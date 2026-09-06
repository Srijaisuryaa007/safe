import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Image, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
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
  const { showAlert, showConfirm } = useLuxuryAlert();
  const { canCreatePlace, canUseRouteCategory, canUseAdaptiveBuffer, canUseSchedule } = useSubscriptionStore();

  const cardStyles = getThemeCardStyles(themeMode);
  const primaryBtnStyles = getThemeButtonStyles(themeMode, 'primary');
  const secondaryBtnStyles = getThemeButtonStyles(themeMode, 'secondary');
  const dangerBtnStyles = getThemeButtonStyles(themeMode, 'danger');
  const borderStyles = getThemeBorderStyles(themeMode);

  const [placeName, setPlaceName] = useState('Home Safe Zone');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [radius, setRadius] = useState(150);
  const [saving, setSaving] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null); // null = All Circle Members

  // Premium Feature Form States
  const [speedAdaptive, setSpeedAdaptive] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState('');

  // Interactive Mini Map & Start/End Points State
  const webViewRef = useRef<WebView | null>(null);
  const expandedWebViewRef = useRef<WebView | null>(null);
  const [startPoint, setStartPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePointMode, setActivePointMode] = useState<'start' | 'end'>('start');
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRouteGeofence, setIsRouteGeofence] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const mainScrollViewRef = useRef<ScrollView | null>(null);
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
    if (activeCircle?.id) {
      fetchSavedPlaces(activeCircle.id);
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
  }, [activeCircle?.id, userLoc]);

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
      setSavedPlaces(placesWithMembers || []);
    } catch (err) {
      console.error('Error fetching places:', err);
    } finally {
      setLoadingPlaces(false);
    }
  };

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const handleSavePlace = async () => {
    if (!activeCircle || !profile) {
      showAlert({
        title: 'Error',
        message: 'No active circle found. Please create or join a circle first.',
        type: 'error',
      });
      return;
    }

    if (!placeName.trim()) {
      showAlert({
        title: 'Required Field',
        message: 'Please enter a name for your geofence boundary.',
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

        showAlert({
          title: 'Geofence Updated',
          message: `"${placeName}" has been updated with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius!`,
          type: 'success',
        });
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

        showAlert({
          title: 'Geofence Created',
          message: `Geofence "${placeName}" created with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius!`,
          type: 'success',
        });
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

      setPlaceName('');
      setSelectedUserIds([]);
      handleResetPoints();
      fetchSavedPlaces(activeCircle.id);
      fetchPlaces(activeCircle.id);
    } catch (err: any) {
      console.error('Error saving/updating place:', err);
      showAlert({
        title: 'Error Saving Geofence',
        message: err.message || 'Failed to save geofence.',
        type: 'error',
      });
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
          showAlert({
            title: 'Error Deleting Geofence',
            message: err.message || 'Permission denied or network error.',
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
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
          background: #10B981;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 900;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2px 7px;
          border-radius: 6px;
          border: 1.5px solid #FFFFFF;
          white-space: nowrap;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(16,185,129,0.7);
          margin-bottom: 2px;
        }
        .start-pin-core {
          width: 26px;
          height: 26px;
          background: radial-gradient(circle at 35% 35%, #34D399, #059669);
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(16,185,129,0.95), inset 0 0 4px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 900;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: pulse-green 2s infinite ease-in-out;
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
          border-top: 7px solid #059669;
        }
        .end-pointer {
          border-top: 7px solid #DC2626;
        }
        @keyframes pulse-green {
          0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(16,185,129,0.9); }
          50% { transform: scale(1.08); box-shadow: 0 0 22px rgba(16,185,129,1); }
        }
        @keyframes pulse-red {
          0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(239,68,68,0.9); }
          50% { transform: scale(1.08); box-shadow: 0 0 22px rgba(239,68,68,1); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: true,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: true,
          tap: false
        }).setView([20.5937, 78.9629], 13);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          maxNativeZoom: 19,
          attribution: '© OpenStreetMap contributors',
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 6
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

        window.updateMiniMap = function(data) {
          if (!data) return;
          if (map) map.invalidateSize();

          if (data.activePointMode) {
            currentActiveMode = data.activePointMode;
          }
          
          var bounds = [];

          if (startMarker) map.removeLayer(startMarker);
          if (endMarker) map.removeLayer(endMarker);
          if (geofenceCircle) map.removeLayer(geofenceCircle);
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

          // Render existing saved circle safe zones
          if (data.savedPlaces) {
            var currentPlaceIds = {};
            data.savedPlaces.forEach(function(p) {
              if (!p.lat || !p.lng) return;
              currentPlaceIds[p.id] = true;
              var pLatLng = [p.lat, p.lng];
              bounds.push(pLatLng);

              if (savedPlaceMarkers[p.id]) {
                savedPlaceMarkers[p.id].setLatLng(pLatLng);
                savedPlaceMarkers[p.id].setRadius(p.radius);
              } else {
                savedPlaceMarkers[p.id] = L.circle(pLatLng, {
                  radius: p.radius,
                  color: '#D4AF37',
                  fillColor: '#D4AF37',
                  fillOpacity: 0.22,
                  weight: 2
                }).addTo(map).bindPopup("Safe Zone: " + p.name);
              }
            });

            Object.keys(savedPlaceMarkers).forEach(function(id) {
              if (!currentPlaceIds[id]) {
                map.removeLayer(savedPlaceMarkers[id]);
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
              var roleColor = m.role === 'owner' ? '#D4AF37' : (m.role === 'co_leader' ? '#A855F7' : (m.role === 'guardian' ? '#3B82F6' : '#10B981'));

              var avatarHtml = m.avatarUrl 
                ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;' + (hasLoc ? '' : 'filter:grayscale(100%);opacity:0.6;') + '" />' 
                : '<span style="color:' + (hasLoc ? '#FFF' : '#9CA3AF') + ';font-size:11px;font-weight:bold;">' + m.initial + '</span>';

              var labelText = hasLoc 
                ? (isCurrentSelf ? 'You (Tap to Pin)' : m.name.split(' ')[0] + ' (Tap to Pin)')
                : m.name.split(' ')[0] + ' (Location Unavailable)';

              var labelBg = hasLoc ? 'rgba(26,26,26,0.92)' : 'rgba(50,50,50,0.85)';
              var labelHtml = '<div style="position:absolute;bottom:36px;left:50%;transform:translateX(-50%);white-space:nowrap;background:' + labelBg + ';color:' + (hasLoc ? '#FFFFFF' : '#D1D5DB') + ';font-size:9px;font-weight:bold;font-family:sans-serif;padding:3px 7px;border-radius:10px;border:1px solid ' + roleColor + ';box-shadow:0 2px 6px rgba(0,0,0,0.5);pointer-events:none;">' + labelText + '</div>';

              var iconHtml = '<div style="position:relative;width:34px;height:34px;">' + labelHtml + '<div style="width:34px;height:34px;border-radius:50%;overflow:hidden;background:#1A1A1A;border:2px solid ' + roleColor + ';box-shadow:0 0 8px ' + roleColor + '99;display:flex;align-items:center;justify-content:center;' + (hasLoc ? '' : 'opacity:0.75;') + '">' + avatarHtml + '</div></div>';

              var mIcon = L.divIcon({
                className: 'member-pin-icon',
                html: iconHtml,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
              });

              var mMarker = L.marker([lat, lng], { icon: mIcon }).addTo(map);
              if (hasLoc) {
                mMarker.on('click', function() {
                  sendAppMessage({
                    type: 'MEMBER_TAP',
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

          // 1. Authoritative Start Point (A) Marker & Safe Zone Boundary
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
            }).addTo(map).bindPopup("<b>📍 START POINT (A)</b><br/>Lat: " + data.startPoint.latitude.toFixed(5) + "<br/>Lng: " + data.startPoint.longitude.toFixed(5));

            geofenceCircle = L.circle([data.startPoint.latitude, data.startPoint.longitude], {
              radius: data.radius || 150,
              color: '#10B981',
              fillColor: '#10B981',
              fillOpacity: 0.18,
              weight: 2.5
            }).addTo(map);
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
            }).addTo(map).bindPopup("<b>🏁 END POINT (B)</b><br/>Lat: " + data.endPoint.latitude.toFixed(5) + "<br/>Lng: " + data.endPoint.longitude.toFixed(5));

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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editingPlaceId ? 'EDIT GEOFENCE' : 'SAFE PLACES GEOFENCING'}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {editingPlaceId ? (
            <TouchableOpacity 
              style={[
                styles.saveBtn, 
                { 
                  backgroundColor: secondaryBtnStyles.backgroundColor, 
                  borderColor: secondaryBtnStyles.borderColor,
                  borderRadius: secondaryBtnStyles.borderRadius,
                  borderWidth: secondaryBtnStyles.borderWidth,
                }
              ]} 
              onPress={handleCancelEdit} 
              activeOpacity={0.8}
            >
              <Text style={[styles.saveBtnText, { color: secondaryBtnStyles.textColor }]}>CANCEL</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity 
            style={[
              styles.saveBtn, 
              { 
                backgroundColor: primaryBtnStyles.backgroundColor, 
                borderColor: primaryBtnStyles.borderColor,
                borderRadius: primaryBtnStyles.borderRadius,
                borderWidth: primaryBtnStyles.borderWidth,
              }
            ]} 
            onPress={handleSavePlace} 
            disabled={saving} 
            activeOpacity={0.8}
          >
            <Text style={[styles.saveBtnText, { color: primaryBtnStyles.textColor, fontWeight: '800' }]}>{saving ? 'SAVING...' : editingPlaceId ? 'UPDATE' : 'SAVE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={mainScrollViewRef} 
        contentContainerStyle={styles.content}
        scrollEnabled={isScrollEnabled}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.overline, { color: colors.accentGold }]}>{editingPlaceId ? 'MODIFY BOUNDARY' : 'SETUP BOUNDARY'}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{editingPlaceId ? 'Edit Geofence' : 'Define Geofence'}</Text>

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>GEOFENCE NAME</Text>
        <TextInput
          style={[styles.underlineInput, { color: colors.foreground, borderBottomColor: colors.accentGold }]}
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
                    backgroundColor: active ? (themeMode === 'brand_green' ? '#E8F8EE' : colors.surfaceMuted) : colors.surface,
                    borderColor: active ? colors.accentGold : colors.border,
                    borderRadius: 14,
                    borderWidth: 1.5,
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
              >
                {isRouteGated ? (
                  <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.accentGold, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: '#1A1A1A' }}>PLUS</Text>
                  </View>
                ) : null}
                <Ionicons 
                  name={cat.icon as any} 
                  size={20} 
                  color={active ? colors.accentGold : colors.foreground} 
                />
                <Text style={[styles.categoryLabel, { color: active ? colors.accentGold : colors.textMuted }]}>
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
                <View style={{ backgroundColor: '#D4AF37', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: '#1A1A1A' }}>PLUS</Text>
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
        <Text style={styles.inputLabel}>TRACKED MEMBER ASSIGNMENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <TouchableOpacity
            style={[styles.memberChip, targetUserId === null ? styles.activeMemberChip : null]}
            onPress={() => setTargetUserId(null)}
          >
            <Text style={[styles.memberChipText, targetUserId === null ? styles.activeMemberChipText : null]}>
              ALL CIRCLE MEMBERS
            </Text>
          </TouchableOpacity>
          {members.map(m => {
            const isSelected = targetUserId === m.user_id;
            const firstName = String(m.profile?.full_name || 'Member').split(' ')[0];
            return (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.memberChip, isSelected ? styles.activeMemberChip : null]}
                onPress={() => setTargetUserId(m.user_id)}
              >
                <Text style={[styles.memberChipText, isSelected ? styles.activeMemberChipText : null]}>
                  {firstName.toUpperCase()} ONLY
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Quick Member Pin Selector */}
        {memberLocations.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.inputLabel}>PIN GEOFENCE TO MEMBER'S LIVE LOCATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {memberLocations.map(m => {
                const roleColor = m.role === 'owner' ? '#D4AF37' : (m.role === 'co_leader' ? '#A855F7' : (m.role === 'guardian' ? '#3B82F6' : '#10B981'));
                const firstName = m.name.split(' ')[0];
                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: LUXURY_THEME.colors.surface,
                      borderWidth: 1.5,
                      borderColor: roleColor,
                      borderRadius: 12,
                      marginRight: 10,
                    }}
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
                  >
                    <Ionicons name="location-sharp" size={14} color={roleColor} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: LUXURY_THEME.colors.foreground, letterSpacing: 0.5 }}>
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
          <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0, marginRight: 8 }]} numberOfLines={1}>
            GEOFENCE MAP (TAP TO SET PINS)
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.resetMapBtn, { borderColor: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.12)' }]} 
              onPress={() => setIsMapExpanded(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="expand-outline" size={12} color="#38BDF8" />
              <Text style={[styles.resetMapText, { color: '#38BDF8' }]}>EXPAND</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetMapBtn} onPress={handleResetPoints} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={12} color={LUXURY_THEME.colors.accentGold} />
              <Text style={styles.resetMapText}>RESET PINS</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeToggleRow}>
          <TouchableOpacity 
            style={[styles.modeBtn, activePointMode === 'start' ? styles.activeStartModeBtn : null]}
            onPress={() => setActivePointMode('start')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.modeBtnText, activePointMode === 'start' ? { color: '#FFFFFF' } : null]}>
              {startPoint ? 'START: SET' : 'TAP MAP: SET START'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modeBtn, activePointMode === 'end' ? styles.activeEndModeBtn : null]}
            onPress={() => setActivePointMode('end')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.modeBtnText, activePointMode === 'end' ? { color: '#FFFFFF' } : null]}>
              {endPoint ? 'END: SET' : 'TAP MAP: SET END'}
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
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: miniMapHtml }}
              style={styles.miniMap}
              nestedScrollEnabled={false}
              scrollEnabled={false}
              onLoadEnd={() => {
                setTimeout(() => pushMiniMapData(false), 200);
              }}
              onMessage={(event) => {
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
                statusColor = '#10B981';
                badgeBg = 'rgba(16, 185, 129, 0.15)';
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
        <View style={styles.coordReadoutBox}>
          <View style={styles.coordCol}>
            <Text style={styles.coordLabel}>START PIN</Text>
            <Text style={styles.coordVal}>
              {startPoint ? `${startPoint.latitude.toFixed(4)}, ${startPoint.longitude.toFixed(4)}` : 'Tap map to set'}
            </Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordCol}>
            <Text style={styles.coordLabel}>END PIN</Text>
            <Text style={styles.coordVal}>
              {endPoint ? `${endPoint.latitude.toFixed(4)}, ${endPoint.longitude.toFixed(4)}` : 'Optional'}
            </Text>
          </View>
        </View>

        {/* Radius Selector */}
        <View style={styles.radiusHeaderRow}>
          <Text style={styles.inputLabel}>AUTO-COMPUTED GEOFENCE RADIUS</Text>
          <Text style={styles.radiusValText}>{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</Text>
        </View>
        
        <View style={styles.radiusRow}>
          {[100, 200, 500, 1000, 2500, 5000].map((r) => {
            const active = radius === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, active ? styles.activeRadiusChip : null]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.radiusText, active ? styles.activeRadiusText : null]}>
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>



        {/* Saved Geofences Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ACTIVE CIRCLE GEOFENCES ({savedPlaces.length})</Text>
          <View style={[styles.accentLine, { backgroundColor: colors.accentGold }]} />
        </View>

        {loadingPlaces ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <LuxuryRadarLoading
              size={120}
              message="LOADING PLACES..."
              subMessage="Syncing geofences"
            />
          </View>
        ) : savedPlaces.length === 0 ? (
          <View style={[styles.emptyCard, cardStyles]}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NO GEOFENCES CONFIGURED</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>Tap points on the Mini Map above to automatically calculate radius and define geofence boundaries.</Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {savedPlaces.map(p => {
              const assignedIds: string[] = p.assigned_user_ids || (p.target_user_id ? [p.target_user_id] : []);
              const assignedMembers = members.filter(m => assignedIds.includes(m.user_id));

              return (
                <View key={p.id} style={[styles.placeCard, cardStyles]}>
                  <View style={styles.placeLeft}>
                    <View style={[styles.placeIconBox, { backgroundColor: `${colors.accentGold}20`, borderColor: colors.accentGold, borderRadius: 10 }]}>
                      <Ionicons name={p.end_lat ? "navigate" : "bookmark"} size={18} color={colors.accentGold} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.placeName, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
                      <View style={styles.tagRow}>
                        <Text style={[styles.placeRadius, { color: colors.accentGold }]}>RADIUS: {p.radius_m || 150}M</Text>
                        <Text style={[styles.tagDot, { color: colors.textMuted }]}>•</Text>
                        <Text style={[styles.targetTag, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                          {assignedMembers.length > 0
                            ? `APPLIES TO: ${assignedMembers.map(m => String(m.profile?.full_name || 'Member').split(' ')[0]).join(', ').toUpperCase()}`
                            : 'APPLIES TO: ALL MEMBERS'}
                        </Text>
                      </View>

                      {assignedMembers.length > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          {assignedMembers.map((m, idx) => {
                            const initial = String(m.profile?.full_name || 'M').charAt(0).toUpperCase();
                            return (
                              <View key={m.user_id || idx} style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: colors.surfaceMuted,
                                borderWidth: 1,
                                borderColor: colors.accentGold,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}>
                                {m.profile?.avatar_url ? (
                                  <Image source={{ uri: m.profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.foreground }}>{initial}</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity 
                      style={[styles.editBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8 }]}
                      onPress={() => handleStartEditPlace(p)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create" size={16} color={colors.accentGold} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.deleteBtn, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderRadius: 8 }]}
                      onPress={() => handleDeletePlace(p.id, p.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        gatedFeatureName={gatedFeatureName}
      />

      <Modal 
        visible={isMapExpanded} 
        animationType="slide" 
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
            paddingTop: Platform.OS === 'ios' ? 56 : (Platform.OS === 'android' ? 44 : 20),
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
                style={[styles.resetMapBtn, { borderColor: colors.border, paddingHorizontal: 10 }]} 
                onPress={handleResetPoints} 
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={13} color={colors.accentGold} />
                <Text style={styles.resetMapText}>RESET</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3
                }}
                onPress={() => {
                  setIsMapExpanded(false);
                  setTimeout(() => pushMiniMapData(true), 150);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={15} color={themeMode === 'brand_green' ? '#FFFFFF' : '#1A1A1A'} />
                <Text style={{ color: themeMode === 'brand_green' ? '#FFFFFF' : '#1A1A1A', fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Toggle Row in Full Map */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: isDark ? 'rgba(21, 23, 30, 0.95)' : 'rgba(245, 245, 245, 0.95)', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity 
                style={[styles.modeBtn, activePointMode === 'start' ? styles.activeStartModeBtn : null]}
                onPress={() => setActivePointMode('start')}
              >
                <View style={[styles.pinDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.modeBtnText, activePointMode === 'start' ? { color: '#FFFFFF' } : null]}>
                  {startPoint ? 'START: SET' : 'TAP MAP: SET START'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modeBtn, activePointMode === 'end' ? styles.activeEndModeBtn : null]}
                onPress={() => setActivePointMode('end')}
              >
                <View style={[styles.pinDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.modeBtnText, activePointMode === 'end' ? { color: '#FFFFFF' } : null]}>
                  {endPoint ? 'END: SET' : 'TAP MAP: SET END'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 9.5, color: colors.textMuted, textAlign: 'center', marginTop: 6 }}>
              Tap any location on the map to place boundary pins • Drag to pan • Pinch to zoom
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
              <WebView
                ref={expandedWebViewRef}
                originWhitelist={['*']}
                source={{ html: miniMapHtml }}
                style={{ flex: 1 }}
                onLoadEnd={() => {
                  setTimeout(() => pushMiniMapData(true), 150);
                  setTimeout(() => pushMiniMapData(true), 500);
                }}
                onMessage={(event) => {
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
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 }}>START POINT (A)</Text>
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
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {userLoc ? (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      borderWidth: 1,
                      borderColor: '#38BDF8',
                    }}
                    onPress={() => centerMapOn(userLoc.latitude, userLoc.longitude, 16)}
                  >
                    <Ionicons name="locate-outline" size={13} color="#38BDF8" />
                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#38BDF8' }}>MY LOC</Text>
                  </TouchableOpacity>
                ) : null}

                {startPoint ? (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      borderWidth: 1,
                      borderColor: '#10B981',
                    }}
                    onPress={() => centerMapOn(startPoint.latitude, startPoint.longitude, 16)}
                  >
                    <Ionicons name="flag-outline" size={13} color="#10B981" />
                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#10B981' }}>GO TO START</Text>
                  </TouchableOpacity>
                ) : null}

                {endPoint ? (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderWidth: 1,
                      borderColor: '#EF4444',
                    }}
                    onPress={() => centerMapOn(endPoint.latitude, endPoint.longitude, 16)}
                  >
                    <Ionicons name="navigate-outline" size={13} color="#EF4444" />
                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#EF4444' }}>GO TO END</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleResetPoints}
                >
                  <Ionicons name="trash-outline" size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.border,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  content: {
    padding: 24,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.foreground,
    paddingVertical: 12,
    fontSize: 15,
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  categoryTile: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
  },
  activeCategoryTile: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  categoryLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  activeCategoryLabel: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: '800',
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    marginRight: 8,
    borderRadius: 8,
  },
  activeMemberChip: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  memberChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  activeMemberChipText: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: '800',
  },
  miniMapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  resetMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 8,
  },
  resetMapText: {
    fontSize: 10,
    fontWeight: '800',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 1,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 8,
  },
  activeStartModeBtn: {
    backgroundColor: '#047857',
    borderColor: '#10B981',
  },
  activeEndModeBtn: {
    backgroundColor: '#B91C1C',
    borderColor: '#EF4444',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  miniMapContainer: {
    height: 220,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  miniMap: {
    flex: 1,
  },
  coordReadoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 12,
    marginBottom: 24,
  },
  coordCol: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  coordVal: {
    fontSize: 11,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
  },
  coordDivider: {
    width: 1,
    height: 24,
    backgroundColor: LUXURY_THEME.colors.border,
    marginHorizontal: 12,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusValText: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeRadiusChip: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  radiusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  activeRadiusText: {
    color: '#0D0E12',
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  accentLine: {
    flex: 1,
    height: 1,
    backgroundColor: LUXURY_THEME.colors.border,
  },
  emptyCard: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  placesList: {
    gap: 12,
  },
  placeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 16,
  },
  placeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  placeIconBox: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  placeRadius: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  tagDot: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  targetTag: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 0.8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
