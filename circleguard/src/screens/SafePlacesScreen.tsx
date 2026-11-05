import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Image, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { WebView } from 'react-native-webview';

const WebViewAny: any = WebView;
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME, getThemeCardStyles, getThemeButtonStyles, getThemeBadgeStyles, getThemeBorderStyles } from '../constants/theme';
import { getHaversineDistanceInMeters, fetchCirclePlacesWithMembers } from '../services/GeofenceEngine';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import PaywallModal from '../components/PaywallModal';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import FeatureInfoModal from '../components/FeatureInfoModal';
import { ValidationSchema } from '../lib/validationSchema';
import { handleServiceError } from '../lib/errorHandler';
import { LEAFLET_JS, LEAFLET_CSS } from '../constants/leafletBundle';

function parseEWKBPoint(hexStr: string): { latitude: number; longitude: number } | null {
  try {
    const clean = hexStr.trim();
    if (clean.length < 42) return null;

    const isLittleEndian = clean.substr(0, 2) === '01';
    let typeHex = clean.substr(2, 8);
    if (!isLittleEndian) {
      typeHex = typeHex.match(/../g)?.reverse().join('') || typeHex;
    }

    const typeInt = parseInt(typeHex, 16);
    const hasSRID = (typeInt & 0x20000000) !== 0;
    const geomType = typeInt & 0xff;

    if (geomType !== 1) return null;

    let coordsHex = clean.substr(10);
    if (hasSRID) {
      coordsHex = coordsHex.substr(8);
    }

    if (coordsHex.length >= 32) {
      const lngHex = coordsHex.substr(0, 16);
      const latHex = coordsHex.substr(16, 16);

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      const parseHexDouble = (str: string) => {
        for (let i = 0; i < 8; i++) {
          const byte = parseInt(str.substr(i * 2, 2), 16);
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
  } catch (e) {
    console.error('EWKB parse error in SafePlaces:', e);
  }
  return null;
}

function parseLocationPoint(item: any): { latitude: number; longitude: number } {
  if (!item) return { latitude: 0, longitude: 0 };

  const directLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat);
  const directLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng);

  if (!isNaN(directLat) && !isNaN(directLng) && Math.abs(directLat) <= 90 && Math.abs(directLng) <= 180 && (directLat !== 0 || directLng !== 0)) {
    return { latitude: directLat, longitude: directLng };
  }

  let lat = 0;
  let lng = 0;

  if (item.geom) {
    if (typeof item.geom === 'string') {
      const clean = item.geom.trim();
      if (clean.startsWith('{')) {
        try {
          const geo = JSON.parse(clean);
          if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
            lng = parseFloat(geo.coordinates[0]);
            lat = parseFloat(geo.coordinates[1]);
          }
        } catch (_) {}
      }
      if (clean.startsWith('01') || clean.startsWith('00')) {
        const parsed = parseEWKBPoint(clean);
        if (parsed) {
          lat = parsed.latitude;
          lng = parsed.longitude;
        }
      } else {
        const matches = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
        if (matches && matches.length >= 3) {
          const val1 = parseFloat(matches[1]);
          const val2 = parseFloat(matches[2]);
          if (Math.abs(val1) > 90) {
            lng = val1;
            lat = val2;
          } else if (Math.abs(val2) > 90) {
            lat = val1;
            lng = val2;
          } else {
            lng = val1;
            lat = val2;
          }
        }
      }
    } else if (typeof item.geom === 'object' && Array.isArray(item.geom.coordinates) && item.geom.coordinates.length >= 2) {
      const c0 = parseFloat(item.geom.coordinates[0]);
      const c1 = parseFloat(item.geom.coordinates[1]);
      if (Math.abs(c0) > 90) {
        lng = c0;
        lat = c1;
      } else if (Math.abs(c1) > 90) {
        lat = c0;
        lng = c1;
      } else {
        lng = c0;
        lat = c1;
      }
    }
  }

  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  if (isNaN(lat) || isNaN(lng)) {
    return { latitude: 0, longitude: 0 };
  }

  return { latitude: lat, longitude: lng };
}

export default function SafePlacesScreen() {
  const navigation = useNavigation();
  const { colors, themeMode, isDark } = useThemeStore();
  const { activeCircle, members, fetchMembers, deletePlace, fetchPlaces } = useCircleStore();
  const { profile } = useAuthStore();
  const { showAlert, showConfirm, showToast } = useLuxuryAlert();
  const { canCreatePlace, canUseRouteCategory, canUseAdaptiveBuffer, canUseSchedule } = useSubscriptionStore();

  const cardStyles = getThemeCardStyles(themeMode);
  const primaryBtnStyles = getThemeButtonStyles(themeMode, 'primary');
  const secondaryBtnStyles = getThemeButtonStyles(themeMode, 'secondary');
  const dangerBtnStyles = getThemeButtonStyles(themeMode, 'danger');
  const borderStyles = getThemeBorderStyles(themeMode);

  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const route = useRoute<any>();
  const initialTargetMemberId = route.params?.memberId;
  const initialTargetMemberName = route.params?.memberName;
  const [filterMemberId, setFilterMemberId] = useState<string | null>(initialTargetMemberId || null);

  const [placeName, setPlaceName] = useState('Home Safe Zone');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [radius, setRadius] = useState(150);
  const [saving, setSaving] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(initialTargetMemberId || null);
  const [activeTab, setActiveTab] = useState<'list' | 'editor'>('list');

  useEffect(() => {
    if (route.params?.openEditor || route.params?.memberId) {
      setActiveTab('editor');
    }
    if (route.params?.memberId) {
      setFilterMemberId(route.params.memberId);
      setTargetUserId(route.params.memberId);
      setSelectedUserIds([route.params.memberId]);
      if (route.params.memberName) {
        setPlaceName(`${route.params.memberName.split(' ')[0]}'s Safe Zone`);
      }
    }
  }, [route.params?.openEditor, route.params?.memberId, route.params?.memberName]);

  // Premium Feature Form States
  const [speedAdaptive, setSpeedAdaptive] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState('');

  // Interactive Mini Map & Start/End Points State
  const webViewRef = useRef<any>(null);
  const expandedWebViewRef = useRef<any>(null);
  const [startPoint, setStartPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePointMode, setActivePointMode] = useState<'start' | 'end'>('start');
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRouteGeofence, setIsRouteGeofence] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [showGeofenceInfoModal, setShowGeofenceInfoModal] = useState(false);
  const mainScrollViewRef = useRef<any>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [memberLocations, setMemberLocations] = useState<Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    initial: string;
    role: string;
    isSelf: boolean;
    latitude: number;
    longitude: number;
  }>>([]);

  const categories = [
    { id: 'home', icon: 'home-outline', label: 'HOME' },
    { id: 'work', icon: 'briefcase-outline', label: 'WORK' },
    { id: 'school', icon: 'school-outline', label: 'SCHOOL' },
    { id: 'fitness', icon: 'fitness-outline', label: 'GYM' },
    { id: 'route', icon: 'navigate-outline', label: 'ROUTE' },
  ];

  const fetchMemberLocations = async () => {
    if (!activeCircle?.id) return;
    try {
      const { data: memberRows } = await supabase
        .from('circle_members')
        .select('user_id, role, profiles(full_name, avatar_url)')
        .eq('circle_id', activeCircle.id);

      if (!memberRows) return;

      const userIds = memberRows.map(m => m.user_id);
      let locMap = new Map<string, { latitude: number; longitude: number }>();

      if (userIds.length > 0) {
        const { data: locRows } = await supabase
          .from('locations')
          .select('*')
          .in('user_id', userIds);

        if (locRows) {
          locRows.forEach(l => {
            const pt = parseLocationPoint(l);
            if (pt.latitude !== 0 && pt.longitude !== 0 && !isNaN(pt.latitude) && !isNaN(pt.longitude)) {
              locMap.set(l.user_id, pt);
            }
          });
        }
      }

      const formatted = memberRows.map((m, idx) => {
        let prof = m.profiles as any;
        if (Array.isArray(prof)) prof = prof[0];
        const name = prof?.full_name || (m.user_id === profile?.id ? 'You' : 'Member');
        const initial = name.charAt(0).toUpperCase();
        const isSelf = m.user_id === profile?.id;
        const loc = locMap.get(m.user_id);

        let lat = 0;
        let lng = 0;

        if (isSelf && userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
          // Always prioritize real-time live device GPS location for oneself!
          lat = userLoc.latitude;
          lng = userLoc.longitude;
        } else if (loc) {
          lat = loc.latitude;
          lng = loc.longitude;
        }

        // Only record real GPS locations (0 if none available)
        if (!lat || !lng || lat === 0 || lng === 0 || isNaN(lat) || isNaN(lng)) {
          lat = 0;
          lng = 0;
        }

        return {
          userId: m.user_id,
          name,
          avatarUrl: prof?.avatar_url || null,
          initial,
          role: m.role || 'member',
          isSelf,
          latitude: lat,
          longitude: lng,
        };
      });

      setMemberLocations(formatted);
    } catch (e) {
      console.warn('Error fetching member locations for safe places:', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const initialCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLoc(initialCoords);
          setStartPoint(initialCoords);
        }
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    const currentCircleId = activeCircle?.id;
    if (currentCircleId) {
      // Instant cache hydration to prevent empty screen flicker
      const cached = useCircleStore.getState().placesByCircle[currentCircleId] || useCircleStore.getState().places;
      if (cached && cached.length > 0) {
        setSavedPlaces(cached.filter(p => !p.circle_id || p.circle_id === currentCircleId) as any);
        setLoadingPlaces(false);
      } else {
        setSavedPlaces([]);
      }

      fetchSavedPlaces(currentCircleId);
      fetchMembers(activeCircle.id);
      fetchMemberLocations();

      // Realtime subscription for live location updates on mini-map
      const channelUid = Math.random().toString(36).substring(2, 9);
      const channel = supabase
        .channel(`safe_places_locations_${activeCircle.id}_${channelUid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
          fetchMemberLocations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoadingPlaces(false);
    }
  }, [activeCircle?.id]);

  const pushMiniMapData = (forceResetZoom = false) => {
    const centerLat = startPoint?.latitude || userLoc?.latitude || 20.5937;
    const centerLng = startPoint?.longitude || userLoc?.longitude || 78.9629;

    const data = {
      center: [centerLat, centerLng],
      startPoint,
      endPoint,
      activePointMode,
      radius,
      memberLocations,
      savedPlaces: savedPlaces.map(p => {
        const pt = parseLocationPoint(p);
        const radiusNum = parseFloat(p.radius_m || p.radius || 150);
        return {
          id: p.id,
          lat: pt.latitude,
          lng: pt.longitude,
          name: p.name,
          radius: isNaN(radiusNum) || radiusNum <= 0 ? 150 : radiusNum,
          endLat: p.end_lat || null,
          endLng: p.end_lng || null,
        };
      }),
      resetZoom: forceResetZoom,
    };

    const jsCode = `
      (function() {
        if (window.updateMiniMap) {
          window.updateMiniMap(${JSON.stringify(data)});
        } else {
          setTimeout(function() {
            if (window.updateMiniMap) window.updateMiniMap(${JSON.stringify(data)});
          }, 250);
        }
      })();
      true;
    `;

    // 1. Update on Web (All map iframes: inline mini-map and expanded modal map)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr: any) => {
        try {
          if (ifr.contentWindow && (ifr.contentWindow as any).updateMiniMap) {
            (ifr.contentWindow as any).updateMiniMap(data);
          } else if (ifr.contentWindow && ifr.contentWindow.postMessage) {
            ifr.contentWindow.postMessage(JSON.stringify({ type: 'UPDATE_MAP_DATA', payload: data }), '*');
          }
        } catch (e) {}
      });
    }

    // 2. Update inline mini-map on Native
    if (webViewRef.current && (webViewRef.current as any).injectJavaScript) {
      (webViewRef.current as any).injectJavaScript(jsCode);
    }

    // 3. Update expanded modal map on Native
    if (expandedWebViewRef.current && (expandedWebViewRef.current as any).injectJavaScript) {
      (expandedWebViewRef.current as any).injectJavaScript(jsCode);
    }
  };

  const centerMapOn = (lat: number, lng: number, zoom = 16) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr: any) => {
        try {
          if (ifr.contentWindow && (ifr.contentWindow as any).centerMap) {
            (ifr.contentWindow as any).centerMap(lat, lng, zoom);
          } else if (ifr.contentWindow && ifr.contentWindow.postMessage) {
            ifr.contentWindow.postMessage(JSON.stringify({ type: 'CENTER_MAP', lat, lng, zoom }), '*');
          }
        } catch (e) {}
      });
    }

    const jsCode = `
      (function() {
        if (window.centerMap) window.centerMap(${lat}, ${lng}, ${zoom});
      })();
      true;
    `;
    if (webViewRef.current && (webViewRef.current as any).injectJavaScript) {
      (webViewRef.current as any).injectJavaScript(jsCode);
    }
    if (expandedWebViewRef.current && (expandedWebViewRef.current as any).injectJavaScript) {
      (expandedWebViewRef.current as any).injectJavaScript(jsCode);
    }
  };

  useEffect(() => {
    pushMiniMapData(false);
  }, [startPoint, endPoint, activePointMode, radius, memberLocations, savedPlaces]);

  useEffect(() => {
    if (isMapExpanded) {
      const t1 = setTimeout(() => pushMiniMapData(true), 150);
      const t2 = setTimeout(() => pushMiniMapData(true), 400);
      const t3 = setTimeout(() => pushMiniMapData(false), 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      const t = setTimeout(() => pushMiniMapData(true), 150);
      return () => clearTimeout(t);
    }
  }, [isMapExpanded]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMsg = (e: MessageEvent) => {
        try {
          const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (msg?.type === 'MAP_READY') {
            pushMiniMapData(false);
          } else if (msg?.type === 'MAP_TAP' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
            handleMapTap(msg.lat, msg.lng);
          } else if (msg?.type === 'MEMBER_TAP') {
            const newStart = { latitude: msg.lat, longitude: msg.lng };
            setStartPoint(newStart);
            if (msg.userId) setTargetUserId(msg.userId);
            if (msg.name) setPlaceName(`${msg.name.split(' ')[0]}'s Safe Zone`);
            setTimeout(() => pushMiniMapData(true), 50);
          }
        } catch (err) {}
      };
      window.addEventListener('message', handleWebMsg);
      return () => window.removeEventListener('message', handleWebMsg);
    }
  }, [startPoint, endPoint, activePointMode, savedPlaces, memberLocations]);

  const handleMapTap = (lat: number, lng: number) => {
    if (activePointMode === 'start') {
      const newStart = { latitude: lat, longitude: lng };
      setStartPoint(newStart);
      setActivePointMode('end');

      if (endPoint) {
        const dist = getHaversineDistanceInMeters(lat, lng, endPoint.latitude, endPoint.longitude);
        const autoRadius = Math.max(50, Math.round(dist));
        setRadius(autoRadius);
      }
    } else {
      const newEnd = { latitude: lat, longitude: lng };
      setEndPoint(newEnd);
      setIsRouteGeofence(true);

      if (startPoint) {
        const dist = getHaversineDistanceInMeters(startPoint.latitude, startPoint.longitude, lat, lng);
        const autoRadius = Math.max(50, Math.round(dist));
        setRadius(autoRadius);
      }
    }
  };

  const handleResetPoints = () => {
    if (userLoc) {
      setStartPoint(userLoc);
    } else {
      setStartPoint(null);
    }
    setEndPoint(null);
    setActivePointMode('start');
    setIsRouteGeofence(false);
    setRadius(150);
    pushMiniMapData(true);
  };

  const fetchSavedPlaces = async (circleId: string) => {
    setLoadingPlaces(true);
    try {
      const placesWithMembers = await fetchCirclePlacesWithMembers(circleId);
      if (useCircleStore.getState().activeCircle?.id === circleId) {
        let list = (placesWithMembers || []).filter(p => p && (!p.circle_id || p.circle_id === circleId));
        // No fallback dummy places: strictly genuine places for this circle
        setSavedPlaces(list);
      }
    } catch (err) {
      console.error('Error fetching places:', err);
      const storePlaces = useCircleStore.getState().placesByCircle[circleId] || useCircleStore.getState().places;
      if (storePlaces && storePlaces.length > 0) {
        setSavedPlaces(storePlaces.filter(p => p && (!p.circle_id || p.circle_id === circleId)) as any);
      }
    } finally {
      setLoadingPlaces(false);
    }
  };

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const displayedPlaces = React.useMemo(() => {
    if (!filterMemberId) return savedPlaces;
    return savedPlaces.filter((p) => {
      const isTarget = p.target_user_id === filterMemberId;
      const isAssigned = Array.isArray(p.assigned_user_ids) && p.assigned_user_ids.includes(filterMemberId);
      const isPlaceMember = Array.isArray(p.place_members) && p.place_members.some((pm: any) => (pm.user_id || pm) === filterMemberId);
      const isCreatedBy = p.created_by === filterMemberId || p.user_id === filterMemberId;
      return isTarget || isAssigned || isPlaceMember || isCreatedBy;
    });
  }, [savedPlaces, filterMemberId]);

  const totalInsideCount = React.useMemo(() => {
    let count = 0;
    displayedPlaces.forEach((p) => {
      const placeCoords = parseLocationPoint(p);
      const placeRadius = parseFloat(p.radius_m || p.radius || 150);
      const inside = memberLocations.filter((m) => {
        const hasValidLoc = m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0;
        if (!hasValidLoc || placeCoords.latitude === 0 || placeCoords.longitude === 0) return false;
        const dist = getHaversineDistanceInMeters(m.latitude, m.longitude, placeCoords.latitude, placeCoords.longitude);
        return dist <= placeRadius;
      });
      count += inside.length;
    });
    return count;
  }, [displayedPlaces, memberLocations]);

  const handleSavePlace = async () => {
    if (!activeCircle || !profile) {
      showAlert({
        title: 'Error',
        message: 'No active circle found. Please create or join a circle first.',
        type: 'error',
      });
      return;
    }

    // Strict schema validation for geofence parameters
    const geofenceValidation = ValidationSchema.validateGeofence({
      name: placeName,
      radius_m: radius,
      category: selectedCategory,
      latitude: startPoint?.latitude || userLoc?.latitude || 20.5937,
      longitude: startPoint?.longitude || userLoc?.longitude || 78.9629,
    });

    if (!geofenceValidation.valid) {
      showAlert({
        title: 'Validation Error',
        message: geofenceValidation.error || 'Please correct the geofence parameters.',
        type: 'warning',
      });
      return;
    }

    if (!editingPlaceId && !canCreatePlace(savedPlaces.length)) {
      setGatedFeatureName('Unlimited Saved Safe Places (> 2 per circle)');
      setPaywallVisible(true);
      return;
    }

    setSaving(true);
    try {
      const startPointLat = startPoint?.latitude || userLoc?.latitude || 20.5937;
      const startPointLng = startPoint?.longitude || userLoc?.longitude || 78.9629;
      const pointGeom = `POINT(${startPointLng} ${startPointLat})`;

      const endLatitude = endPoint ? endPoint.latitude : null;
      const endLongitude = endPoint ? endPoint.longitude : null;

      const isPrem = useSubscriptionStore.getState().isPremium;
      const safeSpeedAdaptive = isPrem ? speedAdaptive : false;
      const safeCategory = (!isPrem && selectedCategory === 'route') ? 'home' : selectedCategory;

      const fullPayload = {
        circle_id: activeCircle.id,
        name: placeName.trim(),
        radius_m: radius,
        geom: pointGeom,
        created_by: profile.id,
        start_lat: startPointLat,
        start_lng: startPointLng,
        end_lat: endLatitude,
        end_lng: endLongitude,
        target_user_id: targetUserId,
        category: safeCategory,
        speed_adaptive: safeSpeedAdaptive,
      };

      const fallbackPayload = {
        circle_id: activeCircle.id,
        name: placeName.trim(),
        radius_m: radius,
        geom: pointGeom,
        created_by: profile.id,
        start_lat: startPointLat,
        start_lng: startPointLng,
        end_lat: endLatitude,
        end_lng: endLongitude,
        target_user_id: targetUserId,
        category: selectedCategory,
      };

      let savedPlaceId = editingPlaceId;

      if (editingPlaceId) {
        let { error } = await supabase.from('places').update(fullPayload).eq('id', editingPlaceId);

        if (error && (error.code === 'PGRST204' || error.message?.includes('speed_adaptive') || error.message?.includes('schema cache'))) {
          const fallbackRes = await supabase.from('places').update(fallbackPayload).eq('id', editingPlaceId);
          error = fallbackRes.error;
        }

        if (error) throw error;

        showToast(`"${placeName}" updated with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius`, 'success', 'Geofence Updated');
        setEditingPlaceId(null);
      } else {
        let { data: newPlace, error } = await supabase.from('places').insert(fullPayload).select().single();

        if (error && (error.code === 'PGRST204' || error.message?.includes('speed_adaptive') || error.message?.includes('schema cache'))) {
          const fallbackRes = await supabase.from('places').insert(fallbackPayload).select().single();
          error = fallbackRes.error;
          if (fallbackRes.data) newPlace = fallbackRes.data;
        }

        if (error) throw error;
        if (newPlace) savedPlaceId = newPlace.id;

        showToast(`Geofence "${placeName}" created with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius`, 'success', 'Geofence Created');
      }

      if (savedPlaceId) {
        await supabase.from('place_members').delete().eq('place_id', savedPlaceId);
        if (selectedUserIds.length > 0) {
          const pmRows = selectedUserIds.map(uid => ({
            place_id: savedPlaceId,
            user_id: uid
          }));
          await supabase.from('place_members').insert(pmRows);
        }
      }

      setEditingPlaceId(null);
      setPlaceName('');
      setSelectedUserIds([]);
      handleResetPoints();
      fetchSavedPlaces(activeCircle.id);
      fetchPlaces(activeCircle.id);
      setActiveTab('list');
    } catch (err: any) {
      const cleanMessage = handleServiceError('SafePlaces:savePlace', err, 'Failed to save geofence. Please check coordinates and try again.');
      if (cleanMessage.toLowerCase().includes('free tier') || cleanMessage.toLowerCase().includes('limit')) {
        setGatedFeatureName('Unlimited Saved Safe Places (> 2 per circle)');
        setPaywallVisible(true);
      } else {
        showAlert({
          title: 'Unable to Save Geofence',
          message: cleanMessage,
          type: 'error',
          buttonText: 'Understood',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditPlace = (p: any) => {
    setEditingPlaceId(p.id);
    setPlaceName(p.name || '');
    setRadius(p.radius_m || 150);
    setSelectedCategory(p.category || 'home');
    setTargetUserId(p.target_user_id || null);
    setSelectedUserIds(p.assigned_user_ids || (p.target_user_id ? [p.target_user_id] : []));

    if (p.start_lat && p.start_lng) {
      setStartPoint({ latitude: p.start_lat, longitude: p.start_lng });
    } else if (p.latitude && p.longitude) {
      setStartPoint({ latitude: p.latitude, longitude: p.longitude });
    }

    if (p.end_lat && p.end_lng) {
      setEndPoint({ latitude: p.end_lat, longitude: p.end_lng });
    } else {
      setEndPoint(null);
    }

    setActiveTab('editor');
    setTimeout(() => pushMiniMapData(true), 120);

    if (mainScrollViewRef.current) {
      mainScrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleCancelEdit = () => {
    setEditingPlaceId(null);
    setPlaceName('');
    setRadius(150);
    setSelectedCategory('home');
    setTargetUserId(null);
    setSelectedUserIds([]);
    handleResetPoints();
    setActiveTab('list');
  };

  const handleDeletePlace = (placeId: string, name: string) => {
    showConfirm({
      title: 'Delete Geofence',
      message: `Are you sure you want to remove "${name}" from your circle geofences?`,
      confirmText: 'DELETE GEOFENCE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));

          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.deletePlaceLayer) {
                window.deletePlaceLayer('${placeId}');
              }
              true;
            `);
          }

          await deletePlace(placeId);

          showAlert({
            title: 'Geofence Removed',
            message: `"${name}" has been removed from circle boundaries.`,
            type: 'success',
            buttonText: 'DONE',
          });
        } catch (err: any) {
          if (activeCircle) fetchSavedPlaces(activeCircle.id);
          const cleanMessage = handleServiceError('SafePlaces:deletePlace', err, 'Failed to delete safe place. Please try again.');
          showAlert({
            title: 'Error Deleting Geofence',
            message: cleanMessage,
            type: 'error',
          });
        }
      },
    });
  };

  const miniMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        ${LEAFLET_CSS}
      </style>
      <style>
        body, html, #map { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          width: 100%; 
          background: #15171E; 
          touch-action: none !important;
          -webkit-user-select: none;
          user-select: none;
          overscroll-behavior: none;
        }
        .leaflet-container { background: #15171E !important; }
        .leaflet-tile-container, .leaflet-zoom-animated, .leaflet-tile { will-change: transform; }
        .member-pin-icon, .leaflet-div-icon { background: transparent !important; border: none !important; }
        
        .start-pin-wrapper, .end-pin-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.65));
          user-select: none;
        }
        .start-pin-badge {
          background: #0F172A;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 900;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2px 7px;
          border-radius: 6px;
          border: 1.5px solid #FFFFFF;
          white-space: nowrap;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          margin-bottom: 2px;
        }
        .start-pin-core {
          width: 26px;
          height: 26px;
          background: radial-gradient(circle at 35% 35%, #94A3B8, #334155);
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(255,255,255,0.4), inset 0 0 4px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 900;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: pulse-start 2s infinite ease-in-out;
        }
        .end-pin-badge {
          background: #EF4444;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 900;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2px 7px;
          border-radius: 6px;
          border: 1.5px solid #FFFFFF;
          white-space: nowrap;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(239,68,68,0.7);
          margin-bottom: 2px;
        }
        .end-pin-core {
          width: 26px;
          height: 26px;
          background: radial-gradient(circle at 35% 35%, #F87171, #DC2626);
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(239,68,68,0.95), inset 0 0 4px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 900;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: pulse-red 2s infinite ease-in-out;
        }
        .pin-pointer {
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          margin-top: -2px;
        }
        .start-pointer {
          border-top: 7px solid #334155;
        }
        .end-pointer {
          border-top: 7px solid #DC2626;
        }
        @keyframes pulse-start {
          0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(255,255,255,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 22px rgba(255,255,255,0.7); }
        }
        @keyframes pulse-red {
          0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(239,68,68,0.9); }
          50% { transform: scale(1.08); box-shadow: 0 0 22px rgba(239,68,68,1); }
        }

        /* 3D Geofence Dome Animations & Styles */
        @keyframes domePulseGlow {
          0% {
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.25));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.55));
          }
          100% {
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.25));
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
        .member-pin {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #FFFFFF;
          position: relative;
          background: #18181B;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1.5px solid #15171E;
        }
        .member-name-tag {
          position: absolute;
          top: 36px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: rgba(15, 23, 42, 0.92);
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          pointer-events: none;
        }
        .member-name-tag.self-tag {
          border-color: #FFFFFF;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }
      </style>
    </head>
    <body>
      <svg id="dome-defs-svg" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;" aria-hidden="true">
        <defs>
          <radialGradient id="dome-grad-green" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
            <stop offset="0%" stop-color="#E2E8F0" stop-opacity="0.80" />
            <stop offset="20%" stop-color="#CBD5E1" stop-opacity="0.50" />
            <stop offset="55%" stop-color="#94A3B8" stop-opacity="0.24" />
            <stop offset="85%" stop-color="#64748B" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#334155" stop-opacity="0.90" />
          </radialGradient>
          <radialGradient id="dome-grad-blue" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
            <stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.80" />
            <stop offset="20%" stop-color="#60A5FA" stop-opacity="0.50" />
            <stop offset="55%" stop-color="#3B82F6" stop-opacity="0.24" />
            <stop offset="85%" stop-color="#2563EB" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.90" />
          </radialGradient>
          <radialGradient id="dome-grad-gold" cx="44%" cy="38%" r="60%" fx="38%" fy="30%">
            <stop offset="0%" stop-color="#E2E8F0" stop-opacity="0.80" />
            <stop offset="20%" stop-color="#CBD5E1" stop-opacity="0.50" />
            <stop offset="55%" stop-color="#94A3B8" stop-opacity="0.24" />
            <stop offset="85%" stop-color="#64748B" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#334155" stop-opacity="0.90" />
          </radialGradient>
        </defs>
      </svg>
      <div id="map"></div>
      <script>
        ${LEAFLET_JS}
      </script>
      <script>
        var map = L.map('map', { 
          zoomControl: true,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: true,
          zoomAnimation: true,
          zoomAnimationThreshold: 20,
          fadeAnimation: true,
          markerZoomAnimation: true,
          tap: false,
          minZoom: 3,
          maxZoom: 18
        }).setView([20.5937, 78.9629], 13);

        window.addEventListener('load', function() {
          if (map) map.invalidateSize();
          setTimeout(function() { if (map) map.invalidateSize(); }, 150);
          setTimeout(function() { if (map) map.invalidateSize(); }, 500);
        });
        window.addEventListener('resize', function() {
          if (map) map.invalidateSize();
        });
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          minZoom: 3,
          maxZoom: 18,
          maxNativeZoom: 18,
          attribution: '© OpenStreetMap contributors',
          updateWhenIdle: false,
          updateWhenZooming: true,
          keepBuffer: 20
        }).addTo(map);

        var startMarker = null;
        var endMarker = null;
        var geofenceCircle = null;
        var routePolyline = null;
        var provisionalStartMarker = null;
        var provisionalEndMarker = null;
        var memberMarkers = {};
        var savedPlaceMarkers = {};
        var userInteracted = false;
        var initialBoundsSet = false;
        var currentActiveMode = 'start';

        map.on('dragstart zoomstart touchstart', function() {
          userInteracted = true;
        });

        window.addEventListener('resize', function() {
          if (map) map.invalidateSize();
        });

        window.centerMap = function(lat, lng, zoom) {
          if (map && lat && lng) {
            map.setView([lat, lng], zoom || 16, { animate: true });
          }
        };

        function sendAppMessage(msg) {
          var str = typeof msg === 'string' ? msg : JSON.stringify(msg);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(str);
          } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(str, '*');
          }
        }

        map.on('click', function(e) {
          var lat = e.latlng.lat;
          var lng = e.latlng.lng;

          // 0ms instant local feedback: drop or move pin immediately under finger
          if (currentActiveMode === 'start') {
            if (startMarker) map.removeLayer(startMarker);
            if (!provisionalStartMarker) {
              provisionalStartMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                  className: 'leaflet-div-icon',
                  html: '<div class="start-pin-wrapper"><div class="start-pin-badge">START (A)</div><div class="start-pin-core">A</div><div class="pin-pointer start-pointer"></div></div>',
                  iconSize: [60, 60],
                  iconAnchor: [30, 58]
                }),
                zIndexOffset: 1500
              }).addTo(map);
            } else {
              provisionalStartMarker.setLatLng([lat, lng]);
            }
          } else {
            if (endMarker) map.removeLayer(endMarker);
            if (!provisionalEndMarker) {
              provisionalEndMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                  className: 'leaflet-div-icon',
                  html: '<div class="end-pin-wrapper"><div class="end-pin-badge">END (B)</div><div class="end-pin-core">B</div><div class="pin-pointer end-pointer"></div></div>',
                  iconSize: [60, 60],
                  iconAnchor: [30, 58]
                }),
                zIndexOffset: 1501
              }).addTo(map);
            } else {
              provisionalEndMarker.setLatLng([lat, lng]);
            }
          }

          sendAppMessage({
            type: 'MAP_TAP',
            lat: lat,
            lng: lng
          });
        });

        window.deletePlaceLayer = function(id) {
          if (savedPlaceMarkers[id]) {
            map.removeLayer(savedPlaceMarkers[id]);
            delete savedPlaceMarkers[id];
          }
        };

        function fetchOsrmRoute(originLng, originLat, destLng, destLat, callback) {
          var endpoints = [
            'https://router.project-osrm.org/route/v1/driving/',
            'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
          ];
          var coordStr = originLng.toFixed(6) + ',' + originLat.toFixed(6) + ';' + destLng.toFixed(6) + ',' + destLat.toFixed(6);
          
          function tryFetch(index) {
            if (index >= endpoints.length) {
              callback(null);
              return;
            }
            var url = endpoints[index] + coordStr + '?overview=full&geometries=geojson';
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 5000) : null;
            
            fetch(url, controller ? { signal: controller.signal } : {})
              .then(function(res) {
                if (timeoutId) clearTimeout(timeoutId);
                return res.json();
              })
              .then(function(json) {
                if (json && json.routes && json.routes.length > 0) {
                  var coords = json.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                  callback(coords);
                } else {
                  tryFetch(index + 1);
                }
              })
              .catch(function() {
                if (timeoutId) clearTimeout(timeoutId);
                tryFetch(index + 1);
              });
          }
          tryFetch(0);
        }

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
            defs.innerHTML = '<radialGradient id="dome-grad-green" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#E2E8F0" stop-opacity="0.80" /><stop offset="22%" stop-color="#CBD5E1" stop-opacity="0.50" /><stop offset="55%" stop-color="#94A3B8" stop-opacity="0.24" /><stop offset="85%" stop-color="#64748B" stop-opacity="0.45" /><stop offset="100%" stop-color="#334155" stop-opacity="0.90" /></radialGradient><radialGradient id="dome-grad-blue" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.80" /><stop offset="22%" stop-color="#60A5FA" stop-opacity="0.50" /><stop offset="55%" stop-color="#3B82F6" stop-opacity="0.24" /><stop offset="85%" stop-color="#2563EB" stop-opacity="0.45" /><stop offset="100%" stop-color="#1D4ED8" stop-opacity="0.90" /></radialGradient><radialGradient id="dome-grad-gold" cx="44%" cy="38%" r="60%" fx="38%" fy="30%"><stop offset="0%" stop-color="#E2E8F0" stop-opacity="0.80" /><stop offset="20%" stop-color="#CBD5E1" stop-opacity="0.50" /><stop offset="55%" stop-color="#94A3B8" stop-opacity="0.24" /><stop offset="85%" stop-color="#64748B" stop-opacity="0.45" /><stop offset="100%" stop-color="#334155" stop-opacity="0.90" /></radialGradient>';
            overlaySvg.insertBefore(defs, overlaySvg.firstChild);
          } catch(e) {}
        }

        function getDomeTheme(cat) {
          if (cat === 'home') {
            return { main: '#FFFFFF', highlight: '#F1F5F9', dark: '#64748B', gradKey: 'green' };
          } else if (cat === 'work') {
            return { main: '#3B82F6', highlight: '#93C5FD', dark: '#1D4ED8', gradKey: 'blue' };
          }
          return { main: '#94A3B8', highlight: '#E2E8F0', dark: '#334155', gradKey: 'green' };
        }

        function getMeridianCoords(lat, lng, r) {
          var dLat = r / 111320;
          var dLng = r / (111320 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
          return {
            ns: [[lat - dLat * 0.98, lng], [lat + dLat * 0.98, lng]],
            we: [[lat, lng - dLng * 0.98], [lat, lng + dLng * 0.98]]
          };
        }

        function createDomeGeofence(placeId, circleKey, latLng, radius, theme) {
          ensureDomeSvgDefs();
          var group = L.layerGroup();
          var lat = latLng[0];
          var lng = latLng[1];
          var coords = getMeridianCoords(lat, lng, radius);

          var baseAura = L.circle(latLng, {
            radius: radius * 1.035,
            color: theme.highlight,
            weight: 2,
            opacity: 0.65,
            fill: false,
            dashArray: '5, 5',
            interactive: false
          });

          var mainDome = L.circle(latLng, {
            radius: radius,
            color: theme.dark || theme.main,
            fillColor: theme.main,
            fillOpacity: 0.26,
            weight: 3.5,
            opacity: 0.95,
            className: 'geofence-3d-dome',
            interactive: false
          });

          var midRing = L.circle(latLng, {
            radius: radius * 0.68,
            color: theme.highlight,
            weight: 1.5,
            opacity: 0.6,
            dashArray: '5, 5',
            fill: false,
            interactive: false,
            className: 'geofence-dome-contour-mid'
          });

          var topRing = L.circle(latLng, {
            radius: radius * 0.38,
            color: theme.highlight,
            weight: 1.8,
            opacity: 0.8,
            fillColor: theme.highlight,
            fillOpacity: 0.18,
            dashArray: '3, 4',
            interactive: false,
            className: 'geofence-dome-contour-top'
          });

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

          var apexBeacon = L.circleMarker(latLng, {
            radius: 3.5,
            color: '#FFFFFF',
            fillColor: theme.highlight,
            fillOpacity: 0.95,
            weight: 1.6,
            interactive: false,
            className: 'geofence-dome-beacon'
          });

          group.addLayer(baseAura);
          group.addLayer(mainDome);
          group.addLayer(midRing);
          group.addLayer(topRing);
          group.addLayer(nsArc);
          group.addLayer(weArc);
          group.addLayer(apexBeacon);

          group._baseAura = baseAura;
          group._mainDome = mainDome;
          group._midRing = midRing;
          group._topRing = topRing;
          group._nsArc = nsArc;
          group._weArc = weArc;
          group._apexBeacon = apexBeacon;
          group._placeId = placeId;
          group._placeKey = circleKey;
          group._theme = theme;

          group.addTo(map);

          setTimeout(function() {
            if (mainDome._path) {
              mainDome._path.setAttribute('fill', 'url(#dome-grad-' + theme.gradKey + ')');
            }
          }, 15);

          return group;
        }

        function updateDomeGeofence(group, latLng, radius, theme) {
          ensureDomeSvgDefs();
          var lat = latLng[0];
          var lng = latLng[1];
          var coords = getMeridianCoords(lat, lng, radius);

          if (group._baseAura) {
            group._baseAura.setLatLng(latLng);
            group._baseAura.setRadius(radius * 1.025);
            group._baseAura.setStyle({ color: theme.main });
          }
          if (group._mainDome) {
            group._mainDome.setLatLng(latLng);
            group._mainDome.setRadius(radius);
            group._mainDome.setStyle({
              color: theme.main,
              fillColor: 'url(#dome-grad-' + theme.gradKey + ')'
            });
            if (group._mainDome._path) {
              group._mainDome._path.setAttribute('fill', 'url(#dome-grad-' + theme.gradKey + ')');
            }
          }
          if (group._midRing) {
            group._midRing.setLatLng(latLng);
            group._midRing.setRadius(radius * 0.68);
            group._midRing.setStyle({ color: theme.highlight });
          }
          if (group._topRing) {
            group._topRing.setLatLng(latLng);
            group._topRing.setRadius(radius * 0.38);
            group._topRing.setStyle({ color: theme.highlight, fillColor: theme.highlight });
          }
          if (group._nsArc) {
            group._nsArc.setLatLngs(coords.ns);
            group._nsArc.setStyle({ color: theme.highlight });
          }
          if (group._weArc) {
            group._weArc.setLatLngs(coords.we);
            group._weArc.setStyle({ color: theme.highlight });
          }
          if (group._apexBeacon) {
            group._apexBeacon.setLatLng(latLng);
            group._apexBeacon.setStyle({ fillColor: theme.highlight });
          }
          group._theme = theme;
        }

        window.updateMiniMap = function(data) {
          if (!data) return;
          if (map) map.invalidateSize();

          if (data.activePointMode) {
            currentActiveMode = data.activePointMode;
          }
          
          var bounds = [];

          if (startMarker) map.removeLayer(startMarker);
          if (endMarker) map.removeLayer(endMarker);
          if (geofenceCircle) {
            try { map.removeLayer(geofenceCircle); } catch(e) {}
            geofenceCircle = null;
          }
          if (routePolyline) map.removeLayer(routePolyline);

          // Clear provisional markers when authoritative ones are supplied
          if (data.startPoint && provisionalStartMarker) {
            map.removeLayer(provisionalStartMarker);
            provisionalStartMarker = null;
          }
          if (data.endPoint && provisionalEndMarker) {
            map.removeLayer(provisionalEndMarker);
            provisionalEndMarker = null;
          }

          // Render existing saved circle safe zones (3D DOME)
          if (data.savedPlaces) {
            var currentPlaceIds = {};
            data.savedPlaces.forEach(function(p) {
              if (!p.lat || !p.lng) return;
              currentPlaceIds[p.id] = true;
              var pLatLng = [p.lat, p.lng];
              bounds.push(pLatLng);
              var domeTheme = getDomeTheme(p.category || 'gold');

              if (savedPlaceMarkers[p.id] && savedPlaceMarkers[p.id]._mainDome) {
                updateDomeGeofence(savedPlaceMarkers[p.id], pLatLng, p.radius, domeTheme);
              } else {
                if (savedPlaceMarkers[p.id]) {
                  try { map.removeLayer(savedPlaceMarkers[p.id]); } catch(e) {}
                }
                savedPlaceMarkers[p.id] = createDomeGeofence(p.id, 'saved_' + p.id, pLatLng, p.radius, domeTheme);
              }
            });

            Object.keys(savedPlaceMarkers).forEach(function(id) {
              if (!currentPlaceIds[id]) {
                try { map.removeLayer(savedPlaceMarkers[id]); } catch(e) {}
                delete savedPlaceMarkers[id];
              }
            });
          }

          // Clear old member markers
          Object.keys(memberMarkers).forEach(function(id) {
            map.removeLayer(memberMarkers[id]);
          });
          memberMarkers = {};

          // Render live member markers on mini-map
          if (data.memberLocations && data.memberLocations.length > 0) {
            data.memberLocations.forEach(function(m) {
              var hasLoc = m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0 && !isNaN(m.latitude) && !isNaN(m.longitude);
              if (!hasLoc) return;

              var lat = m.latitude;
              var lng = m.longitude;
              bounds.push([lat, lng]);

              var isCurrentSelf = m.isSelf;
              var roleColor = m.role === 'owner' ? '#F5A623' : (m.role === 'co_leader' ? '#FFFFFF' : (m.role === 'guardian' ? '#94A3B8' : '#64748B'));

              var avatarHtml = m.avatarUrl 
                ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;' + (hasLoc ? '' : 'filter:grayscale(100%);opacity:0.6;') + '" />' 
                : '<span style="color:' + (hasLoc ? '#FFF' : '#9CA3AF') + ';font-size:11px;font-weight:bold;">' + m.initial + '</span>';

              var statusDotColor = (m.battery && m.battery <= 20) ? '#EF4444' : (hasLoc ? '#FFFFFF' : '#6B7280');

              var cleanName = (m.name || 'Member').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() || 'Member';
              var displayName = isCurrentSelf ? 'You' : cleanName;
              var markerHtml = '<div class="member-pin" style="border-color:' + roleColor + ';box-shadow:0 4px 14px ' + roleColor + '66;">' +
                avatarHtml +
                '<div class="status-dot" style="background:' + statusDotColor + ';"></div>' +
                '</div>' +
                '<div class="member-name-tag ' + (isCurrentSelf ? 'self-tag' : '') + '">' + displayName + '</div>';

              var mMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                  className: 'leaflet-div-icon',
                  html: markerHtml,
                  iconSize: [44, 44],
                  iconAnchor: [22, 22]
                }),
                zIndexOffset: isCurrentSelf ? 1200 : 1000
              }).addTo(map);

              if (m.userId) {
                mMarker.on('click', function() {
                  sendAppMessage({
                    type: 'MEMBER_PIN_CLICK',
                    userId: m.userId,
                    lat: m.latitude,
                    lng: m.longitude,
                    name: m.name
                  });
                });
              }

              memberMarkers[m.userId] = mMarker;
            });
          }

          // 1. Authoritative Start Point (A) Marker & Safe Zone Boundary (3D DOME)
          if (data.startPoint && data.startPoint.latitude && data.startPoint.longitude) {
            bounds.push([data.startPoint.latitude, data.startPoint.longitude]);

            startMarker = L.marker([data.startPoint.latitude, data.startPoint.longitude], {
              icon: L.divIcon({
                className: 'leaflet-div-icon',
                html: '<div class="start-pin-wrapper"><div class="start-pin-badge">START (A)</div><div class="start-pin-core">A</div><div class="pin-pointer start-pointer"></div></div>',
                iconSize: [60, 60],
                iconAnchor: [30, 58],
                popupAnchor: [0, -58]
              }),
              zIndexOffset: 1500
            }).addTo(map).bindPopup("<b>START POINT (A)</b><br/>Lat: " + data.startPoint.latitude.toFixed(5) + "<br/>Lng: " + data.startPoint.longitude.toFixed(5));

            geofenceCircle = createDomeGeofence('active_start', 'active_start', [data.startPoint.latitude, data.startPoint.longitude], data.radius || 150, getDomeTheme('home'));
          }

          // 2. Authoritative End Point (B) Marker & Destination Boundary
          if (data.endPoint && data.endPoint.latitude && data.endPoint.longitude) {
            bounds.push([data.endPoint.latitude, data.endPoint.longitude]);

            endMarker = L.marker([data.endPoint.latitude, data.endPoint.longitude], {
              icon: L.divIcon({
                className: 'leaflet-div-icon',
                html: '<div class="end-pin-wrapper"><div class="end-pin-badge">END (B)</div><div class="end-pin-core">B</div><div class="pin-pointer end-pointer"></div></div>',
                iconSize: [60, 60],
                iconAnchor: [30, 58],
                popupAnchor: [0, -58]
              }),
              zIndexOffset: 1501
            }).addTo(map).bindPopup("<b>END POINT (B)</b><br/>Lat: " + data.endPoint.latitude.toFixed(5) + "<br/>Lng: " + data.endPoint.longitude.toFixed(5));

            // 2. Connect Start & End with Route Corridor Polyline
            if (data.startPoint && data.startPoint.latitude && data.startPoint.longitude) {
              var sLat = data.startPoint.latitude;
              var sLng = data.startPoint.longitude;
              var eLat = data.endPoint.latitude;
              var eLng = data.endPoint.longitude;

              // Immediately draw high-visibility fallback line between points
              routePolyline = L.polyline([[sLat, sLng], [eLat, eLng]], {
                color: '#06B6D4',
                weight: 4.5,
                opacity: 0.95,
                dashArray: '6, 10',
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              // Upgrade to road coordinates via OSRM if available
              fetchOsrmRoute(sLng, sLat, eLng, eLat, function(coords) {
                if (coords && coords.length > 0 && routePolyline) {
                  try {
                    routePolyline.setLatLngs(coords);
                  } catch(e) {}
                }
              });
            }
          }

          // Adjust map viewport
          if (data.resetZoom || !initialBoundsSet) {
            initialBoundsSet = true;
            userInteracted = false;
            if (bounds.length > 1) {
              try {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              } catch(e) {
                if (data.center) map.setView(data.center, 14);
              }
            } else if (data.center) {
              map.setView(data.center, 14);
            }
          }
        };

        window.addEventListener('message', function(ev) {
          try {
            var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            if (d && d.type === 'UPDATE_MAP_DATA' && d.payload) {
              window.updateMiniMap(d.payload);
            } else if (d && d.type === 'CENTER_MAP') {
              window.centerMap(d.lat, d.lng, d.zoom);
            }
          } catch(e) {}
        });

        // Notify parent that Leaflet map instance is fully loaded & ready
        sendAppMessage({ type: 'MAP_READY' });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9', borderColor: colors.border }]} 
            onPress={() => navigation.goBack()} 
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {editingPlaceId ? 'EDIT SAFE ZONE' : 'SAFE ZONES'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {activeTab === 'list' 
              ? `${displayedPlaces.length} Monitored ${displayedPlaces.length === 1 ? 'Perimeter' : 'Perimeters'}`
              : (editingPlaceId ? 'Update Boundary Settings' : 'Configure New Geofence')}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {activeTab === 'editor' ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {editingPlaceId ? (
                <TouchableOpacity 
                  style={[styles.headerCancelBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]} 
                  onPress={handleCancelEdit} 
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={15} color={colors.textMuted} />
                  <Text style={[styles.headerCancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={[
                  styles.headerSaveBtn, 
                  { 
                    backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? '#FFFFFF' : '#0F172A',
                  }
                ]} 
                onPress={handleSavePlace} 
                disabled={saving} 
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <>
                    <Ionicons name={editingPlaceId ? "checkmark" : "shield-checkmark"} size={14} color={isDark ? '#000000' : '#FFFFFF'} />
                    <Text style={[styles.headerSaveBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                      {editingPlaceId ? 'UPDATE' : 'SAVE'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.newZoneHeaderBtn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]} 
              onPress={() => setActiveTab('editor')} 
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={15} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text style={[styles.newZoneHeaderBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>NEW ZONE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Top Segmented Tab Switcher (React Bits Style) */}
      <View style={[styles.safePlaceSegmentBar, { backgroundColor: isDark ? '#141519' : '#F1F5F9', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[
            styles.safePlaceSegmentBtn,
            activeTab === 'list' && (isDark ? styles.safePlaceSegmentActiveDark : styles.safePlaceSegmentActiveLight),
          ]}
          onPress={() => {
            if (editingPlaceId) {
              handleCancelEdit();
            }
            setActiveTab('list');
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark"
            size={14}
            color={activeTab === 'list' ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#94A3B8' : '#64748B')}
          />
          <Text
            style={[
              styles.safePlaceSegmentText,
              { color: isDark ? '#94A3B8' : '#64748B' },
              activeTab === 'list' && (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }),
            ]}
          >
            Active Zones ({displayedPlaces.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.safePlaceSegmentBtn,
            activeTab === 'editor' && (isDark ? styles.safePlaceSegmentActiveDark : styles.safePlaceSegmentActiveLight),
          ]}
          onPress={() => setActiveTab('editor')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={editingPlaceId ? 'create-outline' : 'add-circle-outline'}
            size={14}
            color={activeTab === 'editor' ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#94A3B8' : '#64748B')}
          />
          <Text
            style={[
              styles.safePlaceSegmentText,
              { color: isDark ? '#94A3B8' : '#64748B' },
              activeTab === 'editor' && (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }),
            ]}
          >
            {editingPlaceId ? 'Edit Geofence' : 'Configure Zone'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Member Filter Banner */}
      {filterMemberId && (
        <View style={[styles.filterBanner, { backgroundColor: isDark ? '#18181B' : '#F1F5F9', borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0' }]}>
          <View style={styles.filterBannerLeft}>
            <Ionicons name="location" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
            <Text style={[styles.filterBannerText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
              Geofences for: {initialTargetMemberName || 'Selected Member'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterBannerClearBtn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
            onPress={() => setFilterMemberId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBannerClearText, { color: isDark ? '#000000' : '#FFFFFF' }]}>Show All</Text>
            <Ionicons name="close" size={13} color={isDark ? '#000000' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'list' ? (
        <ScrollView 
          ref={mainScrollViewRef} 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Executive Cockpit Pulse Bar */}
          <View style={styles.cockpitPulseBar}>
            <View style={[styles.cockpitPod, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' }]}>
              <Text style={[styles.cockpitValue, { color: colors.foreground }]}>{displayedPlaces.length}</Text>
              <Text style={[styles.cockpitLabel, { color: colors.textMuted }]}>ACTIVE ZONES</Text>
            </View>

            <View style={[styles.cockpitPod, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: totalInsideCount > 0 ? '#10B981' : '#64748B' }} />
                <Text style={[styles.cockpitValue, { color: totalInsideCount > 0 ? '#10B981' : colors.foreground }]}>{totalInsideCount}</Text>
              </View>
              <Text style={[styles.cockpitLabel, { color: colors.textMuted }]}>MEMBERS INSIDE</Text>
            </View>

            <View style={[styles.cockpitPod, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' }]}>
              <Text style={[styles.cockpitValue, { color: '#10B981' }]}>ARMED</Text>
              <Text style={[styles.cockpitLabel, { color: colors.textMuted }]}>GEOFENCE RADAR</Text>
            </View>
          </View>

          {/* Hero Bento Add Zone Card */}
          <TouchableOpacity
            style={[styles.heroAddGeofenceCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' }]}
            onPress={() => {
              handleCancelEdit();
              setActiveTab('editor');
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.heroAddIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Ionicons name="add" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroAddTitle, { color: colors.foreground }]}>Define New Safe Zone</Text>
              <Text style={[styles.heroAddSub, { color: colors.textMuted }]}>
                Set perimeter alerts for Home, Work, School or custom locations
              </Text>
            </View>
            <View style={[styles.heroAddPill, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#000000' : '#FFFFFF' }}>+ Add</Text>
            </View>
          </TouchableOpacity>

          {/* Section Title */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {filterMemberId
                ? `GEOFENCES FOR ${initialTargetMemberName ? initialTargetMemberName.toUpperCase() : 'MEMBER'} (${displayedPlaces.length})`
                : `MONITORED SAFE ZONES (${displayedPlaces.length})`}
            </Text>
            <View style={[styles.accentLine, { backgroundColor: colors.accentGold }]} />
          </View>

          {loadingPlaces ? (
            <View style={{ paddingVertical: 36, alignItems: 'center' }}>
              <LuxuryRadarLoading
                size={120}
                message="SCANNING GEOFENCES..."
                subMessage="Synchronizing real-time perimeters"
              />
            </View>
          ) : displayedPlaces.length === 0 ? (
            <View style={[styles.emptyCard, cardStyles, { borderRadius: 18, padding: 32 }]}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={28} color={colors.accentGold} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontSize: 13 }]}>
                {filterMemberId ? 'NO GEOFENCES FOR THIS MEMBER' : 'NO SAFE PLACES CONFIGURED'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted, maxWidth: 280, marginTop: 6, lineHeight: 18 }]}>
                {filterMemberId
                  ? 'No perimeter alerts have been assigned specifically to this member.'
                  : 'Protect your circle by creating safe zones around home, school, workplace, or emergency check-in hubs.'}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 18,
                  backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={() => {
                  handleCancelEdit();
                  setActiveTab('editor');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
                  CONFIGURE FIRST SAFE ZONE
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placesList}>
              {displayedPlaces.map((p) => {
                const assignedIds: string[] = p.assigned_user_ids || (p.target_user_id ? [p.target_user_id] : []);
                const assignedMembers = members.filter((m) => assignedIds.includes(m.user_id));
                const placeCoords = parseLocationPoint(p);
                const placeRadius = parseFloat(p.radius_m || p.radius || 150);

                const insideMembers = memberLocations.filter((m) => {
                  const hasValidLoc = m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0;
                  if (!hasValidLoc || placeCoords.latitude === 0 || placeCoords.longitude === 0) return false;
                  const dist = getHaversineDistanceInMeters(m.latitude, m.longitude, placeCoords.latitude, placeCoords.longitude);
                  return dist <= placeRadius;
                });

                const catId = p.category || 'home';
                const catMeta = categories.find((c) => c.id === catId) || { label: catId.toUpperCase(), icon: 'bookmark' };

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.spaciousZoneCard,
                      {
                        backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                        borderColor: insideMembers.length > 0 ? (isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0') : (isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0'),
                      },
                    ]}
                  >
                    {/* Top Row: Category + Status Badge */}
                    <View style={styles.spaciousZoneHeader}>
                      <View
                        style={[
                          styles.zoneCategoryBadge,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                          },
                        ]}
                      >
                        <Ionicons
                          name={(catMeta.icon as any) || 'bookmark'}
                          size={13}
                          color={isDark ? colors.accentGold : '#0F172A'}
                        />
                        <Text style={[styles.zoneCategoryText, { color: isDark ? colors.accentGold : '#0F172A' }]}>
                          {catMeta.label}
                        </Text>
                      </View>

                      {insideMembers.length > 0 ? (
                        <View
                          style={[
                            styles.zoneStatusPill,
                            {
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                              borderColor: '#10B981',
                            },
                          ]}
                        >
                          <View style={[styles.zoneStatusDot, { backgroundColor: '#10B981' }]} />
                          <Text style={[styles.zoneStatusText, { color: isDark ? '#34D399' : '#047857' }]}>
                            {insideMembers.length} INSIDE NOW
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.zoneStatusPill,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                            },
                          ]}
                        >
                          <View style={[styles.zoneStatusDot, { backgroundColor: '#94A3B8' }]} />
                          <Text style={[styles.zoneStatusText, { color: colors.textMuted }]}>
                            PERIMETER ARMED
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Geofence Title */}
                    <Text style={[styles.spaciousZoneTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {p.name}
                    </Text>

                    {/* Metadata Pills */}
                    <View style={styles.spaciousZoneMetaRow}>
                      <View
                        style={[
                          styles.spaciousZoneMetaPill,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          },
                        ]}
                      >
                        <Ionicons name="radio" size={11} color={colors.accentGold} />
                        <Text style={[styles.spaciousZoneMetaText, { color: colors.accentGold }]}>
                          {placeRadius >= 1000 ? `${(placeRadius / 1000).toFixed(1)} km` : `${placeRadius}m`} Perimeter
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.spaciousZoneMetaPill,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          },
                        ]}
                      >
                        <Ionicons name="people" size={11} color={colors.textMuted} />
                        <Text style={[styles.spaciousZoneMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                          {assignedMembers.length > 0
                            ? assignedMembers.map((m) => String(m.profile?.full_name || 'Member').split(' ')[0]).join(', ')
                            : 'All Circle Members'}
                        </Text>
                      </View>
                    </View>

                    {/* Live Occupants Section if any */}
                    {insideMembers.length > 0 && (
                      <View
                        style={[
                          styles.zoneOccupantsContainer,
                          {
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4',
                            borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.zoneOccupantsHeader,
                            { color: isDark ? '#34D399' : '#047857' },
                          ]}
                        >
                          CONFIRMED INSIDE ZONE:
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          {insideMembers.map((m) => (
                            <View
                              key={m.userId}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                                borderRadius: 12,
                              }}
                            >
                              <View
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {m.avatarUrl ? (
                                  <Image source={{ uri: m.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                  <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#000000' : '#FFFFFF' }}>
                                    {m.initial}
                                  </Text>
                                )}
                              </View>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.foreground }}>
                                {m.name.split(' ')[0]} {m.isSelf ? '(You)' : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Action Dock */}
                    <View
                      style={[
                        styles.zoneActionDock,
                        { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.zoneDockBtn,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                          },
                        ]}
                        onPress={() => {
                          setStartPoint(placeCoords);
                          setRadius(placeRadius);
                          setSelectedCategory(p.category || 'home');
                          setIsMapExpanded(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="map-outline" size={15} color={isDark ? '#FFFFFF' : '#0F172A'} />
                        <Text style={[styles.zoneDockBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                          Preview Map
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.zoneDockBtn,
                          {
                            backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                            borderColor: isDark ? '#FFFFFF' : '#0F172A',
                          },
                        ]}
                        onPress={() => handleStartEditPlace(p)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={15} color={isDark ? '#000000' : '#FFFFFF'} />
                        <Text style={[styles.zoneDockBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]} numberOfLines={1}>
                          Edit Zone
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.zoneDockIconOnlyBtn,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                          },
                        ]}
                        onPress={() => handleDeletePlace(p.id, p.name)}
                        activeOpacity={0.7}
                        accessibilityLabel="Delete Safe Zone"
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView 
          ref={mainScrollViewRef} 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          scrollEnabled={isScrollEnabled}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editorHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.overline, { color: colors.accentGold }]}>{editingPlaceId ? 'MODIFY BOUNDARY' : 'SETUP BOUNDARY'}</Text>
              <Text style={[styles.title, { color: colors.foreground, marginBottom: 0 }]}>{editingPlaceId ? 'Edit Geofence' : 'Define Geofence'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {editingPlaceId && (
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={[styles.cancelEditorHeaderBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowGeofenceInfoModal(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Learn how safe places geofencing works"
                style={[styles.infoCircleBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9', borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle-outline" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>GEOFENCE NAME</Text>
        <TextInput
          style={[styles.modernInputBox, { color: colors.foreground, borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }]}
          placeholder="e.g. Home Safe Zone, School Perimeter, Commute Corridor"
          value={placeName}
          onChangeText={setPlaceName}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CATEGORY & TYPE</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            const isRouteGated = cat.id === 'route' && !canUseRouteCategory();

            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTile, 
                  {
                    backgroundColor: active ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
                    borderColor: active ? (isDark ? '#FFFFFF' : '#0F172A') : colors.border,
                  },
                  isRouteGated ? { opacity: 0.8 } : null
                ]}
                onPress={() => {
                  if (cat.id === 'route' && !canUseRouteCategory()) {
                    setGatedFeatureName('Commute Corridor Route & Live ETAs');
                    setPaywallVisible(true);
                    return;
                  }
                  setSelectedCategory(cat.id);
                  if (cat.id === 'route') {
                    setIsRouteGeofence(true);
                    setPlaceName('Commute Route Corridor');
                  } else {
                    setIsRouteGeofence(false);
                    setPlaceName(`${cat.label} Safe Zone`);
                  }
                }}
                activeOpacity={0.8}
              >
                {isRouteGated ? (
                  <View style={styles.categoryPlusBadge}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: '#1A1A1A' }}>PLUS</Text>
                  </View>
                ) : null}
                <Ionicons 
                  name={cat.icon as any} 
                  size={19} 
                  color={active ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted} 
                />
                <Text 
                  style={[
                    styles.categoryLabel, 
                    { color: active ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted, fontWeight: active ? '800' : '600' }
                  ]}
                  numberOfLines={1}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Circle Guard Plus Features: Speed-Adaptive Buffer & Schedule */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.inputLabel}>CIRCLE GUARD PLUS CONTROLS</Text>
          
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: LUXURY_THEME.colors.surface,
              borderWidth: 1,
              borderColor: speedAdaptive ? LUXURY_THEME.colors.accentGold : LUXURY_THEME.colors.border,
              padding: 14,
              borderRadius: 14,
            }}
            onPress={() => {
              if (!canUseAdaptiveBuffer()) {
                setGatedFeatureName('Speed-Adaptive Geofence Buffer');
                setPaywallVisible(true);
                return;
              }
              setSpeedAdaptive(!speedAdaptive);
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Ionicons name="speedometer-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: LUXURY_THEME.colors.foreground, letterSpacing: 0.5 }}>
                  SPEED-ADAPTIVE BUFFER
                </Text>
                <View style={{ backgroundColor: isDark ? '#FFFFFF' : '#0F172A', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#000000' : '#FFFFFF' }}>PLUS</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, color: LUXURY_THEME.colors.textMuted, lineHeight: 14 }}>
                Expands buffer dynamically when member is driving to prevent false highway alerts.
              </Text>
            </View>

            <Ionicons
              name={speedAdaptive ? "toggle" : "toggle-outline"}
              size={28}
              color={speedAdaptive ? LUXURY_THEME.colors.accentGold : LUXURY_THEME.colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Tracked Member Target Selector */}
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>TRACKED MEMBER ASSIGNMENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberChipsScroll}>
          <TouchableOpacity
            style={[
              styles.memberChip,
              targetUserId === null
                ? (isDark ? styles.activeMemberChipDark : styles.activeMemberChipLight)
                : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }
            ]}
            onPress={() => setTargetUserId(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={13} color={targetUserId === null ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted} />
            <Text style={[
              styles.memberChipText, 
              targetUserId === null 
                ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }) 
                : { color: colors.textMuted }
            ]}>
              ALL CIRCLE MEMBERS
            </Text>
          </TouchableOpacity>
          {members.map(m => {
            const isSelected = targetUserId === m.user_id;
            const firstName = String(m.profile?.full_name || 'Member').split(' ')[0];
            return (
              <TouchableOpacity
                key={m.user_id}
                style={[
                  styles.memberChip,
                  isSelected
                    ? (isDark ? styles.activeMemberChipDark : styles.activeMemberChipLight)
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border }
                ]}
                onPress={() => setTargetUserId(m.user_id)}
                activeOpacity={0.8}
              >
                <View style={[styles.miniAvatarDot, { backgroundColor: isSelected ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted }]}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : '#FFFFFF' }}>{firstName.charAt(0)}</Text>
                </View>
                <Text style={[
                  styles.memberChipText, 
                  isSelected 
                    ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }) 
                    : { color: colors.textMuted }
                ]}>
                  {firstName.toUpperCase()} ONLY
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick Member Pin Selector */}
        {memberLocations.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>PIN GEOFENCE TO MEMBER'S LIVE LOCATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {memberLocations.map(m => {
                const roleColor = m.role === 'owner' ? '#F5A623' : (m.role === 'co_leader' ? (isDark ? '#FFFFFF' : '#0F172A') : (m.role === 'guardian' ? (isDark ? '#E2E8F0' : '#334155') : '#64748B'));
                const firstName = m.name.split(' ')[0];
                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={[
                      styles.memberLivePinBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                        borderColor: roleColor,
                      }
                    ]}
                    onPress={() => {
                      if (m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0) {
                        setStartPoint({ latitude: m.latitude, longitude: m.longitude });
                        setTargetUserId(m.userId);
                        setSelectedUserIds(prev => prev.includes(m.userId) ? prev : [...prev, m.userId]);
                        setPlaceName(`${firstName}'s Safe Zone`);
                        setTimeout(() => pushMiniMapData(true), 50);
                        showAlert({
                          title: 'Member Boundary Target Set',
                          message: `Geofence center pinned to ${m.name}'s live position and assigned tracking to ${m.name}.`,
                          type: 'success',
                        });
                      } else {
                        showAlert({
                          title: 'Location Unavailable',
                          message: `${m.name}'s live location is currently unavailable.`,
                          type: 'warning',
                        });
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="location-sharp" size={14} color={roleColor} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.foreground, letterSpacing: 0.5 }}>
                      {m.isSelf ? 'MY LOCATION' : firstName.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Interactive Mini Map Picker (Mark Start & End Points) */}
        <View style={styles.miniMapHeaderRow}>
          <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0, marginRight: 8, color: colors.textMuted }]} numberOfLines={1}>
            GEOFENCE MAP (TAP TO SET PINS)
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity 
              style={[
                styles.mapToolBtn, 
                { 
                  borderColor: '#38BDF8', 
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE' 
                }
              ]} 
              onPress={() => setIsMapExpanded(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="expand-outline" size={13} color={isDark ? '#38BDF8' : '#0284C7'} />
              <Text style={[styles.mapToolBtnText, { color: isDark ? '#38BDF8' : '#0284C7' }]}>EXPAND</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.mapToolBtn,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#CBD5E1',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                }
              ]} 
              onPress={handleResetPoints} 
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={13} color={colors.foreground} />
              <Text style={[styles.mapToolBtnText, { color: colors.foreground }]}>RESET PINS</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.modeToggleRow, { backgroundColor: isDark ? '#141519' : '#F1F5F9', borderColor: colors.border }]}>
          <TouchableOpacity 
            style={[
              styles.modeBtn, 
              activePointMode === 'start' && (isDark ? styles.modeBtnActiveDark : styles.modeBtnActiveLight)
            ]}
            onPress={() => setActivePointMode('start')}
            activeOpacity={0.8}
          >
            <View style={[styles.pinDot, { backgroundColor: '#10B981' }]} />
            <Text style={[
              styles.modeBtnText, 
              activePointMode === 'start' 
                ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' })
                : { color: colors.textMuted }
            ]} numberOfLines={1}>
              {startPoint ? 'START PIN: SET ✓' : 'TAP MAP: SET START'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.modeBtn, 
              activePointMode === 'end' && (isDark ? styles.modeBtnActiveDark : styles.modeBtnActiveLight)
            ]}
            onPress={() => setActivePointMode('end')}
            activeOpacity={0.8}
          >
            <View style={[styles.pinDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[
              styles.modeBtnText, 
              activePointMode === 'end' 
                ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' })
                : { color: colors.textMuted }
            ]} numberOfLines={1}>
              {endPoint ? 'END PIN: SET ✓' : 'TAP MAP: SET END (OPTIONAL)'}
            </Text>
          </TouchableOpacity>
        </View>

        <View 
          style={styles.miniMapContainer}
          onTouchStart={() => setIsScrollEnabled(false)}
          onTouchEnd={() => setIsScrollEnabled(true)}
          onTouchCancel={() => setIsScrollEnabled(true)}
          onResponderGrant={() => setIsScrollEnabled(false)}
          onResponderRelease={() => setIsScrollEnabled(true)}
          onResponderTerminate={() => setIsScrollEnabled(true)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setIsScrollEnabled(false),
            onMouseLeave: () => setIsScrollEnabled(true),
          } : {})}
        >
          {Platform.OS === 'web' ? (
            <iframe
              id="inline-safe-places-map"
              srcDoc={miniMapHtml}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 14 }}
              onLoad={() => {
                setTimeout(() => pushMiniMapData(false), 200);
                setTimeout(() => pushMiniMapData(false), 600);
              }}
            />
          ) : (
            <WebViewAny
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: miniMapHtml, baseUrl: 'https://unpkg.com' }}
              style={styles.miniMap}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode="always"
              androidLayerType="hardware"
              nestedScrollEnabled={false}
              scrollEnabled={false}
              onLoadEnd={() => {
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript('if (map) map.invalidateSize(); true;');
                }
                setTimeout(() => pushMiniMapData(false), 200);
              }}
              onMessage={(event: any) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data);
                  if (msg.type === 'MAP_READY') {
                    pushMiniMapData(false);
                  } else if (msg.type === 'MAP_TAP') {
                    handleMapTap(msg.lat, msg.lng);
                  } else if (msg.type === 'MEMBER_TAP') {
                    const newStart = { latitude: msg.lat, longitude: msg.lng };
                    setStartPoint(newStart);
                    setTargetUserId(msg.userId);
                    setSelectedUserIds(prev => prev.includes(msg.userId) ? prev : [...prev, msg.userId]);
                    setPlaceName(`${msg.name.split(' ')[0]}'s Safe Zone`);
                    setTimeout(() => pushMiniMapData(true), 50);
                    showAlert({
                      title: 'Member Boundary Target Set',
                      message: `Geofence center pinned to ${msg.name}'s current live position. Assigned tracking specifically to ${msg.name}.`,
                      type: 'success',
                    });
                  }
                } catch(e) {}
              }}
            />
          )}
        </View>

        {/* Real-time Member Proximity & Arrival ETA Live Cards (No Dummy Data) */}
        {startPoint && memberLocations.length > 0 ? (
          <View style={{ marginBottom: 16, gap: 10 }}>
            <Text style={styles.inputLabel}>LIVE MEMBER PROXIMITY & ESTIMATED ARRIVAL (REAL-TIME MATH)</Text>
            {memberLocations.map(m => {
              const hasValidLoc = m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0;

              if (!hasValidLoc) {
                return (
                  <View key={m.userId} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: LUXURY_THEME.colors.surface,
                    borderColor: '#6B7280',
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 14,
                    opacity: 0.85,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons name="wifi-outline" size={24} color="#6B7280" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: LUXURY_THEME.colors.foreground }}>
                          {m.name} {m.isSelf ? '(You)' : ''}
                        </Text>
                        <Text style={{ fontSize: 10, color: LUXURY_THEME.colors.textMuted, marginTop: 1 }}>
                          GPS signal or location permission unavailable
                        </Text>
                      </View>
                    </View>

                    <View style={{ backgroundColor: 'rgba(107, 114, 128, 0.15)', borderWidth: 1, borderColor: '#6B7280', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.5 }}>
                        OFFLINE
                      </Text>
                    </View>
                  </View>
                );
              }

              const distMeters = getHaversineDistanceInMeters(m.latitude, m.longitude, startPoint.latitude, startPoint.longitude);
              const distKm = (distMeters / 1000).toFixed(2);
              
              // Real-time ETA math: assuming average 40 km/h movement (~666m per min)
              const etaMinutes = Math.max(1, Math.round(distMeters / 666));
              
              const isInsideInner = distMeters <= radius;
              const outerBufferRadius = Math.max(radius * 3, 800);
              const isInsideOuter = distMeters <= outerBufferRadius;

              let statusText = `Est. Arrival: ~${etaMinutes} min`;
              let statusColor = '#3B82F6';
              let badgeBg = 'rgba(59, 130, 246, 0.12)';

              if (isInsideInner) {
                statusText = 'INSIDE SAFE ZONE';
                statusColor = isDark ? '#FFFFFF' : '#0F172A';
                badgeBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#F1F5F9';
              } else if (isInsideOuter) {
                statusText = `BUFFER ZONE (~${etaMinutes} min)`;
                statusColor = '#F59E0B';
                badgeBg = 'rgba(245, 158, 11, 0.15)';
              }

              return (
                <View key={m.userId} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: LUXURY_THEME.colors.surface,
                  borderColor: statusColor,
                  borderWidth: 1,
                  padding: 12,
                  borderRadius: 14,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="navigate-circle-sharp" size={24} color={statusColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: LUXURY_THEME.colors.foreground }}>
                        {m.name} {m.isSelf ? '(You)' : ''}
                      </Text>
                      <Text style={{ fontSize: 10, color: LUXURY_THEME.colors.textMuted, marginTop: 1 }}>
                        Distance: {distKm} km away from boundary center
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: badgeBg, borderWidth: 1, borderColor: statusColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: '900', color: statusColor, letterSpacing: 0.5 }}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Coordinates & Calculated Distance Readout */}
        <View style={[styles.coordReadoutBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.coordCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <View style={[styles.miniDotIndicator, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.coordLabel, { color: colors.textMuted }]}>START PIN</Text>
            </View>
            <Text style={[styles.coordVal, { color: colors.foreground }]} numberOfLines={1}>
              {startPoint ? `${startPoint.latitude.toFixed(4)}, ${startPoint.longitude.toFixed(4)}` : 'Tap map to set'}
            </Text>
          </View>
          <View style={[styles.coordDivider, { backgroundColor: colors.border }]} />
          <View style={styles.coordCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <View style={[styles.miniDotIndicator, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.coordLabel, { color: colors.textMuted }]}>END PIN</Text>
            </View>
            <Text style={[styles.coordVal, { color: colors.foreground }]} numberOfLines={1}>
              {endPoint ? `${endPoint.latitude.toFixed(4)}, ${endPoint.longitude.toFixed(4)}` : 'Optional'}
            </Text>
          </View>
        </View>

        {/* Radius Selector */}
        <View style={styles.radiusHeaderRow}>
          <Text style={[styles.inputLabel, { color: colors.textMuted, marginBottom: 0 }]}>GEOFENCE RADIUS</Text>
          <View style={[styles.radiusPillBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
            <Ionicons name="radio" size={12} color={colors.accentGold} />
            <Text style={[styles.radiusValText, { color: colors.accentGold }]}>
              {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
            </Text>
          </View>
        </View>
        
        <View style={styles.radiusRow}>
          {[100, 200, 500, 1000, 2500, 5000].map((r) => {
            const active = radius === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.radiusChip, 
                  active 
                    ? (isDark ? styles.radiusChipActiveDark : styles.radiusChipActiveLight)
                    : { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: colors.border }
                ]}
                onPress={() => setRadius(r)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.radiusText, 
                  active 
                    ? (isDark ? { color: '#000000', fontWeight: '900' } : { color: '#FFFFFF', fontWeight: '900' })
                    : { color: colors.textMuted }
                ]}>
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Editor Action Dock */}
        <View style={styles.editorBottomDock}>
          {editingPlaceId && (
            <TouchableOpacity
              style={[
                styles.editorCancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  borderColor: colors.border,
                }
              ]}
              onPress={handleCancelEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.foreground} />
              <Text style={[styles.editorCancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.editorSubmitBtn,
              {
                flex: editingPlaceId ? 2 : 1,
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              }
            ]}
            onPress={handleSavePlace}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
            ) : (
              <>
                <Ionicons
                  name={editingPlaceId ? 'checkmark-circle' : 'shield-checkmark'}
                  size={18}
                  color={isDark ? '#000000' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.editorSubmitBtnText,
                    { color: isDark ? '#000000' : '#FFFFFF' }
                  ]}
                >
                  {editingPlaceId ? 'UPDATE GEOFENCE' : 'ACTIVATE GEOFENCE'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      )}

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        gatedFeatureName={gatedFeatureName}
      />

      <Modal 
        visible={isMapExpanded} 
        animationType="slide" 
        statusBarTranslucent={true}
        onRequestClose={() => {
          setIsMapExpanded(false);
          setTimeout(() => pushMiniMapData(true), 150);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#1C2321' }}>
          {/* Expanded Map Header */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingHorizontal: 20, 
            paddingTop: topInset + 8,
            paddingBottom: 14,
            backgroundColor: isDark ? '#15171E' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: colors.border
          }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accentGold, letterSpacing: 1.5 }}>PRECISION GEOFENCE PINNER</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.foreground }} numberOfLines={1}>
                {placeName || 'Safe Zone Boundary'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity 
                style={[styles.modalHeaderBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]} 
                onPress={handleResetPoints} 
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.foreground} />
                <Text style={[styles.modalHeaderBtnText, { color: colors.foreground }]}>RESET</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalHeaderBtn,
                  {
                    backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? '#FFFFFF' : '#0F172A',
                    paddingHorizontal: 16,
                  }
                ]}
                onPress={() => {
                  setIsMapExpanded(false);
                  setTimeout(() => pushMiniMapData(true), 150);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={15} color={isDark ? '#000000' : '#FFFFFF'} />
                <Text style={[styles.modalHeaderBtnText, { color: isDark ? '#000000' : '#FFFFFF', fontWeight: '900' }]}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Toggle Row in Full Map */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: isDark ? 'rgba(21, 23, 30, 0.95)' : 'rgba(245, 245, 245, 0.95)', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={[styles.modeToggleRow, { backgroundColor: isDark ? '#141519' : '#F1F5F9', borderColor: colors.border, marginBottom: 4 }]}>
              <TouchableOpacity 
                style={[
                  styles.modeBtn, 
                  activePointMode === 'start' && (isDark ? styles.modeBtnActiveDark : styles.modeBtnActiveLight)
                ]}
                onPress={() => setActivePointMode('start')}
                activeOpacity={0.8}
              >
                <View style={[styles.pinDot, { backgroundColor: '#10B981' }]} />
                <Text style={[
                  styles.modeBtnText, 
                  activePointMode === 'start' 
                    ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' })
                    : { color: colors.textMuted }
                ]} numberOfLines={1}>
                  {startPoint ? 'START PIN: SET ✓' : 'TAP MAP: SET START'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modeBtn, 
                  activePointMode === 'end' && (isDark ? styles.modeBtnActiveDark : styles.modeBtnActiveLight)
                ]}
                onPress={() => setActivePointMode('end')}
                activeOpacity={0.8}
              >
                <View style={[styles.pinDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[
                  styles.modeBtnText, 
                  activePointMode === 'end' 
                    ? (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' })
                    : { color: colors.textMuted }
                ]} numberOfLines={1}>
                  {endPoint ? 'END PIN: SET ✓' : 'TAP MAP: SET END (OPTIONAL)'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
              Tap anywhere on the map to position boundary • Drag to pan • Pinch to zoom
            </Text>
          </View>

          {/* Full-Screen Map WebView */}
          <View style={{ flex: 1 }}>
            {Platform.OS === 'web' ? (
              <iframe
                id="expanded-safe-places-map"
                srcDoc={miniMapHtml}
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={() => {
                  setTimeout(() => pushMiniMapData(true), 150);
                  setTimeout(() => pushMiniMapData(true), 500);
                }}
              />
            ) : (
              <WebViewAny
                ref={expandedWebViewRef}
                originWhitelist={['*']}
                source={{ html: miniMapHtml, baseUrl: 'https://unpkg.com' }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="always"
                androidLayerType="hardware"
                onLoadEnd={() => {
                  if (expandedWebViewRef.current) {
                    expandedWebViewRef.current.injectJavaScript('if (map) map.invalidateSize(); true;');
                  }
                  setTimeout(() => pushMiniMapData(true), 150);
                  setTimeout(() => pushMiniMapData(true), 500);
                }}
                onMessage={(event: any) => {
                  try {
                    const msg = JSON.parse(event.nativeEvent.data);
                    if (msg.type === 'MAP_READY') {
                      pushMiniMapData(true);
                    } else if (msg.type === 'MAP_TAP') {
                      handleMapTap(msg.lat, msg.lng);
                    } else if (msg.type === 'MEMBER_TAP') {
                      const newStart = { latitude: msg.lat, longitude: msg.lng };
                      setStartPoint(newStart);
                      setTargetUserId(msg.userId);
                      setSelectedUserIds(prev => prev.includes(msg.userId) ? prev : [...prev, msg.userId]);
                      setPlaceName(`${msg.name.split(' ')[0]}'s Safe Zone`);
                      setTimeout(() => pushMiniMapData(true), 50);
                    }
                  } catch(e) {}
                }}
              />
            )}

            {/* Floating Live Coordinates & Precision Controls Dock in Full Map */}
            <View style={{
              position: 'absolute',
              bottom: 24,
              left: 16,
              right: 16,
              backgroundColor: isDark ? 'rgba(21, 23, 30, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              borderRadius: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: 0.5 }}>START POINT (A)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.foreground }} numberOfLines={1}>
                      {startPoint ? `${startPoint.latitude.toFixed(5)}, ${startPoint.longitude.toFixed(5)}` : 'Tap map to choose'}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 1, height: 26, backgroundColor: colors.border, marginHorizontal: 6 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginLeft: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 0.5 }}>END POINT (B)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.foreground }} numberOfLines={1}>
                      {endPoint ? `${endPoint.latitude.toFixed(5)}, ${endPoint.longitude.toFixed(5)}` : 'Tap map to choose (Optional)'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {userLoc ? (
                  <TouchableOpacity
                    style={[
                      styles.modalDockBtn,
                      {
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
                        borderColor: '#38BDF8',
                      }
                    ]}
                    onPress={() => centerMapOn(userLoc.latitude, userLoc.longitude, 16)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="locate-outline" size={14} color={isDark ? '#38BDF8' : '#0284C7'} />
                    <Text style={[styles.modalDockBtnText, { color: isDark ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>MY LOC</Text>
                  </TouchableOpacity>
                ) : null}

                {startPoint ? (
                  <TouchableOpacity
                    style={[
                      styles.modalDockBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1',
                      }
                    ]}
                    onPress={() => centerMapOn(startPoint.latitude, startPoint.longitude, 16)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="flag-outline" size={14} color={colors.foreground} />
                    <Text style={[styles.modalDockBtnText, { color: colors.foreground }]} numberOfLines={1}>GO TO START</Text>
                  </TouchableOpacity>
                ) : null}

                {endPoint ? (
                  <TouchableOpacity
                    style={[
                      styles.modalDockBtn,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                        borderColor: '#EF4444',
                      }
                    ]}
                    onPress={() => centerMapOn(endPoint.latitude, endPoint.longitude, 16)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="navigate-outline" size={14} color="#EF4444" />
                    <Text style={[styles.modalDockBtnText, { color: '#EF4444' }]} numberOfLines={1}>GO TO END</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.modalDockIconBtn,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                    }
                  ]}
                  onPress={handleResetPoints}
                  activeOpacity={0.75}
                  accessibilityLabel="Reset points"
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <FeatureInfoModal
        visible={showGeofenceInfoModal}
        onClose={() => setShowGeofenceInfoModal(false)}
        title="Safe Places & Geofencing"
        subtitle="Automated arrival and departure intelligence"
        iconName="shield-checkmark"
        iconColor={isDark ? '#FFFFFF' : '#0F172A'}
        overview="Safe Places creates dynamic virtual perimeters around home, school, work, or frequent transit routes. When circle members cross these boundaries, CircleGuard automatically alerts guardians without draining battery."
        bullets={[
          {
            icon: 'notifications',
            title: 'Arrival & Departure Pings',
            description: 'Instant push notifications when your kids reach school or family returns home safely.',
          },
          {
            icon: 'battery-charging',
            title: 'Low-Power Hardware Geofencing',
            description: 'Uses cell towers and Wi-Fi signatures alongside low-frequency GPS to preserve all-day battery life.',
          },
          {
            icon: 'speedometer',
            title: 'Speed-Adaptive Boundary Buffer',
            description: 'Expands virtual boundary margins at driving speeds to eliminate false crossing alerts while cruising past on nearby highways.',
          },
        ]}
        tip="For homes and schools, set the perimeter radius to 150m–200m for prompt notifications without dead-zone dropouts."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1.5,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  headerCancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
  },
  headerSaveBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  newZoneHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  newZoneHeaderBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  safePlaceSegmentBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    padding: 4,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  safePlaceSegmentBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
  },
  safePlaceSegmentActiveLight: {
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  safePlaceSegmentActiveDark: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  safePlaceSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  filterBannerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterBannerClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterBannerClearText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  cockpitPulseBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  cockpitPod: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitValue: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cockpitLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 3,
    textAlign: 'center',
  },
  heroAddGeofenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroAddIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAddTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroAddSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  heroAddPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  accentLine: {
    flex: 1,
    height: 1,
  },
  emptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  placesList: {
    gap: 12,
  },
  spaciousZoneCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  spaciousZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  zoneCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  zoneCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  zoneStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  zoneStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  spaciousZoneTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  spaciousZoneMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  spaciousZoneMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  spaciousZoneMetaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  zoneOccupantsContainer: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  zoneOccupantsHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  zoneActionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
  },
  zoneDockBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  zoneDockBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  zoneDockIconOnlyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cancelEditorHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  modernInputBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  underlineInput: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  categoryTile: {
    flex: 1,
    height: 62,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
    position: 'relative',
  },
  categoryPlusBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#F5A623',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  categoryLabel: {
    fontSize: 9.5,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  plusFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
  },
  memberChipsScroll: {
    gap: 8,
    marginBottom: 18,
  },
  memberChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  activeMemberChipDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  activeMemberChipLight: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  memberChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  miniAvatarDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberLivePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  miniMapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  mapToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  mapToolBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    height: 44,
  },
  modeBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
  },
  modeBtnActiveDark: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  modeBtnActiveLight: {
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  pinDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modeBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  miniMapContainer: {
    height: 230,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  miniMap: {
    flex: 1,
  },
  coordReadoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  coordCol: {
    flex: 1,
  },
  miniDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  coordVal: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  coordDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  radiusPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  radiusValText: {
    fontSize: 12,
    fontWeight: '800',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 22,
  },
  radiusChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActiveDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  radiusChipActiveLight: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  radiusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  editorBottomDock: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  editorCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  editorCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editorSubmitBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  editorSubmitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
  },
  modalHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  modalDockBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  modalDockBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalDockIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legacy compatibility styles
  resetMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetMapText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  activeCategoryTile: {},
  activeCategoryLabel: {},
  activeMemberChip: {},
  activeMemberChipText: {},
  activeStartModeBtn: {},
  activeEndModeBtn: {},
  activeRadiusChip: {},
  activeRadiusText: {},
  placeCard: {},
  placeLeft: {},
  placeIconBox: {},
  placeName: {},
  tagRow: {},
  placeRadius: {},
  tagDot: {},
  targetTag: {},
  editBtn: {},
  deleteBtn: {},
});
