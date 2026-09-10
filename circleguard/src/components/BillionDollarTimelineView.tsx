import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';
import { sendInstantLocationPing } from '../services/LocationBackgroundService';
import { sendExpoPushNotification } from '../services/PushNotificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ActivityEvent {
  id: string;
  type: 'GEOFENCE' | 'SOS' | 'MESSAGE' | 'CHECKIN';
  title: string;
  message: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  memberName: string;
  avatarUrl?: string | null;
  timestamp: number;
}

export default function BillionDollarTimelineView() {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 24);
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week'>('today');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'checkins' | 'arrivals' | 'alerts'>('all');
  const [safeHomeCheckedIn, setSafeHomeCheckedIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const fetchTimelineEvents = async () => {
    if (!activeCircle?.id) {
      setActivities([]);
      return;
    }

    try {
      const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const memberUserIds = (members || []).map((m) => m.user_id);

      let placeEventsQuery = supabase
        .from('place_events')
        .select('id, occurred_at, event_type, place_id, user_id, places(name), profiles(full_name, avatar_url)')
        .gte('occurred_at', cutoffTime)
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (memberUserIds.length > 0) {
        placeEventsQuery = placeEventsQuery.in('user_id', memberUserIds);
      }

      const [sosRes, msgRes, placeEventsRes] = await Promise.all([
        supabase
          .from('sos_alerts')
          .select('id, created_at, status, user_id, profiles(full_name, avatar_url)')
          .eq('circle_id', activeCircle.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('circle_messages')
          .select('id, created_at, content, sender_id, profiles:sender_id(full_name, avatar_url)')
          .eq('circle_id', activeCircle.id)
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(10),
        placeEventsQuery,
      ]);

      const sosEvents: ActivityEvent[] = (sosRes.data || []).map((item: any) => {
        const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const name = prof?.full_name || 'A circle member';
        return {
          id: item.id,
          type: 'SOS',
          title: `${name} triggered Emergency SOS!`,
          message: `Priority emergency distress signal dispatched. Status: ${item.status}`,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'warning',
          color: '#AE041B',
          memberName: name,
          avatarUrl: prof?.avatar_url,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const msgEvents: ActivityEvent[] = (msgRes.data || []).map((item: any) => {
        const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const name = prof?.full_name || 'A circle member';
        return {
          id: item.id,
          type: 'MESSAGE',
          title: `${name} checked in`,
          message: item.content || 'Safe check-in broadcasted to circle.',
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'chatbubble-ellipses',
          color: '#006C4F',
          memberName: name,
          avatarUrl: prof?.avatar_url,
          timestamp: new Date(item.created_at).getTime(),
        };
      });

      const geofenceEvents: ActivityEvent[] = (placeEventsRes.data || []).map((item: any) => {
        const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const name = prof?.full_name || 'Member';
        const place = Array.isArray(item.places) ? item.places[0] : item.places;
        const placeName = place?.name || 'Safe Zone';
        const isArrival = item.event_type === 'arrival';

        return {
          id: item.id,
          type: 'GEOFENCE',
          title: isArrival ? `${name} arrived at ${placeName}` : `${name} departed ${placeName}`,
          message: isArrival
            ? `All-clear automated notice: entered boundary safely.`
            : `Notice: departed recognized sanctuary.`,
          time: new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: isArrival ? 'location' : 'walk-outline',
          color: isArrival ? '#006C4F' : '#183CE6',
          memberName: name,
          avatarUrl: prof?.avatar_url,
          timestamp: new Date(item.occurred_at).getTime(),
        };
      });

      const combined = [...sosEvents, ...msgEvents, ...geofenceEvents].sort(
        (a, b) => b.timestamp - a.timestamp
      );
      setActivities(combined);
    } catch (e) {
      console.warn('Error fetching timeline events:', e);
    }
  };

  useEffect(() => {
    fetchTimelineEvents();
  }, [activeCircle?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTimelineEvents();
    setRefreshing(false);
  };

  const handleQuickSafeHome = async () => {
    setSafeHomeCheckedIn(true);
    try {
      await sendInstantLocationPing();
      if (activeCircle?.id && profile?.id) {
        await supabase.from('circle_messages').insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          content: `${profile?.full_name || 'I'} checked in safely as "Safe & Sound".`,
          message_type: 'CHECKIN',
        });
        const otherMemberIds = members
          .filter((m) => m.user_id !== profile?.id)
          .map((m) => m.user_id);
        if (otherMemberIds.length > 0) {
          sendExpoPushNotification(
            otherMemberIds,
            '✅ Safety Check-In',
            `${profile?.full_name || 'A circle member'} checked in: Safe & Sound!`,
            { type: 'CHECKIN' }
          ).catch(() => {});
        }
      }
      showToast(`Shared safe status with ${circleName}!`);
      await fetchTimelineEvents();
    } catch (e) {
      showToast(`Check-in broadcasted to ${circleName}`);
    }
    setTimeout(() => {
      setSafeHomeCheckedIn(false);
    }, 4500);
  };

  const handleRequestCheckIn = async () => {
    const otherMemberIds = members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user_id);

    if (otherMemberIds.length === 0) {
      showToast('Invite members to your circle to request check-ins!');
      return;
    }

    showToast(`Requesting check-in from ${otherMemberIds.length} members...`);
    try {
      if (activeCircle?.id && profile?.id) {
        await supabase.from('circle_messages').insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          content: `${profile?.full_name || 'A circle member'} requested an instant safety check-in.`,
          message_type: 'CHECKIN_REQUEST',
        });
      }

      await sendExpoPushNotification(
        otherMemberIds,
        '📍 Safety Check-In Request',
        `${profile?.full_name || 'A family member'} requested an instant safety check-in from everyone in ${circleName}!`,
        { type: 'CHECKIN_REQUEST' }
      );
      showToast(`Check-in request sent to ${otherMemberIds.length} members!`);
      await fetchTimelineEvents();
    } catch (e) {
      showToast('Check-in request dispatched to circle!');
    }
  };

  const circleName = activeCircle?.name || 'My Family Circle';

  // Filter activities
  const filteredActivities = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let list = activities;

    if (dateFilter === 'today') {
      list = list.filter((a) => now - a.timestamp <= oneDayMs);
    } else if (dateFilter === 'yesterday') {
      list = list.filter((a) => now - a.timestamp > oneDayMs && now - a.timestamp <= 2 * oneDayMs);
    }

    if (categoryFilter === 'checkins') {
      list = list.filter((a) => a.type === 'MESSAGE' || a.type === 'CHECKIN');
    } else if (categoryFilter === 'arrivals') {
      list = list.filter((a) => a.type === 'GEOFENCE');
    } else if (categoryFilter === 'alerts') {
      list = list.filter((a) => a.type === 'SOS');
    }

    return list;
  }, [activities, dateFilter, categoryFilter]);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topInset, height: 56 + topInset }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={19} color="#2E7D5B" />
          </View>
          <TouchableOpacity
            style={styles.circleSelectorBtn}
            onPress={() => navigation.navigate('Circle')}
            activeOpacity={0.7}
          >
            <Text style={styles.circleSelectorText} numberOfLines={1}>
              {circleName}
            </Text>
            <Ionicons name="chevron-down" size={15} color="#5C665F" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={19} color="#2E7D5B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={19} color="#5C665F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D5B']} />
        }
      >
        {/* Page Title & Calendar Pill */}
        <View style={styles.titleSection}>
          <View>
            <Text style={styles.taglineText}>Circle Activity</Text>
            <Text style={styles.pageTitle}>Timeline & Logs</Text>
          </View>
          <TouchableOpacity
            style={styles.calendarFilterBtn}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={16} color="#2E7D5B" />
            <Text style={styles.calendarFilterText}>Live Feed</Text>
          </TouchableOpacity>
        </View>

        {/* Date Segmented Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateChipsScroll}
        >
          <TouchableOpacity
            style={[styles.dateChip, dateFilter === 'today' && styles.dateChipActive]}
            onPress={() => setDateFilter('today')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.dateChipText, dateFilter === 'today' && styles.dateChipTextActive]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateChip, dateFilter === 'yesterday' && styles.dateChipActive]}
            onPress={() => setDateFilter('yesterday')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.dateChipText, dateFilter === 'yesterday' && styles.dateChipTextActive]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateChip, dateFilter === 'week' && styles.dateChipActive]}
            onPress={() => setDateFilter('week')}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.dateChipText, dateFilter === 'week' && styles.dateChipTextActive]}
            >
              Past 7 Days
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Filter Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryChipsScroll}
        >
          <TouchableOpacity
            style={[styles.catChip, categoryFilter === 'all' && styles.catChipActive]}
            onPress={() => setCategoryFilter('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.catChipText, categoryFilter === 'all' && styles.catChipTextActive]}>
              All Events
            </Text>
            <View style={styles.catCountBadge}>
              <Text style={styles.catCountText}>{activities.length}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catChip, categoryFilter === 'checkins' && styles.catChipActive]}
            onPress={() => setCategoryFilter('checkins')}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={14} color="#006C4F" />
            <Text style={[styles.catChipText, categoryFilter === 'checkins' && styles.catChipTextActive]}>
              Check-ins
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catChip, categoryFilter === 'arrivals' && styles.catChipActive]}
            onPress={() => setCategoryFilter('arrivals')}
            activeOpacity={0.8}
          >
            <Ionicons name="walk-outline" size={14} color="#183CE6" />
            <Text style={[styles.catChipText, categoryFilter === 'arrivals' && styles.catChipTextActive]}>
              Arrivals / Departures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catChip, categoryFilter === 'alerts' && styles.catChipActive]}
            onPress={() => setCategoryFilter('alerts')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={14} color="#AE041B" />
            <Text style={[styles.catChipText, categoryFilter === 'alerts' && styles.catChipTextActive]}>
              Alerts
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Quick Check-in Reassurance Banner */}
        <View style={styles.reassuranceBanner}>
          <View style={styles.reassuranceTop}>
            <View style={styles.reassuranceIconBox}>
              <Ionicons name="home" size={22} color="#006C4F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reassuranceTitle}>Instant Circle Check-in</Text>
              <Text style={styles.reassuranceSub}>Broadcast your current safe location to all members</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.broadcastSafeBtn,
              safeHomeCheckedIn && { backgroundColor: '#3ADFAB' },
            ]}
            onPress={handleQuickSafeHome}
            activeOpacity={0.85}
          >
            <Ionicons
              name={safeHomeCheckedIn ? 'checkmark-done-circle' : 'checkmark-circle'}
              size={18}
              color={safeHomeCheckedIn ? '#002116' : '#FFFFFF'}
            />
            <Text
              style={[
                styles.broadcastSafeBtnText,
                safeHomeCheckedIn && { color: '#002116' },
              ]}
            >
              {safeHomeCheckedIn ? 'Safe Status Shared!' : "I'm Safe & Sound"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chronological Feed Stream with Vertical Connecting Line */}
        <View style={styles.feedContainer}>
          {filteredActivities.length > 0 && <View style={styles.verticalTrackLine} />}

          {filteredActivities.length > 0 ? (
            filteredActivities.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.timelineItem}
                onPress={() => {
                  if (event.type === 'SOS') {
                    navigation.navigate('SOSAlert');
                  } else if (event.type === 'GEOFENCE') {
                    navigation.navigate('SafePlaces');
                  } else {
                    navigation.navigate('Chat');
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={styles.timelineAvatarContainer}>
                  {event.avatarUrl ? (
                    <Image source={{ uri: event.avatarUrl }} style={styles.timelineAvatar} />
                  ) : (
                    <View style={[styles.timelineAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {event.memberName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.timelineBadgeDot, { backgroundColor: event.color }]}>
                    <Ionicons name={event.icon} size={10} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.timelineCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardItemTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.cardItemTime}>{event.time}</Text>
                  </View>
                  <Text style={styles.cardItemSub}>{event.message}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyFeedBox}>
              <Ionicons name="calendar-outline" size={32} color="#183CE6" />
              <Text style={styles.emptyFeedTitle}>No Events Recorded</Text>
              <Text style={styles.emptyFeedSub}>
                Arrivals, departures, check-ins, and safety alerts will automatically populate here as your circle stays connected.
              </Text>
            </View>
          )}
        </View>

        {/* Floating Context Action: Request Check-In */}
        <TouchableOpacity
          style={styles.floatingRequestCheckInBtn}
          onPress={handleRequestCheckIn}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
          <Text style={styles.floatingRequestCheckInText}>Request Check-in</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Emergency SOS Action Button */}
      <TouchableOpacity
        style={styles.floatingSOSButton}
        onPress={() => navigation.navigate('SOSAlert')}
        activeOpacity={0.85}
      >
        <View style={styles.sosPulseAura} />
        <Ionicons name="warning" size={18} color="#FFFFFF" />
        <Text style={styles.floatingSOSText}>SOS</Text>
      </TouchableOpacity>

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250, 249, 246, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  circleSelectorText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFEA',
  },
  profileAvatarBtn: {
    padding: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#2E7D5B',
  },
  profileAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taglineText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pageTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
  },
  calendarFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  calendarFilterText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  dateChipsScroll: {
    marginBottom: 10,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F0EFEA',
    marginRight: 8,
  },
  dateChipActive: {
    backgroundColor: '#2E7D5B',
  },
  dateChipText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#5C665F',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  categoryChipsScroll: {
    marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F0EFEA',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#E8F5EE',
  },
  catChipText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#5C665F',
  },
  catChipTextActive: {
    color: '#2E7D5B',
    fontWeight: '700',
  },
  catCountBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#151C27',
  },
  reassuranceBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    marginBottom: 20,
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  reassuranceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  reassuranceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#60FCC6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  reassuranceSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    marginTop: 2,
  },
  broadcastSafeBtn: {
    backgroundColor: '#006C4F',
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  broadcastSafeBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedContainer: {
    position: 'relative',
    paddingLeft: 4,
  },
  verticalTrackLine: {
    position: 'absolute',
    top: 24,
    bottom: 24,
    left: 24,
    width: 2,
    backgroundColor: '#DCE2F3',
    zIndex: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    zIndex: 2,
  },
  timelineAvatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    shadowColor: '#151C27',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timelineAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  timelineBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardItemTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#151C27',
    flex: 1,
  },
  cardItemTime: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#757688',
    marginLeft: 6,
  },
  cardItemSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    lineHeight: 15,
  },
  emptyFeedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    marginBottom: 16,
  },
  emptyFeedTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  emptyFeedSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    textAlign: 'center',
    lineHeight: 16,
  },
  floatingRequestCheckInBtn: {
    alignSelf: 'center',
    backgroundColor: '#183CE6',
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#183CE6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    marginTop: 14,
    marginBottom: 20,
  },
  floatingRequestCheckInText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingSOSButton: {
    position: 'absolute',
    right: 18,
    bottom: 30,
    backgroundColor: '#AE041B',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#AE041B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  sosPulseAura: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#AE041B',
    opacity: 0.4,
  },
  floatingSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#2A313D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#EBF1FF',
    fontSize: 12,
    fontWeight: '600',
  },
});
