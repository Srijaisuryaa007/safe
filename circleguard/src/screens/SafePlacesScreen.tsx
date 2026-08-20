import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { LUXURY_THEME } from '../constants/theme';
import { getHaversineDistanceInMeters, fetchCirclePlacesWithMembers } from '../services/GeofenceEngine';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import PaywallModal from '../components/PaywallModal';

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
  const { activeCircle, members, fetchMembers, deletePlace } = useCircleStore();
  const { profile } = useAuthStore();
  const { showAlert } = useLuxuryAlert();
  const { canCreatePlace, canUseRouteCategory, canUseAdaptiveBuffer, canUseSchedule } = useSubscriptionStore();

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
  const [startPoint, setStartPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePointMode, setActivePointMode] = useState<'start' | 'end'>('start');
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRouteGeofence, setIsRouteGeofence] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const mainScrollViewRef = useRef<ScrollView | null>(null);
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

        // Fallback positioning for mini map
        if (!lat || !lng || lat === 0 || lng === 0) {
          const baseLat = userLoc?.latitude || 20.5937;
          const baseLng = userLoc?.longitude || 78.9629;
          const angle = (idx * (360 / Math.max(1, memberRows.length))) * (Math.PI / 180);
          lat = baseLat + 0.0015 * Math.cos(angle);
          lng = baseLng + 0.0015 * Math.sin(angle);
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
    if (!webViewRef.current) return;
    const centerLat = startPoint?.latitude || userLoc?.latitude || 20.5937;
    const centerLng = startPoint?.longitude || userLoc?.longitude || 78.9629;

    const data = {
      center: [centerLat, centerLng],
      startPoint,
      endPoint,
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
          }, 300);
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  useEffect(() => {
    pushMiniMapData();
  }, [startPoint, endPoint, radius, memberLocations, savedPlaces]);

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
    Alert.alert(
      'Delete Geofence',
      `Are you sure you want to remove "${name}" from your circle geofences?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setSavedPlaces(prev => prev.filter(p => p.id !== placeId));

              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`
                  if (window.deletePlaceLayer) {
                    window.deletePlaceLayer('${placeId}');
                  }
                  true;
                `);
              }

              await deletePlace(placeId);

              Alert.alert('Geofence Removed', `"${name}" has been deleted.`);
            } catch (err: any) {
              if (activeCircle) fetchSavedPlaces(activeCircle.id);
              Alert.alert('Error Deleting Geofence', err.message || 'Permission denied or network error.');
            }
          } 
        }
      ]
    );
  };

  const miniMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #1C2321; }
        .start-pin { background: #10B981; border: 2.5px solid #FFFFFF; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 14px rgba(16,185,129,0.95); }
        .end-pin { background: #EF4444; border: 2.5px solid #FFFFFF; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 14px rgba(239,68,68,0.95); }
        .member-pin-icon, .leaflet-div-icon { background: transparent !important; border: none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          maxNativeZoom: 19,
          subdomains: 'abcd',
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 6
        }).addTo(map);

        var startMarker = null;
        var endMarker = null;
        var geofenceCircle = null;
        var routePolyline = null;
        var memberMarkers = {};
        var userInteracted = false;
        var initialBoundsSet = false;

        map.on('dragstart zoomstart touchstart', function() {
          userInteracted = true;
        });

        function sendAppMessage(msg) {
          var str = typeof msg === 'string' ? msg : JSON.stringify(msg);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(str);
          } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(str, '*');
          }
        }

        map.on('click', function(e) {
          sendAppMessage({
            type: 'MAP_TAP',
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
        });

          var memberMarkers = {};
          var savedPlaceMarkers = {};

          window.deletePlaceLayer = function(id) {
            if (savedPlaceMarkers[id]) {
              map.removeLayer(savedPlaceMarkers[id]);
              delete savedPlaceMarkers[id];
            }
          };

          window.updateMiniMap = function(data) {
            if (!data) return;
            
            var bounds = [];

            if (startMarker) map.removeLayer(startMarker);
            if (endMarker) map.removeLayer(endMarker);
            if (geofenceCircle) map.removeLayer(geofenceCircle);
            if (routePolyline) map.removeLayer(routePolyline);

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

              // Instantly remove deleted safe zones from the mini map
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
                var hasLoc = m.latitude && m.longitude && m.latitude !== 0 && m.longitude !== 0;
                var lat = hasLoc ? m.latitude : (data.center ? data.center[0] : 20.5937);
                var lng = hasLoc ? m.longitude : (data.center ? data.center[1] : 78.9629);

                if (hasLoc) bounds.push([lat, lng]);

                var isCurrentSelf = m.isSelf;
                var roleColor = hasLoc 
                  ? (m.role === 'owner' ? '#D4AF37' : (m.role === 'co_leader' ? '#A855F7' : (m.role === 'guardian' ? '#3B82F6' : '#10B981')))
                  : '#6B7280';

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

            if (data.startPoint) {
              bounds.push([data.startPoint.latitude, data.startPoint.longitude]);
            }

            // Only adjust map center/zoom on initial load or explicit reset command
            if (data.resetZoom || !initialBoundsSet) {
              initialBoundsSet = true;
              userInteracted = false;
              if (bounds.length > 1) {
                try {
                  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
                } catch(e) {
                  if (data.center) map.setView(data.center, 14);
                }
              } else if (data.center) {
                map.setView(data.center, 14);
              }
            }

            if (data.startPoint) {
              startMarker = L.marker([data.startPoint.latitude, data.startPoint.longitude], {
                icon: L.divIcon({ className: 'custom-icon', html: '<div class="start-pin"></div>', iconSize: [18, 18] })
              }).addTo(map).bindPopup("Start Point");

              // Single Primary Safe Zone Boundary (Gold)
              geofenceCircle = L.circle([data.startPoint.latitude, data.startPoint.longitude], {
                radius: data.radius || 150,
                color: '#D4AF37',
                fillColor: '#D4AF37',
                fillOpacity: 0.25,
                weight: 2
              }).addTo(map);
            }

            if (data.endPoint) {
              endMarker = L.marker([data.endPoint.latitude, data.endPoint.longitude], {
                icon: L.divIcon({ className: 'custom-icon', html: '<div class="end-pin"></div>', iconSize: [18, 18] })
              }).addTo(map).bindPopup("End Point");

              if (data.startPoint) {
                routePolyline = L.polyline([
                  [data.startPoint.latitude, data.startPoint.longitude],
                  [data.endPoint.latitude, data.endPoint.longitude]
                ], { color: '#60A5FA', weight: 3, dashArray: '6, 6' }).addTo(map);
              }
            }
          };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>{editingPlaceId ? 'EDIT GEOFENCE' : 'SAFE PLACES GEOFENCING'}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {editingPlaceId ? (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }]} onPress={handleCancelEdit} activeOpacity={0.8}>
              <Text style={[styles.saveBtnText, { color: '#D1D5DB' }]}>CANCEL</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#D4AF37' }]} onPress={handleSavePlace} disabled={saving} activeOpacity={0.8}>
            <Text style={[styles.saveBtnText, { color: '#0D0E12', fontWeight: '800' }]}>{saving ? 'SAVING...' : editingPlaceId ? 'UPDATE' : 'SAVE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={mainScrollViewRef} contentContainerStyle={styles.content}>
        <Text style={styles.overline}>{editingPlaceId ? 'MODIFY BOUNDARY' : 'SETUP BOUNDARY'}</Text>
        <Text style={styles.title}>{editingPlaceId ? 'Edit Geofence' : 'Define Geofence'}</Text>

        <Text style={styles.inputLabel}>GEOFENCE NAME</Text>
        <TextInput
          style={styles.underlineInput}
          placeholder="e.g. Home Safe Zone, School Perimeter, Commute Corridor"
          value={placeName}
          onChangeText={setPlaceName}
          placeholderTextColor={LUXURY_THEME.colors.textMuted}
        />

        <Text style={styles.inputLabel}>CATEGORY & TYPE</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            const isRouteGated = cat.id === 'route' && !canUseRouteCategory();

            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryTile, active ? styles.activeCategoryTile : null, isRouteGated ? { opacity: 0.8 } : null]}
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
                  <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#D4AF37', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: '#1A1A1A' }}>PLUS</Text>
                  </View>
                ) : null}
                <Ionicons 
                  name={cat.icon as any} 
                  size={20} 
                  color={active ? LUXURY_THEME.colors.accentGold : LUXURY_THEME.colors.foreground} 
                />
                <Text style={[styles.categoryLabel, active ? styles.activeCategoryLabel : null]}>
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
          <TouchableOpacity style={styles.resetMapBtn} onPress={handleResetPoints}>
            <Ionicons name="refresh-outline" size={12} color={LUXURY_THEME.colors.accentGold} />
            <Text style={styles.resetMapText}>RESET PINS</Text>
          </TouchableOpacity>
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

        <View style={styles.miniMapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: miniMapHtml }}
            style={styles.miniMap}
            onLoadEnd={() => pushMiniMapData(false)}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data);
                if (msg.type === 'MAP_TAP') {
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
          <Text style={styles.sectionTitle}>ACTIVE CIRCLE GEOFENCES ({savedPlaces.length})</Text>
          <View style={styles.accentLine} />
        </View>

        {loadingPlaces ? (
          <ActivityIndicator size="small" color={LUXURY_THEME.colors.foreground} style={{ marginVertical: 20 }} />
        ) : savedPlaces.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={32} color={LUXURY_THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>NO GEOFENCES CONFIGURED</Text>
            <Text style={styles.emptySub}>Tap points on the Mini Map above to automatically calculate radius and define geofence boundaries.</Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {savedPlaces.map(p => {
              const assignedIds: string[] = p.assigned_user_ids || (p.target_user_id ? [p.target_user_id] : []);
              const assignedMembers = members.filter(m => assignedIds.includes(m.user_id));

              return (
                <View key={p.id} style={styles.placeCard}>
                  <View style={styles.placeLeft}>
                    <View style={styles.placeIconBox}>
                      <Ionicons name={p.end_lat ? "navigate" : "bookmark"} size={18} color="#D4AF37" />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.placeName} numberOfLines={1}>{p.name}</Text>
                      <View style={styles.tagRow}>
                        <Text style={styles.placeRadius}>RADIUS: {p.radius_m || 150}M</Text>
                        <Text style={styles.tagDot}>•</Text>
                        <Text style={styles.targetTag} numberOfLines={1} ellipsizeMode="tail">
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
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderWidth: 1,
                                borderColor: '#D4AF37',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}>
                                {m.profile?.avatar_url ? (
                                  <Image source={{ uri: m.profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>{initial}</Text>
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
                      style={styles.editBtn}
                      onPress={() => handleStartEditPlace(p)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create" size={16} color="#D4AF37" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.deleteBtn}
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
