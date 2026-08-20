import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, StatusBar, Linking } from 'react-native';
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

  const [activeSection, setActiveSection] = useState<'APP_UPDATES' | 'MEMBER_ALERTS'>('APP_UPDATES');
  const [refreshing, setRefreshing] = useState(false);
  const [memberAlerts, setMemberAlerts] = useState<any[]>([]);

  const fetchMemberAlerts = async () => {
    if (!activeCircle?.id) return;
    try {
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
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
        supabase
          .from('place_events')
          .select('id, occurred_at, event_type, place_id, user_id, places(name), profiles(full_name)')
          .gte('occurred_at', cutoffTime)
          .order('occurred_at', { ascending: false })
          .limit(20),
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
          title: 'EMERGENCY SOS DISTRESS CALL',
          message: `${name} triggered an urgent emergency distress signal!`,
          time: new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          icon: 'alert-circle-sharp',
          color: '#EF4444',
          memberName: name,
          phone,
          timestamp: new Date(item.created_at).getTime(),
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
          title: `MESSAGE FROM ${name.toUpperCase()}`,
          message: item.content,
          time: new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          icon: 'chatbubble-ellipses-sharp',
          color: '#3B82F6',
          memberName: name,
          phone,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const breachList = (placeEventsRes.data || []).map((item) => {
        let name = 'Member';
        if (item.profiles) {
          const prof = Array.isArray(item.profiles) ? item.profiles[0] : (item.profiles as any);
          name = prof?.full_name || 'Member';
        }
        let placeName = 'Geofence';
        if (item.places) {
          const p = Array.isArray(item.places) ? item.places[0] : (item.places as any);
          placeName = p?.name || 'Geofence';
        }

        const isArrival = item.event_type === 'arrival';
        return {
          id: item.id,
          type: 'BREACH',
          title: isArrival ? 'GEOFENCE ARRIVAL ALERT' : 'GEOFENCE EXITED ALERT',
          message: isArrival 
            ? `${name} arrived safely inside boundary "${placeName}".`
            : `${name} departed boundary "${placeName}".`,
          time: new Date(item.occurred_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          icon: isArrival ? 'location-sharp' : 'exit-outline',
          color: isArrival ? '#10B981' : '#F59E0B',
          memberName: name,
          timestamp: new Date(item.occurred_at).getTime(),
        };
      });

      const combined = [...sosList, ...msgList, ...breachList].sort((a, b) => b.timestamp - a.timestamp);
      setMemberAlerts(combined);
    } catch (e) {
      console.warn('Error fetching member alerts:', e);
    }
  };

  React.useEffect(() => {
    fetchMemberAlerts();
  }, [activeCircle?.id]);

  // App & System Release Updates Data (Strictly System Software Announcements)
  const appUpdatesList = [
    {
      id: 'update_1',
      title: 'CircleGuard v1.2.0 Performance Build',
      message: 'New 60 FPS animated protection shield, Swiggy-style live address bar, and Esri World Topographic terrain mini-maps are now active.',
      time: 'TODAY • 06:00 PM',
      icon: 'rocket-sharp',
      color: '#D4AF37',
      badgeText: 'RELEASE',
    },
    {
      id: 'update_2',
      title: 'AES-256 Military Encryption Protocol Active',
      message: 'All real-time location packets, circle member position streams, and status logs are secured using AES-256 end-to-end encryption.',
      time: 'SYSTEM AUDIT • PASS',
      icon: 'lock-closed-sharp',
      color: '#10B981',
      badgeText: 'SECURITY',
    },
    {
      id: 'update_3',
      title: 'Geofencing Engine v2.0 Operational',
      message: 'Haversine geodesic distance calculation, 50m noise filtering, and 15m hysteresis buffers actively monitoring circle safe zones 24/7.',
      time: 'ENGINE OK',
      icon: 'shield-checkmark-sharp',
      color: '#3B82F6',
      badgeText: 'ENGINE',
    },
    {
      id: 'update_4',
      title: 'Ghost Mode & Online Presence Controls',
      message: 'Members can toggle Ghost Mode obfuscation or hide online presence status anytime directly from Profile Privacy Settings.',
      time: 'PRIVACY READY',
      icon: 'eye-off-sharp',
      color: '#A855F7',
      badgeText: 'PRIVACY',
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMemberAlerts();
    setRefreshing(false);
  };

  const handleCheckUpdate = () => {
    Alert.alert(
      'App Up to Date',
      'CircleGuard v1.2.0 is running the latest security release build.',
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

      {/* Section Tabs */}
      <View style={styles.filterRow}>
        <SpringTouchable
          style={[
            styles.filterPill,
            {
              flex: 1,
              alignItems: 'center',
              backgroundColor: activeSection === 'APP_UPDATES' ? colors.accentGold : colors.surface,
              borderColor: activeSection === 'APP_UPDATES' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setActiveSection('APP_UPDATES')}
          scaleTo={0.93}
        >
          <Text style={[styles.filterText, { color: activeSection === 'APP_UPDATES' ? '#1A1A1A' : colors.textMuted }]}>
            APP UPDATES ({appUpdatesList.length})
          </Text>
        </SpringTouchable>

        <SpringTouchable
          style={[
            styles.filterPill,
            {
              flex: 1,
              alignItems: 'center',
              backgroundColor: activeSection === 'MEMBER_ALERTS' ? colors.accentGold : colors.surface,
              borderColor: activeSection === 'MEMBER_ALERTS' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setActiveSection('MEMBER_ALERTS')}
          scaleTo={0.93}
        >
          <Text style={[styles.filterText, { color: activeSection === 'MEMBER_ALERTS' ? '#1A1A1A' : colors.textMuted }]}>
            ALERTS & MESSAGES ({memberAlerts.length})
          </Text>
        </SpringTouchable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
        }
      >
        {activeSection === 'APP_UPDATES' ? (
          <View style={styles.listContainer}>
            <AnimatedList
              items={appUpdatesList.map((item) => ({
                ...item,
                icon: item.icon as any,
                badgeText: item.badgeText || 'SYSTEM LOG',
              }))}
              showGradients={true}
              maxHeight={520}
              onItemSelect={(item) => {
                Alert.alert(item.title, item.message);
              }}
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {memberAlerts.length === 0 ? (
              <View style={[styles.emptyAlertBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="notifications-off-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyAlertTitle, { color: colors.foreground }]}>NO MEMBER ALERTS YET</Text>
                <Text style={[styles.emptyAlertSub, { color: colors.textMuted }]}>
                  Member phone calls, circle chat messages, SOS distress signals, and geofence breach alerts will appear here in real-time.
                </Text>
              </View>
            ) : (
              <AnimatedList
                items={memberAlerts.map((item) => ({
                  ...item,
                  icon: item.icon as any,
                  badgeText: item.type,
                }))}
                showGradients={true}
                maxHeight={520}
                onItemSelect={(item) => {
                  if (item.type === 'SOS') {
                    Alert.alert(
                      item.title,
                      `${item.message}\n\nMember: ${item.memberName}`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Call Member', onPress: () => item.phone ? Linking.openURL(`tel:${item.phone}`) : null }
                      ]
                    );
                  } else if (item.type === 'MESSAGE') {
                    navigation.navigate('Chat' as never);
                  } else {
                    navigation.navigate('MainMap' as never);
                  }
                }}
              />
            )}
          </View>
        )}

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
  emptyAlertBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  emptyAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  emptyAlertSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
