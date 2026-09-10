import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { isValidUuid } from '../lib/utils';
import { flushOfflineBreadcrumbs } from '../services/OfflineLocationQueueService';
import { LUXURY_THEME, getThemeCardStyles, getThemeButtonStyles, getThemeBadgeStyles, getThemeBorderStyles } from '../constants/theme';
import { segmentTripsByStops, analyzeTripTelemetry, isVehicularTrip } from '../services/TripSegmentationService';
import { fetchRoadSnappedRoute } from '../services/RoadRoutingService';
import AnimatedListDropdown from '../components/AnimatedListDropdown';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import { usePaywall } from '../hooks/usePaywall';
import PaywallModal from '../components/PaywallModal';

const drivingGeocodeCache: { [key: string]: string } = {};

async function reverseGeocodeFastDriving(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (drivingGeocodeCache[cacheKey]) return drivingGeocodeCache[cacheKey];

  let addr = `Location • ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const geoPromise = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1800));
    const geoRes: any = await Promise.race([geoPromise, timeoutPromise]).catch(() => null);

    if (geoRes && geoRes.length > 0) {
      const p = geoRes[0];
      const nameParts = [p.name, p.street, p.district || p.subregion || p.city].filter(Boolean);
      if (nameParts.length > 0) addr = nameParts.join(', ');
    }
  } catch (e) {}

  drivingGeocodeCache[cacheKey] = addr;
  return addr;
}

interface TripItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  startAddress: string;
  endAddress: string;
  distanceKm: number;
  durationMins: number;
  topSpeedKmh: number;
  avgSpeedKmh: number;
  score: number;
  hardBrakes: number;
  rapidAccels: number;
  speedingEvents: number;
  cardinalDirection: string;
  bearingDegrees: number;
  routeCoords: { lat: number; lng: number; speed: number }[];
  isOutbound?: boolean;
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
  } catch (e) { }
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

export default function DrivingReportsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, themeMode } = useThemeStore();
  const { activeCircle, members, places } = useCircleStore();
  const { profile } = useAuthStore();
  const { isPremium, paywallVisible, gatedFeatureName, presentPaywall, dismissPaywall } = usePaywall();
  const userIsPremium = isPremium || !!profile?.is_premium;

  const cardStyles = getThemeCardStyles(themeMode);
  const primaryBtnStyles = getThemeButtonStyles(themeMode, 'primary');
  const secondaryBtnStyles = getThemeButtonStyles(themeMode, 'secondary');
  const borderStyles = getThemeBorderStyles(themeMode);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44);

  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday' | '2daysAgo'>('today');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(profile?.id || '');
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [tripRoadCoords, setTripRoadCoords] = useState<[number, number][]>([]);

  // Overall Daily Metrics
  const [driverScore, setDriverScore] = useState(100);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [totalDriveMins, setTotalDriveMins] = useState(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [avgSpeedKmh, setAvgSpeedKmh] = useState(0);
  const [totalHardBrakes, setTotalHardBrakes] = useState(0);
  const [totalRapidAccels, setTotalRapidAccels] = useState(0);
  const [totalSpeedingEvents, setTotalSpeedingEvents] = useState(0);

  const webViewModalRef = useRef<WebView | null>(null);

  useEffect(() => {
    if (profile?.id) {
      // If no selection or selected member is not in current circle (and not self), reset strictly to self
      const isMemberInCircle = (members || []).some(m => m.user_id === selectedMemberId);
      if (!selectedMemberId || (!isMemberInCircle && selectedMemberId !== profile.id)) {
        setSelectedMemberId(profile.id);
      }
    } else {
      setSelectedMemberId('');
      setTrips([]);
    }
  }, [profile?.id, members]);

  useEffect(() => {
    fetchDrivingReport();
  }, [selectedDate, selectedMemberId]);

  useEffect(() => {
    if (selectedTrip && selectedTrip.routeCoords && selectedTrip.routeCoords.length > 0) {
      // Use 100% genuine recorded GPS breadcrumbs from the trip
      setTripRoadCoords(selectedTrip.routeCoords.map(c => [c.lat, c.lng]));
    } else {
      setTripRoadCoords([]);
    }
  }, [selectedTrip]);

  const getDateLabel = () => {
    const d = new Date();
    if (selectedDate === 'yesterday') d.setDate(d.getDate() - 1);
    if (selectedDate === '2daysAgo') d.setDate(d.getDate() - 2);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const fetchDrivingReport = async () => {
    setLoading(true);
    try {
      let baseLat = 20.5937;
      let baseLng = 78.9629;
      let realCity = 'Current Area';

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
        setTrips([]);
        setTotalDistanceKm(0);
        setTotalDriveMins(0);
        setTopSpeedKmh(0);
        setAvgSpeedKmh(0);
        setTotalHardBrakes(0);
        setTotalRapidAccels(0);
        setTotalSpeedingEvents(0);
        setDriverScore(100);
        setLoading(false);
        return;
      }

      const { data: userLocData } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (userLocData?.geom) {
        const coords = parsePointGeom(userLocData.geom);
        if (coords) {
          baseLat = coords.latitude;
          baseLng = coords.longitude;
        }
      } else if (userLocData?.latitude && userLocData?.longitude) {
        baseLat = userLocData.latitude;
        baseLng = userLocData.longitude;
      }

      // 2. Query Supabase location_history table for selectedDate
      const dayOffset = selectedDate === 'today' ? 0 : (selectedDate === 'yesterday' ? 1 : 2);
      const start = new Date();
      start.setDate(start.getDate() - dayOffset);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const rawHistPoints: {
        lat: number;
        lng: number;
        timeMs: number;
        speed: number;
      }[] = [];

      const { data: histData } = await supabase
        .from('location_history')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true });

      if (histData && histData.length > 0) {
        histData.forEach((h: any) => {
          const coords = parsePointGeom(h.geom) || (h.latitude && h.longitude ? { latitude: h.latitude, longitude: h.longitude } : null);
          if (coords && coords.latitude !== 0 && coords.longitude !== 0 && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
            rawHistPoints.push({
              lat: coords.latitude,
              lng: coords.longitude,
              timeMs: new Date(h.recorded_at).getTime(),
              speed: Math.round((h.speed_mps || 0) * 3.6),
            });
          }
        });
      }

      // 3. Slow Network / Offline Resilience: Read pending local offline buffer from AsyncStorage
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
                  if (!rawHistPoints.some(p => Math.abs(p.timeMs - timeMs) < 1500)) {
                    rawHistPoints.push({
                      lat: coords.latitude,
                      lng: coords.longitude,
                      timeMs,
                      speed: Math.round((offItem.speed_mps || 0) * 3.6),
                    });
                  }
                }
              }
            }
          }
          flushOfflineBreadcrumbs(targetUserId).catch(() => {});
        } catch (e) {}
      }

      // Sort points chronologically
      rawHistPoints.sort((a, b) => a.timeMs - b.timeMs);

      let generatedTrips: TripItem[] = [];

      if (rawHistPoints.length >= 2) {
        const tripLegs = segmentTripsByStops(rawHistPoints, (p) => p.timeMs, (p) => p.lat, (p) => p.lng, 4, 60);

        for (let idx = 0; idx < tripLegs.length; idx++) {
          const leg = tripLegs[idx];

          const analysis = analyzeTripTelemetry(
            leg.points,
            p => p.timeMs,
            p => p.lat,
            p => p.lng,
            p => p.speed
          );

          // STRICT ENTERPRISE FILTER: Only classify as a driving trip if vehicular dynamics verified
          if (!isVehicularTrip(analysis)) {
            continue;
          }

          let startAddr = `Departure Location`;
          let endAddr = `Arrival Destination`;

          try {
            const [sAddr, eAddr] = await Promise.all([
              reverseGeocodeFastDriving(leg.startLat || baseLat, leg.startLng || baseLng),
              reverseGeocodeFastDriving(leg.endLat || baseLat, leg.endLng || baseLng),
            ]);
            startAddr = sAddr;
            endAddr = eAddr;
          } catch (_) {}

          // Resolve Directional Title
          const cardDir = analysis.cardinalDirection || leg.cardinalDirection || 'NE';
          let tripTitle = `${cardDir}-bound Trip to ${endAddr.split(',')[0] || 'Destination'}`;

          // Check if ending near a safe place
          const homePlace = places.find(p => p.category === 'home' || p.name.toLowerCase().includes('home'));
          if (homePlace) {
            const hLat = (homePlace as any).latitude ?? (homePlace as any).start_lat ?? ((homePlace as any).geom ? parsePointGeom((homePlace as any).geom)?.latitude : null);
            const hLng = (homePlace as any).longitude ?? (homePlace as any).start_lng ?? ((homePlace as any).geom ? parsePointGeom((homePlace as any).geom)?.longitude : null);
            if (hLat && hLng && leg.endLat && leg.endLng) {
              const dToHome = Math.hypot((leg.endLat - hLat) * 111000, (leg.endLng - hLng) * 111000);
              if (dToHome <= (homePlace.radius_m || 200)) {
                tripTitle = `Return to ${homePlace.name}`;
              }
            }
          }

          generatedTrips.push({
            id: `trip_${idx}_${selectedDate}`,
            title: tripTitle,
            startTime: new Date(leg.startTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            endTime: new Date(leg.endTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            startAddress: startAddr,
            endAddress: endAddr,
            distanceKm: analysis.distanceKm,
            durationMins: analysis.durationMins,
            topSpeedKmh: analysis.topSpeedKmh,
            avgSpeedKmh: analysis.avgSpeedKmh,
            score: analysis.driverScore,
            hardBrakes: analysis.hardBrakes,
            rapidAccels: analysis.rapidAccels,
            speedingEvents: analysis.speedingEvents,
            cardinalDirection: cardDir,
            bearingDegrees: analysis.bearingDegrees,
            routeCoords: analysis.processedPoints,
            isOutbound: leg.isOutbound,
          });
        }
      }

      setTrips(generatedTrips);

      let totDist = 0;
      let totDur = 0;
      let maxSpd = 0;
      let sumAvgSpd = 0;
      let hb = 0;
      let ra = 0;
      let spdEvt = 0;
      let sumScore = 0;

      generatedTrips.forEach(t => {
        totDist += t.distanceKm;
        totDur += t.durationMins;
        if (t.topSpeedKmh > maxSpd) maxSpd = t.topSpeedKmh;
        sumAvgSpd += t.avgSpeedKmh;
        hb += t.hardBrakes;
        ra += t.rapidAccels;
        spdEvt += t.speedingEvents;
        sumScore += t.score;
      });

      setTotalDistanceKm(parseFloat(totDist.toFixed(1)));
      setTotalDriveMins(totDur);
      setTopSpeedKmh(maxSpd);
      setAvgSpeedKmh(generatedTrips.length > 0 ? Math.round(sumAvgSpd / generatedTrips.length) : 0);
      setTotalHardBrakes(hb);
      setTotalRapidAccels(ra);
      setTotalSpeedingEvents(spdEvt);

      const calculatedScore = generatedTrips.length > 0 ? Math.round(sumScore / generatedTrips.length) : 100;
      setDriverScore(calculatedScore);
    } catch (e) {
      console.error('Error fetching driving reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const activeTripCoords = tripRoadCoords.length > 0
    ? tripRoadCoords
    : (selectedTrip?.routeCoords ? selectedTrip.routeCoords.map(c => [c.lat, c.lng]) : []);

  const modalHtmlContent = selectedTrip && activeTripCoords.length > 0 ? `
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
            background: #0D0E12; 
            touch-action: none !important;
            -webkit-user-select: none;
            user-select: none;
            overscroll-behavior: none;
          }
          .leaflet-control-attribution { display: none !important; }
          .custom-pin { background: transparent !important; border: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var coords = ${JSON.stringify(activeTripCoords)};
          var map = L.map('map', { 
            zoomControl: false, 
            attributionControl: false,
            preferCanvas: true,
            dragging: true,
            touchZoom: true,
            scrollWheelZoom: true,
            tap: false
          }).setView(coords[0], 14);
          
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          var routeColor = '#2E7D5B';

          var polylineGlow = L.polyline(coords, {
            color: routeColor,
            weight: 8,
            opacity: 0.25,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var polylineMain = L.polyline(coords, {
            color: routeColor,
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          try {
            L.polylineDecorator(polylineMain, {
              patterns: [
                { offset: 35, repeat: 70, symbol: L.Symbol.arrowHead({ pixelSize: 10, pathOptions: { color: '#FFFFFF', fillOpacity: 1, weight: 0 } }) }
              ]
            }).addTo(map);
          } catch(e) {}

          map.fitBounds(polylineMain.getBounds(), { padding: [40, 40] });

          // Start Departure Marker (Sage Green)
          var startPinHtml = '<div style="display:flex;flex-direction:column;align-items:center;">' +
            '<div style="background:#2E7D5B;color:#FFFFFF;padding:3px 7px;border-radius:10px;font-size:9px;font-weight:900;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);margin-bottom:2px;white-space:nowrap;">DEPARTURE (${selectedTrip.startTime})</div>' +
            '<div style="width:18px;height:18px;border-radius:50%;background:#2E7D5B;border:2.5px solid #FFFFFF;box-shadow:0 0 10px rgba(46,125,91,0.6);"></div>' +
            '</div>';
          var startIcon = L.divIcon({ className: 'custom-pin', html: startPinHtml, iconSize: [120, 36], iconAnchor: [60, 36] });
          L.marker(coords[0], { icon: startIcon, zIndexOffset: 2000 }).addTo(map);

          // End Arrival Marker (Warm Peach)
          var endPinHtml = '<div style="display:flex;flex-direction:column;align-items:center;">' +
            '<div style="background:#E07A5F;color:#FFFFFF;padding:3px 7px;border-radius:10px;font-size:9px;font-weight:900;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);margin-bottom:2px;white-space:nowrap;">ARRIVAL (${selectedTrip.endTime})</div>' +
            '<div style="width:18px;height:18px;border-radius:50%;background:#E07A5F;border:2.5px solid #FFFFFF;box-shadow:0 0 10px rgba(224,122,95,0.6);"></div>' +
            '</div>';
          var endIcon = L.divIcon({ className: 'custom-pin', html: endPinHtml, iconSize: [120, 36], iconAnchor: [60, 36] });
          L.marker(coords[coords.length - 1], { icon: endIcon, zIndexOffset: 2000 }).addTo(map);
        </script>
      </body>
    </html>
  ` : '';

  const selectedMemberObj = (members || []).find(m => m.user_id === selectedMemberId);
  const selectedMemberName = selectedMemberId === profile?.id ? `${profile?.full_name || 'Me'} (You)` : (selectedMemberObj?.profile?.full_name || 'Member');
  const selectedMemberInitial = selectedMemberName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topInset + 14, paddingBottom: 14 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>DRIVING REPORTS</Text>
          <Text style={[styles.headerSubtitle, { color: '#2E7D5B' }]}>{getDateLabel().toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={fetchDrivingReport} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Date & Member Dropdown Control Row */}
      <View style={styles.controlsRow}>
        <View style={[styles.dateSelectorContainer, { backgroundColor: '#E8F5EE', borderColor: '#C6E7D5', flex: 1 }]}>
          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'today' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => setSelectedDate('today')}
            activeOpacity={0.8}
          >
            <Text style={[styles.datePillText, { color: selectedDate === 'today' ? '#FFFFFF' : '#2E7D5B' }]}>
              TODAY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'yesterday' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => setSelectedDate('yesterday')}
            activeOpacity={0.8}
          >
            <Text style={[styles.datePillText, { color: selectedDate === 'yesterday' ? '#FFFFFF' : '#2E7D5B' }]}>
              YESTERDAY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === '2daysAgo' && [styles.datePillActive, { backgroundColor: '#2E7D5B' }]]}
            onPress={() => {
              if (userIsPremium) {
                setSelectedDate('2daysAgo');
              } else {
                presentPaywall('3-Day Extended Driving History');
              }
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={[styles.datePillText, { color: selectedDate === '2daysAgo' ? '#FFFFFF' : '#2E7D5B' }]}>
                2 DAYS
              </Text>
              {!userIsPremium && (
                <Ionicons name="lock-closed" size={10} color={selectedDate === '2daysAgo' ? '#FFFFFF' : '#2E7D5B'} />
              )}
            </View>
          </TouchableOpacity>
        </View>

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

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LuxuryRadarLoading size={140} message="ANALYZING DRIVING TELEMETRY…" />
        ) : (
          <>
            {/* Safety Score Card */}
            <View style={[styles.scoreCard, cardStyles, { backgroundColor: colors.surface, borderColor: driverScore >= 80 ? '#C6E7D5' : '#FFD7C7' }]}>
              <View style={styles.scoreBadgeHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark" size={14} color="#2E7D5B" />
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#2E7D5B', letterSpacing: 1.2 }}>
                    TELEMETRY SAFETY EVALUATION
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: driverScore >= 80 ? '#E8F5EE' : '#FFF3EB' }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: driverScore >= 80 ? '#2E7D5B' : '#E07A5F', letterSpacing: 1 }}>
                    {driverScore >= 90 ? 'GRADE A+' : (driverScore >= 80 ? 'GRADE A' : 'GRADE B')}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreTopRow}>
                <View style={[styles.scoreCircleBg, { borderRadius: 35, borderColor: driverScore >= 80 ? '#2E7D5B' : '#E07A5F', backgroundColor: driverScore >= 80 ? '#E8F5EE' : '#FFF3EB' }]}>
                  <Text 
                    style={[styles.scoreNum, { color: driverScore >= 80 ? '#2E7D5B' : '#E07A5F' }]}
                    numberOfLines={1}
                  >
                    {driverScore}
                  </Text>
                  <Text style={[styles.scoreDenom, { color: colors.textMuted }]}>/100</Text>
                </View>

                <View style={styles.scoreInfo}>
                  <Text style={[styles.scoreTitle, { color: colors.foreground }]}>
                    {driverScore >= 90 ? 'EXCELLENT SAFE DRIVER' : (driverScore >= 80 ? 'GOOD DRIVING RECORD' : 'MODERATE SAFETY SCORE')}
                  </Text>
                  <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
                    {selectedMemberName}'s driving evaluation calculated directly from authentic GPS telemetry and vehicle dynamics.
                  </Text>
                </View>
              </View>

              {/* Safety Event Badges */}
              <View style={styles.eventBadgesRow}>
                <View style={[styles.eventBadge, { borderRadius: 8, backgroundColor: totalHardBrakes === 0 ? '#E8F5EE' : '#FEE2E2', borderColor: totalHardBrakes === 0 ? '#C6E7D5' : '#FECACA' }]}>
                  <Ionicons name="hand-right" size={13} color={totalHardBrakes === 0 ? '#2E7D5B' : '#DC2626'} />
                  <Text style={[styles.eventBadgeText, { color: totalHardBrakes === 0 ? '#2E7D5B' : '#DC2626' }]}>{totalHardBrakes} HARD BRAKES</Text>
                </View>

                <View style={[styles.eventBadge, { borderRadius: 8, backgroundColor: totalRapidAccels === 0 ? '#E8F5EE' : '#FFF3EB', borderColor: totalRapidAccels === 0 ? '#C6E7D5' : '#FFD7C7' }]}>
                  <Ionicons name="flash" size={13} color={totalRapidAccels === 0 ? '#2E7D5B' : '#E07A5F'} />
                  <Text style={[styles.eventBadgeText, { color: totalRapidAccels === 0 ? '#2E7D5B' : '#E07A5F' }]}>{totalRapidAccels} RAPID ACCELS</Text>
                </View>

                <View style={[styles.eventBadge, { borderRadius: 8, backgroundColor: totalSpeedingEvents > 0 ? '#FEE2E2' : '#E8F5EE', borderColor: totalSpeedingEvents > 0 ? '#FECACA' : '#C6E7D5' }]}>
                  <Ionicons name="speedometer" size={13} color={totalSpeedingEvents > 0 ? '#DC2626' : '#2E7D5B'} />
                  <Text style={[styles.eventBadgeText, { color: totalSpeedingEvents > 0 ? '#DC2626' : '#2E7D5B' }]}>{totalSpeedingEvents} SPEEDING</Text>
                </View>
              </View>
            </View>

            {/* Summary Metrics Cards */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, cardStyles, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { borderRadius: 18, backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="navigate-outline" size={18} color="#2E7D5B" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{totalDistanceKm} km</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>DRIVEN</Text>
              </View>

              <View style={[styles.metricCard, cardStyles, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { borderRadius: 18, backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="time-outline" size={18} color="#E07A5F" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{totalDriveMins} mins</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>DRIVE TIME</Text>
              </View>

              <View style={[styles.metricCard, cardStyles, { backgroundColor: colors.surface, borderColor: topSpeedKmh > 80 ? '#FF5266' : '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { borderRadius: 18, backgroundColor: topSpeedKmh > 80 ? 'rgba(255, 82, 102, 0.15)' : 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="speedometer-outline" size={18} color={topSpeedKmh > 80 ? "#FF5266" : "#3B82F6"} />
                </View>
                <Text style={[styles.metricVal, { color: topSpeedKmh > 80 ? '#FF5266' : colors.foreground }]}>{topSpeedKmh} km/h</Text>
                <Text style={[styles.metricLbl, { color: topSpeedKmh > 80 ? '#FF5266' : colors.textMuted }]}>TOP SPEED</Text>
              </View>

              <View style={[styles.metricCard, cardStyles, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <View style={[styles.metricIconWrap, { borderRadius: 18, backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="bar-chart-outline" size={18} color="#2E7D5B" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{avgSpeedKmh} km/h</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>AVG SPEED</Text>
              </View>
            </View>

            {/* Trips List Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textTransform: 'none', fontWeight: '700' }]}>Trips Recorded ({trips.length})</Text>
              <View style={[styles.accentLine, { backgroundColor: '#EDEBE6' }]} />
            </View>

            {/* Trips List Cards */}
            {trips.length === 0 ? (
              <View style={[styles.emptyTripsCard, cardStyles, { backgroundColor: colors.surface, borderColor: '#EDEBE6' }]}>
                <Ionicons name="car-sport-outline" size={40} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyTripsTitle, { color: colors.foreground }]}>NO DRIVING TRIPS LOGGED</Text>
                <Text style={[styles.emptyTripsSub, { color: colors.textMuted }]}>
                  No driving journeys recorded for {selectedMemberName} on {selectedDate.toUpperCase()}. Trips will be segmented and analyzed automatically when driving.
                </Text>
              </View>
            ) : (
              trips.map((trip) => {
                const isSpeeding = trip.topSpeedKmh > 80;
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={[styles.tripCard, cardStyles, { backgroundColor: colors.surface, borderColor: isSpeeding ? 'rgba(255,82,102,0.3)' : '#EDEBE6' }]}
                    onPress={() => setSelectedTrip(trip)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tripCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text style={[styles.tripTitle, { color: colors.foreground, textTransform: 'none', fontWeight: '800' }]}>{trip.title}</Text>
                          <View style={[styles.headingBadge, { borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5EE' }]}>
                            <Ionicons name="compass-outline" size={11} color="#2E7D5B" />
                            <Text style={[styles.headingBadgeText, { color: '#2E7D5B' }]}>{trip.cardinalDirection} ({trip.bearingDegrees}°)</Text>
                          </View>
                        </View>
                        <Text style={[styles.tripTime, { color: colors.textMuted }]}>
                          {trip.startTime} → {trip.endTime} ({trip.durationMins} mins)
                        </Text>
                      </View>

                      <View style={[styles.tripScoreBadge, { borderRadius: 8, backgroundColor: trip.score >= 80 ? '#2E7D5B' : '#E07A5F' }]}>
                        <Text style={[styles.tripScoreText, { color: '#FFFFFF' }]}>{trip.score}</Text>
                      </View>
                    </View>

                    <View style={styles.tripRoutePoints}>
                      <View style={styles.routePointRow}>
                        <Ionicons name="ellipse" size={10} color="#2E7D5B" />
                        <Text style={[styles.routePointText, { color: colors.foreground }]} numberOfLines={1}>{trip.startAddress}</Text>
                      </View>
                      <View style={styles.routeLineDot} />
                      <View style={styles.routePointRow}>
                        <Ionicons name="location" size={12} color="#E07A5F" />
                        <Text style={[styles.routePointText, { color: colors.foreground }]} numberOfLines={1}>{trip.endAddress}</Text>
                      </View>
                    </View>

                    <View style={styles.tripFooterStats}>
                      <Text style={[styles.tripStatText, { color: colors.textMuted }]}>
                        Distance: <Text style={{ color: colors.foreground, fontWeight: '800' }}>{trip.distanceKm} km</Text>
                      </Text>
                      <Text style={[styles.tripStatText, { color: colors.textMuted }]}>
                        Top Speed: <Text style={{ color: isSpeeding ? '#FF5266' : colors.foreground, fontWeight: '800' }}>
                          {trip.topSpeedKmh} km/h
                        </Text>
                      </Text>
                      <View style={styles.inspectBtn}>
                        <Text style={[styles.viewDetailsText, { color: '#2E7D5B', fontWeight: '800' }]}>INSPECT ROUTE →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Trip Detail Map Modal */}
      {selectedTrip ? (
        <Modal visible={true} animationType="slide" transparent={false}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: topInset + 10 }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSelectedTrip(null)} activeOpacity={0.8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: colors.foreground }]}>TRIP TELEMETRY ROUTE</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.modalMapWrapper}>
              {Platform.OS === 'web' ? (
                <iframe
                  srcDoc={modalHtmlContent}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <WebView
                  ref={webViewModalRef}
                  originWhitelist={['*']}
                  source={{ html: modalHtmlContent }}
                  style={{ flex: 1 }}
                />
              )}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.modalTripTitle, { color: colors.foreground, flex: 1 }]}>{selectedTrip.title}</Text>
                <View style={[styles.headingBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <Ionicons name="compass-outline" size={11} color="#3B82F6" />
                  <Text style={styles.headingBadgeText}>{selectedTrip.cardinalDirection} ({selectedTrip.bearingDegrees}°)</Text>
                </View>
              </View>

              <Text style={[styles.modalTripMeta, { color: colors.textMuted }]}>
                {selectedTrip.startTime} - {selectedTrip.endTime} • {selectedTrip.distanceKm} km • {selectedTrip.durationMins} mins
              </Text>

              <View style={[styles.modalScoreCard, { backgroundColor: colors.surface, borderColor: colors.accentGold }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.modalScoreLbl, { color: colors.foreground }]}>TRIP DRIVING SCORE</Text>
                  <Text style={[styles.modalScoreVal, { color: colors.accentGold }]}>{selectedTrip.score} / 100</Text>
                </View>
              </View>

              <View style={styles.modalStatsGrid}>
                <View style={[styles.modalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.modalStatVal, { color: colors.foreground }]}>{selectedTrip.topSpeedKmh} km/h</Text>
                  <Text style={[styles.modalStatLbl, { color: colors.textMuted }]}>TOP SPEED</Text>
                </View>
                <View style={[styles.modalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.modalStatVal, { color: colors.foreground }]}>{selectedTrip.avgSpeedKmh} km/h</Text>
                  <Text style={[styles.modalStatLbl, { color: colors.textMuted }]}>AVG SPEED</Text>
                </View>
                <View style={[styles.modalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.modalStatVal, { color: colors.foreground }]}>{selectedTrip.hardBrakes}</Text>
                  <Text style={[styles.modalStatLbl, { color: colors.textMuted }]}>HARD BRAKES</Text>
                </View>
                <View style={[styles.modalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.modalStatVal, { color: colors.foreground }]}>{selectedTrip.speedingEvents}</Text>
                  <Text style={[styles.modalStatLbl, { color: colors.textMuted }]}>SPEEDING EVENTS</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      <PaywallModal
        visible={paywallVisible}
        onClose={dismissPaywall}
        gatedFeatureName={gatedFeatureName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  datePill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  datePillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  datePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  memberDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatarCircleMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialMini: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0D0E12',
  },
  memberDropdownText: {
    fontSize: 11.5,
    fontWeight: '700',
    maxWidth: 65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalPickerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: 400,
  },
  modalPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPickerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  scoreCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  scoreBadgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  scoreCircleBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  scoreDenom: {
    fontSize: 9.5,
    color: '#9CA3AF',
    marginTop: -2,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  scoreSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  eventBadgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  eventBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLbl: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13.5,
  },
  accentLine: {
    flex: 1,
    height: 1,
  },
  emptyTripsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTripsTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  emptyTripsSub: {
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  tripCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tripTitle: {
    fontSize: 13.5,
  },
  headingBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  headingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D4AF37',
  },
  tripTime: {
    fontSize: 11,
    marginTop: 2,
  },
  tripScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tripScoreText: {
    fontSize: 12,
    fontWeight: '900',
  },
  tripRoutePoints: {
    marginBottom: 10,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLineDot: {
    width: 2,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginLeft: 4,
    marginVertical: 2,
  },
  routePointText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  tripFooterStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  tripStatText: {
    fontSize: 11,
  },
  inspectBtn: {
    paddingVertical: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalMapWrapper: {
    height: 320,
    backgroundColor: '#0D0E12',
  },
  modalTripTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalTripMeta: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalScoreCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  modalScoreLbl: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalScoreVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalStatBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  modalStatVal: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalStatLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
