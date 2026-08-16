import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';
import AnimatedList from '../components/AnimatedList';
import SpringTouchable from '../components/SpringTouchable';

export default function ActivityScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation();
  const { activeCircle } = useCircleStore();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44);

  const [filter, setFilter] = useState<'ALL' | 'UPDATES' | 'SYSTEM'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);

  const fetchLiveActivities = async () => {
    if (!activeCircle?.id) return;
    try {
      const [sosRes, msgRes] = await Promise.all([
        supabase
          .from('sos_alerts')
          .select('id, created_at, status, user_id, profiles(full_name)')
          .eq('circle_id', activeCircle.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('circle_messages')
          .select('id, created_at, content, sender_id, profiles:sender_id(full_name)')
          .eq('circle_id', activeCircle.id)
          .or('content.ilike.%PERMISSION REQUEST%,content.ilike.%PERMISSION GRANTED%,content.ilike.%PERMISSION DENIED%')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const sosList = (sosRes.data || []).map((item) => {
        let name = 'A member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        return {
          id: item.id,
          category: 'SYSTEM',
          title: '🚨 Emergency SOS Dispatch',
          message: `${name || 'Member'} triggered an emergency distress signal!`,
          time: new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          icon: 'alert-circle',
          color: '#EF4444',
          isNew: true,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const msgList = (msgRes.data || []).map((item) => {
        let name = 'Member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        let title = 'Privacy Permission Log';
        let color = '#F59E0B';
        let icon = 'key-outline';

        if (item.content.includes('GRANTED')) {
          color = '#10B981';
          icon = 'checkmark-circle-outline';
          title = '👑 Privacy Request Approved';
        } else if (item.content.includes('DENIED')) {
          color = '#EF4444';
          icon = 'close-circle-outline';
          title = '❌ Privacy Request Denied';
        } else if (item.content.includes('REQUEST')) {
          color = '#F59E0B';
          icon = 'shield-half-outline';
          title = `🔒 Ghost Mode Request: ${name}`;
        }

        return {
          id: item.id,
          category: 'UPDATES',
          title: title,
          message: item.content,
          time: new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          icon: icon,
          color: color,
          isNew: true,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const combined = [...msgList, ...sosList].sort((a, b) => b.timestamp - a.timestamp);
      setLiveActivities(combined);
    } catch (e) {
      console.warn('Error fetching live activities:', e);
    }
  };

  React.useEffect(() => {
    fetchLiveActivities();
  }, [activeCircle?.id]);

  // App & System Announcement Notifications Data
  const appNotifications = [
    {
      id: 'system_1',
      category: 'UPDATES',
      title: 'CircleGuard v1.2 Performance Build',
      message: 'New 60 FPS animated protection shield, Swiggy-style live address bar, and Option A (Privacy-First) vs Option B (Continuous 24/7) circle tracking modes are now active.',
      time: 'TODAY • 06:00 PM',
      icon: 'rocket-outline',
      color: '#D4AF37',
      isNew: false,
    },
  ];

  const allEvents = [...liveActivities, ...appNotifications];

  const filteredList = allEvents.filter(
    item => filter === 'ALL' || item.category === filter
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveActivities();
    setRefreshing(false);
  };

  const handleCheckUpdate = () => {
    Alert.alert(
      'App Up to Date',
      'CircleGuard v1.2.0 is currently running the latest security build with 100% active protection.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topInset + 16, paddingBottom: 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>App Notifications</Text>
        <TouchableOpacity onPress={handleCheckUpdate} activeOpacity={0.8}>
          <Ionicons name="sparkles-outline" size={22} color={colors.accentGold} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <SpringTouchable
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'ALL' ? colors.accentGold : colors.surface,
              borderColor: filter === 'ALL' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('ALL')}
          scaleTo={0.93}
        >
          <Text style={[styles.filterText, { color: filter === 'ALL' ? '#1A1A1A' : colors.textMuted }]}>
            ALL NOTIFICATIONS
          </Text>
        </SpringTouchable>

        <SpringTouchable
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'UPDATES' ? colors.accentGold : colors.surface,
              borderColor: filter === 'UPDATES' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('UPDATES')}
          scaleTo={0.93}
        >
          <Text style={[styles.filterText, { color: filter === 'UPDATES' ? '#1A1A1A' : colors.textMuted }]}>
            APP UPDATES
          </Text>
        </SpringTouchable>

        <SpringTouchable
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'SYSTEM' ? colors.accentGold : colors.surface,
              borderColor: filter === 'SYSTEM' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('SYSTEM')}
          scaleTo={0.93}
        >
          <Text style={[styles.filterText, { color: filter === 'SYSTEM' ? '#1A1A1A' : colors.textMuted }]}>
            SYSTEM
          </Text>
        </SpringTouchable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
        }
      >
        <View style={styles.listContainer}>
          <AnimatedList
            items={filteredList.map((item) => ({
              ...item,
              badgeText: item.badgeText || (item.isNew ? 'LIVE ⚡' : 'ACTIVITY LOG'),
            }))}
            showGradients={true}
            maxHeight={520}
            onItemSelect={(item) => {
              Alert.alert(item.title, item.message || 'Notification details recorded in activity log.');
            }}
          />
        </View>

        {/* Check Update Button */}
        <TouchableOpacity
          style={[styles.updateCheckBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleCheckUpdate}
        >
          <Ionicons name="cloud-download-outline" size={18} color={colors.accentGold} />
          <Text style={[styles.updateCheckText, { color: colors.foreground }]}>CHECK FOR LATEST APP UPDATES</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  content: {
    padding: 16,
  },
  listContainer: {
    gap: 12,
    marginBottom: 20,
  },
  notifCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  timePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMsg: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  cardTime: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  updateCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  updateCheckText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
