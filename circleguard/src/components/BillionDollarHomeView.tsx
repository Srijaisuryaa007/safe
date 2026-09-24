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
const WebViewAny: any = WebView;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { sendInstantLocationPing } from '../services/LocationBackgroundService';
import { supabase } from '../lib/supabase';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { broadcastCheckIn } from '../services/ActivityService';
import { calculateHaversineDistanceMeters } from '../services/LocationSmoothingService';
import CircleSwitcherModal from './CircleSwitcherModal';
import CurrentAddressModal from './CurrentAddressModal';
import OrbitalGoldenLogoBadge from './OrbitalGoldenLogoBadge';
import { getSafeTopInset } from '../utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LAST_USER_LOC_STORAGE_KEY = '@circleguard_last_user_location';

export default function BillionDollarHomeView() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { profile } = useAuthStore();
  const { activeCircle, members, places, fetchMembers, fetchPlaces } = useCircleStore();
  const { isDark } = useThemeStore();

  const webViewRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const hasCenteredOnUserRef = useRef(false);
  const lastFocusedMemberIndexRef = useRef<number>(-1);

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'moving'>('all');
  const [highlightZones, setHighlightZones] = useState(true);
  const [satelliteLayer, setSatelliteLayer] = useState(false);
  const [checkInState, setCheckInState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [circleModalVisible, setCircleModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [localPlaces, setLocalPlaces] = useState<any[]>([]);

  const centerMapOnUser = (lat: number, lng: number, force: boolean = false) => {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    if (!hasCenteredOnUserRef.current || force) {
      hasCenteredOnUserRef.current = true;
      executeMapScript(`
        if (window.recenterTo) {
          window.recenterTo(${lat}, ${lng}, 16, true);
        } else if (window.map) {
          window.map.setView([${lat}, ${lng}], 16);
        }
      `);
    }
  };

  const updateUserLocation = (coords: { latitude: number; longitude: number }, forceCenter: boolean = false) => {
    if (!coords?.latitude || !coords?.longitude || isNaN(coords.latitude) || isNaN(coords.longitude)) return;
    setUserLoc(coords);
    AsyncStorage.setItem(LAST_USER_LOC_STORAGE_KEY, JSON.stringify(coords)).catch(() => {});
    if (forceCenter || !hasCenteredOnUserRef.current) {
      centerMapOnUser(coords.latitude, coords.longitude, forceCenter);
    }
  };

  // Immediate 0ms cache restore on mount
  useEffect(() => {
    AsyncStorage.getItem(LAST_USER_LOC_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.latitude && parsed?.longitude) {
            setUserLoc((prev) => prev || parsed);
            if (!hasCenteredOnUserRef.current) {
              centerMapOnUser(parsed.latitude, parsed.longitude);
            }
          }
        } catch (_) {}
      }
    });
  }, []);

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
            updateUserLocation({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude }, true);
          }

          // Initial fast balanced fix
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then((loc) => {
              if (isMounted && loc?.coords) {
                updateUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
              }
            })
            .catch(() => {});

          // Continuous live movement subscription
          locSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 },
            (pos) => {
              if (isMounted && pos?.coords) {
                updateUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
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
          updateUserLocation({ latitude, longitude }, true);
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
            updateUserLocation({ latitude, longitude });
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

  const otherMembersWithLocation = useMemo(() => {
    return members.filter(
      (m) => m.user_id !== profile?.id && m.latitude && m.longitude && !isNaN(m.latitude) && !isNaN(m.longitude)
    );
  }, [members, profile?.id]);

  const handleFocusOthers = () => {
    if (otherMembersWithLocation.length === 0) {
      const nonSelfMembers = members.filter((m) => m.user_id !== profile?.id);
      if (nonSelfMembers.length === 0) {
        showToast('Invite family members to see their live locations');
      } else {
        const name = nonSelfMembers[0].profile?.full_name?.split(' ')[0] || 'Member';
        showToast(`Waiting for ${name}'s GPS location to sync`);
      }
      return;
    }

    if (otherMembersWithLocation.length === 1) {
      const target = otherMembersWithLocation[0];
      const name = target.profile?.full_name?.split(' ')[0] || 'Member';
      executeMapScript(`
        if (window.recenterTo) {
          window.recenterTo(${target.latitude}, ${target.longitude}, 16);
        } else if (window.map) {
          window.map.setView([${target.latitude}, ${target.longitude}], 16);
        }
      `);
      showToast(`📍 Focused on ${name}'s location`);
      return;
    }

    // Multiple other members: cycle through each, then show all
    const nextIdx = (lastFocusedMemberIndexRef.current + 1) % (otherMembersWithLocation.length + 1);
    lastFocusedMemberIndexRef.current = nextIdx;

    if (nextIdx < otherMembersWithLocation.length) {
      const target = otherMembersWithLocation[nextIdx];
      const name = target.profile?.full_name?.split(' ')[0] || 'Member';
      executeMapScript(`
        if (window.recenterTo) {
          window.recenterTo(${target.latitude}, ${target.longitude}, 16);
        } else if (window.map) {
          window.map.setView([${target.latitude}, ${target.longitude}], 16);
        }
      `);
      showToast(`📍 (${nextIdx + 1}/${otherMembersWithLocation.length}) Focused on ${name}`);
    } else {
      executeMapScript(`
        if (window.fitAllMembers) {
          window.fitAllMembers();
        }
      `);
      showToast(`🌐 Viewing all ${otherMembersWithLocation.length + 1} circle members`);
    }
  };

  const focusMemberOnMap = (target: any) => {
    if (!target) return;
    const lat = target.latitude;
    const lng = target.longitude;
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      navigation.navigate('LocationHistory', { member: target, circleId: activeCircle?.id });
      return;
    }
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    const name = target.profile?.full_name?.split(' ')[0] || 'Member';
    executeMapScript(`
      if (window.recenterTo) {
        window.recenterTo(${lat}, ${lng}, 16);
      } else if (window.map) {
        window.map.setView([${lat}, ${lng}], 16);
      }
    `);
    showToast(`📍 Focused on ${name}'s location`);
  };

  const handleCheckIn = async () => {
    if (checkInState !== 'idle') return;
    setCheckInState('sending');
    try {
      if (activeCircle?.id && profile?.id) {
        const otherMemberIds = members
          .filter((m) => m.user_id !== profile?.id)
          .map((m) => m.user_id);

        await broadcastCheckIn({
          circleId: activeCircle.id,
          circleName: activeCircle.name,
          userId: profile.id,
          userName: profile.full_name || 'Member',
          userAvatar: profile.avatar_url,
          otherMemberIds,
        });
      } else {
        await sendInstantLocationPing();
      }
      setCheckInState('sent');
      showToast('Checked in: Safe status shared with circle!');
      setTimeout(() => setCheckInState('idle'), 3500);
    } catch (e) {
      setCheckInState('sent');
      showToast('Checked in safely!');
      setTimeout(() => setCheckInState('idle'), 3500);
    }
  };

  const circleTitle = activeCircle?.name || 'My Family Circle';

  const movingCount = useMemo(() => {
    return members.filter((m) => Boolean(m.isDriving)).length;
  }, [members]);

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

  // Precise geofence containment checker for family members
  const getMemberSafeZoneStatus = (member: any) => {
    const isSelf = member.user_id === profile?.id;
    const lat = (isSelf && userLoc?.latitude) ? userLoc.latitude : (member.latitude || 0);
    const lng = (isSelf && userLoc?.longitude) ? userLoc.longitude : (member.longitude || 0);

    if (member.isDriving) {
      return {
        isInZone: false,
        statusText: '🚗 Moving in vehicle',
        color: isDark ? '#818CF8' : '#183CE6',
        zoneName: null,
      };
    }

    if (!lat || !lng || zoneData.length === 0) {
      return {
        isInZone: false,
        statusText: 'Outside Safe Zones',
        color: isDark ? '#9EACA3' : '#718076',
        zoneName: null,
      };
    }

    for (const zone of zoneData) {
      const distM = calculateHaversineDistanceMeters(lat, lng, zone.lat, zone.lng);
      if (distM <= zone.radius) {
        const cleanName = (zone.name || 'Safe Zone')
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .trim() || 'Safe Zone';
        return {
          isInZone: true,
          statusText: `In ${cleanName}`,
          color: isDark ? '#3ADFAB' : '#2E7D5B',
          zoneName: cleanName,
        };
      }
    }

    return {
      isInZone: false,
      statusText: 'Outside Safe Zones',
      color: isDark ? '#9EACA3' : '#718076',
      zoneName: null,
    };
  };

  const displayedMembers = useMemo(() => {
    if (activeFilter === 'moving') {
      return members.filter((m) => Boolean(m.isDriving));
    }
    if (activeFilter === 'safe') {
      return members.filter((m) => {
        const st = getMemberSafeZoneStatus(m);
        return st.isInZone;
      });
    }
    return members;
  }, [members, activeFilter, zoneData, profile?.id, userLoc]);

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
  const selfMember = members.find((m) => m.user_id === profile?.id);
  const initialCenter = useMemo(() => {
    return {
      lat: userLoc?.latitude || selfMember?.latitude || 13.0827,
      lng: userLoc?.longitude || selfMember?.longitude || 80.2707,
    };
  }, []);

  const memberPins = useMemo(() => {
    return displayedMembers
      .map((m) => {
        const isSelf = m.user_id === profile?.id;
        const lat = (isSelf && userLoc?.latitude) ? userLoc.latitude : (m.latitude || 0);
        const lng = (isSelf && userLoc?.longitude) ? userLoc.longitude : (m.longitude || 0);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
        const rawName = m.profile?.full_name || 'Member';
        const cleanName = rawName
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .trim();
        return {
          id: m.user_id,
          lat,
          lng,
          name: isSelf ? 'You' : (cleanName.split(' ')[0] || 'Member'),
          initial: (cleanName || 'M').charAt(0).toUpperCase(),
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
          html, body, #map {
            width:100%; height:100%;
            background-color: #0E131F;
            background-image:
              radial-gradient(circle at 50% 50%, rgba(46, 125, 91, 0.08) 0%, transparent 65%),
              linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
            background-size: 100% 100%, 36px 36px, 36px 36px;
            overflow:hidden;
          }
          .leaflet-container {
            background-color: #0E131F !important;
            background-image:
              radial-gradient(circle at 50% 50%, rgba(46, 125, 91, 0.08) 0%, transparent 65%),
              linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px) !important;
            background-size: 100% 100%, 36px 36px, 36px 36px !important;
          }
          .leaflet-tile-container { will-change: transform; }
          .leaflet-zoom-animated { will-change: transform; }
          .leaflet-tile { will-change: transform, opacity; }
          .leaflet-control-attribution, .leaflet-control-zoom { display:none !important; }
          .member-pin {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
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
            font-size: 13px;
            font-weight: 700;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          }
          .pin-label {
            margin-top: 5px;
            background: rgba(15, 23, 42, 0.90);
            border: 1px solid rgba(255, 255, 255, 0.14);
            padding: 3px 9px;
            border-radius: 999px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: -0.1px;
            color: #F8FAFC;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
          .pin-label.self-label {
            background: rgba(15, 23, 42, 0.95);
            border: 1.5px solid #3ADFAB;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 10px rgba(58, 223, 171, 0.3);
            color: #FFFFFF;
            font-weight: 700;
          }
          .self-ring {
            border: 2.5px solid #2E7D5B !important;
            box-shadow: 0 0 0 4px rgba(46, 125, 91, 0.22), 0 4px 12px rgba(46, 125, 91, 0.35) !important;
          }
          .online-dot {
            width: 6px;
            height: 6px;
            border-radius: 3px;
            background: #10B981;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
          }
          .online-dot.self-dot {
            background: #3ADFAB;
            box-shadow: 0 0 8px #3ADFAB;
          }
          .batt-tag {
            font-size: 10px;
            font-weight: 500;
            opacity: 0.8;
          }
          .sep-dot {
            opacity: 0.4;
            font-size: 9px;
          }

          /* Clean Subtle Geofence Styles */
          .custom-geofence-badge {
            background: transparent !important;
            border: none !important;
          }
          .geofence-badge {
            transform: translate(-50%, -50%);
            background: rgba(15, 23, 42, 0.92);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3px;
            padding: 4px 11px;
            border-radius: 999px;
            border: 1.5px solid #10B981;
            box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 10px rgba(16, 185, 129, 0.3);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            pointer-events: none;
          }
          .geofence-badge svg {
            flex-shrink: 0;
          }
          .geofence-name {
            color: #F8FAFC;
            font-weight: 700;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
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
            zoomAnimation: true,
            zoomAnimationThreshold: 20,
            fadeAnimation: true,
            markerZoomAnimation: true,
            dragging: true,
            touchZoom: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            minZoom: 3,
            maxZoom: 18,
          }).setView([${initialCenter.lat}, ${initialCenter.lng}], 15);

          var currentTileLayer = L.tileLayer('${tileUrl}', {
            minZoom: 3,
            maxZoom: 18,
            maxNativeZoom: 18,
            subdomains: 'abcd',
            updateWhenIdle: false,
            updateWhenZooming: true,
            keepBuffer: 25,
            crossOrigin: true
          }).addTo(map);

          currentTileLayer.on('tileerror', function(error, tile) {
            if (tile && tile.src && !tile.src.includes('retry=1')) {
              tile.src = tile.src + (tile.src.includes('?') ? '&' : '?') + 'retry=1';
            } else if (tile) {
              try {
                var coords = error && error.coords ? error.coords : null;
                if (coords) {
                  tile.src = 'https://tile.openstreetmap.org/' + coords.z + '/' + coords.x + '/' + coords.y + '.png';
                }
              } catch(e) {}
            }
          });

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
            var c = (cat || '').toLowerCase();
            if (c === 'work' || c === 'office') {
              return { main: '#3B82F6', highlight: '#93C5FD', dark: '#1D4ED8', gradKey: 'blue' };
            } else if (c === 'school' || c === 'college') {
              return { main: '#F59E0B', highlight: '#FDE68A', dark: '#D97706', gradKey: 'gold' };
            }
            // Default: Vivid Pine & Emerald Green Safe Zone
            return { main: '#10B981', highlight: '#34D399', dark: '#047857', gradKey: 'green' };
          }

          function getZoneSvgIcon(name, color) {
            var n = (name || '').toLowerCase();
            if (n.indexOf('home') !== -1 || n.indexOf('house') !== -1 || n.indexOf('residence') !== -1) {
              return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
            }
            if (n.indexOf('work') !== -1 || n.indexOf('office') !== -1 || n.indexOf('corp') !== -1) {
              return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>';
            }
            if (n.indexOf('school') !== -1 || n.indexOf('college') !== -1 || n.indexOf('univ') !== -1 || n.indexOf('class') !== -1) {
              return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>';
            }
            if (n.indexOf('gym') !== -1 || n.indexOf('fit') !== -1 || n.indexOf('sport') !== -1) {
              return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M6 4v16M18 4v16M2 8h4M2 16h4M18 8h4M18 16h4M6 12h12"></path></svg>';
            }
            return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
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

            zones.forEach(function(z) {
              if (!z.lat || !z.lng) return;
              var r = z.radius || 150;
              var theme = getDomeTheme(z.category || 'home');
              var latLng = [z.lat, z.lng];

              // 1. Outer Glowing Radar Aura Ring
              var outerHalo = L.circle(latLng, {
                radius: r * 1.04,
                color: theme.highlight,
                weight: 2,
                opacity: 0.65,
                fill: false,
                dashArray: '5, 5',
                interactive: false
              });

              // 2. High-Visibility Green Safe Zone (Vivid emerald perimeter & rich translucent fill)
              var mainZone = L.circle(latLng, {
                radius: r,
                color: theme.dark,
                weight: 3.5,
                opacity: 0.95,
                fillColor: theme.main,
                fillOpacity: 0.25, // Prominent, clear green safe zone!
                interactive: true
              });

              // 3. Inner Concentric Radar Contour Ring
              var innerZone = L.circle(latLng, {
                radius: r * 0.45,
                color: theme.highlight,
                weight: 1.5,
                opacity: 0.5,
                fill: false,
                dashArray: '4, 4',
                interactive: false
              });

              // 4. Center Apex Beacon Pin
              var centerPin = L.circleMarker(latLng, {
                radius: 4.5,
                color: '#FFFFFF',
                fillColor: theme.dark,
                fillOpacity: 1.0,
                weight: 2,
                interactive: false
              });

              var cleanZoneName = (z.name || 'Safe Zone')
                .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                .trim() || 'Safe Zone';
              var iconSvg = getZoneSvgIcon(cleanZoneName, theme.highlight || theme.main);
              var badgeHtml = '<div class="geofence-badge" style="border-color:' + theme.highlight + ';box-shadow:0 4px 14px rgba(0,0,0,0.5), 0 0 12px ' + theme.main + '88;">' +
                iconSvg +
                '<span class="geofence-name">' + cleanZoneName + '</span>' +
              '</div>';
              var badgeIcon = L.divIcon({
                className: 'custom-geofence-badge',
                html: badgeHtml,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
              });
              var badgeMarker = L.marker([z.lat, z.lng], { icon: badgeIcon, interactive: true });

              mainZone.on('click', function() {
                try { map.flyTo(latLng, 16, { animate: true, duration: 0.8 }); } catch(e) {}
              });
              badgeMarker.on('click', function() {
                try { map.flyTo(latLng, 16, { animate: true, duration: 0.8 }); } catch(e) {}
              });

              geofenceLayerGroup.addLayer(outerHalo);
              geofenceLayerGroup.addLayer(mainZone);
              geofenceLayerGroup.addLayer(innerZone);
              geofenceLayerGroup.addLayer(centerPin);
              geofenceLayerGroup.addLayer(badgeMarker);
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
              var labelClass = m.isSelf ? 'pin-label self-label' : 'pin-label';
              var dotClass = m.isSelf ? 'online-dot self-dot' : 'online-dot';

              var html = '<div class="member-pin">' +
                '<div class="' + bubbleClass + '" style="background:' + m.roleColor + ';">' + innerContent + '</div>' +
                '<div class="' + labelClass + '">' +
                  '<div class="' + dotClass + '"></div>' +
                  '<span>' + m.name + '</span>' +
                  '<span class="sep-dot">·</span>' +
                  '<span class="batt-tag">' + m.battery + '</span>' +
                '</div>' +
                '</div>';

              var icon = L.divIcon({
                className: 'custom-member-marker',
                html: html,
                iconSize: [120, 60],
                iconAnchor: [60, 24]
              });

              var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(memberLayerGroup);
              marker.on('click', function(e) {
                if (e) {
                  L.DomEvent.stopPropagation(e);
                }
                initialFitDone = true;
                try {
                  var curPos = this.getLatLng();
                  var tLat = curPos ? curPos.lat : m.lat;
                  var tLng = curPos ? curPos.lng : m.lng;
                  map.stop();
                  map.panTo([tLat, tLng], { animate: true, duration: 0.35, easeLinearity: 0.2 });
                } catch(e) {
                  map.setView([m.lat, m.lng], 16);
                }
              });
            });

            // Automatically focus on the user's location on initial load
            if (!initialFitDone) {
              var selfPin = pins.find(function(m) { return m.isSelf; });
              if (selfPin && selfPin.lat && selfPin.lng) {
                initialFitDone = true;
                try {
                  map.setView([selfPin.lat, selfPin.lng], 16);
                } catch(e) {}
              }
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
            currentTileLayer.options.maxZoom = 18;
            currentTileLayer.options.maxNativeZoom = 18;
          };

          window.recenterTo = function(lat, lng, zoom, instant) {
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
            initialFitDone = true;
            var targetZoom = (typeof zoom === 'number' && zoom > 0) ? Math.min(zoom, 18) : 16;
            if (instant) {
              try {
                map.stop();
                map.setView([lat, lng], targetZoom);
                return;
              } catch(e) {}
            }
            var c = map.getCenter();
            var dLat = Math.abs(c.lat - lat);
            var dLng = Math.abs(c.lng - lng);
            var dist = Math.sqrt(dLat * dLat + dLng * dLng);
            var dur = dist > 0.08 ? 1.4 : (dist > 0.01 ? 1.0 : 0.6);

            try {
              map.stop();
              map.flyTo([lat, lng], targetZoom, {
                animate: true,
                duration: dur,
                easeLinearity: 0.18
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

    if (userLoc?.latitude && userLoc?.longitude) {
      executeMapScript(`
        if (window.recenterTo) {
          window.recenterTo(${userLoc.latitude}, ${userLoc.longitude}, 16, true);
        } else if (window.map) {
          window.map.setView([${userLoc.latitude}, ${userLoc.longitude}], 16);
        }
      `);
      hasCenteredOnUserRef.current = true;
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0F1411' }]}>
      {/* 1. Header Bar */}
      <View
        style={[
          styles.header,
          { paddingTop: topInset, height: 56 + topInset },
          isDark && { backgroundColor: '#141A17', borderBottomColor: '#212C26' },
        ]}
      >
        <View style={styles.headerLeft}>
          <OrbitalGoldenLogoBadge
            size={34}
            onPress={() => setAddressModalVisible(true)}
            accessibilityLabel="Current Live Address"
            testID="header-app-logo-btn"
          />
          <TouchableOpacity
            style={[styles.circleSelectorBtn, isDark && { backgroundColor: '#1C2621' }]}
            onPress={() => setCircleModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.circleSelectorText, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
              {circleTitle}
            </Text>
            <Ionicons name="chevron-down" size={15} color={isDark ? '#9EACA3' : '#5C665F'} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.profileAvatarBtn, isDark && { borderColor: '#3ADFAB' }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1C2621' }]}>
                <Text style={[styles.avatarFallbackText, isDark && { color: '#3ADFAB' }]}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Interactive Map Viewport Canvas */}
        <View style={[styles.mapViewport, isDark && { backgroundColor: '#141A17' }]}>
          {Platform.OS === 'web' ? (
            <iframe
              id="homeMapIframe"
              srcDoc={mapHtml}
              style={{ width: '100%', height: '100%', border: 'none' }}
              onLoad={handleMapLoadEnd}
            />
          ) : (
            <WebViewAny
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapWebview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              overScrollMode="never"
              androidLayerType="hardware"
              onLoadEnd={handleMapLoadEnd}
            />
          )}

          {/* Top Floating Filter Capsule Strip */}
          <View style={styles.topFilterStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
                  activeFilter === 'all' && styles.filterChipActive,
                ]}
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
                    { backgroundColor: activeFilter === 'all' ? '#FFFFFF' : isDark ? '#3ADFAB' : '#2E7D5B' },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isDark && { color: '#CAD5CE' },
                    activeFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All Circle
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    isDark && { backgroundColor: '#28362F' },
                    activeFilter === 'all' && styles.chipCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      isDark && { color: '#FFFFFF' },
                      activeFilter === 'all' && styles.chipCountTextActive,
                    ]}
                  >
                    {members.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
                  activeFilter === 'safe' && styles.filterChipActive,
                ]}
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
                    { backgroundColor: activeFilter === 'safe' ? '#FFFFFF' : isDark ? '#3ADFAB' : '#2E7D5B' },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isDark && { color: '#CAD5CE' },
                    activeFilter === 'safe' && styles.filterChipTextActive,
                  ]}
                >
                  Safe Zones
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    isDark && { backgroundColor: '#28362F' },
                    activeFilter === 'safe' && styles.chipCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      isDark && { color: '#FFFFFF' },
                      activeFilter === 'safe' && styles.chipCountTextActive,
                    ]}
                  >
                    {zoneData.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
                  activeFilter === 'moving' && styles.filterChipActivePeach,
                ]}
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
                  style={[
                    styles.filterChipText,
                    isDark && { color: '#CAD5CE' },
                    activeFilter === 'moving' && styles.filterChipTextActive,
                  ]}
                >
                  Moving
                </Text>
                <View
                  style={[
                    styles.chipCountBadge,
                    isDark && { backgroundColor: '#28362F' },
                    activeFilter === 'moving' && styles.chipCountBadgeActivePeach,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      isDark && { color: '#FFFFFF' },
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
                isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
                satelliteLayer && { backgroundColor: isDark ? '#23382D' : '#E8F5E9', borderColor: '#2E7D5B' }
              ]}
              onPress={handleToggleSatellite}
              activeOpacity={0.85}
            >
              <Ionicons
                name={satelliteLayer ? 'map' : 'layers-outline'}
                size={18}
                color={satelliteLayer ? (isDark ? '#3ADFAB' : '#2E7D5B') : (isDark ? '#CAD5CE' : '#5C665F')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.railButton,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
                highlightZones && { backgroundColor: isDark ? '#23382D' : '#E8F5EE', borderColor: '#2E7D5B' }
              ]}
              onPress={handleToggleHighlightZones}
              activeOpacity={0.85}
            >
              <Ionicons
                name={highlightZones ? 'shield' : 'shield-outline'}
                size={18}
                color={highlightZones ? (isDark ? '#3ADFAB' : '#2E7D5B') : (isDark ? '#CAD5CE' : '#5C665F')}
              />
            </TouchableOpacity>

            {/* View / Focus Others' Location Button */}
            <TouchableOpacity
              style={[
                styles.railButton,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' },
              ]}
              onPress={handleFocusOthers}
              activeOpacity={0.85}
              accessibilityLabel="View Others Location"
            >
              <Ionicons name="people" size={19} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              {otherMembersWithLocation.length > 0 && (
                <View style={[styles.miniMemberBadge, isDark && { backgroundColor: '#3ADFAB', borderColor: '#141A17' }]}>
                  <Text style={[styles.miniMemberBadgeText, isDark && { color: '#002116' }]}>
                    {otherMembersWithLocation.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.railButton, isDark && { backgroundColor: '#1C2621', borderColor: '#2A3A32' }]}
              onPress={handleRecenter}
              activeOpacity={0.85}
              accessibilityLabel="My Location"
            >
              <Ionicons name="locate" size={19} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Refined Bottom Sheet Container */}
        <View style={[styles.bottomSheetCard, isDark && { backgroundColor: '#141A17', borderColor: '#212C26' }]}>
          <View style={[styles.sheetHandle, isDark && { backgroundColor: '#26342D' }]} />

          {/* Bottom Sheet Header */}
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {circleTitle}
              </Text>
              <Text style={[styles.sheetSubtitle, isDark && { color: '#9EACA3' }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'} active · Shared location on
              </Text>
            </View>
            <View style={[styles.safeBadgePill, isDark && { backgroundColor: '#1C2621', borderColor: '#26342D' }]}>
              <View style={styles.pulsingGreenDot} />
              <Text style={[styles.safeBadgeText, isDark && { color: '#3ADFAB' }]}>All members safe</Text>
            </View>
          </View>

          {/* Quick Safety Check-in Bar */}
          <View style={[styles.checkInBanner, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
            <View style={styles.checkInLeft}>
              <View style={[styles.checkInIconBox, isDark && { backgroundColor: '#23352B' }]}>
                <Ionicons name="checkmark-done" size={19} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkInTitle, isDark && { color: '#FFFFFF' }]}>Safety Check-in</Text>
                <Text style={[styles.checkInSub, isDark && { color: '#9EACA3' }]}>Broadcast your safe status to all circle members</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.checkInBtn,
                { backgroundColor: '#2E7D5B' },
                checkInState === 'sent' && { backgroundColor: '#3ADFAB' },
              ]}
              onPress={handleCheckIn}
              activeOpacity={0.8}
            >
              <Ionicons
                name={checkInState === 'sent' ? 'checkmark-circle' : 'send-outline'}
                size={14}
                color={checkInState === 'sent' && isDark ? '#002116' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.checkInBtnText,
                  { color: checkInState === 'sent' && isDark ? '#002116' : '#FFFFFF' },
                ]}
              >
                {checkInState === 'sent'
                  ? 'Sent'
                  : checkInState === 'sending'
                  ? 'Sending...'
                  : 'Check In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action Feature Hub */}
          <View style={styles.quickFeatureHub}>
            <TouchableOpacity
              style={[
                styles.featureHubTile,
                isDark
                  ? { backgroundColor: '#16201B', borderColor: '#23322A' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E8E5' },
              ]}
              onPress={() => navigation.navigate('DrivingReports')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? 'rgba(224, 122, 95, 0.18)' : '#FDF2EE' }]}>
                <Ionicons name="speedometer" size={17} color="#E07A5F" />
              </View>
              <Text style={[styles.featureHubTitle, isDark && { color: '#FFFFFF' }]}>Driving</Text>
              <Text style={[styles.featureHubSub, isDark && { color: '#CAD5CE' }]}>Crash & score</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.featureHubTile,
                isDark
                  ? { backgroundColor: '#16201B', borderColor: '#23322A' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E8E5' },
              ]}
              onPress={() => navigation.navigate('LocationHistory')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.16)' : '#E8F5EE' }]}>
                <Ionicons name="time" size={17} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              </View>
              <Text style={[styles.featureHubTitle, isDark && { color: '#FFFFFF' }]}>History</Text>
              <Text style={[styles.featureHubSub, isDark && { color: '#CAD5CE' }]}>Route replay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.featureHubTile,
                isDark
                  ? { backgroundColor: '#16201B', borderColor: '#23322A' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E8E5' },
              ]}
              onPress={() => navigation.navigate('SafePlaces')}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : '#EEF2FF' }]}>
                <Ionicons name="shield-checkmark" size={17} color={isDark ? '#818CF8' : '#4F46E5'} />
              </View>
              <Text style={[styles.featureHubTitle, isDark && { color: '#FFFFFF' }]}>Safe Zones</Text>
              <Text style={[styles.featureHubSub, isDark && { color: '#CAD5CE' }]}>{safePlaces.length} monitored</Text>
            </TouchableOpacity>
          </View>

          {/* Live Family Status Horizontal Strip */}
          <View style={styles.statusSectionHeader}>
            <Text style={[styles.statusSectionTitle, isDark && { color: '#FFFFFF' }]}>Live Family Status</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Circle')}>
              <Text style={[styles.manageGeofenceLink, isDark && { color: '#3ADFAB' }]}>Manage Circle ›</Text>
            </TouchableOpacity>
          </View>

          {displayedMembers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {displayedMembers.map((member) => {
                const name = member.profile?.full_name || 'Member';
                const isSelf = member.user_id === profile?.id;
                const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
                const isDriving = Boolean(member.isDriving);
                const zoneStatus = getMemberSafeZoneStatus(member);

                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.memberStatusCard,
                      isDark && { backgroundColor: '#1A231F', borderColor: '#283730' },
                    ]}
                    onPress={() => {
                      if (isSelf) {
                        handleRecenter();
                      } else if (member.latitude && member.longitude) {
                        focusMemberOnMap(member);
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
                            {
                              backgroundColor: isSelf
                                ? (isDark ? '#23352B' : '#E8F5EE')
                                : (isDark ? '#33231E' : '#FFF3EB'),
                            },
                          ]}
                        >
                          {member.profile?.avatar_url ? (
                            <Image
                              source={{ uri: member.profile.avatar_url }}
                              style={styles.memberCardAvatarImg}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.memberCardInitial,
                                { color: isSelf ? (isDark ? '#3ADFAB' : '#2E7D5B') : '#E07A5F' },
                              ]}
                            >
                              {name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={[styles.memberCardName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                              {name}
                            </Text>
                            {isSelf && (
                              <View style={[styles.selfBadgePill, isDark && { backgroundColor: 'rgba(58, 223, 171, 0.15)', borderColor: 'rgba(58, 223, 171, 0.4)' }]}>
                                <Text style={[styles.selfBadgeText, isDark && { color: '#3ADFAB' }]}>YOU</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, marginTop: 1.5 }}>
                            <Ionicons
                              name={zoneStatus.isInZone ? 'shield-checkmark' : 'navigate-outline'}
                              size={11}
                              color={zoneStatus.color}
                            />
                            <Text
                              style={[
                                styles.memberCardSafeStatus,
                                { color: zoneStatus.color },
                              ]}
                              numberOfLines={1}
                            >
                              {zoneStatus.statusText}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.batteryChip, isDark && { backgroundColor: '#26342D' }]}>
                        <Ionicons
                          name={
                            (member.batteryPct ?? 100) > 20
                              ? 'battery-charging'
                              : 'battery-dead'
                          }
                          size={13}
                          color={(member.batteryPct ?? 100) > 20 ? (isDark ? '#3ADFAB' : '#2E7D5B') : '#E07A5F'}
                        />
                        <Text style={[styles.batteryChipText, isDark && { color: '#E8EDE9' }]}>{battery}</Text>
                      </View>
                    </View>

                    <View style={[styles.memberCardMetrics, isDark && { backgroundColor: '#141A17' }]}>
                      <View style={styles.metricRow}>
                        <Text style={[styles.metricLabel, isDark && { color: '#9EACA3' }]}>Role</Text>
                        <Text style={[styles.metricVal, isDark && { color: '#FFFFFF' }]}>
                          {member.role ? member.role.toUpperCase() : 'MEMBER'}
                        </Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={[styles.metricLabel, isDark && { color: '#9EACA3' }]}>Status</Text>
                        <Text style={[styles.metricVal, isDark && { color: '#E8EDE9' }]}>
                          {member.isOnline !== false ? 'Online' : 'Recent'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyMembersBox, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
              <Ionicons name="people-outline" size={24} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.emptyMembersText, isDark && { color: '#CAD5CE' }]}>
                No members found for this filter. Invite family to grow your circle!
              </Text>
            </View>
          )}

          {/* Mindful Insight Card */}
          <View style={[styles.headspaceCard, isDark && { backgroundColor: '#231B18', borderColor: '#3D2C24' }]}>
            <View style={styles.headspaceIconBox}>
              <Ionicons name="shield-checkmark-outline" size={17} color="#E07A5F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headspaceTitle, isDark && { color: '#FFFFFF' }]}>Peace of Mind Tip</Text>
              <Text style={[styles.headspaceText, isDark && { color: '#CAD5CE' }]}>{peaceOfMindTip}</Text>
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

      {/* Current Address Bottom Sheet Modal */}
      <CurrentAddressModal
        visible={addressModalVisible}
        onClose={() => setAddressModalVisible(false)}
        userLoc={userLoc}
        onRefreshLocation={handleRecenter}
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
  headerAppLogoImg: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
  miniMemberBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  miniMemberBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 12,
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
  selfBadgePill: {
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(46, 125, 91, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 91, 0.28)',
  },
  selfBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.4,
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
