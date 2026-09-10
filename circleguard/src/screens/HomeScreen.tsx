import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../store/useAuthStore';

function AnimatedActivityItem({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index * 70, 350),
      useNativeDriver: true,
    }).start();
  }, [index]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}
import { useCircleStore, CircleMember } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  sendInstantLocationPing,
  startBatteryOptimizedBackgroundLocation,
  stopBackgroundLocation,
} from '../services/LocationBackgroundService';
import { useThemeStore } from '../store/useThemeStore';
import { getThemeBorderStyles, getThemeCardStyles, getThemeButtonStyles, getThemeBadgeStyles } from '../constants/theme';

import FakeCallModal from '../components/FakeCallModal';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import ShareLocationModal from '../components/ShareLocationModal';
import SwiggyHeaderBar from '../components/SwiggyHeaderBar';
import SwiggySearchBar from '../components/SwiggySearchBar';
import MemberStatusPillsCarousel from '../components/MemberStatusPillsCarousel';
import ZomatoLiveJourneyCard from '../components/ZomatoLiveJourneyCard';
import MagnificationDock, { DockItemData } from '../components/MagnificationDock';
import JellySqueezeButton from '../components/JellySqueezeButton';
import HomeMiniMapCard from '../components/HomeMiniMapCard';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import CircleQRCodeModal from '../components/CircleQRCodeModal';
import BillionDollarHomeView from '../components/BillionDollarHomeView';
import * as Location from 'expo-location';
import { getHaversineDistanceInMeters } from '../services/GeofenceEngine';

export default function HomeScreen() {
  const { colors, isDark, themeMode } = useThemeStore();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members, places, circleFetched, isLoading: circleLoading, isSwitchingCircle, switchingTargetName, switchingStepText } = useCircleStore();

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [circlePlaces, setCirclePlaces] = useState<any[]>([]);

  useEffect(() => {
    if (Array.isArray(places) && activeCircle?.id) {
      setCirclePlaces(places.filter(p => p && p.circle_id === activeCircle.id));
    } else {
      setCirclePlaces([]);
    }
  }, [places, activeCircle?.id]);
  const [fakeCallVisible, setFakeCallVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { showAlert } = useLuxuryAlert();

  const fetchHomePlaces = async (circleId: string) => {
    try {
      const { data } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId);
      if (useCircleStore.getState().activeCircle?.id === circleId) {
        setCirclePlaces(data || []);
      }
    } catch (e) {}
  };

  const parsePlaceCoords = (p: any): { latitude: number; longitude: number } => {
    let lat = parseFloat(p.start_lat || p.latitude || 0);
    let lng = parseFloat(p.start_lng || p.longitude || 0);

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
    return { latitude: lat || 0, longitude: lng || 0 };
  };

  const getMemberHomeStatus = (m: any) => {
    if (!circlePlaces || circlePlaces.length === 0 || !m.latitude || !m.longitude) {
      return 'Away';
    }

    for (const place of circlePlaces) {
      const { latitude: pLat, longitude: pLng } = parsePlaceCoords(place);
      if (!pLat || !pLng) continue;

      const dist = getHaversineDistanceInMeters(m.latitude, m.longitude, pLat, pLng);
      const radius = place.radius_m || 150;

      if (dist <= radius) {
        const cat = String(place.category || '').toLowerCase();
        if (cat === 'home' || place.name?.toLowerCase().includes('home')) {
          return 'At Home';
        }
        return `At ${place.name || 'Safe Zone'}`;
      }
    }
    return 'Away';
  };

  const toggleLocationTracking = async () => {
    if (isTrackingActive) {
      await stopBackgroundLocation();
      setIsTrackingActive(false);
      showAlert({
        title: 'Shield Paused',
        message: 'Background location tracking and safety monitoring have been paused.',
        type: 'warning',
        buttonText: 'GOT IT',
      });
    } else {
      await startBatteryOptimizedBackgroundLocation();
      setIsTrackingActive(true);
      showAlert({
        title: 'Shield Active',
        message: '24/7 background location tracking and safety monitoring are active.',
        type: 'success',
        buttonText: 'PROTECTION LIVE',
      });
    }
  };

  const handleShareLocation = () => {
    setShareModalVisible(true);
  };

  // Strictly filter members for the active circle to guarantee no cross-circle data leaks
  const circleMembers: CircleMember[] = useMemo(() => {
    if (!activeCircle?.id || !Array.isArray(members)) return [];
    const list = members.filter(m => !m.circle_id || m.circle_id === activeCircle.id);
    console.log(`[GPS_PIPELINE:LAYER_6_UI_RENDER] HomeScreen rendered ${list.length} circle members. Online: ${list.filter(m => m.isOnline).length}, Offline: ${list.filter(m => !m.isOnline).length}`);
    return list;
  }, [members, activeCircle?.id]);

  const safeMembers: CircleMember[] = activeCircle ? circleMembers : [];
  const firstName = String(profile?.full_name || 'User').split(' ')[0];

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const currentCircle = activeCircle || useCircleStore.getState().activeCircle;
      if (currentCircle?.id) {
        // Refresh only the CURRENT active circle data - NEVER switch circle on pull-to-refresh!
        await Promise.all([
          useCircleStore.getState().fetchMembers(currentCircle.id),
          useCircleStore.getState().fetchPlaces(currentCircle.id),
          fetchHomePlaces(currentCircle.id),
          fetchCircleActivity(currentCircle.id),
        ]);
        // Also refresh user's circles list in background to pick up newly added circles without switching active
        useCircleStore.getState().fetchUserCircles(profile.id).catch(() => {});
      } else {
        await useCircleStore.getState().fetchActiveCircle(profile.id);
      }
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Realtime subscription for location changes in HomeScreen
  useEffect(() => {
    if (!activeCircle?.id) return;
    const channelUid = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`home_locations_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload: any) => {
          console.log(`[GPS_PIPELINE:LAYER_5_REALTIME_SYNC] HomeScreen received Realtime postgres_changes event=${payload?.eventType} for user_id=${payload?.new?.user_id || payload?.old?.user_id}`);
          useCircleStore.getState().fetchMembers(activeCircle.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle?.id]);

  useEffect(() => {
    sendInstantLocationPing();
    startBatteryOptimizedBackgroundLocation();

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
      } catch (e) {}
    })();

    if (profile?.id && !activeCircle) {
      setRecentActivities([]);
      setCirclePlaces([]);
      useCircleStore.getState().fetchActiveCircle(profile.id);
    } else if (activeCircle?.id) {
      setRecentActivities([]);
      setCirclePlaces([]);
      fetchCircleActivity(activeCircle.id);
      fetchHomePlaces(activeCircle.id);
      useCircleStore.getState().fetchPlaces(activeCircle.id);
      useCircleStore.getState().fetchMembers(activeCircle.id);
    } else {
      setRecentActivities([]);
      setCirclePlaces([]);
    }
  }, [profile?.id, activeCircle?.id]);

  const fetchCircleActivity = async (circleId: string) => {
    if (!circleId) {
      setRecentActivities([]);
      return;
    }
    setLoadingActivity(true);
    try {
      const [sosRes, msgRes, placesRes] = await Promise.all([
        supabase
          .from('sos_alerts')
          .select('id, created_at, status, user_id, profiles(full_name)')
          .eq('circle_id', circleId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('circle_messages')
          .select('id, created_at, content, sender_id, profiles:sender_id(full_name)')
          .eq('circle_id', circleId)
          .or('content.ilike.%PERMISSION REQUEST%,content.ilike.%PERMISSION GRANTED%,content.ilike.%PERMISSION DENIED%')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('places')
          .select('id, name')
          .eq('circle_id', circleId)
      ]);

      const placeIds = (placesRes.data || []).map((p: any) => p.id).filter(Boolean);
      let placeEventsData: any[] = [];
      if (placeIds.length > 0) {
        try {
          const { data: peData } = await supabase
            .from('place_events')
            .select('id, occurred_at, event_type, place_id, user_id, places(name), profiles(full_name)')
            .in('place_id', placeIds)
            .order('occurred_at', { ascending: false })
            .limit(5);
          if (peData) placeEventsData = peData;
        } catch (e) {}
      }

      const sosActivities = (sosRes.data || []).map((item) => {
        let name = 'A member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        return {
          id: item.id,
          title: `${name || 'Member'} triggered an emergency distress signal!`,
          badgeText: 'EMERGENCY SOS',
          icon: 'alert-circle-sharp',
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: '#EF4444',
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const msgActivities = (msgRes.data || []).map((item) => {
        let name = 'Member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        let cleanTitle = item.content
          .replace(/^PERMISSION GRANTED:\s*/i, '')
          .replace(/^PERMISSION DENIED:\s*/i, '')
          .replace(/^PERMISSION REQUEST:\s*/i, '');

        let color = colors.accentGold;
        let icon: any = 'shield-outline';
        let badgeText = 'PRIVACY LOG';

        if (item.content.includes('GRANTED')) {
          color = '#10B981';
          icon = 'checkmark-circle-outline';
          badgeText = 'REQUEST APPROVED';
        } else if (item.content.includes('DENIED')) {
          color = '#EF4444';
          icon = 'close-circle-outline';
          badgeText = 'REQUEST DENIED';
        } else if (item.content.includes('REQUEST')) {
          color = '#F59E0B';
          icon = 'lock-closed-outline';
          badgeText = 'PRIVACY REQUEST';
          cleanTitle = `${name} requested Ghost Mode permission under Option B 24/7 Safety`;
        }

        return {
          id: item.id,
          title: cleanTitle,
          badgeText: badgeText,
          icon: icon,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: color,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const placeActivities = placeEventsData.map((item: any) => {
        let name = 'Member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : item.profiles?.full_name;
        }
        let placeName = 'Safe Zone';
        if (item.places) {
          placeName = Array.isArray(item.places) ? item.places[0]?.name : item.places?.name;
        }
        const isArrival = item.event_type === 'arrival';
        return {
          id: String(item.id),
          title: isArrival ? `${name || 'Member'} arrived at ${placeName}` : `${name || 'Member'} departed ${placeName}`,
          badgeText: isArrival ? 'ZONE ARRIVAL' : 'ZONE DEPARTURE',
          icon: isArrival ? 'location' : 'exit-outline',
          time: new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: isArrival ? '#10B981' : '#F5A623',
          timestamp: new Date(item.occurred_at).getTime(),
        };
      });

      const combined = [...sosActivities, ...msgActivities, ...placeActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      setRecentActivities(combined);
    } catch (err) {
      console.warn('Error fetching activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleInviteMember = async () => {
    if (activeCircle?.invite_code) {
      setQrModalVisible(true);
    } else {
      navigation.navigate('Circle');
    }
  };

  const onlineCount = activeCircle ? safeMembers.filter((m) => m.isOnline).length : 0;
  const offlineCount = activeCircle ? Math.max(0, safeMembers.length - onlineCount) : 0;

  // Safety Controls Dock Definitions
  const dockItems: DockItemData[] = [
    {
      id: 'gps',
      iconName: 'navigate',
      label: 'Share GPS',
      badgeColor: 'rgba(10, 132, 255, 0.12)',
      iconColor: '#0A84FF',
      onClick: handleShareLocation,
    },
    {
      id: 'ghost',
      iconName: 'call',
      label: 'Fake Call',
      badgeColor: 'rgba(175, 82, 222, 0.12)',
      iconColor: '#AF52DE',
      onClick: () => setFakeCallVisible(true),
    },
    {
      id: 'places',
      iconName: 'location',
      label: 'Safe Places',
      badgeColor: 'rgba(48, 209, 88, 0.12)',
      iconColor: '#30D158',
      onClick: () => navigation.navigate('SafePlaces'),
    },
    {
      id: 'history',
      iconName: 'time',
      label: 'History',
      badgeColor: 'rgba(255, 159, 10, 0.12)',
      iconColor: '#FF9F0A',
      onClick: () => navigation.navigate('LocationHistory'),
    },
    {
      id: 'driving',
      iconName: 'speedometer',
      label: 'Driving',
      badgeColor: 'rgba(255, 69, 58, 0.12)',
      iconColor: '#FF453A',
      onClick: () => navigation.navigate('DrivingReports'),
    },
  ];

  // Live High-Precision GPS Positioning
  useEffect(() => {
    let locSub: Location.LocationSubscription | null = null;
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted && current?.coords) {
            setUserLoc({ latitude: current.coords.latitude, longitude: current.coords.longitude });
          }
          locSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 8 },
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

  const parseMemberPoint = (m: any): { lat: number; lng: number } => {
    if (!m) return { lat: 0, lng: 0 };
    const directLat = parseFloat(m.latitude ?? m.start_lat ?? m.lat);
    const directLng = parseFloat(m.longitude ?? m.start_lng ?? m.lng);
    if (!isNaN(directLat) && !isNaN(directLng) && Math.abs(directLat) <= 90 && Math.abs(directLng) <= 180 && (directLat !== 0 || directLng !== 0)) {
      return { lat: directLat, lng: directLng };
    }
    if (m.geom && typeof m.geom === 'string') {
      const match = m.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (match) {
        let lngVal = parseFloat(match[1]); // In WKT POINT(lng lat), token 1 is Longitude
        let latVal = parseFloat(match[2]); // Token 2 is Latitude
        if (Math.abs(latVal) > 90 && Math.abs(lngVal) <= 90) {
          const temp = latVal;
          latVal = lngVal;
          lngVal = temp;
        }
        return { lat: latVal, lng: lngVal };
      }
    }
    return { lat: 0, lng: 0 };
  };

  // Find member currently genuinely in-transit or moving (strict check)
  const inTransitMember = circleMembers.find((m: any) => {
    const { lat, lng } = parseMemberPoint(m);
    if (!lat || !lng || m.isOnline === false) {
      return false;
    }
    const speedKmh = Math.round(((m.speed_mps || m.speed || 0) * 3.6));
    const isDriving = Boolean(m.isDriving || m.is_driving || speedKmh > 18);
    const isWalking = speedKmh >= 3 && speedKmh <= 18;
    const isVehicle = m.activity_state === 'In Vehicle';
    return isDriving || isWalking || isVehicle;
  }) || null;

  // Find member currently OUTSIDE all registered safe places
  const outsideMember = !inTransitMember ? circleMembers.find((m: any) => {
    const { lat, lng } = parseMemberPoint(m);
    if (!lat || !lng || m.isOnline === false) return false;
    if (!circlePlaces || circlePlaces.length === 0) return false;

    const isInsideAny = circlePlaces.some((p: any) => {
      const { latitude: pLat, longitude: pLng } = parsePlaceCoords(p);
      if (!pLat || !pLng) return false;
      const dist = getHaversineDistanceInMeters(lat, lng, pLat, pLng);
      const radius = Number(p.radius_m) || 150;
      return dist <= radius;
    });

    return !isInsideAny;
  }) || null : null;

  // Billion Dollar Flagship view (Primary UI mode)
  if (themeMode === 'billion_dollar') {
    return <BillionDollarHomeView />;
  }

  // When opening the Home tab in legacy view, fetching initial circle, or actively switching circle
  if ((!circleFetched && !activeCircle) || isSwitchingCircle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <LuxuryRadarLoading
          message={switchingTargetName ? `SYNCING ${switchingTargetName.toUpperCase()}...` : "LOADING HOME..."}
          subMessage={switchingStepText || "Syncing members & telemetry"}
          size={130}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FAF9F5' }]}>
      {/* Fixed Top Location Header */}
      <SwiggyHeaderBar hasNotification={recentActivities.length > 0} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#B48B1E']}
            tintColor="#B48B1E"
          />
        }
      >
        {/* Universal Search Bar */}
        <SwiggySearchBar safePlaces={circlePlaces} />

        {/* Horizontal Member Status Carousel */}
        <MemberStatusPillsCarousel
          safePlaces={circlePlaces}
          userLoc={userLoc}
        />

        {/* Live In-Transit Journey / Perimeter Status Card */}
        {activeCircle ? (
          <ZomatoLiveJourneyCard
            inTransitMember={inTransitMember}
            outsideMember={outsideMember}
            safePlaces={circlePlaces}
            userLoc={userLoc}
          />
        ) : null}
        {/* THEME-SPECIFIC HERO LAYOUT ARCHITECTURE */}
        {themeMode === 'brand_green' ? (
          /* BRAND GREEN & AMBER (FLEXY UI): Split Dual-Tone Cockpit */
          <View style={styles.flexyHeroCard}>
            {/* Top Brand Green Header */}
            <View style={styles.flexyHeroTopBanner}>
              <View style={styles.flexyHeaderRow}>
                <View style={styles.flexyLogoBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flexyBrandLabel}>CIRCLEGUARD LIVE</Text>
                  <Text style={styles.flexyCircleTitle} numberOfLines={1}>
                    {activeCircle ? activeCircle.name : 'No Active Circle'}
                  </Text>
                </View>
                <View style={styles.flexyLivePulsePill}>
                  <View style={styles.flexyPulseDot} />
                  <Text style={styles.flexyLivePulseText}>24/7 ACTIVE</Text>
                </View>
              </View>

              {/* Members Avatar Row on Green Canvas */}
              {activeCircle && safeMembers.length > 0 ? (
                <View style={styles.flexyAvatarRow}>
                  {safeMembers.slice(0, 5).map((m, idx) => {
                    const name = m.profile?.full_name || 'Member';
                    const initial = name.charAt(0).toUpperCase();
                    const avatarUrl = m.profile?.avatar_url;
                    return (
                      <View key={m.user_id || idx} style={styles.flexyAvatarCircle}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.flexyAvatarInitial}>{initial}</Text>
                        )}
                      </View>
                    );
                  })}
                  {safeMembers.length > 5 ? (
                    <View style={styles.flexyMoreBadge}>
                      <Text style={styles.flexyMoreText}>+{safeMembers.length - 5}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.flexyConnectedCount}>
                    {safeMembers.length} family members connected
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bottom White Status & Protection Control Panel */}
            <View style={styles.flexyHeroBottomPanel}>
              <View style={styles.flexyStatusRow}>
                <View style={styles.flexyShieldIconBox}>
                  <Ionicons
                    name={isTrackingActive ? 'shield-checkmark' : 'pause-circle'}
                    size={20}
                    color={isTrackingActive ? '#3DBE6C' : '#F5A623'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flexyStatusTitle}>
                    {isTrackingActive ? 'Real-Time Protection Live' : 'Background Shield Paused'}
                  </Text>
                  <Text style={styles.flexyStatusSub}>
                    {isTrackingActive ? 'GPS broadcasting & geofence alerts active' : 'Tap below to resume 24/7 monitoring'}
                  </Text>
                </View>
              </View>

              {activeCircle ? (
                <TouchableOpacity
                  style={[
                    styles.flexyActionBtn,
                    { backgroundColor: isTrackingActive ? '#F5F5F5' : '#3DBE6C' },
                  ]}
                  onPress={toggleLocationTracking}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isTrackingActive ? 'pause' : 'play'}
                    size={16}
                    color={isTrackingActive ? '#111111' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.flexyActionBtnText,
                      { color: isTrackingActive ? '#111111' : '#FFFFFF' },
                    ]}
                  >
                    {isTrackingActive ? 'PAUSE LIVE TRACKING' : 'RESUME BACKGROUND SHIELD'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.flexyActionBtn, { backgroundColor: '#3DBE6C' }]}
                  onPress={() => navigation.navigate('Circle')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                  <Text style={[styles.flexyActionBtnText, { color: '#FFFFFF' }]}>JOIN OR CREATE A CIRCLE</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* STANDARD / BAUHAUS / PLAYFUL / BOTANICAL HERO CARD */
          <View
            style={[
              styles.heroCard,
              getThemeCardStyles(themeMode),
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
          >
            {/* Gold Left Accent Stripe */}
            <View style={[styles.goldLeftStripe, { backgroundColor: colors.accentGold }]} />

            {/* Top Status & Date Row */}
            <View style={styles.cardTopRow}>
              <View
                style={[
                  styles.liveShieldPill,
                  {
                    borderColor: isTrackingActive ? '#10B981' : '#F59E0B',
                    backgroundColor: isTrackingActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isTrackingActive ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text
                  style={[
                    styles.liveShieldText,
                    { color: isTrackingActive ? '#10B981' : '#F59E0B' },
                  ]}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >
                  {isTrackingActive ? 'LIVE SHIELD ACTIVE' : 'SHIELD PAUSED'}
                </Text>
              </View>

              <Text 
                style={[styles.cardDateText, { color: isDark ? colors.textMuted : '#A1A1AA' }]}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
                numberOfLines={1}
              >
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).toUpperCase()}
              </Text>
            </View>

            {/* Center 3D Shield Emblem Badge */}
            <View style={styles.shieldEmblemContainer}>
              <View style={[styles.outerShieldRing, { backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : '#FAF5DB' }]}>
                <View style={[styles.innerShieldBadge, { borderColor: colors.accentGold }]}>
                  <Ionicons name="shield-checkmark" size={32} color={colors.accentGold} />
                  <View style={styles.shieldInnerPinWrap}>
                    <Ionicons name="location" size={14} color="#FF5266" />
                  </View>
                </View>
              </View>
            </View>

            {/* Circle Title & Connected Status */}
            <Text 
              style={[styles.circleNameTitle, { color: colors.foreground }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              numberOfLines={1}
            >
              {activeCircle ? activeCircle.name : 'No Active Circle'}
            </Text>

            <Text style={[styles.circleSubtitle, { color: colors.textMuted }]}>
              {activeCircle
                ? `${safeMembers.length} members connected in real time`
                : 'Join or create a family group to start 24/7 live location tracking.'}
            </Text>

            {/* Member Avatar Stack */}
            {activeCircle && safeMembers.length > 0 ? (
              <View style={styles.avatarRowContainer}>
                {safeMembers.slice(0, 4).map((m, idx) => {
                  const name = m.profile?.full_name || 'Member';
                  const initial = name.charAt(0).toUpperCase();
                  const avatarUrl = m.profile?.avatar_url;

                  return (
                    <View
                      key={m.user_id || idx}
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isDark ? colors.surfaceMuted : '#F4F4F5',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={[styles.avatarInitialText, { color: colors.foreground }]}>
                          {initial}
                        </Text>
                      )}
                    </View>
                  );
                })}

                {safeMembers.length > 4 ? (
                  <View style={[styles.moreAvatarGoldBadge, { backgroundColor: colors.accentGold }]}>
                    <Text style={styles.moreAvatarText}>
                      +{safeMembers.length - 4}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ marginBottom: 16 }} />
            )}

            {/* Interactive Action Button */}
            {activeCircle ? (
              <JellySqueezeButton
                glowColor={isTrackingActive ? '#EF4444' : '#10B981'}
                style={[
                  styles.pauseTrackingBtn,
                  getThemeBorderStyles(themeMode),
                  {
                    borderColor: isTrackingActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                    backgroundColor: isTrackingActive ? '#FFF1F1' : 'rgba(16, 185, 129, 0.12)',
                  },
                ]}
                onPress={toggleLocationTracking}
              >
                <Ionicons
                  name={isTrackingActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={18}
                  color={isTrackingActive ? '#DC2626' : '#10B981'}
                />
                <Text
                  style={[
                    styles.pauseBtnText,
                    { color: isTrackingActive ? '#DC2626' : '#10B981' },
                  ]}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >
                  {isTrackingActive ? 'PAUSE BACKGROUND TRACKING' : 'RESUME BACKGROUND SHIELD'}
                </Text>
              </JellySqueezeButton>
            ) : (
              <TouchableOpacity
                style={[
                  styles.pauseTrackingBtn,
                  {
                    backgroundColor: colors.accentGold,
                    borderColor: colors.accentGold,
                  },
                ]}
                onPress={() => navigation.navigate('Circle')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#1A1A1A" />
                <Text 
                  style={[styles.pauseBtnText, { color: '#1A1A1A', fontWeight: '900' }]}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >
                  JOIN OR CREATE A CIRCLE
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Section Header: Circle Metrics */}
        <View style={styles.sectionHeaderRow}>
          <Text 
            style={[styles.sectionTitle, { color: colors.foreground }]}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.85}
            numberOfLines={1}
          >
            CIRCLE METRICS
          </Text>
          <View style={[styles.accentLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Circle Metrics Grid */}
        <View style={styles.metricsGridRow}>
          <TouchableOpacity
            style={[
              styles.metricCardBox,
              getThemeCardStyles(themeMode),
              {
                backgroundColor: colors.surface,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.metricBigNumber, { color: themeMode === 'brand_green' ? '#3DBE6C' : '#10B981' }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {activeCircle ? onlineCount : 0}
            </Text>
            <Text 
              style={[styles.metricCardLabel, { color: themeMode === 'brand_green' ? '#3DBE6C' : '#10B981' }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              numberOfLines={2}
            >
              MEMBERS{'\n'}ONLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCardBox,
              getThemeCardStyles(themeMode),
              {
                backgroundColor: colors.surface,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.metricBigNumber, { color: colors.textMuted }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {activeCircle ? offlineCount : 0}
            </Text>
            <Text 
              style={[styles.metricCardLabel, { color: colors.textMuted }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              numberOfLines={2}
            >
              MEMBERS{'\n'}OFFLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCardBox,
              getThemeCardStyles(themeMode),
              {
                backgroundColor: colors.surface,
              },
            ]}
            onPress={() => navigation.navigate('Activity')}
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.metricBigNumber, { color: themeMode === 'brand_green' ? '#F5A623' : colors.accentGold }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {activeCircle ? recentActivities.length : 0}
            </Text>
            <Text 
              style={[styles.metricCardLabel, { color: themeMode === 'brand_green' ? '#F5A623' : colors.accentGold }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              numberOfLines={2}
            >
              ALERTS{'\n'}LOGGED
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Header: Safety Controls */}
        <View style={styles.sectionHeaderRow}>
          <Text 
            style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B' }]}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.85}
            numberOfLines={1}
          >
            {themeMode === 'brand_green' ? 'SAFETY CONTROLS' : 'SAFETY CONTROLS'}
          </Text>
          <View style={[styles.accentLine, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]} />
        </View>

        {/* THEME SPECIFIC CONTROLS LAYOUT: Bento Matrix vs Dock */}
        {themeMode === 'brand_green' ? (
          <View style={styles.bentoContainer}>
            {/* Row 1 */}
            <View style={styles.bentoRow}>
              {/* Card 1: 2-Day Route History & Breadcrumbs */}
              <TouchableOpacity
                style={[styles.bentoCard, styles.bentoCardBlue]}
                onPress={() => navigation.navigate('LocationHistory')}
                activeOpacity={0.85}
              >
                <View style={styles.bentoIconCircleBlue}>
                  <Ionicons name="navigate-circle" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.bentoTitle}>ROUTE HISTORY</Text>
                <Text style={styles.bentoSubtitle}>2-day historical breadcrumb trail</Text>
                <View style={styles.bentoActionPillBlue}>
                  <Text style={styles.bentoActionPillTextBlue}>VIEW TRAIL →</Text>
                </View>
              </TouchableOpacity>

              {/* Card 2: Safe Zones / Geofences */}
              <TouchableOpacity
                style={[styles.bentoCard, styles.bentoCardGreen]}
                onPress={() => navigation.navigate('SafePlaces')}
                activeOpacity={0.85}
              >
                <View style={styles.bentoIconCircleGreen}>
                  <Ionicons name="location" size={24} color="#3DBE6C" />
                </View>
                <Text style={styles.bentoTitle}>SAFE ZONES</Text>
                <Text style={styles.bentoSubtitle}>{circlePlaces.length} geofences armed</Text>
                <View style={styles.bentoActionPillGreen}>
                  <Text style={styles.bentoActionPillTextGreen}>MANAGE →</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Row 2 */}
            <View style={styles.bentoRow}>
              {/* Card 3: Discreet Security (Fake Call) */}
              <TouchableOpacity
                style={[styles.bentoCard, styles.bentoCardPurple]}
                onPress={() => setFakeCallVisible(true)}
                activeOpacity={0.85}
              >
                <View style={styles.bentoIconCirclePurple}>
                  <Ionicons name="call" size={22} color="#8B5CF6" />
                </View>
                <Text style={styles.bentoTitle}>DISCREET SHIELD</Text>
                <Text style={styles.bentoSubtitle}>Simulate emergency incoming call</Text>
                <View style={styles.bentoActionPillPurple}>
                  <Text style={styles.bentoActionPillTextPurple}>TRIGGER →</Text>
                </View>
              </TouchableOpacity>

              {/* Card 4: Live Location Share */}
              <TouchableOpacity
                style={[styles.bentoCard, styles.bentoCardAmber]}
                onPress={handleShareLocation}
                activeOpacity={0.85}
              >
                <View style={styles.bentoIconCircleAmber}>
                  <Ionicons name="paper-plane" size={22} color="#F5A623" />
                </View>
                <Text style={styles.bentoTitle}>LIVE SHARE</Text>
                <Text style={styles.bentoSubtitle}>Generate position token</Text>
                <View style={styles.bentoActionPillAmber}>
                  <Text style={styles.bentoActionPillTextAmber}>BROADCAST →</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Horizontal Fast-Pills Row for Driving */}
            <View style={styles.bentoFastRow}>
              <TouchableOpacity
                style={styles.fastPill}
                onPress={() => navigation.navigate('DrivingReports')}
                activeOpacity={0.8}
              >
                <Ionicons name="speedometer-outline" size={15} color="#EF4444" />
                <Text style={styles.fastPillText}>Driving Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* STANDARD / BAUHAUS / PLAYFUL DOCK */
          <MagnificationDock items={dockItems} />
        )}

        {/* RECENT ACTIVITY CARD */}
        <View
          style={[
            styles.activityContainerBox,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
            },
          ]}
        >
          {/* Inner Header Row */}
          <View style={styles.activityBoxHeader}>
            <View style={styles.activityBoxTitleRow}>
              <View style={styles.pulseLiveDot} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? colors.foreground : '#18181B', fontSize: 11 },
                ]}
              >
                RECENT ACTIVITY
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Activity')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.seeAllText,
                  { color: themeMode === 'brand_green' ? '#3DBE6C' : '#0A84FF' },
                ]}
              >
                See All →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityBoxInnerContent}>
            {loadingActivity ? (
              <ActivityIndicator
                size="small"
                color={themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold}
                style={{ paddingVertical: 18 }}
              />
            ) : recentActivities.length > 0 ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                {recentActivities.slice(0, 3).map((item, index) => (
                  <AnimatedActivityItem key={item.id || index} index={index}>
                    <TouchableOpacity
                      style={[
                        styles.activityCard,
                        {
                          backgroundColor: isDark ? '#12141C' : '#F9FAFB',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E5E7EB',
                          borderLeftColor: item.color,
                        },
                      ]}
                      onPress={() => navigation.navigate('Activity')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.activityCardHeader}>
                        <View style={styles.activityBadgeRow}>
                          <View
                            style={[
                              styles.activityIconBox,
                              {
                                backgroundColor: `${item.color}18`,
                                borderColor: `${item.color}40`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={item.icon as any}
                              size={13}
                              color={item.color}
                            />
                          </View>
                          <Text
                            style={[
                              styles.activityBadgeText,
                              { color: item.color },
                            ]}
                          >
                            {item.badgeText}
                          </Text>
                        </View>
                        <View style={styles.activityTimePill}>
                          <Ionicons
                            name="time-outline"
                            size={11}
                            color={colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.activityTimeText,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.time}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.activityTitleText,
                          { color: colors.foreground },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  </AnimatedActivityItem>
                ))}
              </View>
            ) : (
              <View style={styles.emptyActivityBox}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={24}
                  color={colors.textMuted}
                />
                <Text
                  style={[
                    styles.emptyActivityText,
                    { color: isDark ? colors.textMuted : '#71717A' },
                  ]}
                >
                  All clear. No safety breaches or alerts recorded yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <ShareLocationModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onSuccess={() =>
          showAlert({
            title: 'Live Location Shared',
            message: 'Your live location details have been sent. Target members can view your exact position on their main map.',
            type: 'success',
            buttonText: 'POSITION BROADCASTING',
          })
        }
      />
      <FakeCallModal visible={fakeCallVisible} onClose={() => setFakeCallVisible(false)} />
      <CircleQRCodeModal
        visible={qrModalVisible}
        circle={activeCircle}
        onClose={() => setQrModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
  },
  goldLeftStripe: {
    position: 'absolute',
    left: 0,
    top: 24,
    bottom: 24,
    width: 4,
    backgroundColor: '#B48B1E',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  liveShieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 4,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveShieldText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardDateText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  shieldEmblemContainer: {
    marginBottom: 16,
  },
  outerShieldRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FAF5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerShieldBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#B48B1E',
  },
  shieldInnerPinWrap: {
    position: 'absolute',
    bottom: 12,
  },
  circleNameTitle: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  circleSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 20,
  },
  avatarRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitialText: {
    fontSize: 15,
    fontWeight: '600',
  },
  moreAvatarGoldBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B48B1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pauseTrackingBtn: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    borderWidth: 1,
    gap: 8,
  },
  pauseBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  memberStatusPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  miniStatusAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusMemberName: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
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
  metricsGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricCardBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricBigNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 11,
  },
  activityContainerBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  activityBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  activityBoxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  seeAllText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  activityBoxInnerContent: {
    width: '100%',
  },
  activityCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  activityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activityTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityTimeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activityTitleText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptyActivityBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyActivityText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Flexy UI Dual-Tone Split Cockpit Hero Styles
  flexyHeroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    shadowColor: '#3DBE6C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  flexyHeroTopBanner: {
    backgroundColor: '#3DBE6C',
    padding: 20,
    paddingBottom: 16,
  },
  flexyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  flexyLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexyBrandLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  flexyCircleTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  flexyLivePulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  flexyPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  flexyLivePulseText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  flexyAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  flexyAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flexyAvatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  flexyMoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  flexyMoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  flexyConnectedCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 6,
  },
  flexyHeroBottomPanel: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  flexyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexyShieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexyStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  flexyStatusSub: {
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
  },
  flexyActionBtn: {
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  flexyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Bento Matrix Layout Styles
  bentoContainer: {
    gap: 12,
    marginBottom: 24,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: 'space-between',
  },
  bentoCardBlue: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  bentoCardGreen: {
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
  },
  bentoCardPurple: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FFFFFF',
  },
  bentoCardAmber: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFFFF',
  },
  bentoIconCircleBlue: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoIconCircleGreen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoIconCirclePurple: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoIconCircleAmber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bentoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  bentoSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 12,
  },
  bentoActionPillBlue: {
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bentoActionPillTextBlue: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bentoActionPillGreen: {
    alignSelf: 'flex-start',
    backgroundColor: '#3DBE6C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bentoActionPillTextGreen: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bentoActionPillPurple: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bentoActionPillTextPurple: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bentoActionPillAmber: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5A623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bentoActionPillTextAmber: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bentoFastRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fastPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
});
