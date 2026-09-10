import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { isValidUuid } from '../lib/utils';
import { flushOfflineBreadcrumbs } from '../services/OfflineLocationQueueService';
import { fetchRoadSnappedRoute, getCardinalDirection, calculateBearing } from '../services/RoadRoutingService';
import { smoothTrajectoryPoints, calculateHaversineDistanceMeters } from '../services/LocationSmoothingService';
import { segmentTripsByStops } from '../services/TripSegmentationService';
import AnimatedListDropdown from '../components/AnimatedListDropdown';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';

const geocodeCache: { [key: string]: string } = {};

async function reverseGeocodeFast(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache[cacheKey]) return geocodeCache[cacheKey];

  let addr = `Location • ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const geoPromise = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1800));
    const geoRes: any = await Promise.race([geoPromise, timeoutPromise]).catch(() => null);

    if (geoRes && geoRes.length > 0) {
      const place = geoRes[0];
      const nameParts = [place.name, place.street, place.district || place.subregion || place.city].filter(Boolean);
      if (nameParts.length > 0) addr = nameParts.join(', ');
    }
  } catch (e) {}

  geocodeCache[cacheKey] = addr;
  return addr;
}

interface HistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  rawTimeMs: number;
  speedKmh: number;
  activity: string;
  address?: string;
}

interface StationaryStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: number;
}

function parseEWKBPoint(hex: string): { latitude: number; longitude: number } | null {
  try {
    if (typeof hex !== 'string') return null;
    const cleanHex = hex.trim();
    if (cleanHex.length >= 40) {
      const isLittleEndian = cleanHex.startsWith('0101') || cleanHex.startsWith('01');
      let offset = cleanHex.length >= 50 ? 18 : (cleanHex.length >= 42 ? 10 : 2);

      const lngHex = cleanHex.substr(offset, 16);
      const latHex = cleanHex.substr(offset + 16, 16);

      if (lngHex.length < 16 || latHex.length < 16) return null;

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      const parseHexDouble = (hexStr: string) => {
        for (let i = 0; i < 8; i++) {
          const byte = parseInt(hexStr.substr(i * 2, 2), 16);
          view.setUint8(isLittleEndian ? i : 7 - i, byte);
        }
        return view.getFloat64(0, isLittleEndian);
      };

      const lng = parseHexDouble(lngHex);
      const lat = parseHexDouble(latHex);

      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (e) {}
  return null;
}

function parsePointGeom(geom: any): { latitude: number; longitude: number } | null {
  if (!geom) return null;
  if (typeof geom === 'string') {
    const clean = geom.trim();
    if (clean.startsWith('01') || clean.startsWith('00')) {
      const parsed = parseEWKBPoint(clean);
      if (parsed) return parsed;
    }
    const match = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
    if (match) {
      return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
    }
  } else if (typeof geom === 'object') {
    if (Array.isArray(geom.coordinates)) {
      return { longitude: parseFloat(geom.coordinates[0]), latitude: parseFloat(geom.coordinates[1]) };
    } else if (geom.latitude && geom.longitude) {
      return { latitude: parseFloat(geom.latitude), longitude: parseFloat(geom.longitude) };
    }
  }
  return null;
}

export default function LocationHistoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useThemeStore();
  const { activeCircle, members } = useCircleStore();
  const { profile } = useAuthStore();

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44);

  const webViewRef = useRef<WebView | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday' | '2daysAgo'>('today');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(profile?.id || '');
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [tripLegs, setTripLegs] = useState<any[]>([]);
  const [roadCoords, setRoadCoords] = useState<[number, number][]>([]);
  const [roadBearings, setRoadBearings] = useState<number[]>([]);
  const [stationaryStops, setStationaryStops] = useState<StationaryStop[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 5>(1);

  // Calculated metrics
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [travelDurationMinutes, setTravelDurationMinutes] = useState(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      // If no selection or selected member is not in current circle (and not self), reset strictly to self
      const isMemberInCircle = (members || []).some(m => m.user_id === selectedMemberId);
      if (!selectedMemberId || (!isMemberInCircle && selectedMemberId !== profile.id)) {
        setSelectedMemberId(profile.id);
      }
    } else {
      setSelectedMemberId('');
      setHistoryPoints([]);
    }
  }, [profile?.id, members]);

  useEffect(() => {
    fetchLocationHistory();
  }, [selectedDate, selectedMemberId]);

  const movementEvents = useMemo(() => {
    if (!historyPoints || historyPoints.length === 0) return [];

    const events: { point: HistoryPoint; origIndex: number; stayDuration?: string }[] = [];
    let currentStayStart: HistoryPoint | null = null;
    let currentStayStartIndex = -1;
    let currentStayEnd: HistoryPoint | null = null;
    let stayCount = 0;

    historyPoints.forEach((pt, idx) => {
      const isMoving = pt.speedKmh > 1.5 || pt.activity.toLowerCase().includes('walking') || pt.activity.toLowerCase().includes('driving') || pt.activity.toLowerCase().includes('travel');

      if (isMoving) {
        if (currentStayStart && currentStayEnd && stayCount > 1) {
          const startPt: HistoryPoint = currentStayStart;
          const endPt: HistoryPoint = currentStayEnd;
          const mins = Math.round((endPt.rawTimeMs - startPt.rawTimeMs) / 60000);
          const durationStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} mins`;

          events.push({
            point: {
              ...startPt,
              id: `stay_${startPt.id}`,
              timestamp: `${startPt.timestamp} - ${endPt.timestamp}`,
              activity: `Stationary at Location (${durationStr})`,
              speedKmh: 0,
            },
            origIndex: currentStayStartIndex,
            stayDuration: durationStr,
          });
        }
        currentStayStart = null;
        currentStayEnd = null;
        stayCount = 0;

        events.push({ point: pt, origIndex: idx });
      } else {
        if (!currentStayStart) {
          currentStayStart = pt;
          currentStayStartIndex = idx;
          currentStayEnd = pt;
          stayCount = 1;
        } else {
          currentStayEnd = pt;
          stayCount += 1;
        }
      }
    });

    if (currentStayStart && currentStayEnd) {
      const startPt: HistoryPoint = currentStayStart;
      const endPt: HistoryPoint = currentStayEnd;
      const mins = Math.round((endPt.rawTimeMs - startPt.rawTimeMs) / 60000);
      const durationStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} mins`;

      events.push({
        point: {
          ...startPt,
          id: `stay_${startPt.id}`,
          timestamp: stayCount > 1 ? `${startPt.timestamp} - ${endPt.timestamp}` : startPt.timestamp,
          activity: stayCount > 1 ? `Stationary at Location (${durationStr})` : `Stationary at Location`,
          speedKmh: 0,
        },
        origIndex: currentStayStartIndex,
        stayDuration: stayCount > 1 ? durationStr : undefined,
      });
    }

    return events;
  }, [historyPoints]);

  // Animation Playback Timer
  useEffect(() => {
    let interval: any;
    if (isPlaying && historyPoints.length > 0) {
      interval = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= historyPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, historyPoints.length, playbackSpeed]);

  useEffect(() => {
    updateMapPlaybackPin();
  }, [playbackIndex, historyPoints]);

  const getDateRange = () => {
    const now = new Date();
    const targetDate = new Date();

    if (selectedDate === 'yesterday') {
      targetDate.setDate(now.getDate() - 1);
    } else if (selectedDate === '2daysAgo') {
      targetDate.setDate(now.getDate() - 2);
    }

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return { 
      start: start.toISOString(), 
      end: end.toISOString(), 
      dateLabel: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) 
    };
  };

  const fetchLocationHistory = async () => {
    setLoading(true);
    setIsPlaying(false);
    setPlaybackIndex(0);

    try {
      const { start, end } = getDateRange();
      let targetUserId = selectedMemberId || profile?.id;

      // Strict Enterprise Privacy Boundary:
      // Verify that targetUserId is either self OR an active member in current circle
      const isSelf = targetUserId === profile?.id;
      const isCircleMember = (members || []).some(m => m.user_id === targetUserId);

      if (!isSelf && !isCircleMember) {
        // Alien or previous user ID: enforce boundary to self only
        targetUserId = profile?.id || '';
        if (targetUserId && targetUserId !== selectedMemberId) {
          setSelectedMemberId(targetUserId);
        }
      }

      if (!targetUserId || !isValidUuid(targetUserId)) {
        setHistoryPoints([]);
        setTripLegs([]);
        setRoadCoords([]);
        setRoadBearings([]);
        setStationaryStops([]);
        setTotalDistanceKm(0);
        setTravelDurationMinutes(0);
        setTopSpeedKmh(0);
        setLoading(false);
        return;
      }

      // 1. Gather all raw points from Supabase database
      const rawPoints: {
        id: string;
        lat: number;
        lng: number;
        timeMs: number;
        speed_mps: number | null;
        accuracy?: number;
        recorded_at: string;
      }[] = [];

      const { data, error } = await supabase
        .from('location_history')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: true });

      if (!error && data && data.length > 0) {
        data.forEach((item: any, idx: number) => {
          const coords = parsePointGeom(item.geom) || (item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null);
          if (coords && coords.latitude !== 0 && coords.longitude !== 0 && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
            rawPoints.push({
              id: item.id?.toString() || `db_${idx}`,
              lat: coords.latitude,
              lng: coords.longitude,
              timeMs: new Date(item.recorded_at).getTime(),
              speed_mps: item.speed_mps,
              accuracy: item.accuracy,
              recorded_at: item.recorded_at,
            });
          }
        });
      }

      // 2. Slow Network / Offline Resilience: Read pending local offline buffer from AsyncStorage
      if (selectedDate === 'today') {
        try {
          const offlineRaw = await AsyncStorage.getItem(`@circleguard_offline_breadcrumbs_${targetUserId}`);
          if (offlineRaw) {
            const offlineQueue = JSON.parse(offlineRaw);
            if (Array.isArray(offlineQueue)) {
              for (let i = 0; i < offlineQueue.length; i++) {
                const offItem = offlineQueue[i];
                const coords = offItem.latitude && offItem.longitude 
                  ? { latitude: offItem.latitude, longitude: offItem.longitude }
                  : parsePointGeom(offItem.geom);
                if (coords && coords.latitude !== 0 && coords.longitude !== 0 && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
                  const timeMs = new Date(offItem.recorded_at).getTime();
                  // Avoid duplicate timestamps (< 1.5s)
                  if (!rawPoints.some(p => Math.abs(p.timeMs - timeMs) < 1500)) {
                    rawPoints.push({
                      id: `offline_${i}`,
                      lat: coords.latitude,
                      lng: coords.longitude,
                      timeMs,
                      speed_mps: offItem.speed_mps,
                      accuracy: offItem.accuracy,
                      recorded_at: offItem.recorded_at,
                    });
                  }
                }
              }
            }
          }
          // Asynchronously flush offline queue in background
          flushOfflineBreadcrumbs(targetUserId).catch(() => {});
        } catch (e) {}
      }

      // Sort all points chronologically to guarantee accurate travel direction
      rawPoints.sort((a, b) => a.timeMs - b.timeMs);

      let fetchedPoints: HistoryPoint[] = [];

      if (rawPoints.length > 0) {
        let prevPoint: { lat: number; lng: number; timeMs: number } | null = null;

        for (let idx = 0; idx < rawPoints.length; idx++) {
          const item = rawPoints[idx];
          const timeMs = item.timeMs;

          if (prevPoint) {
            const distMeters = calculateHaversineDistanceMeters(prevPoint.lat, prevPoint.lng, item.lat, item.lng);
            const timeDiffSec = Math.max(0.5, Math.abs(timeMs - prevPoint.timeMs) / 1000);

            // Filter out stationary GPS noise points (< 10 meters AND < 3 minutes gap)
            if (distMeters < 10 && timeDiffSec < 180 && idx < rawPoints.length - 1) {
              continue;
            }

            // Discard impossible teleport speed jumps (> 150 km/h) caused by multipath cell tower jumps
            const impliedKmh = (distMeters / timeDiffSec) * 3.6;
            if (timeDiffSec < 3 && impliedKmh > 150) {
              continue;
            }
          }

          let speed = 0;
          if (item.speed_mps != null && !isNaN(item.speed_mps)) {
            speed = Math.round(item.speed_mps * 3.6);
          } else if (prevPoint) {
            const distMeters = calculateHaversineDistanceMeters(prevPoint.lat, prevPoint.lng, item.lat, item.lng);
            const timeDiffSec = Math.max(0.5, Math.abs(timeMs - prevPoint.timeMs) / 1000);
            if (timeDiffSec > 0) {
              const impliedKmh = (distMeters / timeDiffSec) * 3.6;
              speed = impliedKmh < 2.0 ? 0 : Math.min(130, Math.round(impliedKmh));
            }
          }

          prevPoint = { lat: item.lat, lng: item.lng, timeMs };

          fetchedPoints.push({
            id: item.id,
            latitude: item.lat,
            longitude: item.lng,
            timestamp: new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTimeMs: timeMs,
            speedKmh: speed,
            activity: speed > 18 ? 'Driving / Transit' : speed > 3 ? 'Walking' : 'Stationary',
            address: `Point • ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`,
          });
        }
      }

      if (fetchedPoints.length === 0) {
        setHistoryPoints([]);
        setTripLegs([]);
        setRoadCoords([]);
        setRoadBearings([]);
        setStationaryStops([]);
        setTotalDistanceKm(0);
        setTravelDurationMinutes(0);
        setTopSpeedKmh(0);
        setLoading(false);
        return;
      }

      // Fast async reverse geocode for First (Departure) and Last (Arrival) points only
      try {
        const [firstAddr, lastAddr] = await Promise.all([
          reverseGeocodeFast(fetchedPoints[0].latitude, fetchedPoints[0].longitude),
          reverseGeocodeFast(fetchedPoints[fetchedPoints.length - 1].latitude, fetchedPoints[fetchedPoints.length - 1].longitude),
        ]);
        fetchedPoints[0].address = firstAddr;
        fetchedPoints[fetchedPoints.length - 1].address = lastAddr;
      } catch (e) {}

      // Apply 3-point moving average smoothing to eliminate GPS jitter while keeping the path exact
      fetchedPoints = smoothTrajectoryPoints(fetchedPoints);
      setHistoryPoints(fetchedPoints);

      // Segment trips by stops (> 4 mins)
      const legs = segmentTripsByStops(
        fetchedPoints,
        (p) => p.rawTimeMs,
        (p) => p.latitude,
        (p) => p.longitude,
        4, // 4 mins
        50 // 50 meters
      );

      // Render accurate trajectory coordinates
      let allRoadCoords: [number, number][] = [];
      let allBearings: number[] = [];
      const processedLegs = [];

      for (const leg of legs) {
        const directCoords: [number, number][] = leg.points.map(p => [p.latitude, p.longitude]);
        allRoadCoords = allRoadCoords.concat(directCoords);
        processedLegs.push({
          ...leg,
          roadCoords: directCoords,
        });
      }

      setTripLegs(processedLegs);
      setRoadCoords(allRoadCoords);
      setRoadBearings(allBearings);

      // Compute top speed, travel duration, and cluster stationary stays (>= 5 mins)
      let maxSpd = 0;
      const stops: StationaryStop[] = [];

      if (fetchedPoints.length > 0) {
        fetchedPoints.forEach((pt) => {
          if (pt.speedKmh > maxSpd) maxSpd = pt.speedKmh;
        });

        // Cluster consecutive stationary points
        let currentGroup: HistoryPoint[] = [];

        for (let i = 0; i < fetchedPoints.length; i++) {
          const pt = fetchedPoints[i];
          if (pt.speedKmh === 0 || pt.activity.includes('Stationary')) {
            currentGroup.push(pt);
          } else {
            if (currentGroup.length >= 2) {
              const first = currentGroup[0];
              const last = currentGroup[currentGroup.length - 1];
              const dwellMins = Math.max(5, Math.round((last.rawTimeMs - first.rawTimeMs) / 60000));
              let stopAddr = first.address;
              try {
                stopAddr = await reverseGeocodeFast(first.latitude, first.longitude);
              } catch (e) {}

              stops.push({
                id: `stop_${first.id}`,
                name: stopAddr || 'Recorded Stay Location',
                latitude: first.latitude,
                longitude: first.longitude,
                arrivalTime: first.timestamp,
                departureTime: last.timestamp,
                durationMinutes: dwellMins,
              });
            }
            currentGroup = [];
          }
        }

        if (currentGroup.length >= 2) {
          const first = currentGroup[0];
          const last = currentGroup[currentGroup.length - 1];
          const dwellMins = Math.max(5, Math.round((last.rawTimeMs - first.rawTimeMs) / 60000));
          let stopAddr = first.address;
          try {
            stopAddr = await reverseGeocodeFast(first.latitude, first.longitude);
          } catch (e) {}

          stops.push({
            id: `stop_${first.id}`,
            name: stopAddr || 'Recorded Stay Location',
            latitude: first.latitude,
            longitude: first.longitude,
            arrivalTime: first.timestamp,
            departureTime: last.timestamp,
            durationMinutes: dwellMins,
          });
        }

        // Calculate total authentic trip distance (with stationary drift freeze)
        let totalDist = 0;
        for (let i = 1; i < allRoadCoords.length; i++) {
          const segDist = getHaversineDistKm(allRoadCoords[i - 1][0], allRoadCoords[i - 1][1], allRoadCoords[i][0], allRoadCoords[i][1]);
          // Only accumulate if moved >= 8 meters to eliminate odometer creep
          if (segDist >= 0.008) {
            totalDist += segDist;
          }
        }

        let totalDur = 0;
        if (fetchedPoints.length >= 2) {
          totalDur = Math.max(1, Math.round((fetchedPoints[fetchedPoints.length - 1].rawTimeMs - fetchedPoints[0].rawTimeMs) / 60000));
        }

        setTotalDistanceKm(totalDist > 0 ? parseFloat(totalDist.toFixed(1)) : 0);
        setTopSpeedKmh(maxSpd);
        setTravelDurationMinutes(totalDur > 0 ? totalDur : 0);
        setStationaryStops(stops);
      }
    } catch (err) {
      console.error('Error fetching location history:', err);
    } finally {
      setLoading(false);
    }
  };

  function getHaversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const updateMapPlaybackPin = () => {
    if (historyPoints.length === 0) return;

    const activePt = historyPoints[playbackIndex] || historyPoints[0];
    const totalRoad = roadCoords.length;

    let roadIdx = 0;
    if (totalRoad > 0) {
      const progress = playbackIndex / Math.max(1, historyPoints.length - 1);
      roadIdx = Math.min(Math.floor(progress * (totalRoad - 1)), totalRoad - 1);
    }

    const currentPt = totalRoad > 0 ? roadCoords[roadIdx] : [activePt.latitude, activePt.longitude];
    const bearing = roadBearings[roadIdx] || 0;
    const cardinalDir = getCardinalDirection(bearing);

    const stopCoords = stationaryStops.map(s => ({ lat: s.latitude, lng: s.longitude, name: s.name }));

    const data = {
      tripLegs,
      roadCoords: roadCoords.length > 0 ? roadCoords : historyPoints.map(p => [p.latitude, p.longitude]),
      currentPt,
      bearing,
      cardinalDir,
      currentLabel: `${activePt.timestamp} • ${activePt.speedKmh} km/h • Heading ${cardinalDir} (${Math.round(bearing)}°)`,
      stops: stopCoords,
      isDark,
    };

    if (Platform.OS === 'web') {
      try {
        const iframe = document.getElementById('historyMapIframe') as HTMLIFrameElement | null;
        if (iframe && iframe.contentWindow) {
          const win: any = iframe.contentWindow;
          if (win.renderHistoryMap) {
            win.renderHistoryMap(data);
          } else {
            win.postMessage({ type: 'RENDER_MAP', data }, '*');
          }
        }
      } catch (e) {}
    } else if (webViewRef.current) {
      const jsCode = `
        if (window.renderHistoryMap) {
          window.renderHistoryMap(${JSON.stringify(data)});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet-polylineoffset@1.1.1/leaflet.polylineoffset.js"></script>
        <script src="https://unpkg.com/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js"></script>
        <style>
          body, html, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: ${isDark ? '#0D0E12' : '#F4F5FB'};
            touch-action: none !important;
            -webkit-user-select: none;
            user-select: none;
            overscroll-behavior: none;
          }
          .leaflet-control-attribution { display: none !important; }
          .stop-badge { background: #FF536A; color: #FFFFFF; font-weight: bold; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 10px rgba(255,83,106,0.4); }
          .nav-arrow-container {
            width: 40px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 6px 12px rgba(212, 175, 55, 0.45));
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map, legPolylines = [], legDecorators = [], playerMarker, stopMarkers = [];

          function initMap() {
            var tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
            var fallbackTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
            map = L.map('map', { 
              zoomControl: false, 
              attributionControl: false, 
              preferCanvas: true, 
              dragging: true,
              touchZoom: true,
              scrollWheelZoom: true,
              tap: false,
              zoomAnimation: true, 
              fadeAnimation: true, 
              markerZoomAnimation: true 
            }).setView([13.0827, 80.2707], 14);

            var terrainLayer = L.tileLayer(tileUrl, { maxZoom: 19, keepBuffer: 8, updateWhenIdle: false, updateWhenZooming: false, crossOrigin: true }).addTo(map);
            terrainLayer.on('tileerror', function(e) {
              e.tile.src = fallbackTileUrl.replace('{z}', e.coords.z).replace('{x}', e.coords.x).replace('{y}', e.coords.y);
            });
          }
          initMap();

          window.addEventListener('message', function(event) {
            try {
              var payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (payload && payload.type === 'RENDER_MAP' && payload.data) {
                window.renderHistoryMap(payload.data);
              }
            } catch(e) {}
          });

          window.renderHistoryMap = function(data) {
            if (!map) return;

            stopMarkers.forEach(function(m) { map.removeLayer(m); });
            stopMarkers = [];
            legPolylines.forEach(function(p) { map.removeLayer(p); });
            legPolylines = [];
            legDecorators.forEach(function(d) { map.removeLayer(d); });
            legDecorators = [];

            if (data.tripLegs && data.tripLegs.length > 0) {
              var allBounds = L.latLngBounds();

              data.tripLegs.forEach(function(leg) {
                var isOutbound = leg.isOutbound;
                var color = isOutbound ? '#2E7D5B' : '#E07A5F'; // Sage green for outbound, Warm Peach for return
                var offsetVal = isOutbound ? 4 : -4;

                var coords = leg.roadCoords;
                if (!coords || coords.length === 0) return;

                coords.forEach(function(c) { allBounds.extend(c); });

                var glow = L.polyline(coords, {
                  color: color,
                  weight: 8,
                  opacity: 0.2,
                  lineCap: 'round',
                  lineJoin: 'round',
                  offset: offsetVal
                }).addTo(map);
                legPolylines.push(glow);

                var mainLine = L.polyline(coords, {
                  color: color,
                  weight: 4.5,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                  offset: offsetVal
                }).addTo(map);
                legPolylines.push(mainLine);

                // Add arrows
                var decorator = L.polylineDecorator(mainLine, {
                  patterns: [
                    { offset: 50, repeat: 100, symbol: L.Symbol.arrowHead({ pixelSize: 11, pathOptions: { color: color, fillOpacity: 1, weight: 0 } }) }
                  ]
                }).addTo(map);
                legDecorators.push(decorator);
              });

              map.fitBounds(allBounds, { padding: [40, 40] });

              // Start Sage Green Teardrop Marker
              var startPinSvg = '<div style="filter: drop-shadow(0 4px 8px rgba(46,125,91,0.4));">' +
                '<svg width="34" height="44" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                  '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#2E7D5B"/>' +
                  '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
                '</svg>' +
              '</div>';
              var startIcon = L.divIcon({ className: 'custom-3d-pin', html: startPinSvg, iconSize: [34, 44], iconAnchor: [17, 44] });
              L.marker(data.roadCoords[0], { icon: startIcon }).addTo(map).bindPopup('Start Location');

              // End Warm Peach Teardrop Marker
              var endPinSvg = '<div style="filter: drop-shadow(0 4px 8px rgba(224,122,95,0.4));">' +
                '<svg width="34" height="44" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                  '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#E07A5F"/>' +
                  '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
                '</svg>' +
              '</div>';
              var endIcon = L.divIcon({ className: 'custom-3d-pin', html: endPinSvg, iconSize: [34, 44], iconAnchor: [17, 44] });
              L.marker(data.roadCoords[data.roadCoords.length - 1], { icon: endIcon }).addTo(map).bindPopup('End Destination');

              if (data.stops) {
                data.stops.forEach(function(st, i) {
                  var icon = L.divIcon({ className: 'stop-badge', html: (i+1).toString() });
                  var m = L.marker([st.lat, st.lng], { icon: icon }).addTo(map).bindPopup(st.name);
                  stopMarkers.push(m);
                });
              }
            }

            if (data.currentPt) {
              var bearing = data.bearing || 0;
              var svgHtml = '<div class="nav-arrow-container" style="transform: rotate(' + bearing + 'deg); filter: drop-shadow(0 4px 8px rgba(46,125,91,0.35));">' +
                '<svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                  '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#2E7D5B"/>' +
                  '<ellipse cx="19" cy="19" rx="8" ry="8" fill="#FFFFFF"/>' +
                  '<polygon points="19,13 23,23 19,20 15,23" fill="#E07A5F"/>' +
                '</svg>' +
              '</div>';

              if (!playerMarker) {
                var icon = L.divIcon({ className: 'custom-nav-icon', html: svgHtml, iconSize: [38, 48], iconAnchor: [19, 24] });
                playerMarker = L.marker(data.currentPt, { icon: icon }).addTo(map);
              } else {
                playerMarker.setLatLng(data.currentPt);
                var icon = L.divIcon({ className: 'custom-nav-icon', html: svgHtml, iconSize: [38, 48], iconAnchor: [19, 24] });
                playerMarker.setIcon(icon);
              }
            }
          };
        </script>
      </body>
    </html>
  `;

  const activePoint = historyPoints[playbackIndex] || historyPoints[0];
  const selectedMemberObj = (members || []).find(m => m.user_id === selectedMemberId);
  const selectedMemberName = selectedMemberId === profile?.id ? `${profile?.full_name || 'Me'} (You)` : (selectedMemberObj?.profile?.full_name || 'Member');
  const selectedMemberInitial = selectedMemberName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topInset + 14, paddingBottom: 14 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>LOCATION HISTORY</Text>
          <Text style={[styles.headerSubtitle, { color: colors.accentGold }]}>{getDateRange().dateLabel.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={fetchLocationHistory} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Date & Member Dropdown Control Row */}
      <View style={styles.controlsRow}>
        {/* Date Selector Pills */}
        <View style={[styles.dateSelectorContainer, { backgroundColor: '#E8F5EE', borderColor: '#C6E7D5', flex: 1 }]}>
          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'today' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => setSelectedDate('today')}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.datePillText, { color: selectedDate === 'today' ? '#FFFFFF' : '#2E7D5B' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              TODAY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'yesterday' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => setSelectedDate('yesterday')}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.datePillText, { color: selectedDate === 'yesterday' ? '#FFFFFF' : '#2E7D5B' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              YESTERDAY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === '2daysAgo' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => setSelectedDate('2daysAgo')}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.datePillText, { color: selectedDate === '2daysAgo' ? '#FFFFFF' : '#2E7D5B' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              2 DAYS
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member Selector Dropdown Button */}
        {members && members.length > 0 ? (
          <TouchableOpacity
            style={[styles.memberDropdownBtn, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}
            onPress={() => setMemberPickerVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarCircleMini, { backgroundColor: '#2E7D5B' }]}>
              <Text style={[styles.avatarInitialMini, { color: '#FFFFFF' }]}>{selectedMemberInitial}</Text>
            </View>
            <Text style={[styles.memberDropdownText, { color: colors.foreground }]} numberOfLines={1}>
              {selectedMemberName.split(' ')[0]}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#2E7D5B" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Member Picker Modal */}
      <Modal visible={memberPickerVisible} animationType="fade" transparent onRequestClose={() => setMemberPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMemberPickerVisible(false)}>
          <View style={[styles.modalPickerCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
            <View style={styles.modalPickerHeader}>
              <Text style={[styles.modalPickerTitle, { color: colors.foreground }]}>Select Circle Member</Text>
              <TouchableOpacity onPress={() => setMemberPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <AnimatedListDropdown
              items={(members || []).map((m: any) => {
                const isSel = m.user_id === selectedMemberId;
                const name = m.user_id === profile?.id ? `${profile?.full_name || 'Me'} (You)` : (m.profile?.full_name || 'Member');
                return {
                  id: m.user_id,
                  title: name,
                  subtitle: m.isOnline ? 'Online now' : 'Offline',
                  iconName: 'person-circle-outline',
                  badge: isSel ? 'SELECTED' : undefined,
                  data: m,
                };
              })}
              selectedIndex={(members || []).findIndex((m: any) => m.user_id === selectedMemberId)}
              onItemSelect={(item) => {
                setSelectedMemberId(item.id);
                setMemberPickerVisible(false);
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.centeredLoadingScreen}>
          <LuxuryRadarLoading size={140} message="RETRIEVING LOCATION HISTORY…" />
        </View>
      ) : (
        <>
          {/* Main Map Viewport */}
          <View 
            style={styles.mapViewportWrapper}
            onTouchStart={() => setIsScrollEnabled(false)}
            onTouchEnd={() => setIsScrollEnabled(true)}
            onTouchCancel={() => setIsScrollEnabled(true)}
            onResponderGrant={() => setIsScrollEnabled(false)}
            onResponderRelease={() => setIsScrollEnabled(true)}
            onResponderTerminate={() => setIsScrollEnabled(true)}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setIsScrollEnabled(false),
              onMouseLeave: () => setIsScrollEnabled(true),
            } : {})}
          >
            <View style={[styles.mapContainer, { borderColor: '#EDEBE6' }]}>
              {Platform.OS === 'web' ? (
                <iframe
                  id="historyMapIframe"
                  srcDoc={htmlContent}
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 20 }}
                  onLoad={updateMapPlaybackPin}
                />
              ) : (
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: htmlContent }}
                  style={styles.webView}
                  nestedScrollEnabled={false}
                  scrollEnabled={false}
                  onLoadEnd={updateMapPlaybackPin}
                />
              )}
            </View>

            {/* Docked Playback Control Panel Below Map */}
            {historyPoints.length > 0 ? (
              <View style={[styles.playbackCardDocked, { backgroundColor: colors.surface, borderColor: '#EDEBE6', marginTop: 10, borderRadius: 16, padding: 14, borderWidth: 1 }]}>
                <View style={styles.playbackHeader}>
                  <TouchableOpacity
                    style={[styles.playBtn, { backgroundColor: isPlaying ? '#2E7D5B' : '#E07A5F', borderRadius: 20 }]}
                    onPress={() => setIsPlaying(!isPlaying)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View style={styles.playbackInfo}>
                    <Text style={[styles.playbackTimeText, { color: colors.foreground, fontSize: 13, fontWeight: '700' }]}>
                      {activePoint?.timestamp || '--:--'} • {activePoint?.speedKmh || 0} km/h • {getCardinalDirection(roadBearings[Math.min(Math.floor((playbackIndex / Math.max(1, historyPoints.length - 1)) * Math.max(0, roadCoords.length - 1)), Math.max(0, roadCoords.length - 1))] || 0)}
                    </Text>
                    <Text style={[styles.playbackAddress, { color: colors.textMuted, fontSize: 11 }]} numberOfLines={1}>
                      {activePoint?.address || `${selectedMemberName}'s Waypoint #${playbackIndex + 1}`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.speedBtn, { borderColor: '#2E7D5B', backgroundColor: '#E8F5EE', borderRadius: 12 }]}
                    onPress={() => setPlaybackSpeed(prev => (prev === 1 ? 2 : prev === 2 ? 5 : 1))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.speedBtnText, { color: '#2E7D5B', fontWeight: '800' }]}>{playbackSpeed}x</Text>
                  </TouchableOpacity>
                </View>

                {/* Scrubber Progress Bar */}
                <View style={[styles.scrubberTrack, { marginTop: 10, backgroundColor: '#EDEBE6' }]}>
                  <View
                    style={[
                      styles.scrubberFill,
                      {
                        backgroundColor: '#2E7D5B',
                        width: `${((playbackIndex + 1) / historyPoints.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {/* Daily Metrics & Movement Timeline */}
          <ScrollView 
            style={styles.metricsScroll} 
            contentContainerStyle={styles.metricsContent} 
            showsVerticalScrollIndicator={false}
            scrollEnabled={isScrollEnabled}
            nestedScrollEnabled={true}
          >
            {/* Metric Cards Grid */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="navigate-outline" size={18} color="#2E7D5B" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{typeof totalDistanceKm === 'number' ? totalDistanceKm.toFixed(1) : totalDistanceKm} km</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>TOTAL DISTANCE</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="stopwatch-outline" size={18} color="#E07A5F" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{Math.floor(travelDurationMinutes / 60)}h {travelDurationMinutes % 60}m</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>TRAVEL TIME</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="speedometer-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{topSpeedKmh} km/h</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>TOP SPEED</Text>
              </View>
            </View>

            {/* Stationary Stops */}
            {stationaryStops.length > 0 ? (
              <>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>STATIONARY STOPS ({stationaryStops.length})</Text>
                  <View style={[styles.accentLine, { backgroundColor: '#EDEBE6' }]} />
                </View>

                {stationaryStops.map((stop, idx) => (
                  <View key={stop.id} style={[styles.stopItemCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                    <View style={[styles.stopNumberBadge, { backgroundColor: '#E07A5F' }]}>
                      <Text style={[styles.stopNumberText, { color: '#FFFFFF' }]}>{idx + 1}</Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={[styles.stopName, { color: colors.foreground }]}>{stop.name}</Text>
                      <Text style={[styles.stopMeta, { color: colors.textMuted }]}>
                        Dwell Time: {stop.durationMinutes} mins • Arrived at {stop.arrivalTime}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {/* Travel & Movement Timeline */}
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>TRAVEL & MOVEMENT TIMELINE ({movementEvents.length})</Text>
              <View style={[styles.accentLine, { backgroundColor: '#EDEBE6' }]} />
            </View>

            {movementEvents.length === 0 ? (
              <View style={{
                padding: 24,
                borderRadius: 16,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: '#EDEBE6',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 12,
              }}>
                <Ionicons name="map-outline" size={32} color="#2E7D5B" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.foreground, letterSpacing: 1, marginTop: 10 }}>NO TRAVEL LOGGED FOR THIS DATE</Text>
                <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 16 }}>
                  No authentic travel or movement recorded for the selected date. Authentic GPS tracking is active.
                </Text>
              </View>
            ) : (
              movementEvents.map(({ point: pt, origIndex }, idx) => {
                const isSelected = origIndex === playbackIndex;
                const isStationary = pt.speedKmh <= 1.5 && !pt.activity.toLowerCase().includes('walking') && !pt.activity.toLowerCase().includes('driving');

                return (
                  <TouchableOpacity
                    key={`${pt.id}_${idx}`}
                    style={[
                      styles.historyRow,
                      {
                        backgroundColor: isSelected ? '#E8F5EE' : colors.surface,
                        borderColor: isSelected ? '#2E7D5B' : '#EDEBE6',
                      },
                    ]}
                    onPress={() => {
                      setPlaybackIndex(origIndex);
                      setIsPlaying(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.historyDot, { backgroundColor: pt.speedKmh > 50 ? '#EF4444' : pt.speedKmh > 1.5 ? '#2E7D5B' : (isStationary ? '#E07A5F' : '#2E7D5B') }]} />
                    <View style={styles.historyDetails}>
                      <Text style={[styles.historyTime, { color: colors.foreground }]}>{pt.timestamp}</Text>
                      <Text style={[styles.historyDesc, { color: colors.textMuted }]}>
                        {pt.activity} {pt.speedKmh > 0 ? `• ${pt.speedKmh} km/h` : ''} • {pt.address || 'Location Area'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredLoadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  datePill: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePillActive: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  datePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  memberDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: 120,
  },
  avatarCircleMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialMini: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  memberDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalPickerCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    elevation: 10,
  },
  modalPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalPickerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  memberPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  memberPickerName: {
    fontSize: 13,
  },
  mapViewportWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mapContainer: {
    height: 320,
    width: '100%',
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  webView: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  playbackCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  playbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  playbackInfo: {
    flex: 1,
  },
  playbackTimeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  playbackAddress: {
    fontSize: 11,
    marginTop: 2,
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  playbackCardDocked: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrubberTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricsScroll: {
    flex: 1,
  },
  metricsContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  accentLine: {
    flex: 1,
    height: 1,
  },
  stopItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  stopNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumberText: {
    color: '#1A1A1A',
    fontWeight: '800',
    fontSize: 12,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '700',
  },
  stopMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyDetails: {
    flex: 1,
  },
  historyTime: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});
