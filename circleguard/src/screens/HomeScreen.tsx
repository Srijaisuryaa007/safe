import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  sendInstantLocationPing,
  startBatteryOptimizedBackgroundLocation,
  stopBackgroundLocation,
} from '../services/LocationBackgroundService';
import { useThemeStore } from '../store/useThemeStore';

import FakeCallModal from '../components/FakeCallModal';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import ShareLocationModal from '../components/ShareLocationModal';
import SwiggyHeaderBar from '../components/SwiggyHeaderBar';
import MagnificationDock, { DockItemData } from '../components/MagnificationDock';
import JellySqueezeButton from '../components/JellySqueezeButton';

export default function HomeScreen() {
  const { colors, isDark } = useThemeStore();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [fakeCallVisible, setFakeCallVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { showAlert } = useLuxuryAlert();

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

  const safeMembers = members || [];
  const firstName = String(profile?.full_name || 'User').split(' ')[0];

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await useCircleStore.getState().fetchActiveCircle(profile.id);
      if (activeCircle?.id) {
        await Promise.all([
          useCircleStore.getState().fetchMembers(activeCircle.id),
          fetchCircleActivity(activeCircle.id),
        ]);
      }
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    sendInstantLocationPing();
    startBatteryOptimizedBackgroundLocation();
    if (activeCircle?.id) {
      fetchCircleActivity(activeCircle.id);
    }
  }, [activeCircle?.id]);

  const fetchCircleActivity = async (circleId: string) => {
    setLoadingActivity(true);
    try {
      const { data: sosData } = await supabase
        .from('sos_alerts')
        .select('id, created_at, status, user_id, profiles(full_name)')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(5);

      const formatted = (sosData || []).map((item) => {
        let name = 'A member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        return {
          id: item.id,
          title: `${name || 'Member'} triggered SOS alert`,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: colors.accentGold,
        };
      });

      setRecentActivities(formatted);
    } catch (err) {
      console.warn('Error fetching activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleInviteMember = async () => {
    if (activeCircle?.invite_code) {
      await Clipboard.setStringAsync(activeCircle.invite_code);
      Alert.alert('Invite Code Copied', `Invite Code: ${activeCircle.invite_code}\n\nCopied to clipboard.`);
    } else {
      navigation.navigate('Circle');
    }
  };

  const onlineCount = safeMembers.filter((m) => m.isOnline).length;
  const offlineCount = Math.max(0, safeMembers.length - onlineCount);

  // Magnification Dock Item Definitions for Safety Suite
  const dockItems: DockItemData[] = [
    {
      id: 'gps',
      iconName: 'location',
      label: 'Share GPS',
      badgeColor: 'rgba(59, 130, 246, 0.12)',
      iconColor: '#3B82F6',
      onClick: handleShareLocation,
    },
    {
      id: 'ghost',
      iconName: 'call',
      label: 'Ghost Escort',
      badgeColor: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#F59E0B',
      onClick: () => setFakeCallVisible(true),
    },
    {
      id: 'places',
      iconName: 'compass',
      label: 'Safe Places',
      badgeColor: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#10B981',
      onClick: () => navigation.navigate('SafePlaces'),
    },
    {
      id: 'history',
      iconName: 'time',
      label: '2-Day History',
      badgeColor: 'rgba(180, 139, 30, 0.12)',
      iconColor: '#B48B1E',
      onClick: () => navigation.navigate('LocationHistory'),
    },
    {
      id: 'driving',
      iconName: 'speedometer',
      label: 'Driving Report',
      badgeColor: 'rgba(239, 68, 68, 0.12)',
      iconColor: '#EF4444',
      onClick: () => navigation.navigate('DrivingReports'),
    },
    {
      id: 'chat',
      iconName: 'chatbubbles',
      label: 'Circle Chat',
      badgeColor: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#10B981',
      onClick: () => navigation.navigate('Chat'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FAF9F5' }]}>
      {/* Top Location Header */}
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
        {/* Main Hero Protection Shield Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? colors.border : '#F4F4F5',
            },
          ]}
        >
          {/* Gold Left Accent Stripe */}
          <View style={styles.goldLeftStripe} />

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
              >
                {isTrackingActive ? 'LIVE SHIELD ACTIVE' : 'SHIELD PAUSED'}
              </Text>
            </View>

            <Text style={[styles.cardDateText, { color: isDark ? colors.textMuted : '#9CA3AF' }]}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </Text>
          </View>

          {/* Central Shield Emblem */}
          <View style={styles.shieldEmblemContainer}>
            <View style={styles.outerShieldRing}>
              <View style={styles.innerShieldBadge}>
                <Ionicons name="shield" size={38} color="#B48B1E" />
                <View style={styles.shieldInnerPinWrap}>
                  <Ionicons name="location" size={18} color="#1C1C1E" />
                </View>
              </View>
            </View>
          </View>

          {/* Circle Title & Connected Status */}
          <Text style={[styles.circleNameTitle, { color: isDark ? colors.foreground : '#18181B' }]}>
            {activeCircle ? activeCircle.name : 'friends'}
          </Text>

          <Text style={[styles.circleSubtitle, { color: isDark ? colors.textMuted : '#71717A' }]}>
            {activeCircle
              ? `${safeMembers.length || 7} members connected in real time`
              : '7 members connected in real time'}
          </Text>

          {/* Member Avatar Stack */}
          <View style={styles.avatarRowContainer}>
            {safeMembers.length > 0
              ? safeMembers.slice(0, 4).map((m, idx) => {
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
                          borderColor: isDark ? colors.border : '#E4E4E7',
                        },
                      ]}
                    >
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={[styles.avatarInitialText, { color: isDark ? colors.foreground : '#27272A' }]}>
                          {initial}
                        </Text>
                      )}
                    </View>
                  );
                })
              : [
                  { initial: 'S' },
                  { initial: 'B' },
                  { initial: 'M' },
                  { initial: 'A' },
                ].map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: isDark ? colors.surfaceMuted : '#F4F4F5',
                        borderColor: isDark ? colors.border : '#E4E4E7',
                      },
                    ]}
                  >
                    <Text style={[styles.avatarInitialText, { color: isDark ? colors.foreground : '#27272A' }]}>
                      {item.initial}
                    </Text>
                  </View>
                ))}

            <View style={styles.moreAvatarGoldBadge}>
              <Text style={styles.moreAvatarText}>
                +{safeMembers.length > 4 ? safeMembers.length - 4 : 3}
              </Text>
            </View>
          </View>

          {/* Interactive Jelly Squeeze Physics Button */}
          <JellySqueezeButton
            style={[
              styles.pauseTrackingBtn,
              {
                borderColor: isTrackingActive ? '#FCA5A5' : '#10B981',
                backgroundColor: isTrackingActive ? '#FEF2F2' : 'rgba(16, 185, 129, 0.08)',
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
            >
              {isTrackingActive ? 'PAUSE BACKGROUND TRACKING' : 'RESUME BACKGROUND SHIELD'}
            </Text>
          </JellySqueezeButton>
        </View>

        {/* Section Header: Circle Metrics */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B' }]}>
            CIRCLE METRICS
          </Text>
          <View style={[styles.accentLine, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]} />
        </View>

        {/* Circle Metrics Grid */}
        <View style={styles.metricsGridRow}>
          <TouchableOpacity
            style={[
              styles.metricCardBox,
              {
                borderColor: '#10B981',
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricBigNumber, { color: '#10B981' }]}>
              {onlineCount || 2}
            </Text>
            <Text style={[styles.metricCardLabel, { color: '#10B981' }]}>
              MEMBERS{'\n'}ONLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCardBox,
              {
                borderColor: isDark ? colors.border : '#E4E4E7',
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricBigNumber, { color: isDark ? colors.textMuted : '#4B5563' }]}>
              {offlineCount || 5}
            </Text>
            <Text style={[styles.metricCardLabel, { color: isDark ? colors.textMuted : '#6B7280' }]}>
              MEMBERS{'\n'}OFFLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCardBox,
              {
                borderColor: '#B48B1E',
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricBigNumber, { color: '#B48B1E' }]}>
              {recentActivities.length || 5}
            </Text>
            <Text style={[styles.metricCardLabel, { color: '#B48B1E' }]}>
              ALERTS{'\n'}LOGGED
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Header: Safety Suite & Controls */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B' }]}>
            SAFETY SUITE & CONTROLS
          </Text>
          <View style={[styles.accentLine, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]} />
        </View>

        {/* macOS-Inspired Magnification Dock Component */}
        <MagnificationDock items={dockItems} />

        {/* Activity Log Feed Header */}
        <View style={styles.activityHeader}>
          <Text style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B' }]}>ACTIVITY LOG</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Activity')} activeOpacity={0.7}>
            <Text style={[styles.seeAllText, { color: '#B48B1E' }]}>VIEW ALL →</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.activityList, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: isDark ? colors.border : '#E4E4E7' }]}>
          {loadingActivity ? (
            <ActivityIndicator size="small" color="#B48B1E" />
          ) : recentActivities.length > 0 ? (
            recentActivities.map((act) => (
              <View key={act.id} style={styles.activityItem}>
                <View style={[styles.goldIndicatorDot, { backgroundColor: '#B48B1E' }]} />
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityTitle, { color: isDark ? colors.foreground : '#18181B' }]}>{act.title}</Text>
                  <Text style={[styles.activityTime, { color: isDark ? colors.textMuted : '#71717A' }]}>{act.time}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyActivityText, { color: isDark ? colors.textMuted : '#71717A' }]}>No activity recorded in your circle yet.</Text>
          )}
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
    paddingBottom: 110,
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
    gap: 10,
    marginBottom: 28,
  },
  metricCardBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricBigNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  activityList: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goldIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 11,
  },
  emptyActivityText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
