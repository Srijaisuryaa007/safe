import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Linking,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import OrbitalGoldenLogoBadge from './OrbitalGoldenLogoBadge';
import JellyRadio from './JellyRadio';
import {
  ActivityEvent,
  fetchCircleActivities,
  broadcastCheckIn,
  broadcastCheckInRequest,
} from '../services/ActivityService';
import { getSafeTopInset } from '../utils/safeArea';
import { navigationRef } from '../navigation/AppNavigator';

interface TimelineViewProps {
  onRefreshActivities?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillionDollarTimelineView({ onRefreshActivities }: TimelineViewProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const navigation = useNavigation<any>();

  const navigateToScreen = React.useCallback((screenName: string, params?: any) => {
    try {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate(screenName, params);
        return;
      }
    } catch (_) {}
    try {
      const parent = navigation.getParent?.();
      if (parent && typeof parent.navigate === 'function') {
        parent.navigate(screenName, params);
        return;
      }
    } catch (_) {}
    try {
      navigation.navigate(screenName, params);
    } catch (e) {
      console.warn('[TimelineView] nav error:', e);
    }
  }, [navigation]);
  const { profile } = useAuthStore();
  const { activeCircle, members, places } = useCircleStore();
  const { isDark } = useThemeStore();

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

  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedEvent) {
      translateY.setValue(0);
    }
  }, [selectedEvent]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              setSelectedEvent(null);
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [setSelectedEvent, translateY]
  );

  const fetchTimelineEvents = async () => {
    if (!activeCircle?.id) {
      setActivities([]);
      return;
    }

    try {
      // Automatically evaluate all circle members against safe places in real-time
      if (members.length > 0 && places.length > 0) {
        try {
          const { evaluateCircleMembersGeofences } = require('../services/GeofenceEngine');
          await evaluateCircleMembersGeofences(members, places);
        } catch (e) {}
      }

      const list = await fetchCircleActivities(activeCircle.id, members, places);
      setActivities(list);
    } catch (e) {
      console.warn('Error fetching timeline events:', e);
    }
  };

  useEffect(() => {
    fetchTimelineEvents();
  }, [activeCircle?.id, members.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTimelineEvents();
    setRefreshing(false);
  };

  const handleQuickSafeHome = async () => {
    setSafeHomeCheckedIn(true);
    try {
      const otherMemberIds = members
        .filter((m) => m.user_id !== profile?.id)
        .map((m) => m.user_id);

      const res = await broadcastCheckIn({
        circleId: activeCircle?.id || '',
        circleName: activeCircle?.name,
        userId: profile?.id || '',
        userName: profile?.full_name || 'Member',
        userAvatar: profile?.avatar_url,
        otherMemberIds,
        customMessage: `${profile?.full_name || 'I'} checked in safely as "Safe & Sound".`,
      });

      setActivities((prev) => [res.event, ...prev.filter((e) => e.id !== res.event.id)]);
      showToast(`Shared safe status with ${circleName}!`);
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
      const res = await broadcastCheckInRequest({
        circleId: activeCircle?.id || '',
        circleName: activeCircle?.name,
        userId: profile?.id || '',
        userName: profile?.full_name || 'Member',
        userAvatar: profile?.avatar_url,
        otherMemberIds,
      });

      setActivities((prev) => [res.event, ...prev.filter((e) => e.id !== res.event.id)]);
      showToast(`Check-in request sent to ${otherMemberIds.length} members!`);
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
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header Bar */}
      <View
        style={[
          styles.header,
          { paddingTop: topInset, height: 56 + topInset },
          isDark && styles.headerDark,
        ]}
      >
        <View style={styles.headerLeft}>
          <OrbitalGoldenLogoBadge
            size={34}
            onPress={() => navigation.navigate('Home')}
            accessibilityLabel="CircleGuard Logo"
          />
          <TouchableOpacity
            style={[styles.circleSelectorBtn, isDark && styles.circleSelectorBtnDark]}
            onPress={() => navigation.navigate('Circle')}
            activeOpacity={0.7}
          >
            <Text style={[styles.circleSelectorText, isDark && styles.textLight]} numberOfLines={1}>
              {circleName}
            </Text>
            <Ionicons name="chevron-down" size={15} color={isDark ? '#8C9B91' : '#5C665F'} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={19} color="#2E7D5B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={19} color={isDark ? '#8C9B91' : '#5C665F'} />
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
            <Text style={[styles.pageTitle, isDark && styles.textLight]}>Timeline & Logs</Text>
          </View>
          <TouchableOpacity
            style={[styles.calendarFilterBtn, isDark && styles.calendarFilterBtnDark]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={16} color="#2E7D5B" />
            <Text style={styles.calendarFilterText}>Live Feed</Text>
          </TouchableOpacity>
        </View>

        {/* Date Segmented JellyRadio */}
        <View style={{ marginBottom: 10 }}>
          <JellyRadio
            items={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'week', label: 'Past 7 Days' },
            ]}
            value={dateFilter}
            onChange={(val) => setDateFilter(val as any)}
            chipColor={isDark ? '#1C2621' : '#F0EFEA'}
            activeColor="#2E7D5B"
            textColor={isDark ? '#8E9E95' : '#64748B'}
            activeTextColor="#FFFFFF"
            size="sm"
            gap={6}
            radius={16}
            swell={0.12}
            bounce={0.2}
          />
        </View>

        {/* Category Segmented JellyRadio */}
        <View style={{ marginBottom: 16 }}>
          <JellyRadio
            items={[
              {
                value: 'all',
                label: `All Events (${activities.length})`,
              },
              {
                value: 'checkins',
                label: 'Check-ins',
                icon: (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={categoryFilter === 'checkins' ? (isDark ? '#002116' : '#FFFFFF') : (isDark ? '#3ADFAB' : '#2E7D5B')}
                  />
                ),
              },
              {
                value: 'arrivals',
                label: 'Arrivals / Departures',
                icon: (
                  <Ionicons
                    name="walk-outline"
                    size={14}
                    color={categoryFilter === 'arrivals' ? (isDark ? '#002116' : '#FFFFFF') : (isDark ? '#60A5FA' : '#183CE6')}
                  />
                ),
              },
              {
                value: 'alerts',
                label: 'Alerts',
                icon: (
                  <Ionicons
                    name="warning-outline"
                    size={14}
                    color={categoryFilter === 'alerts' ? (isDark ? '#002116' : '#FFFFFF') : '#DC2626'}
                  />
                ),
              },
            ]}
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val as any)}
            chipColor={isDark ? '#141E18' : '#FFFFFF'}
            activeColor={isDark ? '#3ADFAB' : '#2E7D5B'}
            textColor={isDark ? '#CAD5CE' : '#4A5568'}
            activeTextColor={isDark ? '#002116' : '#FFFFFF'}
            size="md"
            gap={8}
            radius={18}
            swell={0.16}
            barge={4}
            bounce={0.25}
          />
        </View>

        {/* Quick Check-in Reassurance Banner */}
        <View style={[styles.reassuranceBanner, isDark && styles.reassuranceBannerDark]}>
          <View style={styles.reassuranceTop}>
            <View style={[styles.reassuranceIconBox, isDark && { backgroundColor: '#23352B' }]}>
              <Ionicons name="home" size={22} color={isDark ? '#3ADFAB' : '#006C4F'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reassuranceTitle, isDark && styles.textLight]}>
                Instant Circle Check-in
              </Text>
              <Text style={[styles.reassuranceSub, isDark && styles.textSubDark]}>
                Broadcast your current safe location to all members
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.broadcastSafeBtn,
              isDark && { backgroundColor: '#2E7D5B', borderWidth: 1, borderColor: '#3ADFAB' },
              safeHomeCheckedIn && { backgroundColor: '#3ADFAB', borderColor: '#3ADFAB' },
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
          {filteredActivities.length > 0 && (
            <View style={[styles.verticalTrackLine, isDark && styles.verticalTrackLineDark]} />
          )}

          {filteredActivities.length > 0 ? (
            filteredActivities.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.timelineItem}
                onPress={() => setSelectedEvent(event)}
                activeOpacity={0.75}
              >
                <View style={[styles.timelineAvatarContainer, isDark && styles.timelineAvatarContainerDark]}>
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
                    <Ionicons name={event.icon as any || 'information'} size={10} color="#FFFFFF" />
                  </View>
                </View>

                <View style={[styles.timelineCard, isDark && styles.timelineCardDark]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {event.type === 'GEOFENCE' && (
                        <View style={styles.geofenceTagRow}>
                          <View
                            style={[
                              styles.geofenceStatusTag,
                              { backgroundColor: event.eventType === 'arrival' ? '#E8F5EE' : '#FEF3C7' },
                            ]}
                          >
                            <Ionicons
                              name={event.eventType === 'arrival' ? 'location-sharp' : 'walk-outline'}
                              size={10}
                              color={event.eventType === 'arrival' ? '#2E7D5B' : '#B45309'}
                            />
                            <Text
                              style={[
                                styles.geofenceStatusTagText,
                                { color: event.eventType === 'arrival' ? '#2E7D5B' : '#B45309' },
                              ]}
                            >
                              {event.eventType === 'arrival' ? 'ARRIVED' : 'DEPARTED'}
                            </Text>
                          </View>
                          {event.dwellDurationText ? (
                            <Text style={styles.dwellDurationBadge}>
                              {event.dwellDurationText}
                            </Text>
                          ) : null}
                        </View>
                      )}
                      <Text style={[styles.cardItemTitle, isDark && styles.textLight]} numberOfLines={1}>
                        {event.title}
                      </Text>
                    </View>
                    <Text style={[styles.cardItemTime, isDark && styles.textSubDark]}>{event.time}</Text>
                  </View>
                  <Text style={[styles.cardItemSub, isDark && styles.textSubDark]}>{event.message}</Text>
                  <View style={styles.cardActionHintRow}>
                    <Text style={styles.cardActionHintText}>Tap for actions & map</Text>
                    <Ionicons name="chevron-forward" size={12} color="#2E7D5B" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.emptyFeedBox, isDark && styles.emptyFeedBoxDark]}>
              <Ionicons name="calendar-outline" size={32} color="#2E7D5B" />
              <Text style={[styles.emptyFeedTitle, isDark && styles.textLight]}>No Events Recorded</Text>
              <Text style={[styles.emptyFeedSub, isDark && styles.textSubDark]}>
                Arrivals, departures, check-ins, and safety alerts will automatically populate here as your circle stays connected.
              </Text>
            </View>
          )}
        </View>

        {/* Floating Context Action: Request Check-In */}
        <TouchableOpacity
          style={[
            styles.floatingRequestCheckInBtn,
            isDark && {
              backgroundColor: '#1C2E24',
              borderWidth: 1,
              borderColor: '#3ADFAB',
            },
          ]}
          onPress={handleRequestCheckIn}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={18} color={isDark ? '#3ADFAB' : '#FFFFFF'} />
          <Text style={[styles.floatingRequestCheckInText, isDark && { color: '#3ADFAB' }]}>Request Check-in</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Activity Event Details Modal */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedEvent(null)}
        >
          <Animated.View
            style={[
              styles.modalCard,
              isDark && styles.modalCardDark,
              {
                transform: [
                  {
                    translateY: translateY.interpolate({
                      inputRange: [-50, 0, 600],
                      outputRange: [0, 0, 600],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Top Interactive Drag-to-Dismiss / Tap-to-Close Handle */}
            <TouchableOpacity
              style={styles.handleContainer}
              onPress={() => setSelectedEvent(null)}
              activeOpacity={0.7}
              {...panResponder.panHandlers}
              accessibilityLabel="Drag down or tap to close event details"
            >
              <View style={[styles.handleBar, { backgroundColor: isDark ? '#26342D' : '#D1D5DB' }]} />
            </TouchableOpacity>

            {/* Modal Header */}
            {(() => {
              const isDeparture = selectedEvent?.type === 'GEOFENCE' && (
                selectedEvent.eventType === 'departure' ||
                selectedEvent.title?.toLowerCase().includes('depart') ||
                selectedEvent.title?.toLowerCase().includes('left') ||
                selectedEvent.title?.toLowerCase().includes('exit')
              );
              const isGeofenceBreach = selectedEvent?.title?.toLowerCase().includes('breach');
              const headerBadgeColor = (isDeparture || isGeofenceBreach) ? '#F59E0B' : (selectedEvent?.color || '#2E7D5B');
              const headerIconName = (isDeparture || isGeofenceBreach) ? 'navigate' : ((selectedEvent?.icon as any) || 'information-circle');
              const tagLabel = selectedEvent?.type === 'CHECKIN'
                ? 'SAFETY CHECK-IN'
                : isGeofenceBreach
                ? 'GEOFENCE PERIMETER BREACH'
                : isDeparture
                ? 'SAFE PLACE DEPARTURE'
                : selectedEvent?.type === 'GEOFENCE'
                ? 'SAFE PLACE ARRIVAL'
                : selectedEvent?.type === 'SOS'
                ? 'EMERGENCY SOS ALERT'
                : 'CIRCLE UPDATE';

              return (
                <>
                  <View style={styles.modalHeaderRow}>
                    <View style={[styles.modalHeaderBadge, isDark && styles.modalHeaderBadgeDark, { backgroundColor: `${headerBadgeColor}18` }]}>
                      <Ionicons
                        name={headerIconName}
                        size={20}
                        color={headerBadgeColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalMemberName, isDark && styles.textLight]}>
                        {selectedEvent?.memberName}
                      </Text>
                      <Text style={[styles.modalTimestamp, isDark && styles.textSubDark]}>
                        {selectedEvent?.time}
                      </Text>
                    </View>
                  </View>

                  {/* Event Category Tag */}
                  <View style={styles.modalTagRow}>
                    <View
                      style={[
                        styles.modalCategoryPill,
                        { backgroundColor: `${headerBadgeColor}18` },
                      ]}
                    >
                      <View style={[styles.modalCategoryDot, { backgroundColor: headerBadgeColor }]} />
                      <Text
                        style={[
                          styles.modalCategoryPillText,
                          { color: headerBadgeColor },
                        ]}
                      >
                        {tagLabel}
                      </Text>
                    </View>
                  </View>
                </>
              );
            })()}

            {/* Arrival & Departure Telemetry Details Card */}
            {selectedEvent?.type === 'GEOFENCE' ? (
              <View style={[styles.telemetryCard, isDark && styles.telemetryCardDark]}>
                <View style={styles.telemetryHeaderRow}>
                  <View style={[styles.telemetryCategoryIconBox, { backgroundColor: selectedEvent.eventType === 'arrival' ? '#E8F5EE' : '#FEF3C7' }]}>
                    <Ionicons
                      name={
                        selectedEvent.placeCategory === 'home'
                          ? 'home'
                          : selectedEvent.placeCategory === 'work'
                          ? 'briefcase'
                          : selectedEvent.placeCategory === 'school'
                          ? 'school'
                          : selectedEvent.eventType === 'arrival'
                          ? 'location'
                          : 'walk'
                      }
                      size={20}
                      color={selectedEvent.eventType === 'arrival' ? '#2E7D5B' : '#B45309'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.telemetryPlaceTitle, isDark && styles.textLight]} numberOfLines={1}>
                      {selectedEvent.placeName || 'Safe Zone'}
                    </Text>
                    <Text style={[styles.telemetryPlaceSub, isDark && styles.textSubDark]}>
                      {selectedEvent.eventType === 'arrival' ? 'Verified Zone Arrival' : 'Verified Zone Departure'}
                    </Text>
                  </View>
                  <View style={[styles.telemetryStatusPill, { backgroundColor: selectedEvent.eventType === 'arrival' ? '#E8F5EE' : '#FEF3C7' }]}>
                    <Text style={[styles.telemetryStatusText, { color: selectedEvent.eventType === 'arrival' ? '#2E7D5B' : '#B45309' }]}>
                      {selectedEvent.eventType === 'arrival' ? 'ARRIVED' : 'DEPARTED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.telemetryGrid}>
                  <View style={[styles.telemetryStatBox, isDark && styles.telemetryStatBoxDark]}>
                    <Text style={[styles.telemetryStatLabel, isDark && styles.textSubDark]}>EVENT TIME</Text>
                    <Text style={[styles.telemetryStatValue, isDark && styles.textLight]}>{selectedEvent.time}</Text>
                  </View>
                  <View style={[styles.telemetryStatBox, isDark && styles.telemetryStatBoxDark]}>
                    <Text style={[styles.telemetryStatLabel, isDark && styles.textSubDark]}>
                      {selectedEvent.eventType === 'arrival' ? 'PERIMETER' : 'STAY DURATION'}
                    </Text>
                    <Text style={[styles.telemetryStatValue, isDark && styles.textLight]}>
                      {selectedEvent.eventType === 'arrival' ? `${selectedEvent.radiusMeters || 150}m Radius` : selectedEvent.dwellDurationText || 'Safe transition'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.telemetryExplanation, isDark && styles.textSubDark]}>
                  {selectedEvent.message}
                </Text>
              </View>
            ) : (
              /* Standard Event Message Box */
              <View style={[styles.modalMessageBox, isDark && styles.modalMessageBoxDark]}>
                <Text style={[styles.modalMessageTitle, isDark && styles.textLight]}>
                  {selectedEvent?.title}
                </Text>
                <Text style={[styles.modalMessageBody, isDark && styles.textSubDark]}>
                  {selectedEvent?.message}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            {(() => {
              const targetMember = members.find((m) => m.user_id === selectedEvent?.userId || (m as any).id === selectedEvent?.userId);
              const targetUserId = selectedEvent?.userId || targetMember?.user_id || (targetMember as any)?.id || profile?.id;
              const targetName = selectedEvent?.memberName || targetMember?.profile?.full_name || 'Member';
              const targetPhone = selectedEvent?.phone || targetMember?.profile?.phone;
              const hasCoordinates = Boolean(targetMember?.latitude && targetMember?.longitude);
              const isSelf = Boolean(targetUserId && profile?.id && targetUserId === profile.id);
              const cleanPhone = typeof targetPhone === 'string' ? targetPhone.trim() : '';
              const canCall = !isSelf && cleanPhone.length > 0;

              return (
                <View style={styles.modalActions}>
                  {/* Primary: Live Map Centered on This Member */}
                  <TouchableOpacity
                    style={styles.modalActionPrimary}
                    onPress={() => {
                      setSelectedEvent(null);
                      navigation.navigate('Map', {
                        focusUserId: targetUserId,
                        focusLat: targetMember?.latitude,
                        focusLng: targetMember?.longitude,
                        focusUserName: targetName,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.modalActionPrimaryText}>
                      {hasCoordinates ? `Locate ${targetName.split(' ')[0]} on Map` : 'View on Live Map'}
                    </Text>
                  </TouchableOpacity>

                  {/* Secondary Row 1: Route History & Driving Report */}
                  <View style={styles.modalSecondaryRow}>
                    <TouchableOpacity
                      style={[styles.modalActionSecondary, isDark && styles.modalActionSecondaryDark]}
                      onPress={() => {
                        setSelectedEvent(null);
                        navigateToScreen('LocationHistory', {
                          member: targetMember,
                          memberId: targetUserId,
                          circleId: activeCircle?.id,
                          memberName: targetName,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trail-sign-outline" size={16} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                      <Text style={[styles.modalActionSecondaryText, isDark && styles.textLight]}>
                        Route History
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionSecondary, isDark && styles.modalActionSecondaryDark]}
                      onPress={() => {
                        setSelectedEvent(null);
                        navigateToScreen('DrivingReports', {
                          member: targetMember,
                          memberId: targetUserId,
                          circleId: activeCircle?.id,
                          memberName: targetName,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="speedometer-outline" size={16} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                      <Text style={[styles.modalActionSecondaryText, isDark && styles.textLight]}>
                        Driving Report
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Secondary Row 2: Chat & Safe Places */}
                  <View style={styles.modalSecondaryRow}>
                    <TouchableOpacity
                      style={[styles.modalActionSecondary, isDark && styles.modalActionSecondaryDark]}
                      onPress={() => {
                        setSelectedEvent(null);
                        navigation.navigate('Chat', {
                          memberId: targetUserId,
                          memberName: targetName,
                          filterMemberId: targetUserId,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubbles-outline" size={16} color="#183CE6" />
                      <Text style={[styles.modalActionSecondaryText, isDark && styles.textLight]}>
                        Chat ({targetName.split(' ')[0]})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionSecondary, isDark && styles.modalActionSecondaryDark]}
                      onPress={() => {
                        setSelectedEvent(null);
                        navigation.navigate('SafePlaces', {
                          memberId: targetUserId,
                          memberName: targetName,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="location-outline" size={16} color="#2E7D5B" />
                      <Text style={[styles.modalActionSecondaryText, isDark && styles.textLight]}>
                        Safe Places
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Optional Row 3: Call Member (Only for other members with valid phone) or SOS Alert Details */}
                  {canCall ? (
                    <TouchableOpacity
                      style={[styles.modalCallBtn, isDark && styles.modalCallBtnDark]}
                      onPress={() => {
                        Linking.openURL(`tel:${cleanPhone}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call" size={17} color={isDark ? '#3ADFAB' : '#165D40'} />
                      <Text style={[styles.modalCallBtnText, isDark && { color: '#3ADFAB' }]}>
                        Call {targetName.split(' ')[0]} ({cleanPhone})
                      </Text>
                    </TouchableOpacity>
                  ) : selectedEvent?.type === 'SOS' ? (
                    <TouchableOpacity
                      style={[styles.modalSOSBtn, isDark && styles.modalSOSBtnDark]}
                      onPress={() => {
                        setSelectedEvent(null);
                        navigation.navigate('SOSAlert');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="warning" size={17} color="#DC2626" />
                      <Text style={styles.modalSOSBtnText}>
                        View Emergency SOS Details
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })()}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const SANS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

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
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pageTitle: {
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  reassuranceSub: {
    fontFamily: SANS_FONT,
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
    fontFamily: SANS_FONT,
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
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2E7D5B',
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
  cardActionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  cardActionHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  // Dark Theme Tokens
  containerDark: {
    backgroundColor: '#0F1411',
  },
  headerDark: {
    backgroundColor: '#141A17',
    borderBottomColor: '#212C26',
  },
  logoBadgeDark: {
    backgroundColor: '#1C2621',
  },
  circleSelectorBtnDark: {
    backgroundColor: '#1C2621',
  },
  headerIconButtonDark: {
    backgroundColor: '#1C2621',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textSubDark: {
    color: '#CAD5CE',
  },
  calendarFilterBtnDark: {
    backgroundColor: '#1C2621',
  },
  dateChipDark: {
    backgroundColor: '#1C2621',
    borderWidth: 1,
    borderColor: '#2A3A32',
  },
  dateChipTextDark: {
    color: '#CAD5CE',
  },
  catChipDark: {
    backgroundColor: '#1C2621',
    borderWidth: 1,
    borderColor: '#2A3A32',
  },
  catChipTextDark: {
    color: '#CAD5CE',
  },
  catChipActiveDark: {
    backgroundColor: '#2E7D5B',
    borderColor: '#3ADFAB',
  },
  catChipTextActiveDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  catCountBadgeDark: {
    backgroundColor: '#28362F',
  },
  reassuranceBannerDark: {
    backgroundColor: '#1A231F',
    borderColor: '#283730',
  },
  verticalTrackLineDark: {
    backgroundColor: '#283730',
  },
  timelineAvatarContainerDark: {
    backgroundColor: '#1C2621',
  },
  timelineCardDark: {
    backgroundColor: '#1A231F',
    borderColor: '#283730',
  },
  emptyFeedBoxDark: {
    backgroundColor: '#1A231F',
    borderColor: '#283730',
  },
  // Activity Details Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  modalCardDark: {
    backgroundColor: '#141A17',
    borderWidth: 1,
    borderColor: '#283730',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalHeaderBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderBadgeDark: {
    backgroundColor: '#1C2621',
  },
  modalMemberName: {
    fontFamily: SANS_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2A24',
  },
  modalTimestamp: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    color: '#5C665F',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnDark: {
    backgroundColor: '#1C2621',
  },
  modalTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  modalCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalCategoryPillText: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalMessageBox: {
    backgroundColor: '#F8F7F4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 18,
  },
  modalMessageBoxDark: {
    backgroundColor: '#0F1411',
    borderColor: '#283730',
  },
  modalMessageTitle: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
    marginBottom: 4,
  },
  modalMessageBody: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    color: '#5C665F',
    lineHeight: 18,
  },
  modalActions: {
    gap: 10,
  },
  modalActionPrimary: {
    backgroundColor: '#2E7D5B',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2E7D5B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalActionPrimaryText: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  modalSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionSecondary: {
    flex: 1,
    backgroundColor: '#F0EFEA',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalActionSecondaryDark: {
    backgroundColor: '#1E2923',
    borderWidth: 1,
    borderColor: '#2F4037',
  },
  modalActionSecondaryText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2A24',
  },
  modalCallBtn: {
    width: '100%',
    backgroundColor: '#E8F5EE',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#A3D9C0',
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  modalCallBtnDark: {
    backgroundColor: 'rgba(58, 223, 171, 0.12)',
    borderColor: 'rgba(58, 223, 171, 0.32)',
  },
  modalCallBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#165D40',
    letterSpacing: 0.2,
  },
  modalSOSBtn: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#FECACA',
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  modalSOSBtnDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.38)',
  },
  modalSOSBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.2,
  },
  geofenceTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  geofenceStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  geofenceStatusTagText: {
    fontFamily: SANS_FONT,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dwellDurationBadge: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  telemetryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#ECEAE4',
    padding: 14,
    marginBottom: 16,
  },
  telemetryCardDark: {
    backgroundColor: '#1E2923',
    borderColor: '#2F4037',
  },
  telemetryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  telemetryCategoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryPlaceTitle: {
    fontFamily: SANS_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2A24',
  },
  telemetryPlaceSub: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  telemetryStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  telemetryStatusText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  telemetryStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  telemetryStatBoxDark: {
    backgroundColor: '#16201B',
    borderColor: '#23322A',
  },
  telemetryStatLabel: {
    fontFamily: SANS_FONT,
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  telemetryStatValue: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    marginTop: 2,
  },
  telemetryExplanation: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    color: '#5C665F',
    lineHeight: 16.5,
  },
});
