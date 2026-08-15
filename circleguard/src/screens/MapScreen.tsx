import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import AlertModal from '../components/AlertModal';
import AddPlaceModal from '../components/AddPlaceModal';
import SearchFilterModal from '../components/SearchFilterModal';
import { LUXURY_THEME } from '../constants/theme';
import { evaluateGeofenceBreaches } from '../services/GeofenceEngine';
import { fetchCategoryPois, generateFallbackPois } from '../services/PoiService';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
  } catch (e) {
    console.error('EWKB parse error:', e);
  }
  return null;
}

function parseLocationPoint(item: any): { latitude: number; longitude: number } {
  let lat = parseFloat(item.latitude || item.lat || 0);
  let lng = parseFloat(item.longitude || item.lng || 0);

  if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && item.geom) {
    if (typeof item.geom === 'string') {
      const clean = item.geom.trim();
      if (clean.startsWith('01') || clean.startsWith('00')) {
        const parsed = parseEWKBPoint(clean);
        if (parsed) {
          return parsed;
        }
      }
      const matches = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (matches && matches.length >= 3) {
        lng = parseFloat(matches[1]);
        lat = parseFloat(matches[2]);
      }
    } else if (typeof item.geom === 'object') {
      if (Array.isArray(item.geom.coordinates)) {
        lng = parseFloat(item.geom.coordinates[0]);
        lat = parseFloat(item.geom.coordinates[1]);
      } else if (item.geom.latitude && item.geom.longitude) {
        lat = parseFloat(item.geom.latitude);
        lng = parseFloat(item.geom.longitude);
      }
    }
  }

  return {
    latitude: isNaN(lat) ? 0 : lat,
    longitude: isNaN(lng) ? 0 : lng
  };
}

import { useThemeStore } from '../store/useThemeStore';

export default function MapScreen() {
  const { colors, isDark } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, members, circleFetched, fetchActiveCircle, fetchMembers, isLoading: circleLoading } = useCircleStore();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [mapStyleSetting, setMapStyleSetting] = useState<'vector' | 'satellite'>('vector');

  useEffect(() => {
    const loadAppSettings = async () => {
      const u = await AsyncStorage.getItem('@circleguard_distance_unit');
      const m = await AsyncStorage.getItem('@circleguard_map_style');
      if (u) setDistanceUnit(u as 'km' | 'mi');
      if (m) setMapStyleSetting(m as 'vector' | 'satellite');
    };
    loadAppSettings();
  }, []);

  const handleDeleteSelectedPlace = async () => {
    if (!selectedPlace) return;
    const placeToDelete = selectedPlace;
    Alert.alert(
      'Delete Bookmark',
      `Remove "${placeToDelete.name}" from your circle geofences?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSelectedPlace(null);
              setPlaces(prev => prev.filter(p => p.id !== placeToDelete.id));

              const { error } = await supabase.from('places').delete().eq('id', placeToDelete.id);
              if (error) {
                fetchPlaces();
                throw error;
              }
              Alert.alert('Bookmark Removed', `"${placeToDelete.name}" has been deleted.`);
            } catch (e: any) {
              Alert.alert('Error Deleting Bookmark', e.message || 'Failed to delete bookmark');
            }
          }
        }
      ]
    );
  };

  // POI Categories & Nearby Places State
  const [selectedPoiCategory, setSelectedPoiCategory] = useState<string | null>(null);
  const [poiList, setPoiList] = useState<any[]>([]);
  const [loadingPois, setLoadingPois] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<any>(null);

  const poiCategories = [
    { id: 'hospital', label: 'HOSPITALS', icon: 'medical', color: '#EF4444' },
    { id: 'school', label: 'SCHOOLS', icon: 'school', color: '#3B82F6' },
    { id: 'police', label: 'POLICE STATIONS', icon: 'shield-checkmark', color: '#D4AF37' },
    { id: 'restaurant', label: 'DINING & CAFES', icon: 'restaurant', color: '#F59E0B' },
    { id: 'fuel', label: 'FUEL STATIONS', icon: 'car', color: '#10B981' },
    { id: 'member', label: 'MEMBERS', icon: 'person', color: '#A855F7' },
    { id: 'place', label: 'SAVED PLACES', icon: 'bookmark', color: '#EC4899' },
  ];

  const fetchNearbyPois = async (category: string) => {
    if (selectedPoiCategory === category) {
      setSelectedPoiCategory(null);
      setPoiList([]);
      handleSearchChange('');
      return;
    }

    setSelectedPoiCategory(category);
    setLoadingPois(true);
    setSelectedPoi(null);

    if (category === 'member') {
      handleSearchChange('member');
      setLoadingPois(false);
      return;
    }

    if (category === 'place') {
      handleSearchChange('place');
      setLoadingPois(false);
      return;
    }

    const lat = userLoc?.latitude || 20.5937;
    const lng = userLoc?.longitude || 78.9629;
    const isMiles = distanceUnit === 'mi';

    try {
      const results = await fetchCategoryPois(category, lat, lng, isMiles);
      setPoiList(results);
      handleSearchChange(category);
    } catch (e) {
      console.warn('POI fetch error:', e);
      const fallbacks = generateFallbackPois(category, lat, lng, isMiles);
      setPoiList(fallbacks);
    } finally {
      setLoadingPois(false);
    }
  };

  const fetchAllNearbyPois = async (lat: number, lng: number, targetCategories?: string[]) => {
    setLoadingPois(true);
    try {
      const categories = targetCategories && targetCategories.length > 0 
        ? targetCategories 
        : ['hospital', 'school', 'police', 'restaurant', 'fuel'];

      const isMiles = distanceUnit === 'mi';
      const requests = categories.map(cat =>
        fetchCategoryPois(cat, lat, lng, isMiles).catch(() => generateFallbackPois(cat, lat, lng, isMiles))
      );

      const results = await Promise.all(requests);
      const combined = results.flat();
      setPoiList(combined);
    } catch (e) {
      console.warn('Auto POI fetch error:', e);
    } finally {
      setLoadingPois(false);
    }
  };

  // Map is clean & plain by default showing only User & Circle Members





  const handleZoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.zoomIn(); } true;`);
    }
  };

  const handleZoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.zoomOut(); } true;`);
    }
  };

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Search Engine State
  const [searchResults, setSearchResults] = useState<{
    members: any[];
    places: any[];
    pois: any[];
    locations: any[];
  }>({ members: [], places: [], pois: [], locations: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.length < 2) {
      setSearchResults({ members: [], places: [], pois: [], locations: [] });
      setIsSearching(false);
      return;
    }

    const queryLower = text.toLowerCase();

    // 1. Filter local circle members
    const matchedMembers = members.filter(m => 
      queryLower === 'member' || m.profile?.full_name?.toLowerCase().includes(queryLower)
    );

    // 2. Filter bookmarked safe places
    const matchedPlaces = places.filter(p => 
      queryLower === 'place' || p.name?.toLowerCase().includes(queryLower)
    );

    // 3. Filter nearby POIs (Hospitals, Schools, Police, Dining, Fuel)
    const matchedPois = poiList.filter(p => 
      p.name?.toLowerCase().includes(queryLower) ||
      p.category?.toLowerCase().includes(queryLower) ||
      (queryLower.includes('hosp') && p.category === 'hospital') ||
      (queryLower.includes('school') && p.category === 'school') ||
      (queryLower.includes('police') && p.category === 'police') ||
      ((queryLower.includes('rest') || queryLower.includes('food') || queryLower.includes('cafe')) && p.category === 'restaurant') ||
      ((queryLower.includes('fuel') || queryLower.includes('gas') || queryLower.includes('petrol')) && p.category === 'fuel')
    );

    setSearchResults(prev => ({ 
      ...prev, 
      members: matchedMembers, 
      places: matchedPlaces,
      pois: matchedPois 
    }));

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const lat = userLoc?.latitude || 20.5937;
        const lng = userLoc?.longitude || 78.9629;
        const delta = 0.18;
        const viewbox = `${(lng - delta).toFixed(4)},${(lat + delta).toFixed(4)},${(lng + delta).toFixed(4)},${(lat - delta).toFixed(4)}`;

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&viewbox=${viewbox}&bounded=1&limit=8&addressdetails=1`,
          {
            headers: { 'User-Agent': 'CircleGuardApp/1.0' }
          }
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(prev => ({
            ...prev,
            locations: data.map(item => ({
              id: item.place_id,
              name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              type: item.type || item.class || 'location'
            }))
          }));
        }
      } catch (err) {
        console.warn('Geocoding search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectSearchResult = (item: any, category: 'member' | 'place' | 'poi' | 'location') => {
    setSearchQuery('');
    setSearchResults({ members: [], places: [], pois: [], locations: [] });

    if (category === 'member') {
      setSelectedPlace(null);
      setSelectedPoi(null);
      setSelectedMember(item);
      const loc = locations.find(l => l.user_id === item.user_id);
      if (loc && webViewRef.current) {
        const js = `if (map) { map.setView([${loc.latitude}, ${loc.longitude}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'place') {
      setSelectedMember(null);
      setSelectedPoi(null);
      setSelectedPlace(item);
      if (webViewRef.current) {
        const js = `if (map) { map.setView([${item.latitude}, ${item.longitude}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'poi') {
      setSelectedMember(null);
      setSelectedPlace(null);
      setSelectedPoi(item);
      if (webViewRef.current) {
        const js = `if (map) { map.setView([${item.lat}, ${item.lng}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'location') {
      setSelectedMember(null);
      setSelectedPlace(null);
      setSelectedPoi(null);
      if (webViewRef.current) {
        const js = `if (map) { map.setView([${item.lat}, ${item.lng}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    }
  };

  // Refresh State
  const [isRefreshingMap, setIsRefreshingMap] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshingMap(true);
    try {
      if (profile?.id) {
        await fetchActiveCircle(profile.id);
      }
      if (activeCircle?.id) {
        await Promise.all([
          fetchMembers(activeCircle.id),
          fetchPlaces(),
          fetchLocations(),
        ]);
      }
      pushMapData();
      Alert.alert('Sync Complete', 'Refreshed latest member locations, online statuses, and geofences!');
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setIsRefreshingMap(false);
    }
  };

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'sos' | 'place'>('sos');
  
  // Add Place Modal State
  const [addPlaceVisible, setAddPlaceVisible] = useState(false);
  const [addPlaceCoord, setAddPlaceCoord] = useState<{latitude: number, longitude: number} | null>(null);

  // Search Filter Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterCategories, setActiveFilterCategories] = useState<string[]>([]);
  
  const webViewRef = useRef<WebView | null>(null);
  const alertedProximity = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!locations || locations.length === 0 || !places || places.length === 0) return;

    (async () => {
      for (const loc of locations) {
        const member = members.find(m => m.user_id === loc.user_id);
        const name = member?.profile?.full_name || (loc.user_id === profile?.id ? 'You' : 'A circle member');

        const breaches = await evaluateGeofenceBreaches(
          {
            user_id: loc.user_id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy_m: loc.accuracy_m
          },
          name,
          places
        );

        if (breaches.length > 0) {
          const firstBreach = breaches[0];
          if (firstBreach.type === 'exit') {
            setModalTitle('GEOFENCE EXIT BREACH ALERT');
            setModalMessage(`⚠️ ${firstBreach.userName} exited geofence boundary "${firstBreach.placeName}" (${firstBreach.formattedDistance} from center)!`);
            setModalType('sos');
            setModalVisible(true);
          } else if (firstBreach.type === 'entry') {
            setModalTitle('GEOFENCE RE-ENTRY ALERT');
            setModalMessage(`📍 ${firstBreach.userName} re-entered geofence boundary "${firstBreach.placeName}" (${firstBreach.formattedDistance} from center)!`);
            setModalType('place');
            setModalVisible(true);
          }
        }
      }
    })();
  }, [locations, places, members, profile]);

  useEffect(() => {
    if (profile?.id && !activeCircle && !circleFetched) {
      fetchActiveCircle(profile.id);
    }
  }, [profile?.id, activeCircle, circleFetched]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use map tracking.');
        return;
      }

      try {
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (currentLoc?.coords) {
          setUserLoc({ latitude: currentLoc.coords.latitude, longitude: currentLoc.coords.longitude });
        }
      } catch (e) {
        console.warn("Initial location fetch error:", e);
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Fast 3-second live sync cycle
          distanceInterval: 0,
        },
        async (loc) => {
          if (!profile) return;
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          
          try {
            let battPct = 100;
            try {
              const battLevel = await Battery.getBatteryLevelAsync();
              if (battLevel >= 0) battPct = Math.round(battLevel * 100);
            } catch (e) {}

            const speed = loc.coords.speed || 0;
            const isDriving = speed > 5.5;

            let finalLat = loc.coords.latitude;
            let finalLng = loc.coords.longitude;

            if (profile.is_ghost_mode) {
              // Fuzz position by ~500m for Ghost Privacy Mode
              finalLat += (Math.random() - 0.5) * 0.009;
              finalLng += (Math.random() - 0.5) * 0.009;
            }

            const point = `POINT(${finalLng} ${finalLat})`;
            await supabase.from('locations').upsert({
              user_id: profile.id,
              geom: point,
              accuracy_m: loc.coords.accuracy,
              speed_mps: speed,
              battery_pct: battPct,
              is_driving: isDriving,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          } catch (err) {
            console.error('Error updating location:', err);
          }
        }
      );
    })();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [profile]);

  useEffect(() => {
    if (!activeCircle) return;
    
    // Fetch members, places, and locations in parallel for sub-second instant load
    Promise.all([
      fetchMembers(activeCircle.id),
      fetchPlaces(),
      fetchLocations()
    ]);
    
    const channel = supabase
      .channel('public:locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => fetchLocations()
      )
      .subscribe();

    const membersChannel = supabase
      .channel('public:circle_members')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_members', filter: `circle_id=eq.${activeCircle.id}` },
        () => fetchMembers(activeCircle.id)
      )
      .subscribe();
      
    const placesChannel = supabase
      .channel('public:places')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `circle_id=eq.${activeCircle.id}` },
        () => fetchPlaces()
      )
      .subscribe();
      
    const fallbackInterval = setInterval(() => {
      fetchLocations();
    }, 3000); // 3-second rapid polling
      
    const sosChannel = supabase
      .channel('public:sos_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts', filter: `circle_id=eq.${activeCircle.id}` },
        (payload) => {
          if (payload.new.user_id === profile?.id) return;
          if (payload.new.status !== 'active') return;
          
          const sender = members.find(m => m.user_id === payload.new.user_id);
          const name = sender?.profile?.full_name || 'A circle member';
          
          setModalTitle('SOS ALERT');
          setModalMessage(`${name} triggered an emergency SOS alert!`);
          setModalType('sos');
          setModalVisible(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(placesChannel);
      supabase.removeChannel(sosChannel);
      clearInterval(fallbackInterval);
    };
  }, [activeCircle]);

  const fetchLocations = async () => {
    try {
      let query = supabase.from('locations').select('*');
      if (activeCircle?.id) {
        const { data: memberRows } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', activeCircle.id);

        const memberUserIds = (memberRows || []).map(m => m.user_id);
        if (memberUserIds.length > 0) {
          query = query.in('user_id', memberUserIds);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching locations:', error);
        return;
      }

      if (data) {
        const formatted = data.map(item => {
          const pt = parseLocationPoint(item);
          return {
            ...item,
            latitude: pt.latitude,
            longitude: pt.longitude
          };
        }).filter(item => item.latitude !== 0 && item.longitude !== 0);

        setLocations(formatted);
      }
    } catch (e) {
      console.error('Error parsing locations:', e);
    }
  };

  const fetchPlaces = async () => {
    if (!activeCircle) return;
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', activeCircle.id);

      if (error) throw error;
      
      if (data) {
        const formatted = data.map(item => {
          const pt = parseLocationPoint(item);
          return {
            ...item,
            latitude: pt.latitude,
            longitude: pt.longitude
          };
        }).filter(item => item.latitude !== 0 && item.longitude !== 0);
        
        setPlaces(formatted);
      }
    } catch (e) {
      console.error('Error fetching places:', e);
    }
  };

  const savePlace = async (name: string, radius: number) => {
    if (!activeCircle || !profile || !addPlaceCoord) return;
    try {
      const point = `POINT(${addPlaceCoord.longitude} ${addPlaceCoord.latitude})`;
      const { error } = await supabase.from('places').insert({
        circle_id: activeCircle.id,
        name: name,
        radius_m: radius,
        geom: point,
        created_by: profile.id
      });
      if (error) throw error;
      Alert.alert("Success", `Safe place "${name}" created!`);
      setAddPlaceVisible(false);
      fetchPlaces();
    } catch(e: any) {
      Alert.alert("Error", e.message || "Failed to create place");
    }
  };

  const pushMapData = () => {
    if (!webViewRef.current) return;
    const centerLat = userLoc?.latitude || 20.5937;
    const centerLng = userLoc?.longitude || 78.9629;

    const mapData = {
      isDark: isDark,
      center: [centerLat, centerLng],
      userLocation: userLoc,
      members: members
        .filter(m => m.user_id === profile?.id || !m.profile?.is_ghost_mode)
        .map(m => {
          const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
          const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
          
          let lat = loc?.latitude;
          let lng = loc?.longitude;

          if (!lat || !lng) {
            if (isSelf && userLoc) {
              lat = userLoc.latitude;
              lng = userLoc.longitude;
            }
          }

          if (!lat || !lng) return null;

          const isHideOnline = !!m.profile?.hide_online_presence;
          const isGhost = !!m.profile?.is_ghost_mode;

          const isMiles = distanceUnit === 'mi';
          const speedMps = loc?.speed_mps || 0;
          const speedFormatted = isMiles ? Math.round(speedMps * 2.23694) : Math.round(speedMps * 3.6);
          const unitText = isMiles ? 'mph' : 'km/h';

          let activityText = '🛋️ Stationary';
          if (loc?.activity_state) {
            activityText = loc.activity_state;
          } else if (speedMps > 4.5) {
            activityText = `🚗 Traveling • ${speedFormatted} ${unitText}`;
          } else if (speedMps >= 0.8) {
            activityText = `🚶 Walking • ${speedFormatted} ${unitText}`;
          } else {
            activityText = '🛋️ Stationary / Idle';
          }

          return {
            id: m.user_id,
            lat,
            lng,
            name: isSelf ? 'You' : (m.profile?.full_name || 'Member'),
            initial: String(m.profile?.full_name || 'M').charAt(0).toUpperCase(),
            avatarUrl: m.profile?.avatar_url || null,
            isOnline: (isGhost || isHideOnline) ? false : (m.isOnline ?? false),
            lastSeenText: isGhost ? 'Ghost Mode' : (isHideOnline ? 'Offline' : (m.lastSeenText || 'Offline')),
            batteryPct: loc?.battery_pct || m.batteryPct || 100,
            activityText,
          };
        })
        .filter(Boolean),
      places: places.map(p => ({
        id: p.id,
        lat: p.start_lat || p.latitude,
        lng: p.start_lng || p.longitude,
        endLat: p.end_lat || null,
        endLng: p.end_lng || null,
        name: p.name,
        radius: p.radius_m || 150
      })),
      pois: poiList.map(p => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        category: p.category
      }))
    };

    const jsCode = `if (window.updateMapData) { window.updateMapData(${JSON.stringify(mapData)}); } true;`;
    webViewRef.current.injectJavaScript(jsCode);
  };

  useEffect(() => {
    pushMapData();
  }, [userLoc, locations, places, members, poiList, isDark]);

  // Leaflet map with CartoDB Positron luxury light monochrome tiles
  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #F9F8F6; }
        .member-avatar-online {
          background: #1A1A1A; color: #10B981; border-radius: 0px;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-family: sans-serif; border: 2px solid #10B981;
          box-shadow: 0 4px 12px rgba(16,185,129,0.35);
        }
        .member-avatar-offline {
          background: #374151; color: #D1D5DB; border-radius: 0px;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-family: sans-serif; border: 2px solid #9CA3AF;
          opacity: 0.75;
        }
        .poi-logo-pin {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .poi-logo-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          border: 1.5px solid #FFFFFF;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          transition: transform 0.15s ease;
        }
        .poi-logo-circle:active {
          transform: scale(1.3);
        }
        .poi-logo-arrow {
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          margin-top: -1px;
        }
        .poi-logo-label {
          background: rgba(13, 14, 18, 0.95);
          color: #FFFFFF;
          font-size: 8px;
          font-weight: bold;
          font-family: sans-serif;
          padding: 1px 4px;
          border-radius: 3px;
          margin-top: 1px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.15);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 14);
        var userMarker = null;
        var memberMarkers = {};
        var placeCircles = {};
        var poiMarkers = {};
        var initialCentered = false;

        var tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: 'CartoDB'
        }).addTo(map);

        window.updateMapData = function(data) {
          if (!data) return;

          if (data.isDark) {
            document.body.style.background = '#0D0E12';
            tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
          } else {
            document.body.style.background = '#F9F8F6';
            tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
          }

          if (!initialCentered && data.center && (data.center[0] !== 20.5937 || data.center[1] !== 78.9629 || data.userLocation)) {
            map.setView(data.center, 14);
            initialCentered = true;
          }

          if (data.userLocation) {
            var userLatLng = [data.userLocation.latitude, data.userLocation.longitude];
            if (userMarker) {
              userMarker.setLatLng(userLatLng);
            } else {
              userMarker = L.circleMarker(userLatLng, {
                radius: 8, fillColor: '#D4AF37', color: '#1A1A1A', weight: 2, opacity: 1, fillOpacity: 0.95
              }).addTo(map).bindPopup("Your Position (Live GPS)");
            }
          }

          if (data.members) {
            var currentMemberIds = {};
            var allMemberCoords = [];

            data.members.forEach(function(m) {
              currentMemberIds[m.id] = true;
              var mLatLng = [m.lat, m.lng];
              allMemberCoords.push(mLatLng);

              var avatarClass = m.isOnline ? 'member-avatar-online' : 'member-avatar-offline';
              var statusTag = m.isOnline ? ' (Online)' : ' (' + (m.lastSeenText || 'Offline - Last Known Position') + ')';
              var avatarContent = m.avatarUrl
                ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
                : '<span style="color:#FFF;font-weight:bold;font-size:14px;">' + m.initial + '</span>';

              var pulseStyle = m.isOnline 
                ? 'border: 2px solid #10B981; box-shadow: 0 0 16px rgba(16,185,129,0.95);' 
                : 'border: 2px solid #9CA3AF; opacity: 0.85;';

              var batteryTag = m.batteryPct ? ' • 🔋' + m.batteryPct + '%' : '';
              var activityTag = m.activityText ? ' • ' + m.activityText : '';
              var labelHtml = '<div style="position:absolute; bottom:44px; left:50%; transform:translateX(-50%); white-space:nowrap; background:rgba(26,26,26,0.95); color:#FFFFFF; font-size:10px; font-weight:bold; font-family:sans-serif; padding:4px 9px; border-radius:12px; border:1px solid #D4AF37; box-shadow:0 4px 12px rgba(0,0,0,0.5); pointer-events:none; z-index:1000;">' + m.name + activityTag + batteryTag + '</div>';

              var icon = L.divIcon({
                className: 'custom-icon',
                html: '<div style="position:relative; width:40px; height:40px;">' + labelHtml + '<div class="' + avatarClass + '" style="width:40px;height:40px;overflow:hidden;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1A1A1A;' + pulseStyle + '">' + avatarContent + '</div></div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              });

              if (memberMarkers[m.id]) {
                memberMarkers[m.id].setLatLng(mLatLng);
                memberMarkers[m.id].setIcon(icon);
                memberMarkers[m.id].setPopupContent(m.name + statusTag);
              } else {
                memberMarkers[m.id] = L.marker(mLatLng, { icon: icon }).addTo(map).bindPopup(m.name + statusTag);
              }
            });

            if (!initialCentered && allMemberCoords.length > 0) {
              try {
                var bounds = L.latLngBounds(allMemberCoords);
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                initialCentered = true;
              } catch(e) {}
            }

            Object.keys(memberMarkers).forEach(function(id) {
              if (!currentMemberIds[id]) {
                map.removeLayer(memberMarkers[id]);
                delete memberMarkers[id];
              }
            });
          }

          if (data.places) {
            var currentPlaceIds = {};
            data.places.forEach(function(p) {
              currentPlaceIds[p.id] = true;
              var pLatLng = [p.lat, p.lng];
              if (placeCircles[p.id]) {
                placeCircles[p.id].setLatLng(pLatLng);
                placeCircles[p.id].setRadius(p.radius);
              } else {
                placeCircles[p.id] = L.circle(pLatLng, {
                  radius: p.radius, color: '#D4AF37', fillColor: '#D4AF37', fillOpacity: 0.22, weight: 2
                }).addTo(map).bindPopup("Geofence: " + p.name);

                placeCircles[p.id].on('click', function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PLACE_CLICK', placeId: p.id }));
                  }
                });
              }

              if (p.endLat && p.endLng) {
                var startKey = 'start_' + p.id;
                var endKey = 'end_' + p.id;
                var lineKey = 'line_' + p.id;
                currentPlaceIds[startKey] = true;
                currentPlaceIds[endKey] = true;
                currentPlaceIds[lineKey] = true;

                var endLatLng = [p.endLat, p.endLng];

                if (placeCircles[startKey]) {
                  placeCircles[startKey].setLatLng(pLatLng);
                } else {
                  placeCircles[startKey] = L.marker(pLatLng, {
                    icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#10B981;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(16,185,129,0.9);"></div>', iconSize: [16, 16] })
                  }).addTo(map).bindPopup("Start Point: " + p.name);
                }

                if (placeCircles[endKey]) {
                  placeCircles[endKey].setLatLng(endLatLng);
                } else {
                  placeCircles[endKey] = L.marker(endLatLng, {
                    icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#EF4444;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(239,68,68,0.9);"></div>', iconSize: [16, 16] })
                  }).addTo(map).bindPopup("End Point: " + p.name);
                }

                if (placeCircles[lineKey]) {
                  placeCircles[lineKey].setLatLngs([pLatLng, endLatLng]);
                } else {
                  placeCircles[lineKey] = L.polyline([pLatLng, endLatLng], {
                    color: '#60A5FA', weight: 3, dashArray: '6, 6'
                  }).addTo(map);
                }
              }
            });

            Object.keys(placeCircles).forEach(function(id) {
              if (!currentPlaceIds[id]) {
                map.removeLayer(placeCircles[id]);
                delete placeCircles[id];
              }
            });
          }

          if (data.pois) {
            var currentPoiIds = {};
            data.pois.forEach(function(p) {
              currentPoiIds[p.id] = true;
              var poiLatLng = [p.lat, p.lng];
              var iconSymbol = '📍';
              var bgGradient = 'linear-gradient(135deg, #1A1A1A, #333333)';
              var arrowColor = '#1A1A1A';

              if (p.category === 'hospital') {
                iconSymbol = '🏥';
                bgGradient = 'linear-gradient(135deg, #EF4444, #B91C1C)';
                arrowColor = '#B91C1C';
              } else if (p.category === 'school') {
                iconSymbol = '🎓';
                bgGradient = 'linear-gradient(135deg, #3B82F6, #1D4ED8)';
                arrowColor = '#1D4ED8';
              } else if (p.category === 'police') {
                iconSymbol = '🛡️';
                bgGradient = 'linear-gradient(135deg, #D4AF37, #92400E)';
                arrowColor = '#92400E';
              } else if (p.category === 'restaurant') {
                iconSymbol = '🍽️';
                bgGradient = 'linear-gradient(135deg, #F59E0B, #B45309)';
                arrowColor = '#B45309';
              } else if (p.category === 'fuel') {
                iconSymbol = '⛽';
                bgGradient = 'linear-gradient(135deg, #10B981, #047857)';
                arrowColor = '#047857';
              }

              var htmlStr = '<div class="poi-logo-pin">' +
                '<div class="poi-logo-circle" style="background:' + bgGradient + ';">' + iconSymbol + '</div>' +
                '<div class="poi-logo-arrow" style="border-top: 5px solid ' + arrowColor + ';"></div>' +
                '<div class="poi-logo-label">' + p.name.substring(0, 14) + '</div>' +
                '</div>';

              var icon = L.divIcon({
                className: 'custom-poi-logo-icon',
                html: htmlStr,
                iconSize: [80, 42],
                iconAnchor: [40, 28]
              });

              if (poiMarkers[p.id]) {
                poiMarkers[p.id].setLatLng(poiLatLng);
                poiMarkers[p.id].setIcon(icon);
              } else {
                poiMarkers[p.id] = L.marker(poiLatLng, { icon: icon }).addTo(map);
                poiMarkers[p.id].on('click', function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POI_CLICK', poiId: p.id }));
                  }
                });
              }
            });

            Object.keys(poiMarkers).forEach(function(id) {
              if (!currentPoiIds[id]) {
                map.removeLayer(poiMarkers[id]);
                delete poiMarkers[id];
              }
            });
          }
        };

        var touchTimer = null;
        map.on('contextmenu', function(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LONG_PRESS',
              lat: e.latlng.lat,
              lng: e.latlng.lng
            }));
          }
        });

        map.on('touchstart', function(e) {
          if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length === 1) {
            touchTimer = setTimeout(function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LONG_PRESS',
                  lat: e.latlng.lat,
                  lng: e.latlng.lng
                }));
              }
            }, 550);
          }
        });

        map.on('touchend touchmove dragstart zoomstart', function() {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
        });
      </script>
    </body>
    </html>
  `;

  if (!circleFetched || circleLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={LUXURY_THEME.colors.foreground} />
        <Text style={styles.loadingText}>INITIALIZING MAP ENGINE...</Text>
      </View>
    );
  }

  if (!activeCircle) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Join or create a circle to access live mapping.</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={LUXURY_THEME.colors.foreground} />
        <Text style={styles.loadingText}>REQUESTING GPS PERMISSIONS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.map}
        onLoadEnd={pushMapData}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'LONG_PRESS') {
              setAddPlaceCoord({ latitude: msg.lat, longitude: msg.lng });
              setAddPlaceVisible(true);
            } else if (msg.type === 'PLACE_CLICK') {
              const found = places.find(p => p.id === msg.placeId);
              if (found) {
                setSelectedMember(null);
                setSelectedPlace(found);
              }
            } else if (msg.type === 'POI_CLICK') {
              const found = poiList.find(p => p.id === msg.poiId);
              if (found) {
                setSelectedMember(null);
                setSelectedPlace(null);
                setSelectedPoi(found);
              }
            }
          } catch(e) {}
        }}
      />

      {/* Top Search Bar & Control Overlay */}
      <View style={styles.searchOverlay}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={LUXURY_THEME.colors.foreground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search member, landmark, road or area..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor={LUXURY_THEME.colors.textMuted}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={LUXURY_THEME.colors.accentGold} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={LUXURY_THEME.colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
              <Ionicons name="options-outline" size={18} color={activeFilterCategories.length > 0 ? LUXURY_THEME.colors.accentGold : LUXURY_THEME.colors.foreground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown Results Box */}
        {(searchResults.members.length > 0 || searchResults.places.length > 0 || searchResults.pois.length > 0 || searchResults.locations.length > 0) ? (
          <ScrollView style={styles.searchResultsDropdown} keyboardShouldPersistTaps="handled">
            {searchResults.members.map(m => (
              <TouchableOpacity key={m.user_id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(m, 'member')}>
                <Ionicons name="person-outline" size={16} color={colors.accentGold} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{m.profile?.full_name || 'Member'}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Circle Member • {m.isOnline ? 'Online' : 'Offline'}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.places.map(p => (
              <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(p, 'place')}>
                <Ionicons name="bookmark-outline" size={16} color={colors.accentGold} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Bookmarked Place</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.pois.map(p => {
              let iconName = 'location-outline';
              let iconColor = colors.foreground;
              let catTag = 'Nearby Place';

              if (p.category === 'hospital') {
                iconName = 'medical';
                iconColor = '#EF4444';
                catTag = 'Hospital / Clinic';
              } else if (p.category === 'school') {
                iconName = 'school';
                iconColor = '#3B82F6';
                catTag = 'School / University';
              } else if (p.category === 'police') {
                iconName = 'shield-checkmark';
                iconColor = '#D4AF37';
                catTag = 'Police Station';
              } else if (p.category === 'restaurant') {
                iconName = 'restaurant';
                iconColor = '#F59E0B';
                catTag = 'Dining & Cafe';
              } else if (p.category === 'fuel') {
                iconName = 'car';
                iconColor = '#10B981';
                catTag = 'Fuel Station';
              }

              return (
                <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(p, 'poi')}>
                  <Ionicons name={iconName as any} size={16} color={iconColor} />
                  <View style={styles.searchResultTextWrapper}>
                    <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>{catTag} • {p.distanceKm ? `${p.distanceKm} km away` : 'Nearby'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {searchResults.locations.map(loc => (
              <TouchableOpacity key={loc.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(loc, 'location')}>
                <Ionicons name="location-outline" size={16} color={colors.foreground} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]} numberOfLines={1}>{loc.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Map Location</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Horizontal Member Quick Selector Bar */}
        {members.length > 0 ? (
          <View style={styles.memberAvatarBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberAvatarContent}>
              {members.map(m => {
                const isSelected = selectedMember?.user_id === m.user_id;
                const nameFirst = String(m.profile?.full_name || 'Member').split(' ')[0];

                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.avatarChip,
                      m.isOnline ? styles.avatarChipOnline : styles.avatarChipOffline,
                      isSelected ? styles.avatarChipSelected : null
                    ]}
                    onPress={() => {
                      setSelectedPoi(null);
                      setSelectedPlace(null);
                      setSelectedMember(m);
                      const loc = locations.find(l => l.user_id === m.user_id);
                      if (loc && webViewRef.current) {
                        const js = `if (map) { map.setView([${loc.latitude}, ${loc.longitude}], 16); } true;`;
                        webViewRef.current.injectJavaScript(js);
                      }
                    }}
                  >
                    <View style={[styles.miniDot, { backgroundColor: m.isOnline ? '#10B981' : '#9CA3AF' }]} />
                    <Text style={[styles.chipText, { color: m.isOnline ? '#1A1A1A' : '#4B5563' }]}>{nameFirst.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Member Details Bottom Card */}
      {selectedMember ? (() => {
        const memberLoc = locations.find(l => l.user_id === selectedMember.user_id);
        const lat = memberLoc?.latitude || userLoc?.latitude || 0;
        const lng = memberLoc?.longitude || userLoc?.longitude || 0;
        
        let distText = 'Nearby';
        if (userLoc && lat && lng) {
          const meters = getDistanceInMeters(userLoc.latitude, userLoc.longitude, lat, lng);
          distText = meters > 1000 ? `${(meters / 1000).toFixed(1)} km away` : `${Math.round(meters)} m away`;
        }

        const handleNavigate = () => {
          if (lat && lng) {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
          } else {
            Alert.alert('Location Unavailable', 'No location coordinates found for this member.');
          }
        };

        const handleCall = () => {
          const phone = selectedMember.profile?.phone;
          if (phone) {
            Linking.openURL(`tel:${phone}`);
          } else {
            Alert.alert('Phone Unavailable', 'No phone number saved for this member.');
          }
        };

        const handleMessage = () => {
          const phone = selectedMember.profile?.phone;
          if (phone) {
            Linking.openURL(`sms:${phone}`);
          } else {
            Alert.alert('Phone Unavailable', 'No phone number saved for this member.');
          }
        };

        return (
          <View style={styles.memberCardSheet}>
            <View style={styles.memberCardHeader}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>
                  {String(selectedMember.profile?.full_name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberMainInfo}>
                <Text style={styles.memberCardName}>{selectedMember.profile?.full_name || 'Circle Member'}</Text>
                <View style={styles.safeBadge}>
                  <View style={[styles.safeDot, { backgroundColor: selectedMember.isOnline ? '#10B981' : '#9CA3AF' }]} />
                  <Text style={[styles.safeBadgeText, { color: selectedMember.isOnline ? '#10B981' : '#9CA3AF' }]}>
                    {selectedMember.isOnline ? 'ONLINE & ACTIVE' : (selectedMember.lastSeenText || 'OFFLINE').toUpperCase()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Ionicons name="battery-charging-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>
                  {memberLoc?.battery_pct ? `BATTERY ${memberLoc.battery_pct}%` : 'BATTERY OPTIMAL'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="car-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>
                  {memberLoc?.is_driving ? 'DRIVING' : 'STATIONARY'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="time-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>LIVE GPS SYNC</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="navigate-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>{distText.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.cardActionRow}>
              <TouchableOpacity style={[styles.cardBtn, { backgroundColor: LUXURY_THEME.colors.accentGold }]} onPress={handleNavigate}>
                <Ionicons name="compass-outline" size={16} color={LUXURY_THEME.colors.foreground} />
                <Text style={[styles.cardBtnText, { color: LUXURY_THEME.colors.foreground }]}>NAVIGATE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cardBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} onPress={handleCall}>
                <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                <Text style={styles.cardBtnText}>CALL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cardBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} onPress={handleMessage}>
                <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                <Text style={styles.cardBtnText}>MESSAGE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })() : null}

      {/* Bookmarked Place Bottom Card */}
      {selectedPlace ? (
        <View style={styles.memberCardSheet}>
          <View style={styles.memberCardHeader}>
            <View style={[styles.memberAvatar, { borderColor: LUXURY_THEME.colors.accentGold }]}>
              <Ionicons name="bookmark" size={20} color={LUXURY_THEME.colors.accentGold} />
            </View>
            <View style={styles.memberMainInfo}>
              <Text style={styles.memberCardName}>{selectedPlace.name}</Text>
              <View style={styles.safeBadge}>
                <View style={styles.safeDot} />
                <Text style={styles.safeBadgeText}>GEOFENCE RADIUS: {selectedPlace.radius_m || selectedPlace.radius || 150}M</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedPlace(null)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={[styles.cardActionRow, { marginTop: 16 }]}>
            <TouchableOpacity 
              style={[styles.cardBtn, { backgroundColor: LUXURY_THEME.colors.sosRed, borderColor: LUXURY_THEME.colors.sosRed }]} 
              onPress={handleDeleteSelectedPlace}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={[styles.cardBtnText, { color: '#FFFFFF' }]}>DELETE BOOKMARK</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.cardBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} 
              onPress={() => setSelectedPlace(null)}
            >
              <Text style={styles.cardBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Selected POI (Hospital, School, Police, Restaurant, Fuel) Bottom Card */}
      {selectedPoi ? (
        <View style={styles.memberCardSheet}>
          <View style={styles.memberCardHeader}>
            <View style={[styles.memberAvatar, { backgroundColor: LUXURY_THEME.colors.accentGold, borderColor: LUXURY_THEME.colors.accentGold }]}>
              <Ionicons name="location" size={20} color={LUXURY_THEME.colors.foreground} />
            </View>
            <View style={styles.memberMainInfo}>
              <Text style={styles.memberCardName}>{selectedPoi.name}</Text>
              <Text style={styles.poiAddressText} numberOfLines={2}>{selectedPoi.subText}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedPoi(null)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={[styles.cardActionRow, { marginTop: 16 }]}>
            <TouchableOpacity 
              style={[styles.cardBtn, { backgroundColor: LUXURY_THEME.colors.accentGold }]} 
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.lat},${selectedPoi.lng}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="navigate-outline" size={16} color={LUXURY_THEME.colors.foreground} />
              <Text style={[styles.cardBtnText, { color: LUXURY_THEME.colors.foreground }]}>NAVIGATE</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.cardBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} 
              onPress={() => {
                setAddPlaceCoord({ latitude: selectedPoi.lat, longitude: selectedPoi.lng });
                setAddPlaceVisible(true);
              }}
            >
              <Ionicons name="bookmark-outline" size={16} color="#FFFFFF" />
              <Text style={styles.cardBtnText}>BOOKMARK PLACE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <AlertModal 
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />

      <AddPlaceModal
        visible={addPlaceVisible}
        coordinate={addPlaceCoord}
        onClose={() => setAddPlaceVisible(false)}
        onSave={savePlace}
      />

      <SearchFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        selectedCategories={activeFilterCategories}
        onApplyFilters={(cats) => {
          setActiveFilterCategories(cats);
          const poiCats = cats.filter(c => c !== 'member' && c !== 'place');
          if (poiCats.length > 0) {
            fetchAllNearbyPois(userLoc?.latitude || 20.5937, userLoc?.longitude || 78.9629, poiCats);
          } else {
            setSelectedPoiCategory(null);
            setPoiList([]);
          }
          if (cats.length > 0) {
            handleSearchChange(cats[0]);
          } else {
            handleSearchChange('');
          }
        }}
        poiList={poiList}
        members={members}
        places={places}
        userLoc={userLoc}
      />

      {/* Floating Map Controls: Zoom Controls */}
      <View style={[styles.floatingControls, selectedMember || selectedPlace || selectedPoi ? { bottom: 275 } : { bottom: 25 }]}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={LUXURY_THEME.colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut} activeOpacity={0.8}>
          <Ionicons name="remove" size={22} color={LUXURY_THEME.colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: LUXURY_THEME.colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
  },
  emptyText: {
    color: LUXURY_THEME.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  searchOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: LUXURY_THEME.colors.foreground,
  },
  filterBtn: {
    padding: 4,
  },
  searchResultsDropdown: {
    maxHeight: 240,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    marginTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  searchResultTextWrapper: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  searchResultSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },

  memberCardSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: LUXURY_THEME.colors.foreground,
    padding: 24,
    borderTopWidth: 3,
    borderTopColor: LUXURY_THEME.colors.accentGold,
    zIndex: 20,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberMainInfo: {
    flex: 1,
  },
  memberCardName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  safeDot: {
    width: 6,
    height: 6,
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  safeBadgeText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metricItem: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  memberAvatarBar: {
    marginTop: 8,
  },
  memberAvatarContent: {
    gap: 6,
    paddingHorizontal: 2,
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarChipOnline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  avatarChipOffline: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  avatarChipSelected: {
    borderColor: LUXURY_THEME.colors.accentGold,
    borderWidth: 2,
  },
  miniDot: {
    width: 6,
    height: 6,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 6,
    gap: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 30,
  },
  controlBtn: {
    width: 44,
    height: 44,
    backgroundColor: LUXURY_THEME.colors.background,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotateRow: {
    flexDirection: 'row',
    gap: 4,
  },
  controlBtnSmall: {
    width: 20,
    height: 30,
    backgroundColor: LUXURY_THEME.colors.background,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    marginTop: 1,
  },
  controlDivider: {
    width: 24,
    height: 1,
    backgroundColor: LUXURY_THEME.colors.border,
    marginVertical: 2,
  },
  poiFilterBar: {
    marginTop: 6,
  },
  poiFilterContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  poiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  poiChipActive: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  poiChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  poiChipTextActive: {
    color: '#FFFFFF',
  },
  poiAddressText: {
    fontSize: 11,
    color: LUXURY_THEME.colors.textMuted,
    marginTop: 2,
  },
});
