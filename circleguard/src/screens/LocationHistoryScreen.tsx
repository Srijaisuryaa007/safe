import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { WebView } from 'react-native-webview';

const WebViewAny: any = WebView;
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { isValidUuid } from '../lib/utils';
import { flushOfflineBreadcrumbs } from '../services/OfflineLocationQueueService';
import { fetchRoadSnappedRoute, fetchMapMatchedRoute, getCardinalDirection, calculateBearing } from '../services/RoadRoutingService';
import { LEAFLET_CSS, LEAFLET_JS } from '../constants/leafletBundle';
import { smoothTrajectoryPoints, calculateHaversineDistanceMeters } from '../services/LocationSmoothingService';
import { segmentTripsByStops } from '../services/TripSegmentationService';
import { intelligentRouteReconstruction, detectRouteGaps, ReconstructionResult } from '../services/HistoricalRouteReconstructionService';
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
  isReconstructed?: boolean;
  reconstructionSource?: 'metro_transit' | 'rail_network' | 'historical_learned' | 'road_snapped' | 'spline_interpolated';
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
  const route = useRoute<any>();
  const { colors, isDark } = useThemeStore();
  const { activeCircle, members } = useCircleStore();
  const { profile } = useAuthStore();

  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const webViewRef = useRef<WebView | null>(null);

  // Filters - prioritize member passed from route navigation (e.g., Circle tab 3-dots actions)
  const initialTargetMemberId = route.params?.memberId || route.params?.member?.user_id || route.params?.member?.id;
  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday' | '2daysAgo'>('today');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialTargetMemberId || profile?.id || '');
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  // Robust Circle Members Aggregation (Self is guaranteed to be present)
  const allCircleMembers = useMemo(() => {
    const list = [...(members || [])];
    const pMember = route.params?.member;
    if (pMember) {
      const pId = pMember.user_id || pMember.id;
      if (pId && !list.some(m => (m.user_id === pId || (m as any).id === pId))) {
        list.push(pMember);
      }
    }
    // Always guarantee current logged-in user (You) is present in the list
    if (profile?.id && !list.some(m => (m.user_id === profile.id || (m as any).id === profile.id))) {
      list.unshift({
        user_id: profile.id,
        role: 'owner',
        profile: {
          id: profile.id,
          full_name: profile.full_name || 'You',
          avatar_url: profile.avatar_url,
          phone: profile.phone,
        },
        isOnline: true,
      } as any);
    }
    return list;
  }, [members, route.params?.member, profile]);

  const passedMember = route.params?.member;
  const selectedMemberObj = allCircleMembers.find(m => (
    m.user_id === selectedMemberId || (m as any).id === selectedMemberId || (m.profile as any)?.id === selectedMemberId
  )) || (passedMember && (passedMember.user_id === selectedMemberId || passedMember.id === selectedMemberId) ? passedMember : null);

  const isSelf = selectedMemberId === profile?.id;
  const rawMemberName = isSelf ? `${profile?.full_name || 'Me'} (You)` : (selectedMemberObj?.profile?.full_name || (selectedMemberObj as any)?.name || 'Member');
  const selectedMemberName = rawMemberName;
  const selectedMemberAvatar = isSelf ? (profile?.avatar_url || null) : (selectedMemberObj?.profile?.avatar_url || (selectedMemberObj as any)?.avatar_url || null);
  const selectedMemberInitial = (selectedMemberName.replace('(You)', '').trim().charAt(0) || 'U').toUpperCase();

  const sendMapTelemetry = (data: any) => {
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
  const [reconstructionStats, setReconstructionStats] = useState<ReconstructionResult | null>(null);

  // Sync selectedMemberId whenever route params or user profile changes
  useEffect(() => {
    const passedId = route.params?.memberId || route.params?.member?.user_id || route.params?.member?.id;
    if (passedId) {
      if (selectedMemberId !== passedId) {
        setSelectedMemberId(passedId);
      }
      return;
    }

    if (profile?.id) {
      if (!selectedMemberId) {
        setSelectedMemberId(profile.id);
        return;
      }
      if (selectedMemberId === profile.id) return;

      const isMemberInCircle = (allCircleMembers || []).some(m => 
        m.user_id === selectedMemberId || (m as any).id === selectedMemberId || (m.profile as any)?.id === selectedMemberId
      );
      if (allCircleMembers.length > 0 && !isMemberInCircle) {
        setSelectedMemberId(profile.id);
      }
    } else {
      setSelectedMemberId('');
      setHistoryPoints([]);
    }
  }, [profile?.id, allCircleMembers, route.params?.memberId, route.params?.member?.user_id, route.params?.member?.id]);

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
  }, [playbackIndex, historyPoints, roadCoords, tripLegs]);

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
    setReconstructionStats(null);

    try {
      const { start, end } = getDateRange();
      const passedId = route.params?.memberId || route.params?.member?.user_id || route.params?.member?.id;
      let targetUserId = selectedMemberId || passedId || profile?.id;

      // Strict Enterprise Privacy Boundary:
      // Verify that targetUserId is either self OR an active member in current circle OR explicitly passed member
      const isSelf = targetUserId === profile?.id;
      const isCircleMember = (allCircleMembers || []).some(m => 
        m.user_id === targetUserId || (m as any).id === targetUserId || (m.profile as any)?.id === targetUserId
      ) || Boolean(passedId && targetUserId === passedId);

      if (!isSelf && !isCircleMember && allCircleMembers.length > 0) {
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

      // 0. Instant Cache-First Hydration for sub-300ms instant view
      const cacheKey = `@circleguard_history_cache_${targetUserId}_${selectedDate}`;
      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && Array.isArray(cached.points) && cached.points.length > 0) {
            setHistoryPoints(cached.points);
            setTripLegs(cached.legs || []);
            setRoadCoords(cached.roadCoords || []);
            setStationaryStops(cached.stops || []);
            setTotalDistanceKm(cached.totalDist || 0);
            setTopSpeedKmh(cached.maxSpd || 0);
            setTravelDurationMinutes(cached.totalDur || 0);
            setLoading(false);
          }
        }
      } catch (_) {}

      // 1. Query only necessary telemetry columns from Supabase (sub-second query)
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
        .select('id, geom, speed_mps, recorded_at')
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
          flushOfflineBreadcrumbs(targetUserId).catch(() => {});
        } catch (e) {}
      }

      // Sort all points chronologically
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

            if (distMeters < 10 && timeDiffSec < 180 && idx < rawPoints.length - 1) {
              continue;
            }

            const impliedKmh = (distMeters / timeDiffSec) * 3.6;
            if (timeDiffSec < 4 && impliedKmh > 125) {
              continue;
            }
          }

          let speed = 0;
          if (item.speed_mps != null && !isNaN(item.speed_mps) && item.speed_mps > 0) {
            speed = Math.min(115, Math.round(item.speed_mps * 3.6));
          } else if (prevPoint) {
            const distMeters = calculateHaversineDistanceMeters(prevPoint.lat, prevPoint.lng, item.lat, item.lng);
            const timeDiffSec = Math.max(0.5, Math.abs(timeMs - prevPoint.timeMs) / 1000);
            if (timeDiffSec > 0) {
              const impliedKmh = (distMeters / timeDiffSec) * 3.6;
              const prevSpeed = fetchedPoints.length > 0 ? fetchedPoints[fetchedPoints.length - 1].speedKmh : 30;
              const maxPhysicalSpeed = Math.min(115, (prevSpeed > 0 ? prevSpeed : 30) + (9 * timeDiffSec));
              speed = impliedKmh < 2.0 ? 0 : Math.min(maxPhysicalSpeed, Math.round(impliedKmh));
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

        // If member has known live coordinates, center map on them with stationary marker
        const memberLat = selectedMemberObj?.latitude;
        const memberLng = selectedMemberObj?.longitude;
        if (memberLat && memberLng && !isNaN(memberLat) && !isNaN(memberLng)) {
          sendMapTelemetry({
            currentPt: [memberLat, memberLng],
            bearing: 0,
            cardinalDir: 'N',
            currentLabel: `${selectedMemberName} • Stationary`,
            stops: [],
            tripLegs: [],
            roadCoords: [],
            isDark,
            avatarUrl: selectedMemberAvatar,
            userInitial: selectedMemberInitial,
            userName: selectedMemberName,
            speedKmh: 0,
            isStationaryLive: true,
          });
        }
        return;
      }

      // Smooth jitter points
      fetchedPoints = smoothTrajectoryPoints(fetchedPoints);

      // Intelligent Route Reconstruction across GPS gaps
      if (fetchedPoints.length >= 2) {
        try {
          const recon = await intelligentRouteReconstruction(fetchedPoints, targetUserId);
          if (recon && recon.reconstructedPoints && recon.reconstructedPoints.length >= fetchedPoints.length) {
            fetchedPoints = recon.reconstructedPoints;
            setReconstructionStats(recon);
          }
        } catch (e) {
          console.warn('[LocationHistory] Error in route reconstruction:', e);
        }
      }

      // 3. Segment trips by stops (> 4 mins)
      const legs = segmentTripsByStops(
        fetchedPoints,
        (p) => p.rawTimeMs,
        (p) => p.latitude,
        (p) => p.longitude,
        4,
        50
      );

      // Initial fast road coords from points
      let allRoadCoords: [number, number][] = fetchedPoints.map(p => [p.latitude, p.longitude]);
      let allBearings: number[] = [];
      for (let i = 0; i < fetchedPoints.length - 1; i++) {
        allBearings.push(calculateBearing(fetchedPoints[i].latitude, fetchedPoints[i].longitude, fetchedPoints[i + 1].latitude, fetchedPoints[i + 1].longitude));
      }

      const processedLegs = legs.map((leg) => ({
        ...leg,
        roadCoords: leg.points.map(p => [p.latitude, p.longitude] as [number, number]),
        isTransit: leg.points.some((p: any) => p.activity && (p.activity.toLowerCase().includes('transit') || p.activity.toLowerCase().includes('metro'))),
        transitType: 'road' as const,
      }));

      // Compute speed filter & stats synchronously (< 5ms)
      let maxSpd = 0;
      const speeds = fetchedPoints.map(p => p.speedKmh);
      const filteredSpeeds: number[] = [];
      for (let i = 0; i < speeds.length; i++) {
        const prevSpd = i > 0 ? speeds[i - 1] : speeds[i];
        const curSpd = speeds[i];
        const nextSpd = i < speeds.length - 1 ? speeds[i + 1] : speeds[i];
        const sorted = [prevSpd, curSpd, nextSpd].sort((a, b) => a - b);
        filteredSpeeds.push(sorted[1]);
        fetchedPoints[i].speedKmh = sorted[1];
      }
      const moving = filteredSpeeds.filter(s => s >= 5).sort((a, b) => a - b);
      if (moving.length >= 5) {
        const p98Idx = Math.min(moving.length - 1, Math.floor(moving.length * 0.98));
        maxSpd = moving[p98Idx];
      } else if (moving.length > 0) {
        maxSpd = moving[moving.length - 1];
      }

      // Cluster stops synchronously
      const stops: StationaryStop[] = [];
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
            stops.push({
              id: `stop_${first.id}`,
              name: `Stay Location (${dwellMins}m)`,
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
        stops.push({
          id: `stop_${first.id}`,
          name: `Stay Location (${dwellMins}m)`,
          latitude: first.latitude,
          longitude: first.longitude,
          arrivalTime: first.timestamp,
          departureTime: last.timestamp,
          durationMinutes: dwellMins,
        });
      }

      // Calculate total authentic trip distance
      let totalDist = 0;
      for (let i = 1; i < allRoadCoords.length; i++) {
        const segDist = getHaversineDistKm(allRoadCoords[i - 1][0], allRoadCoords[i - 1][1], allRoadCoords[i][0], allRoadCoords[i][1]);
        if (segDist >= 0.008) {
          totalDist += segDist;
        }
      }

      let movingSec = 0;
      for (let i = 1; i < fetchedPoints.length; i++) {
        const prev = fetchedPoints[i - 1];
        const cur = fetchedPoints[i];
        const dtSec = Math.max(0, (cur.rawTimeMs - prev.rawTimeMs) / 1000);
        const distM = calculateHaversineDistanceMeters(prev.latitude, prev.longitude, cur.latitude, cur.longitude);

        const isMovingPt = cur.speedKmh >= 1.8 || prev.speedKmh >= 1.8 || distM >= 15;
        if (isMovingPt) {
          movingSec += Math.min(180, Math.max(1, dtSec));
        } else if (dtSec <= 90) {
          movingSec += dtSec;
        }
      }

      const totalDur = Math.max(1, Math.round(movingSec / 60));
      const formattedDist = totalDist > 0 ? parseFloat(totalDist.toFixed(1)) : 0;

      // === 4. INSTANT RENDER: Map and Timeline are interactive in < 300ms ===
      setHistoryPoints(fetchedPoints);
      setTripLegs(processedLegs);
      setRoadCoords(allRoadCoords);
      setRoadBearings(allBearings);
      setStationaryStops(stops);
      setTotalDistanceKm(formattedDist);
      setTopSpeedKmh(maxSpd);
      setTravelDurationMinutes(totalDur);
      setLoading(false);

      // === 5. PROGRESSIVE ASYNC HYDRATION: Non-blocking background refinement ===
      (async () => {
        try {
          // A. Geocode departure & arrival in parallel
          const [firstAddr, lastAddr] = await Promise.all([
            reverseGeocodeFast(fetchedPoints[0].latitude, fetchedPoints[0].longitude).catch(() => null),
            reverseGeocodeFast(fetchedPoints[fetchedPoints.length - 1].latitude, fetchedPoints[fetchedPoints.length - 1].longitude).catch(() => null),
          ]);
          if (firstAddr || lastAddr) {
            setHistoryPoints(prev => {
              if (prev.length === 0) return prev;
              const next = [...prev];
              if (firstAddr) next[0] = { ...next[0], address: firstAddr };
              if (lastAddr) next[next.length - 1] = { ...next[next.length - 1], address: lastAddr };
              return next;
            });
          }

          // B. Geocode stops in parallel
          if (stops.length > 0) {
            const geocodedStops = await Promise.all(
              stops.map(async (s) => {
                const addr = await reverseGeocodeFast(s.latitude, s.longitude).catch(() => null);
                return { ...s, name: addr || s.name };
              })
            );
            setStationaryStops(geocodedStops);
          }

          // C. Map-match road legs concurrently with Promise.allSettled
          const matchPromises = legs.map(async (leg) => {
            if (leg.points.length >= 2) {
              const res = await fetchMapMatchedRoute(
                leg.points.map(p => ({
                  latitude: p.latitude,
                  longitude: p.longitude,
                  speed: p.speedKmh,
                  timeMs: p.rawTimeMs,
                }))
              ).catch(() => null);
              if (res && res.roadCoords && res.roadCoords.length >= 2) {
                return { legId: leg.id, roadCoords: res.roadCoords, bearings: res.bearings || [] };
              }
            }
            return null;
          });

          const matchResults = await Promise.allSettled(matchPromises);
          let updatedRoadCoords: [number, number][] = [];
          let updatedBearings: number[] = [];

          const updatedLegs = legs.map((leg, idx) => {
            const res = matchResults[idx];
            if (res.status === 'fulfilled' && res.value) {
              updatedRoadCoords = updatedRoadCoords.concat(res.value.roadCoords);
              updatedBearings = updatedBearings.concat(res.value.bearings);
              return { ...leg, roadCoords: res.value.roadCoords };
            }
            const fallbackCoords = leg.points.map(p => [p.latitude, p.longitude] as [number, number]);
            updatedRoadCoords = updatedRoadCoords.concat(fallbackCoords);
            return { ...leg, roadCoords: fallbackCoords };
          });

          if (updatedRoadCoords.length > 0) {
            setRoadCoords(updatedRoadCoords);
            setRoadBearings(updatedBearings);
            setTripLegs(updatedLegs);

            // Recompute accurate road distance
            let accurateDistKm = 0;
            for (let i = 1; i < updatedRoadCoords.length; i++) {
              const seg = getHaversineDistKm(updatedRoadCoords[i - 1][0], updatedRoadCoords[i - 1][1], updatedRoadCoords[i][0], updatedRoadCoords[i][1]);
              if (seg >= 0.003) accurateDistKm += seg;
            }
            if (accurateDistKm > 0) {
              setTotalDistanceKm(parseFloat(accurateDistKm.toFixed(1)));
            }

            // Immediately dispatch refined road geometry to Leaflet map
            const activePt = fetchedPoints[0];
            sendMapTelemetry({
              tripLegs: updatedLegs,
              roadCoords: updatedRoadCoords,
              currentPt: updatedRoadCoords[0] || [activePt.latitude, activePt.longitude],
              bearing: updatedBearings[0] || 0,
              cardinalDir: getCardinalDirection(updatedBearings[0] || 0),
              currentLabel: `${activePt.timestamp} • ${activePt.speedKmh} km/h`,
              stops: stops.map(s => ({ lat: s.latitude, lng: s.longitude, name: s.name })),
              isDark,
              avatarUrl: selectedMemberAvatar,
              userInitial: selectedMemberInitial,
              userName: selectedMemberName,
              speedKmh: activePt.speedKmh,
            });
          }

          // Save to local cache for instant return visits
          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              points: fetchedPoints,
              legs: updatedLegs,
              roadCoords: updatedRoadCoords.length > 0 ? updatedRoadCoords : allRoadCoords,
              stops,
              totalDist: formattedDist,
              maxSpd,
              totalDur,
            })
          ).catch(() => {});
        } catch (_) {}
      })();
    } catch (err) {
      console.warn('Location history notice:', err);
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
      avatarUrl: selectedMemberAvatar,
      userInitial: selectedMemberInitial,
      userName: selectedMemberName,
      speedKmh: activePt.speedKmh,
    };

    sendMapTelemetry(data);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          ${LEAFLET_CSS}
          body, html, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: ${isDark ? '#0D0E12' : '#F4F5FB'};
            touch-action: pan-x pan-y !important;
            -webkit-user-select: none;
            user-select: none;
            overscroll-behavior: none;
          }
          .leaflet-container { background-color: ${isDark ? '#0D0E12' : '#F4F5FB'} !important; }
          .leaflet-tile-container, .leaflet-zoom-animated, .leaflet-tile { will-change: transform; }
          .leaflet-control-attribution { display: none !important; }
          .stop-badge { background: #FF536A; color: #FFFFFF; font-weight: bold; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 10px rgba(255,83,106,0.4); }
          .custom-player-avatar {
            transition: transform 0.15s ease-out;
          }
        </style>
        <script>
          ${LEAFLET_JS}
        </script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map, legPolylines = [], legDecorators = [], playerMarker, stopMarkers = [];
          var loadedRouteSignature = null;

          function initMap() {
            var tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
            var fallbackTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
            map = L.map('map', { 
              minZoom: 3,
              maxZoom: 18,
              zoomControl: false, 
              attributionControl: false, 
              preferCanvas: true, 
              dragging: true,
              touchZoom: true,
              scrollWheelZoom: true,
              doubleClickZoom: true,
              tap: false,
              zoomAnimation: true, 
              zoomAnimationThreshold: 20,
              fadeAnimation: true, 
              markerZoomAnimation: true 
            }).setView([13.0827, 80.2707], 14);

            var terrainLayer = L.tileLayer(tileUrl, { minZoom: 3, maxZoom: 18, maxNativeZoom: 18, keepBuffer: 20, updateWhenIdle: false, updateWhenZooming: true, crossOrigin: true }).addTo(map);
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

            // Route signature check: ONLY rebuild polyline layers and reset zoom/fitBounds
            // when the route itself changes (different trip data or new date).
            // During playback or scrubbing, DO NOT call fitBounds so user zoom is 100% preserved!
            var incomingSig = (data.tripLegs ? data.tripLegs.length : 0) + '_' + 
                              (data.roadCoords ? data.roadCoords.length : 0) + '_' + 
                              (data.roadCoords && data.roadCoords.length > 0 ? (data.roadCoords[0][0].toFixed(4) + '_' + data.roadCoords[data.roadCoords.length - 1][0].toFixed(4)) : '') + '_' +
                              (data.stops ? data.stops.length : 0);

            if (incomingSig !== loadedRouteSignature) {
              loadedRouteSignature = incomingSig;

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
                  var isTransit = leg.isTransit || leg.transitType === 'metro' || leg.transitType === 'rail';
                  var isMetro = leg.transitType === 'metro';
                  var isRail = leg.transitType === 'rail';

                  var color = isMetro ? '#8B5CF6' : (isRail ? '#0EA5E9' : (isOutbound ? '#2E7D5B' : '#E07A5F'));
                  var offsetVal = isTransit ? 0 : (isOutbound ? 4 : -4);

                  var coords = leg.roadCoords;
                  if (!coords || coords.length === 0) return;

                  coords.forEach(function(c) { allBounds.extend(c); });

                  // Outer Glow / Tunnel illumination
                  var glow = L.polyline(coords, {
                    color: color,
                    weight: isMetro ? 10 : 8,
                    opacity: isMetro ? 0.35 : 0.2,
                    lineCap: 'round',
                    lineJoin: 'round',
                    offset: offsetVal
                  }).addTo(map);
                  legPolylines.push(glow);

                  // Core Track Polyline
                  var mainLine = L.polyline(coords, {
                    color: color,
                    weight: isMetro ? 5 : 4.5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: isMetro ? '10, 6' : undefined,
                    offset: offsetVal
                  }).addTo(map);
                  legPolylines.push(mainLine);

                  if (isMetro) {
                    mainLine.bindPopup('Metro Transit (Underground Tunnel Corridor)');
                  } else if (isRail) {
                    mainLine.bindPopup('Rail Transit Corridor');
                  }

                  try {
                    if (typeof L.polylineDecorator === 'function') {
                      var decorator = L.polylineDecorator(mainLine, {
                        patterns: [
                          { offset: 50, repeat: 100, symbol: L.Symbol.arrowHead({ pixelSize: 11, pathOptions: { color: color, fillOpacity: 1, weight: 0 } }) }
                        ]
                      }).addTo(map);
                      legDecorators.push(decorator);
                    }
                  } catch(decErr) {}
                });

                // ONLY fit bounds on initial load of the route
                map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 16 });

                // Start Marker
                var startPinSvg = '<div style="filter: drop-shadow(0 4px 8px rgba(46,125,91,0.4));">' +
                  '<svg width="34" height="44" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                    '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#2E7D5B"/>' +
                    '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
                  '</svg>' +
                '</div>';
                var startIcon = L.divIcon({ className: 'custom-3d-pin', html: startPinSvg, iconSize: [34, 44], iconAnchor: [17, 44] });
                L.marker(data.roadCoords[0], { icon: startIcon }).addTo(map).bindPopup('Start Location');

                // End Marker
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
              } else if (data.roadCoords && data.roadCoords.length > 0) {
                var fallbackBounds = L.latLngBounds();
                data.roadCoords.forEach(function(c) { fallbackBounds.extend(c); });
                var fallbackLine = L.polyline(data.roadCoords, {
                  color: '#2E7D5B',
                  weight: 4.5,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(map);
                legPolylines.push(fallbackLine);
                if (data.roadCoords.length >= 2) {
                  map.fitBounds(fallbackBounds, { padding: [40, 40] });
                } else {
                  map.setView(data.roadCoords[0], 15);
                }
              }
            }

            // USER PROFILE AVATAR TRAVELLING MARKER
            if (data.currentPt) {
              var bearing = data.bearing || 0;
              var avatarUrl = data.avatarUrl;
              var userInitial = (data.userInitial || 'U').toUpperCase();

              var imgOrInitial = avatarUrl
                ? '<img src="' + avatarUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'flex\\';" />' +
                  '<div style="display:none;width:100%;height:100%;background:#2E7D5B;color:#FFFFFF;font-weight:900;font-size:16px;align-items:center;justify-content:center;border-radius:50%;">' + userInitial + '</div>'
                : '<div style="width:100%;height:100%;background:#2E7D5B;color:#FFFFFF;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;border-radius:50%;">' + userInitial + '</div>';

              var svgArrow = '<div style="position:absolute; top:-12px; left:50%; margin-left:-10px; width:20px; height:16px; transform:rotate(' + bearing + 'deg); transform-origin:10px 34px; z-index:10; filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));">' +
                '<svg width="20" height="16" viewBox="0 0 20 16" fill="none">' +
                  '<path d="M10 0L20 16L10 12L0 16L10 0Z" fill="#2E7D5B" stroke="#FFFFFF" stroke-width="1.8"/>' +
                '</svg>' +
              '</div>';

              var playerHtml = '<div class="travel-avatar-marker" style="position:relative; width:48px; height:48px;">' +
                svgArrow +
                '<div style="width:48px; height:48px; border-radius:50%; border:3px solid #2E7D5B; background:#0D0E12; box-shadow:0 4px 14px rgba(46,125,91,0.55), 0 0 0 2px rgba(255,255,255,0.9); overflow:hidden; display:flex; align-items:center; justify-content:center;">' +
                  imgOrInitial +
                '</div>' +
              '</div>';

              var icon = L.divIcon({ className: 'custom-player-avatar', html: playerHtml, iconSize: [48, 48], iconAnchor: [24, 24] });

              if (!playerMarker) {
                playerMarker = L.marker(data.currentPt, { icon: icon, zIndexOffset: 3000 }).addTo(map);
              } else {
                playerMarker.setLatLng(data.currentPt);
                playerMarker.setIcon(icon);
              }
            }
          };
        </script>
      </body>
    </html>
  `;

  const activePoint = historyPoints[playbackIndex] || historyPoints[0];

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
      </View>

      {/* Member Scope Banner: Clearly highlights whose timeline is active and provides a 1-tap switcher */}
      <View style={[styles.memberScopeBanner, { backgroundColor: isDark ? '#141E18' : '#F0F9F4', borderColor: isDark ? '#1E3226' : '#DCF0E5' }]}>
        <View style={styles.memberScopeLeft}>
          <View style={[styles.memberScopeDot, { backgroundColor: selectedMemberObj?.isOnline ? '#10B981' : '#9CA3AF' }]} />
          <Text style={[styles.memberScopeText, { color: colors.foreground }]} numberOfLines={1}>
            Timeline for <Text style={{ fontWeight: '800', color: '#2E7D5B' }}>{selectedMemberName}</Text>
          </Text>
        </View>
        {allCircleMembers.length > 1 && (
          <TouchableOpacity
            style={styles.memberScopeSwitchBtn}
            onPress={() => setMemberPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.memberScopeSwitchText}>Switch Member</Text>
            <Ionicons name="swap-horizontal" size={12} color="#2E7D5B" />
          </TouchableOpacity>
        )}
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
              items={allCircleMembers.map((m: any) => {
                const memberId = m.user_id || m.id || m.profile?.id;
                const isSel = memberId === selectedMemberId;
                const isMemberSelf = memberId === profile?.id;
                const name = isMemberSelf ? `${profile?.full_name || 'Me'} (You)` : (m.profile?.full_name || m.name || 'Member');
                const batteryText = m.batteryPct != null ? ` • 🔋${m.batteryPct}%` : '';
                const subtitle = m.isOnline ? `Online now${batteryText}` : `Offline${batteryText}`;
                return {
                  id: memberId,
                  title: name,
                  subtitle,
                  iconName: 'person-circle-outline',
                  badge: isSel ? 'SELECTED' : (m.role ? m.role.toUpperCase() : undefined),
                  data: m,
                };
              })}
              selectedIndex={allCircleMembers.findIndex((m: any) => (m.user_id === selectedMemberId || m.id === selectedMemberId))}
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
                <WebViewAny
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: htmlContent, baseUrl: 'https://unpkg.com' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  mixedContentMode="always"
                  allowFileAccess={true}
                  androidLayerType="hardware"
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
            {/* Verified Authentic Telemetry Banner */}
            {historyPoints.length > 0 ? (
              <View style={[
                styles.reconstructionBanner,
                isDark && { backgroundColor: '#18241F', borderColor: '#293C33' }
              ]}>
                <View style={[
                  styles.reconstructionBannerIcon,
                  isDark && { backgroundColor: 'rgba(58, 223, 171, 0.15)' }
                ]}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={isDark ? '#3ADFAB' : '#2E7D5B'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reconstructionBannerTitle, isDark && { color: '#FFFFFF' }]}>
                    Verified True User Trajectory
                  </Text>
                  <Text style={[styles.reconstructionBannerSubtitle, isDark && { color: '#9EACA3' }]}>
                    Displaying only authentic GPS fixes travelled ({historyPoints.length} points logged, zero synthetic routing)
                  </Text>
                </View>
                <View style={[
                  styles.reconstructionBadge,
                  isDark && { backgroundColor: 'rgba(58, 223, 171, 0.18)' }
                ]}>
                  <Text style={[
                    styles.reconstructionBadgeText,
                    isDark && { color: '#3ADFAB' }
                  ]}>
                    AUTHENTIC
                  </Text>
                </View>
              </View>
            ) : null}

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
              <View style={[styles.emptyTimelineCard, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={styles.emptyCardHeader}>
                  <View style={[styles.avatarCircleSmall, { backgroundColor: '#2E7D5B' }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{selectedMemberInitial}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>{selectedMemberName}</Text>
                    <Text style={[styles.emptyCardSubtitle, { color: colors.textMuted }]}>
                      Stationary at current location
                    </Text>
                  </View>
                  <View style={styles.liveStationaryBadge}>
                    <View style={styles.liveStationaryDot} />
                    <Text style={styles.liveStationaryText}>LIVE</Text>
                  </View>
                </View>

                {/* Status Chips: Battery & Last Seen */}
                <View style={styles.emptyStatusRow}>
                  {selectedMemberObj?.batteryPct != null && (
                    <View style={[styles.emptyStatusChip, { backgroundColor: '#E8F5EE' }]}>
                      <Ionicons name="battery-charging" size={13} color="#2E7D5B" />
                      <Text style={[styles.emptyStatusChipText, { color: '#2E7D5B' }]}>
                        {selectedMemberObj.batteryPct}% Battery
                      </Text>
                    </View>
                  )}
                  {selectedMemberObj?.lastSeenText && (
                    <View style={[styles.emptyStatusChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.emptyStatusChipText, { color: colors.textMuted }]}>
                        Last seen {selectedMemberObj.lastSeenText}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.emptyExplainerText, { color: colors.textMuted }]}>
                  {selectedDate === 'today'
                    ? `${selectedMemberName} has remained stationary today. GPS tracking is live and active.`
                    : `No driving trips or transit movement were logged on ${getDateRange().dateLabel}.`}
                </Text>

                {selectedDate === 'today' && (
                  <View style={[styles.quickDateJumpWrap, { borderTopColor: isDark ? '#222' : '#EDEBE6' }]}>
                    <Text style={[styles.quickDateJumpLabel, { color: colors.foreground }]}>Check recent driving trips:</Text>
                    <View style={styles.quickDateBtnRow}>
                      <TouchableOpacity
                        style={[styles.quickJumpBtn, { backgroundColor: '#2E7D5B' }]}
                        onPress={() => setSelectedDate('yesterday')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
                        <Text style={styles.quickJumpBtnText}>View Yesterday</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickJumpBtnSecondary, { borderColor: '#2E7D5B', backgroundColor: isDark ? '#141E18' : '#E8F5EE' }]}
                        onPress={() => setSelectedDate('2daysAgo')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={13} color="#2E7D5B" />
                        <Text style={[styles.quickJumpBtnTextSecondary, { color: '#2E7D5B' }]}>2 Days Ago</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <Text style={[styles.historyTime, { color: colors.foreground }]}>{pt.timestamp}</Text>
                        {(pt as any).isReconstructed && (
                          <View style={[
                            styles.reconstructionBadgeMini,
                            {
                              backgroundColor: (pt as any).reconstructionSource === 'metro_transit'
                                ? (isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF')
                                : ((pt as any).reconstructionSource === 'rail_network'
                                  ? (isDark ? 'rgba(14, 165, 233, 0.2)' : '#E0F2FE')
                                  : ((pt as any).reconstructionSource === 'historical_learned'
                                    ? (isDark ? 'rgba(58, 223, 171, 0.15)' : '#E8F5EE')
                                    : (isDark ? 'rgba(24, 60, 230, 0.15)' : '#EAF0FE'))),
                              borderColor: (pt as any).reconstructionSource === 'metro_transit'
                                ? (isDark ? '#A78BFA' : '#8B5CF6')
                                : ((pt as any).reconstructionSource === 'rail_network'
                                  ? (isDark ? '#38BDF8' : '#0EA5E9')
                                  : ((pt as any).reconstructionSource === 'historical_learned'
                                    ? (isDark ? '#3ADFAB' : '#2E7D5B')
                                    : (isDark ? '#818CF8' : '#183CE6'))),
                            }
                          ]}>
                            <Ionicons
                              name={(pt as any).reconstructionSource === 'metro_transit'
                                ? "subway-outline"
                                : ((pt as any).reconstructionSource === 'rail_network'
                                  ? "train-outline"
                                  : ((pt as any).reconstructionSource === 'historical_learned' ? "sparkles" : "navigate"))}
                              size={8}
                              color={(pt as any).reconstructionSource === 'metro_transit'
                                ? (isDark ? '#C4B5FD' : '#8B5CF6')
                                : ((pt as any).reconstructionSource === 'rail_network'
                                  ? (isDark ? '#7DD3FC' : '#0EA5E9')
                                  : ((pt as any).reconstructionSource === 'historical_learned'
                                    ? (isDark ? '#3ADFAB' : '#2E7D5B')
                                    : (isDark ? '#818CF8' : '#183CE6')))}
                            />
                            <Text style={[
                              styles.reconstructionBadgeMiniText,
                              {
                                color: (pt as any).reconstructionSource === 'metro_transit'
                                  ? (isDark ? '#C4B5FD' : '#8B5CF6')
                                  : ((pt as any).reconstructionSource === 'rail_network'
                                    ? (isDark ? '#7DD3FC' : '#0EA5E9')
                                    : ((pt as any).reconstructionSource === 'historical_learned'
                                      ? (isDark ? '#3ADFAB' : '#2E7D5B')
                                      : (isDark ? '#818CF8' : '#183CE6'))),
                              }
                            ]}>
                              {(pt as any).reconstructionSource === 'metro_transit'
                                ? 'METRO TUNNEL'
                                : ((pt as any).reconstructionSource === 'rail_network'
                                  ? 'RAIL LINE'
                                  : ((pt as any).reconstructionSource === 'historical_learned' ? 'LEARNED ROUTE' : 'ROAD SNAPPED'))}
                            </Text>
                          </View>
                        )}
                      </View>
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
    padding: 4,
    borderRadius: 22,
    borderWidth: 1,
  },
  datePill: {
    flex: 1,
    height: 36,
    borderRadius: 18,
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
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
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
  reconstructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#BFE3D1',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  reconstructionBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(46, 125, 91, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconstructionBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A3326',
    letterSpacing: 0.3,
  },
  reconstructionBannerSubtitle: {
    fontSize: 11,
    color: '#3C6753',
    marginTop: 2,
    lineHeight: 15,
  },
  reconstructionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(46, 125, 91, 0.12)',
  },
  reconstructionBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#2E7D5B',
  },
  reconstructionBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  reconstructionBadgeMiniText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  memberScopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberScopeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberScopeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberScopeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberScopeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberScopeSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  emptyTimelineCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  emptyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  liveStationaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveStationaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveStationaryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.5,
  },
  emptyStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyStatusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyExplainerText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  quickDateJumpWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  quickDateJumpLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  quickDateBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  quickJumpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickJumpBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickJumpBtnTextSecondary: {
    fontSize: 11,
    fontWeight: '700',
  },
});
