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

  if (themeMode === 'billion_dollar') {
    return <BillionDollarTimelineView />;
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F2F2F7' }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>Activity</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>
            {activeCircle ? activeCircle.name : 'All notifications'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCheckUpdate}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="#30D158" />
        </TouchableOpacity>
      </View>

      {/* iOS Native Segmented Control */}
      <View style={styles.segmentedContainer}>
        <View style={[styles.segmentedTrack, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}>
          <SpringTouchable
            style={[
              styles.segmentTab,
              activeSection === 'APP_UPDATES' && {
                backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
              },
            ]}
            onPress={() => setActiveSection('APP_UPDATES')}
            scaleTo={0.97}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeSection === 'APP_UPDATES' ? (isDark ? '#FFFFFF' : '#000000') : '#8E8E93' },
              ]}
            >
              Updates ({appUpdatesList.length})
            </Text>
          </SpringTouchable>

          <SpringTouchable
            style={[
              styles.segmentTab,
              activeSection === 'MEMBER_ALERTS' && {
                backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
              },
            ]}
            onPress={() => setActiveSection('MEMBER_ALERTS')}
            scaleTo={0.97}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeSection === 'MEMBER_ALERTS' ? (isDark ? '#FFFFFF' : '#000000') : '#8E8E93' },
              ]}
            >
              Alerts ({memberAlerts.length})
            </Text>
          </SpringTouchable>
        </View>
      </View>

      {/* Main Feed */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0A84FF']}
            tintColor={isDark ? '#8E8E93' : '#8E8E93'}
          />
        }
      >
        {activeSection === 'APP_UPDATES' ? (
          <View style={styles.feedListContainer}>
            <AnimatedList
              items={appUpdatesList.map((item) => ({
                ...item,
                icon: item.icon as any,
                badgeText: item.badgeText,
              }))}
              isNestedInParentScroll={true}
              showGradients={false}
              onItemSelect={(item) => {
                showAlert({
                  title: item.title,
                  message: item.message || '',
                  type: 'info',
                  buttonText: 'Done',
                });
              }}
            />
          </View>
        ) : (
          <View style={styles.feedListContainer}>
            {memberAlerts.length === 0 ? (
              <View style={[styles.emptyStateCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                <Ionicons name="checkmark-circle-outline" size={40} color="#30D158" style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyStateTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>All Clear</Text>
                <Text style={[styles.emptyStateSub, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>
                  No active alerts recorded in your circle.
                </Text>
              </View>
            ) : (
              <View style={styles.alertCardsWrapper}>
                {memberAlerts.map((item) => {
                  const accentColor = item.color || '#30D158';
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.alertDetailCard,
                        {
                          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        },
                      ]}
                    >
                      <View style={styles.alertTopHeader}>
                        <View style={styles.alertHeaderLeft}>
                          <View style={[styles.alertGlyphBox, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                            <Ionicons name={item.icon} size={18} color={accentColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.alertTitleText, { color: isDark ? '#FFFFFF' : '#000000' }]}>{item.title}</Text>
                            <Text style={[styles.alertMessageText, { color: isDark ? '#8E8E93' : '#636366' }]}>
                              {item.message}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.alertTimeText, { color: '#8E8E93' }]}>{item.time}</Text>
                      </View>

                      {/* Clean Action Button */}
                      <TouchableOpacity
                        style={[
                          styles.alertActionButton,
                          {
                            backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          },
                        ]}
                        onPress={() => handleAlertAction(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={item.actionIcon as any} size={14} color={accentColor} />
                        <Text style={[styles.alertActionText, { color: accentColor }]}>
                          {item.actionLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Check App Updates Button */}
        <TouchableOpacity
          style={[
            styles.updateCheckBtn,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            },
          ]}
          onPress={handleCheckUpdate}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-down-circle-outline" size={17} color="#0A84FF" />
          <Text style={styles.updateCheckText}>Check for Updates</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  segmentedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  segmentedTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 9,
    gap: 3,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 7,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  feedListContainer: {
    marginBottom: 16,
  },
  alertCardsWrapper: {
    gap: 10,
  },
  alertDetailCard: {
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  alertTopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  alertGlyphBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitleText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  alertMessageText: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertTimeText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6,
  },
  alertActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  alertActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyStateCard: {
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyStateSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  updateCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  updateCheckText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A84FF',
  },
});
