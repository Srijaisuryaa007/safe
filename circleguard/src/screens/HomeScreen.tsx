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
  registerNativeGeofencesAsync,
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
      const filtered = places.filter(p => p && p.circle_id === activeCircle.id);
      setCirclePlaces(filtered);
      if (filtered.length > 0) {
        registerNativeGeofencesAsync(filtered);
      }
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
        if (data && data.length > 0) {
          registerNativeGeofencesAsync(data);
        }
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

  // Modern unified interface for both Light and Dark mode
  return <BillionDollarHomeView />;

}

const styles = StyleSheet.create({});
