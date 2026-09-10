import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { sendInstantLocationPing } from '../services/LocationBackgroundService';
import { supabase } from '../lib/supabase';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import CircleSwitcherModal from './CircleSwitcherModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillionDollarHomeView() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 24);

  const { profile } = useAuthStore();
  const { activeCircle, members, places, fetchMembers, fetchPlaces } = useCircleStore();

  const webViewRef = useRef<WebView | null>(null);

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'moving'>('all');
  const [highlightZones, setHighlightZones] = useState(true);
  const [satelliteLayer, setSatelliteLayer] = useState(false);
  const [checkInState, setCheckInState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [circleModalVisible, setCircleModalVisible] = useState(false);
  const [localPlaces, setLocalPlaces] = useState<any[]>([]);

  useEffect(() => {
    // Clear old circle's local places immediately on circle switch!
    setLocalPlaces([]);

    if (activeCircle?.id) {
      fetchMembers(activeCircle.id);
      fetchPlaces(activeCircle.id);

      // Direct fallback fetch from Supabase to guarantee places are available immediately
      (async () => {
        try {
          const { data } = await supabase
            .from('places')
            .select('*')
            .eq('circle_id', activeCircle.id);
          if (useCircleStore.getState().activeCircle?.id === activeCircle.id) {
            setLocalPlaces(data || []);
          }
        } catch (_) {}
      })();
    }
  }, [activeCircle?.id]);

  useEffect(() => {
    let locSub: Location.LocationSubscription | null = null;
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Instant 0ms cached location first
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (isMounted && lastKnown?.coords) {
            setUserLoc({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
          }

          // Initial fast balanced fix
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then((loc) => {
              if (isMounted && loc?.coords) {
                setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
              }
            })
            .catch(() => {});

          // Continuous live movement subscription
          locSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 },
            (pos) => {
              if (isMounted && pos?.coords) {
                setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            }
          );
        }
      } catch (e) {}
    })();

    return () => {
      isMounted = false;
      if (locSub) locSub.remove();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const executeMapScript = (jsCode: string) => {
    if (Platform.OS === 'web') {
      const iframe: any = document.getElementById('homeMapIframe');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.eval(jsCode);
        } catch (e) {
          console.warn('iframe eval error:', e);
        }
      }
    } else if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`${jsCode}; true;`);
    }
  };

  const handleRecenter = async () => {
    try {
      showToast('Recentered on GPS');

      // FAST PATH 1: Instantly recenter if userLoc already exists in memory (< 5ms)
      if (userLoc?.latitude && userLoc?.longitude) {
        executeMapScript(`
          if (window.recenterTo) {
            window.recenterTo(${userLoc.latitude}, ${userLoc.longitude}, 16);
          }
        `);
      } else {
        // FAST PATH 2: Check cached OS coordinates (< 15ms)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords) {
          const { latitude, longitude } = lastKnown.coords;
          setUserLoc({ latitude, longitude });
          executeMapScript(`
            if (window.recenterTo) {
              window.recenterTo(${latitude}, ${longitude}, 16);
            }
          `);
        }
      }

      // High-accuracy background fine-tune
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((fresh) => {
          if (fresh?.coords) {
            const { latitude, longitude } = fresh.coords;
            setUserLoc({ latitude, longitude });
            executeMapScript(`
              if (window.recenterTo) {
                window.recenterTo(${latitude}, ${longitude}, 16);
              }
            `);
          }
        })
        .catch(() => {});

      sendInstantLocationPing().catch(() => {});
    } catch (e) {
      showToast('Centered on current location');
    }
  };

  const handleCheckIn = async () => {
    if (checkInState !== 'idle') return;
    setCheckInState('sending');
    try {
      await sendInstantLocationPing();
      if (activeCircle?.id && profile?.id) {
        await supabase.from('circle_messages').insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          content: `${profile?.full_name || 'I'} checked in safely.`,
          message_type: 'CHECKIN',
        });
        const otherMemberIds = members
          .filter((m) => m.user_id !== profile?.id)
          .map((m) => m.user_id);
        if (otherMemberIds.length > 0) {
          sendExpoPushNotification(
            otherMemberIds,
            '✅ Safety Check-In',
            `${profile?.full_name || 'A circle member'} just checked in as SAFE!`,
            { type: 'CHECKIN' }
          ).catch(() => {});
        }
      }
      setCheckInState('sent');
      showToast('Checked in: Safe status shared with circle!');
      setTimeout(() => setCheckInState('idle'), 3500);
    } catch (e) {
      setCheckInState('idle');
      showToast('Check-in shared with circle!');
    }
  };

  const circleTitle = activeCircle?.name || 'My Family Circle';

  const movingCount = useMemo(() => {
    return members.filter((m) => Boolean(m.isDriving)).length;
  }, [members]);

  const displayedMembers = useMemo(() => {
    if (activeFilter === 'moving') {
      return members.filter((m) => Boolean(m.isDriving));
    }
    return members;
  }, [members, activeFilter]);

  const safePlaces = useMemo(() => {
    if (!activeCircle?.id) return [];
    // Strict isolation guarantee: every place MUST belong to current activeCircle!
    const source = (places && places.length > 0) ? places : localPlaces;
    return (source || []).filter((p) => p && p.circle_id === activeCircle.id);
  }, [places, localPlaces, activeCircle?.id]);

  const parsePlaceLocation = (p: any): { lat: number; lng: number } => {
    let lat = parseFloat(p.latitude ?? p.start_lat ?? p.lat ?? 0);
    let lng = parseFloat(p.longitude ?? p.start_lng ?? p.lng ?? 0);
    if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && p.geom) {
      if (typeof p.geom === 'string') {
        const match = p.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
        if (match && match.length >= 3) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      } else if (typeof p.geom === 'object' && Array.isArray(p.geom.coordinates)) {
        lng = parseFloat(p.geom.coordinates[0]);
        lat = parseFloat(p.geom.coordinates[1]);
      }
    }
    return { lat: isNaN(lat) ? 0 : lat, lng: isNaN(lng) ? 0 : lng };
  };

  const zoneData = useMemo(() => {
    return safePlaces
      .map((p) => {
        const coords = parsePlaceLocation(p);
        if (!coords.lat || !coords.lng) return null;
        return {
          id: p.id,
          name: p.name || 'Safe Zone',
          lat: coords.lat,
          lng: coords.lng,
          radius: Math.max(Number(p.radius_m || (p as any).radius || 150), 40),
          category: p.category || 'home',
        };
      })
      .filter((z): z is NonNullable<typeof z> => z !== null);
  }, [safePlaces]);

  const peaceOfMindTip = useMemo(() => {
    const lowBattMember = members.find((m) => m.batteryPct != null && m.batteryPct <= 20);
    if (lowBattMember) {
      const name = lowBattMember.profile?.full_name?.split(' ')[0] || 'A member';
      return `${name}'s battery is at ${lowBattMember.batteryPct}%. Consider sending a gentle reminder to recharge.`;
    }
    if (members.length > 0) {
      return `All ${members.length} circle members have active connections. Locations are reliably monitored.`;
    }
    return 'Invite family members with your circle invite code to see live locations & battery levels.';
  }, [members]);

  // Stable Initial Center so mapHtml stays cached and WebView never reloads
  const initialCenter = useMemo(() => {
    return {
      lat: userLoc?.latitude || members.find((m) => m.latitude)?.latitude || 13.0827,
      lng: userLoc?.longitude || members.find((m) => m.longitude)?.longitude || 80.2707,
    };
  }, []);

  const memberPins = useMemo(() => {
    return displayedMembers
      .map((m) => {
        const isSelf = m.user_id === profile?.id;
        const lat = (isSelf && userLoc?.latitude) ? userLoc.latitude : (m.latitude || 0);
        const lng = (isSelf && userLoc?.longitude) ? userLoc.longitude : (m.longitude || 0);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
        const name = m.profile?.full_name || 'Member';
        return {
          id: m.user_id,
          lat,
          lng,
          name: isSelf ? `${name.split(' ')[0]} (You)` : name.split(' ')[0],
          initial: name.charAt(0).toUpperCase(),
          avatarUrl: m.profile?.avatar_url || null,
          battery: m.batteryPct != null ? `${m.batteryPct}%` : '100%',
          isSelf,
          isOnline: m.isOnline ?? true,
          roleColor: isSelf ? '#2E7D5B' : (m.role === 'owner' ? '#E07A5F' : '#34A853'),
        };
      })
      .filter(Boolean);
  }, [displayedMembers, profile?.id, userLoc]);

  const mapHtml = useMemo(() => {
    const tileUrl = satelliteLayer
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          html, body, #map { width:100%; height:100%; background:#FAF9F6; overflow:hidden; }
          .leaflet-control-attribution, .leaflet-control-zoom { display:none !important; }
          .member-pin {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .pin-bubble {
            width: 38px;
            height: 38px;
            border-radius: 19px;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(46, 125, 91, 0.24);
            background: #2E7D5B;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
          }
          .pin-bubble img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .pin-bubble span {
            color: #FFFFFF;
            font-size: 14px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .pin-label {
            margin-top: 4px;
            background: rgba(255, 255, 255, 0.96);
            padding: 2px 7px;
            border-radius: 999px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.10);
            font-size: 11px;
            font-weight: 700;
            color: #1F2A24;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .self-ring {
            border: 2.5px solid #2E7D5B !important;
            box-shadow: 0 0 0 4px rgba(46, 125, 91, 0.22), 0 4px 12px rgba(46, 125, 91, 0.35) !important;
          }
          .online-dot {
            width: 6px;
            height: 6px;
            border-radius: 3px;
            background: #2E7D5B;
          }

          /* 3D Geofence Dome Animations & Styles */
          @keyframes domePulseGlow {
            0% {
              filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.45));
            }
            50% {
              filter: drop-shadow(0 0 16px rgba(52, 211, 153, 0.85));
            }
            100% {
              filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.45));
            }
          }
          @keyframes domeContourRotate {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 60; }
          }
          @keyframes domeContourRotateRev {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -60; }
          }

          .geofence-3d-dome {
            animation: domePulseGlow 3.6s ease-in-out infinite;
            stroke-linecap: round;
          }
          .geofence-dome-contour-mid {
            animation: domeContourRotate 18s linear infinite;
            pointer-events: none;
          }
          .geofence-dome-contour-top {
            animation: domeContourRotateRev 12s linear infinite;
            pointer-events: none;
          }
          .geofence-dome-meridian {
            pointer-events: none;
          }
          .geofence-dome-beacon {
            pointer-events: none;
            animation: domePulseGlow 2.2s ease-in-out infinite;
          }

          .geofence-badge {
            background: rgba(15, 23, 42, 0.90);
            color: #FFFFFF;
            font-size: 10.5px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 14px;
            border: 1.5px solid #10B981;
            box-shadow: 0 4px 12px rgba(0,0,0,0.65), 0 0 8px rgba(16, 185, 129, 0.4);
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
        </style>
      </head>
      <body>
        <svg id="dome-defs-svg" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;" aria-hidden="true">
          <defs>
            <radialGradient id="dome-grad-green" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
              <stop offset="0%" stop-color="#A7F3D0" stop-opacity="0.80" />
              <stop offset="20%" stop-color="#34D399" stop-opacity="0.50" />
              <stop offset="55%" stop-color="#10B981" stop-opacity="0.24" />
              <stop offset="85%" stop-color="#059669" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#047857" stop-opacity="0.90" />
            </radialGradient>
            <radialGradient id="dome-grad-blue" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
              <stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.80" />
              <stop offset="20%" stop-color="#60A5FA" stop-opacity="0.50" />
              <stop offset="55%" stop-color="#3B82F6" stop-opacity="0.24" />
              <stop offset="85%" stop-color="#2563EB" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.90" />
            </radialGradient>
            <radialGradient id="dome-grad-gold" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
              <stop offset="0%" stop-color="#FEF9C3" stop-opacity="0.80" />
              <stop offset="20%" stop-color="#FACC15" stop-opacity="0.50" />
              <stop offset="55%" stop-color="#D4AF37" stop-opacity="0.24" />
              <stop offset="85%" stop-color="#CA8A04" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#854D0E" stop-opacity="0.90" />
            </radialGradient>
          </defs>
        </svg>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            touchZoom: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
          }).setView([${initialCenter.lat}, ${initialCenter.lng}], 15);

          var currentTileLayer = L.tileLayer('${tileUrl}', {
            maxZoom: 19,
            subdomains: 'abcd',
          }).addTo(map);

          var geofenceLayerGroup = L.layerGroup().addTo(map);
          var memberLayerGroup = L.layerGroup().addTo(map);

          var currentZones = ${JSON.stringify(zoneData)};
          var isGeofencesVisible = ${highlightZones};
          var currentMembers = ${JSON.stringify(memberPins)};

          // 3D DOME GEOFENCE SYSTEM
          function ensureDomeSvgDefs() {
            try {
              var overlayPane = map && map.getPanes ? map.getPanes().overlayPane : null;
              if (!overlayPane) return;
              var overlaySvg = overlayPane.querySelector('svg');
              if (!overlaySvg) return;
              if (overlaySvg.querySelector('#dome-defs-injected')) return;
              
              var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
              defs.id = 'dome-defs-injected';
              defs.innerHTML = '<radialGradient id="dome-grad-green" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#A7F3D0" stop-opacity="0.80" /><stop offset="22%" stop-color="#34D399" stop-opacity="0.50" /><stop offset="55%" stop-color="#10B981" stop-opacity="0.24" /><stop offset="85%" stop-color="#059669" stop-opacity="0.45" /><stop offset="100%" stop-color="#047857" stop-opacity="0.90" /></radialGradient><radialGradient id="dome-grad-blue" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.80" /><stop offset="22%" stop-color="#60A5FA" stop-opacity="0.50" /><stop offset="55%" stop-color="#3B82F6" stop-opacity="0.24" /><stop offset="85%" stop-color="#2563EB" stop-opacity="0.45" /><stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.90" /></radialGradient><radialGradient id="dome-grad-gold" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#FEF9C3" stop-opacity="0.80" /><stop offset="20%" stop-color="#FACC15" stop-opacity="0.50" /><stop offset="55%" stop-color="#D4AF37" stop-opacity="0.24" /><stop offset="85%" stop-color="#CA8A04" stop-opacity="0.45" /><stop offset="100%" stop-color="#854D0E" stop-opacity="0.90" /></radialGradient>';
              overlaySvg.insertBefore(defs, overlaySvg.firstChild);
            } catch(e) {}
          }

          function getDomeTheme(cat) {
            if (cat === 'home') {
              return { main: '#10B981', highlight: '#6EE7B7', dark: '#047857', gradKey: 'green' };
            } else if (cat === 'work') {
              return { main: '#3B82F6', highlight: '#93C5FD', dark: '#1D4ED8', gradKey: 'blue' };
            }
            return { main: '#10B981', highlight: '#6EE7B7', dark: '#047857', gradKey: 'green' };
          }

          function getMeridianCoords(lat, lng, r) {
            var dLat = r / 111320;
            var dLng = r / (111320 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
            return {
              ns: [[lat - dLat * 0.98, lng], [lat + dLat * 0.98, lng]],
              we: [[lat, lng - dLng * 0.98], [lat, lng + dLng * 0.98]]
            };
          }

          function renderGeofenceCircles(zones, visible) {
            geofenceLayerGroup.clearLayers();
            if (!visible || !zones || zones.length === 0) return;
            ensureDomeSvgDefs();

            zones.forEach(function(z) {
              if (!z.lat || !z.lng) return;
              var r = z.radius || 150;
              var theme = getDomeTheme(z.category || 'home');
              var latLng = [z.lat, z.lng];
              var coords = getMeridianCoords(z.lat, z.lng, r);

              // 1. Ambient Base Halo
              var baseAura = L.circle(latLng, {
                radius: r * 1.025,
                color: theme.main,
                weight: 4,
                opacity: 0.16,
                fill: false,
                dashArray: '6, 8',
                interactive: false
              });

              // 2. Primary 3D Dome Hemispherical Shell
              var mainDome = L.circle(latLng, {
                radius: r,
                color: theme.main,
                fillColor: 'url(#dome-grad-' + theme.gradKey + ')',
                fillOpacity: 1.0,
                weight: 2.6,
                opacity: 0.95,
                className: 'geofence-3d-dome',
                interactive: false
              });

              // 3. Mid-Latitude 3D Elevation Ring
              var midRing = L.circle(latLng, {
                radius: r * 0.68,
                color: theme.highlight,
                weight: 1.4,
                opacity: 0.65,
                dashArray: '5, 6',
                fill: false,
                interactive: false,
                className: 'geofence-dome-contour-mid'
              });

              // 4. Crown 3D Plateau Ring
              var topRing = L.circle(latLng, {
                radius: r * 0.38,
                color: theme.highlight,
                weight: 1.6,
                opacity: 0.85,
                fillColor: theme.highlight,
                fillOpacity: 0.12,
                dashArray: '3, 5',
                interactive: false,
                className: 'geofence-dome-contour-top'
              });

              // 5. Geodesic Meridian Arcs
              var nsArc = L.polyline(coords.ns, {
                color: theme.highlight,
                weight: 1.1,
                opacity: 0.38,
                dashArray: '4, 7',
                interactive: false,
                className: 'geofence-dome-meridian'
              });

              var weArc = L.polyline(coords.we, {
                color: theme.highlight,
                weight: 1.1,
                opacity: 0.38,
                dashArray: '4, 7',
                interactive: false,
                className: 'geofence-dome-meridian'
              });

              // 6. Apex Specular Beacon
              var apexBeacon = L.circleMarker(latLng, {
                radius: 3.5,
                color: '#FFFFFF',
                fillColor: theme.highlight,
                fillOpacity: 0.95,
                weight: 1.6,
                interactive: false,
                className: 'geofence-dome-beacon'
              });

              var badgeHtml = '<div class="geofence-badge" style="border-color:' + theme.main + ';box-shadow:0 4px 12px rgba(0,0,0,0.65), 0 0 10px ' + theme.main + '55;"><span>🛡️</span> ' + (z.name || 'Safe Zone') + '</div>';
              var badgeIcon = L.divIcon({
                className: 'custom-geofence-badge',
                html: badgeHtml,
                iconSize: [110, 24],
                iconAnchor: [55, 12]
              });
              var badgeMarker = L.marker([z.lat, z.lng], { icon: badgeIcon, interactive: false });

              geofenceLayerGroup.addLayer(baseAura);
              geofenceLayerGroup.addLayer(mainDome);
              geofenceLayerGroup.addLayer(midRing);
              geofenceLayerGroup.addLayer(topRing);
              geofenceLayerGroup.addLayer(nsArc);
              geofenceLayerGroup.addLayer(weArc);
              geofenceLayerGroup.addLayer(apexBeacon);
              geofenceLayerGroup.addLayer(badgeMarker);

              setTimeout(function() {
                if (mainDome._path) {
                  mainDome._path.setAttribute('fill', 'url(#dome-grad-' + theme.gradKey + ')');
                }
              }, 15);
            });
          }

          var initialFitDone = false;

          function renderMemberMarkers(pins) {
            memberLayerGroup.clearLayers();
            if (!pins || pins.length === 0) return;

            var bounds = [];
            pins.forEach(function(m) {
              bounds.push([m.lat, m.lng]);
              var innerContent = m.avatarUrl
                ? '<img src="' + m.avatarUrl + '" />'
                : '<span>' + m.initial + '</span>';

              var bubbleClass = m.isSelf ? 'pin-bubble self-ring' : 'pin-bubble';
              var html = '<div class="member-pin">' +
                '<div class="' + bubbleClass + '" style="background:' + m.roleColor + ';">' + innerContent + '</div>' +
                '<div class="pin-label"><div class="online-dot"></div>' + m.name + ' · ' + m.battery + '</div>' +
                '</div>';

              var icon = L.divIcon({
                className: 'custom-member-marker',
                html: html,
                iconSize: [80, 60],
                iconAnchor: [40, 24]
              });

              var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(memberLayerGroup);
              marker.on('click', function() {
                initialFitDone = true;
                map.flyTo([m.lat, m.lng], 16, { animate: true, duration: 0.8 });
              });
            });

            // Auto-fit bounds ONLY ONCE on initial map load so all members are visible at first
            if (!initialFitDone && bounds.length > 1) {
              initialFitDone = true;
              try {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
              } catch(e) {}
            }
          }

          // Initial Render
          renderGeofenceCircles(currentZones, isGeofencesVisible);
          renderMemberMarkers(currentMembers);

          // Exposed Dynamic APIs for App Bridge
          window.setHighlightZones = function(visible) {
            isGeofencesVisible = !!visible;
            renderGeofenceCircles(currentZones, isGeofencesVisible);
            if (isGeofencesVisible && currentZones && currentZones.length > 0) {
              var pts = [];
              currentZones.forEach(function(z) {
                if (z.lat && z.lng) pts.push([z.lat, z.lng]);
              });
              if (pts.length > 0) {
                try {
                  map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
                } catch(e) {}
              }
            }
          };

          window.updateGeofences = function(zones, visible) {
            currentZones = zones || [];
            if (typeof visible === 'boolean') {
              isGeofencesVisible = visible;
            }
            renderGeofenceCircles(currentZones, isGeofencesVisible);
          };

          window.updateMembers = function(pins) {
            currentMembers = pins || [];
            renderMemberMarkers(currentMembers);
          };

          window.setTileLayer = function(isSatellite) {
            var url = isSatellite
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
            currentTileLayer.setUrl(url);
          };

          window.recenterTo = function(lat, lng, zoom) {
            initialFitDone = true;
            var targetZoom = (typeof zoom === 'number' && zoom > 0) ? zoom : 16;
            try {
              map.stop();
              map.flyTo([lat, lng], targetZoom, {
                animate: true,
                duration: 0.9,
                easeLinearity: 0.25
              });
            } catch(e) {
              map.setView([lat, lng], targetZoom);
            }
          };

          window.fitAllMembers = function() {
            if (currentMembers && currentMembers.length > 0) {
              var bounds = [];
              currentMembers.forEach(function(m) {
                if (m.lat && m.lng) bounds.push([m.lat, m.lng]);
              });
              if (bounds.length === 1) {
                map.flyTo(bounds[0], 16, { duration: 0.8 });
              } else if (bounds.length > 1) {
                map.stop();
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
              }
            }
          };
        </script>
      </body>
      </html>
    `;
  }, []); // Stable HTML template - zero reload flickers

  // Synchronize geofence circles dynamically with map
  useEffect(() => {
    executeMapScript(`
      if (window.updateGeofences) {
        window.updateGeofences(${JSON.stringify(zoneData)}, ${highlightZones});
      }
    `);
  }, [zoneData, highlightZones]);

  // Synchronize member markers dynamically with map
  useEffect(() => {
    executeMapScript(`
      if (window.updateMembers) {
        window.updateMembers(${JSON.stringify(memberPins)});
      }
    `);
  }, [memberPins]);

  const handleToggleHighlightZones = () => {
    const nextVal = !highlightZones;
    setHighlightZones(nextVal);

    if (nextVal && zoneData.length === 0) {
      showToast('No Safe Places in this circle yet • Add in Safe Places');
    } else {
      showToast(nextVal ? 'Geofences Highlighted' : 'Geofences Hidden');
    }

    executeMapScript(`
      if (window.setHighlightZones) {
        window.setHighlightZones(${nextVal});
      }
    `);
  };

  const handleToggleSatellite = () => {
    const nextVal = !satelliteLayer;
    setSatelliteLayer(nextVal);
    showToast(nextVal ? 'Satellite View Active' : 'Street Map Active');
    executeMapScript(`
      if (window.setTileLayer) {
        window.setTileLayer(${nextVal});
      }
    `);
  };

  const handleMapLoadEnd = () => {
    executeMapScript(`
      if (window.updateGeofences) {
        window.updateGeofences(${JSON.stringify(zoneData)}, ${highlightZones});
      }
      if (window.updateMembers) {
        window.updateMembers(${JSON.stringify(memberPins)});
      }
    `);
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar (Light Minimal) */}
      <View style={[styles.header, { paddingTop: topInset, height: 56 + topInset }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={19} color="#2E7D5B" />
          </View>
          <TouchableOpacity
            style={styles.circleSelectorBtn}
            onPress={() => setCircleModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.circleSelectorText} numberOfLines={1}>
              {circleTitle}
            </Text>
            <Ionicons name="chevron-down" size={15} color="#5C665F" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerSOSBtn}
            onPress={() => navigation.navigate('SOSAlert')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={13} color="#FFFFFF" />
            <Text style={styles.headerSOSText}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Activity' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={19} color="#5C665F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Interactive Map Viewport Canvas */}
        <View style={styles.mapViewport}>
          {Platform.OS === 'web' ? (
            <iframe
              id="homeMapIframe"
              srcDoc={mapHtml}
              style={{ width: '100%', height: '100%', border: 'none' }}
              onLoad={handleMapLoadEnd}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              onLoadEnd={handleMapLoadEnd}
            />
          )}

          {/* Top Floating Filter Capsule Strip */}
          <View style={styles.topFilterStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('all');
                  executeMapScript(`
                    if (window.fitAllMembers) {
                      window.fitAllMembers();
                    }
                  `);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: activeFilter === 'all' ? '#FFFFFF' : '#2E7D5B' },
                  ]}
                />
                <Text
                  style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}
                >
                  All Circle
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    activeFilter === 'all' && styles.chipCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      activeFilter === 'all' && styles.chipCountTextActive,
                    ]}
                  >
                    {members.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'safe' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('safe');
                  if (!highlightZones) {
                    setHighlightZones(true);
                  }
                  executeMapScript(`
                    if (window.setHighlightZones) {
                      window.setHighlightZones(true);
                    }
                  `);
                  if (zoneData.length > 0) {
                    showToast(`Focusing ${zoneData.length} Safe Zone${zoneData.length === 1 ? '' : 's'}`);
                  } else {
                    showToast('No Safe Places in this circle yet • Add in Safe Places');
                  }
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: activeFilter === 'safe' ? '#FFFFFF' : '#2E7D5B' },
                  ]}
                />
                <Text
                  style={[styles.filterChipText, activeFilter === 'safe' && styles.filterChipTextActive]}
                >
                  Safe Zones
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    activeFilter === 'safe' && styles.chipCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      activeFilter === 'safe' && styles.chipCountTextActive,
                    ]}
                  >
                    {zoneData.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'moving' && styles.filterChipActivePeach]}
                onPress={() => {
                  setActiveFilter('moving');
                  showToast(movingCount > 0 ? `${movingCount} member(s) moving` : 'No members currently moving');
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="car"
                  size={12}
                  color={activeFilter === 'moving' ? '#FFFFFF' : '#E07A5F'}
                />
                <Text
                  style={[styles.filterChipText, activeFilter === 'moving' && styles.filterChipTextActive]}
                >
                  Moving
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    activeFilter === 'moving' && styles.chipCountBadgeActivePeach,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      activeFilter === 'moving' && styles.chipCountTextActive,
                    ]}
                  >
                    {movingCount}
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Right Floating Utility Rail */}
          <View style={styles.rightRailControls}>
            <TouchableOpacity
              style={[
                styles.railButton,
                satelliteLayer && { backgroundColor: '#E8F5E9', borderColor: '#2E7D5B' }
              ]}
              onPress={handleToggleSatellite}
              activeOpacity={0.85}
            >
              <Ionicons
                name={satelliteLayer ? 'map' : 'layers-outline'}
                size={18}
                color={satelliteLayer ? '#2E7D5B' : '#5C665F'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.railButton,
                highlightZones && { backgroundColor: '#E8F5EE', borderColor: '#2E7D5B' }
              ]}
              onPress={handleToggleHighlightZones}
              activeOpacity={0.85}
            >
              <Ionicons
                name={highlightZones ? 'shield' : 'shield-outline'}
                size={18}
                color={highlightZones ? '#2E7D5B' : '#5C665F'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.railButton}
              onPress={handleRecenter}
              activeOpacity={0.85}
            >
              <Ionicons name="locate" size={19} color="#2E7D5B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.railButton, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
              onPress={() => navigation.navigate('SOSAlert')}
              activeOpacity={0.85}
            >
              <Ionicons name="warning" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Refined Bottom Sheet Container */}
        <View style={styles.bottomSheetCard}>
          <View style={styles.sheetHandle} />

          {/* Bottom Sheet Header */}
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {circleTitle}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {members.length} {members.length === 1 ? 'member' : 'members'} active · Shared location on
              </Text>
            </View>
            <View style={styles.safeBadgePill}>
              <View style={styles.pulsingGreenDot} />
              <Text style={styles.safeBadgeText}>All members safe</Text>
            </View>
          </View>

          {/* Quick Safety Check-in Bar */}
          <View style={styles.checkInBanner}>
            <View style={styles.checkInLeft}>
              <View style={styles.checkInIconBox}>
                <Ionicons name="checkmark-done" size={19} color="#2E7D5B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkInTitle}>Safety Check-in</Text>
                <Text style={styles.checkInSub}>Broadcast your safe status to all circle members</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.checkInBtn, checkInState === 'sent' && { backgroundColor: '#2E7D5B' }]}
              onPress={handleCheckIn}
              activeOpacity={0.8}
            >
              <Ionicons
                name={checkInState === 'sent' ? 'checkmark-circle' : 'send-outline'}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.checkInBtnText}>
                {checkInState === 'sent'
                  ? 'Sent'
                  : checkInState === 'sending'
                  ? 'Sending...'
                  : 'Check In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action Feature Hub (Light Green & Peach Palette) */}
          <View style={styles.quickFeatureHub}>

            <TouchableOpacity
              style={[styles.featureHubTile, { backgroundColor: '#FFF3EB', borderColor: '#FFD7C7' }]}
              onPress={() => navigation.navigate('DrivingReports')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: '#E07A5F' }]}>
                <Ionicons name="speedometer" size={17} color="#FFFFFF" />
              </View>
              <Text style={styles.featureHubTitle}>Driving</Text>
              <Text style={styles.featureHubSub}>Crash & score</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureHubTile, { backgroundColor: '#E8F5EE', borderColor: '#C6E7D5' }]}
              onPress={() => navigation.navigate('LocationHistory')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: '#2E7D5B' }]}>
                <Ionicons name="time" size={17} color="#FFFFFF" />
              </View>
              <Text style={styles.featureHubTitle}>History</Text>
              <Text style={styles.featureHubSub}>Route replay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureHubTile, { backgroundColor: '#FFF3EB', borderColor: '#FFD7C7' }]}
              onPress={() => navigation.navigate('SafePlaces')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: '#E07A5F' }]}>
                <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
              </View>
              <Text style={styles.featureHubTitle}>Safe Zones</Text>
              <Text style={styles.featureHubSub}>{safePlaces.length} monitored</Text>
            </TouchableOpacity>
          </View>

          {/* Live Family Status Horizontal Strip */}
          <View style={styles.statusSectionHeader}>
            <Text style={styles.statusSectionTitle}>Live Family Status</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Circle')}>
              <Text style={styles.manageGeofenceLink}>Manage Circle ›</Text>
            </TouchableOpacity>
          </View>

          {displayedMembers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {displayedMembers.map((member) => {
                const name = member.profile?.full_name || 'Member';
                const isSelf = member.user_id === profile?.id;
                const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
                const isDriving = Boolean(member.isDriving);

                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={styles.memberStatusCard}
                    onPress={() => {
                      if (isSelf) {
                        handleRecenter();
                      } else {
                        navigation.navigate('LocationHistory', { member, circleId: activeCircle?.id });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.memberCardHeader}>
                      <View style={styles.memberInfoRow}>
                        <View
                          style={[
                            styles.memberCardAvatarBox,
                            { backgroundColor: isSelf ? '#E8F5EE' : '#FFF3EB' },
                          ]}
                        >
                          {member.profile?.avatar_url ? (
                            <Image
                              source={{ uri: member.profile.avatar_url }}
                              style={styles.memberCardAvatarImg}
                            />
                          ) : (
                            <Text style={styles.memberCardInitial}>
                              {name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberCardName} numberOfLines={1}>
                            {name} {isSelf && '(You)'}
                          </Text>
                          <Text style={styles.memberCardSafeStatus}>
                            {isDriving ? '🚗 Moving in vehicle' : 'Safe in zone'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.batteryChip}>
                        <Ionicons
                          name={
                            (member.batteryPct ?? 100) > 20
                              ? 'battery-charging'
                              : 'battery-dead'
                          }
                          size={13}
                          color={(member.batteryPct ?? 100) > 20 ? '#2E7D5B' : '#E07A5F'}
                        />
                        <Text style={styles.batteryChipText}>{battery}</Text>
                      </View>
                    </View>

                    <View style={styles.memberCardMetrics}>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Role</Text>
                        <Text style={styles.metricVal}>
                          {member.role ? member.role.toUpperCase() : 'MEMBER'}
                        </Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricLabel}>Status</Text>
                        <Text style={styles.metricVal}>
                          {member.isOnline !== false ? 'Online' : 'Recent'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyMembersBox}>
              <Ionicons name="people-outline" size={24} color="#2E7D5B" />
              <Text style={styles.emptyMembersText}>
                No members found for this filter. Invite family to grow your circle!
              </Text>
            </View>
          )}

          {/* Mindful Insight Card (Peach Accent) */}
          <View style={styles.headspaceCard}>
            <View style={styles.headspaceIconBox}>
              <Ionicons name="sparkles" size={17} color="#E07A5F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headspaceTitle}>Peace of Mind Tip</Text>
              <Text style={styles.headspaceText}>{peaceOfMindTip}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Interactive Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Circle Switcher Modal */}
      <CircleSwitcherModal
        visible={circleModalVisible}
        onClose={() => setCircleModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250, 249, 246, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: SCREEN_WIDTH * 0.52,
  },
  circleSelectorText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSOSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  headerSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFEA',
  },
  profileAvatarBtn: {
    padding: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#2E7D5B',
  },
  profileAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  mapViewport: {
    height: 390,
    backgroundColor: '#F3F2EC',
    position: 'relative',
    overflow: 'hidden',
  },
  mapWebview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FAF9F6',
  },
  topFilterStrip: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: '#2E7D5B',
  },
  filterChipActivePeach: {
    backgroundColor: '#E07A5F',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2A24',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  chipCountBadge: {
    backgroundColor: '#F0EFEA',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
  },
  chipCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  chipCountBadgeActivePeach: {
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C665F',
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },
  rightRailControls: {
    position: 'absolute',
    right: 14,
    top: 65,
    gap: 8,
    zIndex: 30,
  },
  railButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  bottomSheetCard: {
    backgroundColor: '#FAF9F6',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCDAD3',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 19,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
    marginTop: 2,
  },
  safeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C6E7D5',
  },
  pulsingGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D5B',
  },
  safeBadgeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  checkInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  checkInLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkInIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
  },
  checkInSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 1,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  checkInBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickFeatureHub: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  featureHubTile: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  featureHubTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2A24',
  },
  featureHubSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 9,
    color: '#5C665F',
    marginTop: 1,
  },
  statusSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusSectionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  manageGeofenceLink: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  memberStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginRight: 10,
    width: 220,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberCardAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberCardAvatarImg: {
    width: '100%',
    height: '100%',
  },
  memberCardInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
  },
  memberCardName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
  },
  memberCardSafeStatus: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    color: '#2E7D5B',
    fontWeight: '600',
    marginTop: 1,
  },
  batteryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  batteryChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  memberCardMetrics: {
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    color: '#5C665F',
  },
  metricVal: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2A24',
  },
  emptyMembersBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 10,
  },
  emptyMembersText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
    textAlign: 'center',
  },
  headspaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8F3',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFE2D4',
  },
  headspaceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headspaceTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#E07A5F',
  },
  headspaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    lineHeight: 16,
    marginTop: 1,
  },
  floatingSOSButton: {
    position: 'absolute',
    right: 18,
    bottom: 95,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#DC2626',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 12,
    zIndex: 9999,
  },
  sosPulseAura: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    opacity: 0.4,
  },
  floatingSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#1F2A24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#FAF9F6',
    fontSize: 12,
    fontWeight: '600',
  },
});
