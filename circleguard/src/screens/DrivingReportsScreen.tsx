import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME } from '../constants/theme';
import { segmentTripsByStops } from '../services/TripSegmentationService';
import { fetchRoadSnappedRoute } from '../services/RoadRoutingService';

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

export default function DrivingReportsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useThemeStore();
  const { activeCircle, members } = useCircleStore();
  const { profile } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday' | '2daysAgo'>('today');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(profile?.id || '');
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [tripRoadCoords, setTripRoadCoords] = useState<[number, number][]>([]);

  // Overall Daily Metrics
  const [driverScore, setDriverScore] = useState(96);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [totalDriveMins, setTotalDriveMins] = useState(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [avgSpeedKmh, setAvgSpeedKmh] = useState(0);
  const [totalHardBrakes, setTotalHardBrakes] = useState(0);
  const [totalRapidAccels, setTotalRapidAccels] = useState(0);
  const [totalSpeedingEvents, setTotalSpeedingEvents] = useState(0);

  const webViewModalRef = useRef<WebView | null>(null);

  useEffect(() => {
    if (profile?.id && !selectedMemberId) {
      setSelectedMemberId(profile.id);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchDrivingReport();
  }, [selectedDate, selectedMemberId]);

  useEffect(() => {
    if (selectedTrip && selectedTrip.routeCoords && selectedTrip.routeCoords.length > 0) {
      const waypoints = selectedTrip.routeCoords.map(c => ({ latitude: c.lat, longitude: c.lng }));
      fetchRoadSnappedRoute(waypoints).then(res => {
        if (res.roadCoords && res.roadCoords.length > 0) {
          setTripRoadCoords(res.roadCoords);
        } else {
          setTripRoadCoords(selectedTrip.routeCoords.map(c => [c.lat, c.lng]));
        }
      }).catch(() => {
        setTripRoadCoords(selectedTrip.routeCoords.map(c => [c.lat, c.lng]));
      });
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
      let baseLat = 13.0827; // Default Chennai / Metro
      let baseLng = 80.2707;
      let realCity = 'Metro Area';

      // 1. Check member location in locations table
      const targetUserId = selectedMemberId || profile?.id;
      if (targetUserId) {
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
        } else {
          try {
            const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (cur?.coords) {
              baseLat = cur.coords.latitude;
              baseLng = cur.coords.longitude;
            }
          } catch (e) {}
        }
      }

      // Reverse geocode to get actual street & city name
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: baseLat, longitude: baseLng });
        if (geo && geo.length > 0) {
          const p = geo[0];
          realCity = p.district || p.subregion || p.city || p.street || 'Current Area';
        }
      } catch (e) {}

      // Generate points for an out-and-back trip
      const nowMs = Date.now();
      const points = [
        // Outbound Leg
        { lat: baseLat, lng: baseLng, timeMs: nowMs - 60*60*1000, speed: 20 },
        { lat: baseLat + 0.005, lng: baseLng + 0.005, timeMs: nowMs - 55*60*1000, speed: 45 },
        { lat: baseLat + 0.010, lng: baseLng + 0.010, timeMs: nowMs - 50*60*1000, speed: 60 },
        
        // Stationary for 10 minutes at destination (Will cause a split!)
        { lat: baseLat + 0.010, lng: baseLng + 0.010, timeMs: nowMs - 40*60*1000, speed: 0 },
        
        // Return Leg (Same road)
        { lat: baseLat + 0.005, lng: baseLng + 0.005, timeMs: nowMs - 35*60*1000, speed: 45 },
        { lat: baseLat, lng: baseLng, timeMs: nowMs - 30*60*1000, speed: 30 },
      ];

      // Segment trips by stops > 5 mins
      const tripLegs = segmentTripsByStops(
        points,
        (p) => p.timeMs,
        (p) => p.lat,
        (p) => p.lng,
        5,
        50
      );

      const generatedTrips: TripItem[] = tripLegs.map((leg, idx) => {
        const isOutbound = leg.isOutbound;
        return {
          id: `trip_${idx}_${selectedDate}`,
          title: isOutbound ? 'Outbound Journey' : 'Return Journey',
          startTime: new Date(leg.startTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime: new Date(leg.endTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          startAddress: isOutbound ? `Home • ${realCity}` : `Destination • ${realCity}`,
          endAddress: isOutbound ? `Destination • ${realCity}` : `Home • ${realCity}`,
          distanceKm: 5.2,
          durationMins: Math.round((leg.endTimeMs - leg.startTimeMs) / 60000) || 1,
          topSpeedKmh: 60,
          avgSpeedKmh: 35,
          score: 98,
          hardBrakes: 0,
          rapidAccels: 0,
          speedingEvents: 0,
          routeCoords: leg.points,
          isOutbound: isOutbound, // Store direction for rendering
        };
      });

      // Add one more trip that is a quick out-and-back WITHOUT a long stop (No split)
      const quickPoints = [
        { lat: baseLat, lng: baseLng + 0.02, timeMs: nowMs - 20*60*1000, speed: 20 },
        { lat: baseLat + 0.002, lng: baseLng + 0.022, timeMs: nowMs - 18*60*1000, speed: 40 },
        { lat: baseLat + 0.002, lng: baseLng + 0.022, timeMs: nowMs - 16*60*1000, speed: 0 }, // 2 min stop
        { lat: baseLat, lng: baseLng + 0.02, timeMs: nowMs - 14*60*1000, speed: 30 },
      ];

      const quickLegs = segmentTripsByStops(quickPoints, (p) => p.timeMs, (p) => p.lat, (p) => p.lng, 5, 50);
      
      quickLegs.forEach((leg, idx) => {
        generatedTrips.push({
          id: `trip_quick_${idx}_${selectedDate}`,
          title: 'Quick Errand (No Split)',
          startTime: new Date(leg.startTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime: new Date(leg.endTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          startAddress: `Store • ${realCity}`,
          endAddress: `Home • ${realCity}`,
          distanceKm: 2.1,
          durationMins: 6,
          topSpeedKmh: 40,
          avgSpeedKmh: 25,
          score: 100,
          hardBrakes: 0,
          rapidAccels: 0,
          speedingEvents: 0,
          routeCoords: leg.points,
          isOutbound: true,
        });
      });

      setTrips(generatedTrips);

      let totDist = 0;
      let totDur = 0;
      let maxSpd = 0;
      let sumAvgSpd = 0;
      let hb = 0;
      let ra = 0;
      let spdEvt = 0;

      generatedTrips.forEach(t => {
        totDist += t.distanceKm;
        totDur += t.durationMins;
        if (t.topSpeedKmh > maxSpd) maxSpd = t.topSpeedKmh;
        sumAvgSpd += t.avgSpeedKmh;
        hb += t.hardBrakes;
        ra += t.rapidAccels;
        spdEvt += t.speedingEvents;
      });

      setTotalDistanceKm(parseFloat(totDist.toFixed(1)));
      setTotalDriveMins(totDur);
      setTopSpeedKmh(maxSpd);
      setAvgSpeedKmh(Math.round(sumAvgSpd / generatedTrips.length));
      setTotalHardBrakes(hb);
      setTotalRapidAccels(ra);
      setTotalSpeedingEvents(spdEvt);

      const calculatedScore = Math.max(75, 100 - hb * 3 - ra * 2 - spdEvt * 2);
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
          body { margin: 0; padding: 0; background-color: #F4F5FB; }
          #map { width: 100vw; height: 320px; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map;
          var coords = ${JSON.stringify(activeTripCoords)};
          var isOutbound = ${selectedTrip?.isOutbound ?? true};
          var routeColor = isOutbound ? '#10B981' : '#FF536A'; // Teal for outbound, Coral for return
          var routeOffset = isOutbound ? 4 : -4;

          function initMap() {
            var tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
            var fallbackTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
            map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true, zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true }).setView(coords[0], 14);
            var terrainLayer = L.tileLayer(tileUrl, { maxZoom: 17, keepBuffer: 8, updateWhenIdle: false, updateWhenZooming: false, crossOrigin: true }).addTo(map);
            terrainLayer.on('tileerror', function(e) {
              e.tile.src = fallbackTileUrl.replace('{s}', 'a').replace('{z}', e.coords.z).replace('{x}', e.coords.x).replace('{y}', e.coords.y);
            });

            var polylineGlow = L.polyline(coords, {
              color: routeColor,
              weight: 10,
              opacity: 0.25,
              lineCap: 'round',
              lineJoin: 'round',
              offset: routeOffset
            }).addTo(map);

            var polylineMain = L.polyline(coords, {
              color: routeColor,
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
              offset: routeOffset
            }).addTo(map);

            L.polylineDecorator(polylineMain, {
              patterns: [
                { offset: 50, repeat: 100, symbol: L.Symbol.arrowHead({ pixelSize: 12, pathOptions: { color: routeColor, fillOpacity: 1, weight: 0 } }) }
              ]
            }).addTo(map);

            map.fitBounds(polylineMain.getBounds(), { padding: [35, 35] });

            // Start 3D Coral Pin
            var startPinSvg = '<div style="filter: drop-shadow(0 6px 10px rgba(255,83,106,0.5));">' +
              '<svg width="34" height="44" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#FF536A"/>' +
                '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
              '</svg>' +
            '</div>';
            var startIcon = L.divIcon({ className: 'custom-3d-pin', html: startPinSvg, iconSize: [34, 44], iconAnchor: [17, 44] });
            L.marker(coords[0], { icon: startIcon }).addTo(map).bindPopup('Start: ${selectedTrip.startAddress}');

            // End 3D White Pin (previously Royal Blue)
            var endPinSvg = '<div style="filter: drop-shadow(0 6px 10px rgba(255,255,255,0.5));">' +
              '<svg width="34" height="44" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#FFFFFF"/>' +
                '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#D4AF37"/>' +
              '</svg>' +
            '</div>';
            var endIcon = L.divIcon({ className: 'custom-3d-pin', html: endPinSvg, iconSize: [34, 44], iconAnchor: [17, 44] });
            L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map).bindPopup('Destination: ${selectedTrip.endAddress}');
          }
          initMap();
        </script>
  ` : '';

  const selectedMemberObj = (members || []).find(m => m.user_id === selectedMemberId);
  const selectedMemberName = selectedMemberId === profile?.id ? `${profile?.full_name || 'Me'} (You)` : (selectedMemberObj?.profile?.full_name || 'Member');
  const selectedMemberInitial = selectedMemberName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>DRIVING REPORTS</Text>
          <Text style={[styles.headerSubtitle, { color: colors.accentGold }]}>{getDateLabel().toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={fetchDrivingReport} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Date & Member Dropdown Control Row */}
      <View style={styles.controlsRow}>
        {/* Date Selector Pills */}
        <View style={[styles.dateSelectorContainer, { backgroundColor: 'rgba(212, 175, 55, 0.08)', borderColor: 'rgba(212, 175, 55, 0.15)', flex: 1 }]}>
          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'today' && [styles.datePillActive, { backgroundColor: '#D4AF37' }]]}
            onPress={() => setSelectedDate('today')}
            activeOpacity={0.8}
          >
            <Text style={[styles.datePillText, { color: selectedDate === 'today' ? '#FFFFFF' : '#D4AF37' }]}>TODAY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === 'yesterday' && [styles.datePillActive, { backgroundColor: '#D4AF37' }]]}
            onPress={() => setSelectedDate('yesterday')}
            activeOpacity={0.8}
          >
            <Text style={[styles.datePillText, { color: selectedDate === 'yesterday' ? '#FFFFFF' : '#D4AF37' }]}>YESTERDAY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, selectedDate === '2daysAgo' && [styles.datePillActive, { backgroundColor: '#D4AF37' }]]}
            onPress={() => setSelectedDate('2daysAgo')}
            activeOpacity={0.8}
          >
            <Text style={[styles.datePillText, { color: selectedDate === '2daysAgo' ? '#FFFFFF' : '#D4AF37' }]}>2 DAYS AGO</Text>
          </TouchableOpacity>
        </View>

        {/* Member Selector Dropdown Button */}
        {members && members.length > 0 ? (
          <TouchableOpacity
            style={[styles.memberDropdownBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setMemberPickerVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarCircleMini, { backgroundColor: colors.accentGold }]}>
              <Text style={styles.avatarInitialMini}>{selectedMemberInitial}</Text>
            </View>
            <Text style={[styles.memberDropdownText, { color: colors.foreground }]} numberOfLines={1}>
              {selectedMemberName.split(' ')[0]}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.accentGold} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Member Picker Modal */}
      <Modal visible={memberPickerVisible} animationType="fade" transparent onRequestClose={() => setMemberPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMemberPickerVisible(false)}>
          <View style={[styles.modalPickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalPickerHeader}>
              <Text style={[styles.modalPickerTitle, { color: colors.foreground }]}>Select Circle Member</Text>
              <TouchableOpacity onPress={() => setMemberPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {(members || []).map((m) => {
                const isSel = m.user_id === selectedMemberId;
                const name = m.user_id === profile?.id ? `${profile?.full_name || 'Me'} (You)` : (m.profile?.full_name || 'Member');
                const initial = name.charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.memberPickerRow,
                      {
                        backgroundColor: isSel ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
                        borderColor: isSel ? '#D4AF37' : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setSelectedMemberId(m.user_id);
                      setMemberPickerVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.avatarCircleMini, { backgroundColor: isSel ? '#D4AF37' : 'rgba(255, 255, 255, 0.15)' }]}>
                        <Text style={[styles.avatarInitialMini, { color: isSel ? '#FFFFFF' : colors.foreground }]}>{initial}</Text>
                      </View>
                      <Text style={[styles.memberPickerName, { color: isSel ? colors.accentGold : colors.foreground, fontWeight: isSel ? '700' : '500' }]}>
                        {name}
                      </Text>
                    </View>
                    {isSel ? <Ionicons name="checkmark-circle" size={18} color={colors.accentGold} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accentGold} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Analyzing Driving Telemetry...</Text>
          </View>
        ) : (
          <>
            {/* Safety Score Card */}
            <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: '#D4AF37' }]}>
              <View style={styles.scoreTopRow}>
                <View style={[styles.scoreCircleBg, { borderColor: driverScore >= 90 ? '#10B981' : driverScore >= 80 ? '#D4AF37' : '#FF536A' }]}>
                  <Text style={[styles.scoreNum, { color: driverScore >= 90 ? '#10B981' : driverScore >= 80 ? '#D4AF37' : '#FF536A' }]}>
                    {driverScore}
                  </Text>
                  <Text style={styles.scoreDenom}>/100</Text>
                </View>

                <View style={styles.scoreInfo}>
                  <Text style={[styles.scoreTitle, { color: colors.foreground }]}>
                    {driverScore >= 90 ? 'EXCELLENT SAFE DRIVER' : 'MODERATE DRIVING SCORE'}
                  </Text>
                  <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
                    {selectedMemberName}'s overall driving safety evaluation based on 2-day telemetry algorithms.
                  </Text>
                </View>
              </View>

              {/* Safety Event Badges Row */}
              <View style={styles.eventBadgesRow}>
                <View style={[styles.eventBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <Ionicons name="hand-right-outline" size={14} color="#10B981" />
                  <Text style={[styles.eventBadgeText, { color: '#10B981' }]}>{totalHardBrakes} HARD BRAKES</Text>
                </View>

                <View style={[styles.eventBadge, { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderColor: 'rgba(212, 175, 55, 0.3)' }]}>
                  <Ionicons name="flash-outline" size={14} color="#D4AF37" />
                  <Text style={[styles.eventBadgeText, { color: '#D4AF37' }]}>{totalRapidAccels} RAPID ACCELS</Text>
                </View>

                <View style={[styles.eventBadge, { backgroundColor: 'rgba(255, 83, 106, 0.12)', borderColor: 'rgba(255, 83, 106, 0.3)' }]}>
                  <Ionicons name="speedometer-outline" size={14} color="#FF536A" />
                  <Text style={[styles.eventBadgeText, { color: '#FF536A' }]}>{totalSpeedingEvents} SPEEDING</Text>
                </View>
              </View>
            </View>

            {/* Summary Metrics Cards */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
                  <Ionicons name="navigate-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{totalDistanceKm} km</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>DRIVEN</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="time-outline" size={18} color="#10B981" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{totalDriveMins} mins</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>DRIVE TIME</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: topSpeedKmh > 80 ? '#FF5266' : colors.border }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: topSpeedKmh > 80 ? 'rgba(255, 82, 102, 0.15)' : 'rgba(255, 83, 106, 0.12)' }]}>
                  <Ionicons name={topSpeedKmh > 80 ? "alert-circle" : "speedometer-outline"} size={18} color={topSpeedKmh > 80 ? "#FF5266" : "#FF536A"} />
                </View>
                <Text style={[styles.metricVal, { color: topSpeedKmh > 80 ? '#FF5266' : colors.foreground }]}>{topSpeedKmh} km/h</Text>
                <Text style={[styles.metricLbl, { color: topSpeedKmh > 80 ? '#FF5266' : colors.textMuted }]}>
                  {topSpeedKmh > 80 ? 'HIGH SPEED' : 'TOP SPEED'}
                </Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
                  <Ionicons name="bar-chart-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{avgSpeedKmh} km/h</Text>
                <Text style={[styles.metricLbl, { color: colors.textMuted }]}>AVG SPEED</Text>
              </View>
            </View>

            {/* Trips List Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textTransform: 'none', fontWeight: '700' }]}>Trips Recorded ({trips.length})</Text>
              <View style={[styles.accentLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Trips List Cards */}
            {trips.map(trip => {
              const isSpeeding = trip.topSpeedKmh > 80;
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: isSpeeding ? 'rgba(255,82,102,0.3)' : colors.border }]}
                  onPress={() => setSelectedTrip(trip)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tripCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tripTitle, { color: colors.foreground, textTransform: 'none', fontWeight: '700' }]}>{trip.title || 'Recorded Trip'}</Text>
                      <Text style={[styles.tripTime, { color: colors.textMuted }]}>
                        {trip.startTime || '08:00 AM'} → {trip.endTime || '08:30 AM'} ({trip.durationMins || 30} mins)
                      </Text>
                    </View>

                    <View style={[styles.tripScoreBadge, { backgroundColor: trip.score >= 90 ? '#16B889' : trip.score >= 75 ? '#D4AF37' : '#FF5266' }]}>
                      <Text style={[styles.tripScoreText, { color: '#FFFFFF' }]}>{trip.score || 85}</Text>
                    </View>
                  </View>

                  <View style={styles.tripRoutePoints}>
                    <View style={styles.routePointRow}>
                      <Ionicons name="ellipse" size={10} color="#16B889" />
                      <Text style={[styles.routePointText, { color: colors.foreground }]} numberOfLines={1}>{trip.startAddress || 'Start Point'}</Text>
                    </View>
                    <View style={styles.routeLineDot} />
                    <View style={styles.routePointRow}>
                      <Ionicons name="location" size={12} color="#FF5266" />
                      <Text style={[styles.routePointText, { color: colors.foreground }]} numberOfLines={1}>{trip.endAddress || 'Destination'}</Text>
                    </View>
                  </View>

                  <View style={styles.tripFooterStats}>
                    <Text style={[styles.tripStatText, { color: colors.textMuted }]}>
                      Distance: <Text style={{ color: colors.foreground, fontWeight: '800' }}>{trip.distanceKm} km</Text>
                    </Text>
                    <Text style={[styles.tripStatText, { color: colors.textMuted }]}>
                      Top Speed: <Text style={{ color: isSpeeding ? '#FF5266' : colors.foreground, fontWeight: '800' }}>
                        {trip.topSpeedKmh} km/h {isSpeeding ? ' ⚠️' : ''}
                      </Text>
                    </Text>
                    <View style={styles.inspectBtn}>
                      <Text style={[styles.viewDetailsText, { color: '#D4AF37', fontWeight: '800' }]}>INSPECT ROUTE →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Trip Detail Map Modal */}
      {selectedTrip ? (
        <Modal visible={true} animationType="slide" transparent={false}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSelectedTrip(null)} activeOpacity={0.8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: colors.foreground }]}>TRIP TELEMETRY ROUTE</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.modalMapWrapper}>
              <WebView
                ref={webViewModalRef}
                originWhitelist={['*']}
                source={{ html: modalHtmlContent }}
                style={{ flex: 1 }}
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTripTitle, { color: colors.foreground }]}>{selectedTrip.title}</Text>
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
                  <Text style={[styles.modalStatLbl, { color: colors.textMuted }]}>SPEEDING EXCEED</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      ) : null}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
  },
  datePill: {
    flex: 1,
    height: 34,
    borderRadius: 20,
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
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  memberDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    maxWidth: 135,
  },
  avatarCircleMini: {
    width: 24,
    height: 24,
    borderWidth: 1,
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
  scrollContent: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  scoreCircleBg: {
    width: 72,
    height: 72,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  scoreNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreDenom: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 1,
    marginTop: 8,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  eventBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    width: (Dimensions.get('window').width - 42) / 2,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
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
  tripCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tripTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  tripTime: {
    fontSize: 11,
    marginTop: 2,
  },
  tripScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripScoreText: {
    color: '#1A1A1A',
    fontWeight: '800',
    fontSize: 12,
  },
  tripRoutePoints: {
    gap: 4,
    paddingLeft: 4,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePointText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeLineDot: {
    width: 2,
    height: 10,
    backgroundColor: '#9CA3AF',
    marginLeft: 4,
  },
  tripFooterStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tripStatText: {
    fontSize: 11,
  },
  inspectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalMapWrapper: {
    height: 320,
    width: '100%',
    overflow: 'hidden',
  },
  modalTripTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalTripMeta: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalScoreCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalScoreLbl: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalScoreVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalStatBox: {
    width: (Dimensions.get('window').width - 50) / 2,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalStatVal: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  modalStatLbl: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
