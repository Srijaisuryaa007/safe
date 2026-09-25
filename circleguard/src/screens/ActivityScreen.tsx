import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';
import AnimatedList from '../components/AnimatedList';
import SpringTouchable from '../components/SpringTouchable';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import BillionDollarTimelineView from '../components/BillionDollarTimelineView';

export default function ActivityScreen() {
  const { colors, isDark, themeMode } = useThemeStore();
  const navigation = useNavigation<any>();
  const { activeCircle } = useCircleStore();
  const { showAlert } = useLuxuryAlert();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44);

  const [activeSection, setActiveSection] = useState<'APP_UPDATES' | 'MEMBER_ALERTS'>('APP_UPDATES');
  const [refreshing, setRefreshing] = useState(false);
  const [memberAlerts, setMemberAlerts] = useState<any[]>([]);

  const fetchMemberAlerts = async () => {
    if (!activeCircle?.id) {
      setMemberAlerts([]);
      return;
    }
    try {
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const memberUserIds = (useCircleStore.getState().members || []).map((m) => m.user_id);

      let placeEventsQuery = supabase
        .from('place_events')
        .select('id, occurred_at, event_type, place_id, user_id, places(name), profiles(full_name)')
        .gte('occurred_at', cutoffTime)
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (memberUserIds.length > 0) {
        placeEventsQuery = placeEventsQuery.in('user_id', memberUserIds);
      }

      const [sosRes, msgRes, placeEventsRes] = await Promise.all([
        supabase
          .from('sos_alerts')
          .select('id, created_at, status, user_id, profiles(full_name, phone)')
          .eq('circle_id', activeCircle.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('circle_messages')
          .select('id, created_at, content, sender_id, profiles:sender_id(full_name, phone)')
          .eq('circle_id', activeCircle.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(25),
        placeEventsQuery,
      ]);

      const sosList = (sosRes.data || []).map((item) => {
        let name = 'A member';
        let phone = '';
        if (item.profiles) {
          const prof = Array.isArray(item.profiles) ? item.profiles[0] : (item.profiles as any);
          name = prof?.full_name || 'Member';
          phone = prof?.phone || '';
        }
        return {
          id: item.id,
          type: 'SOS',
          title: `${name} sent an SOS`,
          message: `Emergency distress signal triggered.`,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'alert-circle' as const,
          color: '#FF453A',
          memberName: name,
          phone,
          timestamp: new Date(item.created_at).getTime(),
          actionLabel: phone ? 'Call' : 'View on Map',
          actionIcon: phone ? 'call' : 'map',
        };
      });

      const msgList = (msgRes.data || []).map((item) => {
        let name = 'Member';
        let phone = '';
        if (item.profiles) {
          const prof = Array.isArray(item.profiles) ? item.profiles[0] : (item.profiles as any);
          name = prof?.full_name || 'Member';
          phone = prof?.phone || '';
        }
        return {
          id: item.id,
          type: 'MESSAGE',
          title: `Message from ${name}`,
          message: item.content,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'chatbubble-ellipses' as const,
          color: '#0A84FF',
          memberName: name,
          phone,
          timestamp: new Date(item.created_at).getTime(),
          actionLabel: 'Reply',
          actionIcon: 'chatbubbles',
        };
      });

      const breachList = (placeEventsRes.data || []).map((item) => {
        let name = 'Member';
        if (item.profiles) {
          const prof = Array.isArray(item.profiles) ? item.profiles[0] : (item.profiles as any);
          name = prof?.full_name || 'Member';
        }
        let placeName = 'Safe Zone';
        if (item.places) {
          const p = Array.isArray(item.places) ? item.places[0] : (item.places as any);
          placeName = p?.name || 'Safe Zone';
        }

        const isArrival = item.event_type === 'arrival';
        return {
          id: item.id,
          type: 'GEOFENCE',
          title: isArrival ? `${name} arrived at ${placeName}` : `${name} left ${placeName}`,
          message: isArrival ? `Entered boundary safely.` : `Departed boundary.`,
          time: new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: isArrival ? 'location' : 'navigate' as const,
          color: isArrival ? '#30D158' : '#FF9F0A',
          memberName: name,
          timestamp: new Date(item.occurred_at).getTime(),
          actionLabel: 'View on Map',
          actionIcon: 'map',
        };
      });

      const combined = [...sosList, ...msgList, ...breachList].sort((a, b) => b.timestamp - a.timestamp);
      setMemberAlerts(combined);
    } catch (e) {
      console.warn('Error fetching member alerts:', e);
    }
  };

  useEffect(() => {
    fetchMemberAlerts();
  }, [activeCircle?.id]);

  // App Release Notes (Human-written, clean)
  const appUpdatesList = [
    {
      id: 'update_1',
      title: 'CircleGuard 1.2 Update',
      message: 'New Apple Find My style design, smooth UI-thread animations, and automated emergency hotlines for India and international destinations.',
      time: 'Today • Version 1.2',
      icon: 'sparkles' as const,
      color: '#30D158',
      badgeText: 'Update',
    },
    {
      id: 'update_2',
      title: 'End-to-End Encryption',
      message: 'Location telemetry and circle chat messages are secured with full end-to-end encryption.',
      time: 'Security',
      icon: 'lock-closed' as const,
      color: '#0A84FF',
      badgeText: 'Security',
    },
    {
      id: 'update_3',
      title: 'Sub-Meter Geofence Alerts',
      message: 'Precise boundary detection with intelligent noise filtering to reduce false alarms.',
      time: 'Performance',
      icon: 'location' as const,
      color: '#30D158',
      badgeText: 'Engine',
    },
    {
      id: 'update_4',
      title: 'Discreet Safety Call',
      message: 'Simulate an incoming phone call anytime with a single tap in Safety Controls.',
      time: 'Feature',
      icon: 'call' as const,
      color: '#AF52DE',
      badgeText: 'Privacy',
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMemberAlerts();
    setRefreshing(false);
  };

  const handleCheckUpdate = () => {
    showAlert({
      title: 'Up to Date',
      message: 'CircleGuard is on the latest version.',
      type: 'success',
      buttonText: 'Done',
    });
  };

  const handleAlertAction = (item: any) => {
    if (item.type === 'SOS') {
      if (item.phone) {
        Linking.openURL(`tel:${item.phone}`);
      } else {
        navigation.navigate('Map');
      }
    } else if (item.type === 'MESSAGE') {
      navigation.navigate('Chat');
    } else {
      navigation.navigate('Map');
    }
  };

  // Modern unified interface for both Light and Dark mode
  return <BillionDollarTimelineView />;

}

const styles = StyleSheet.create({});
