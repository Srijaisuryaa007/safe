import React, { useEffect, useState, useRef } from 'react';
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
import { useCircleStore } from '../store/useCircleStore';
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
import MagnificationDock, { DockItemData } from '../components/MagnificationDock';
import JellySqueezeButton from '../components/JellySqueezeButton';
import AnimatedList from '../components/AnimatedList';
import HomeMiniMapCard from '../components/HomeMiniMapCard';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const { colors, isDark, themeMode } = useThemeStore();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [circlePlaces, setCirclePlaces] = useState<any[]>([]);
  const [fakeCallVisible, setFakeCallVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { showAlert } = useLuxuryAlert();

  const fetchHomePlaces = async (circleId: string) => {
    try {
      const { data } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId);
      if (data) {
        setCirclePlaces(data);
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
    const { getHaversineDistanceInMeters } = require('../services/GeofenceEngine');

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

  const safeMembers = activeCircle ? (members || []) : [];
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
      useCircleStore.getState().fetchActiveCircle(profile.id);
    } else if (activeCircle?.id) {
      fetchCircleActivity(activeCircle.id);
      fetchHomePlaces(activeCircle.id);
    }
  }, [profile?.id, activeCircle?.id]);

  const fetchCircleActivity = async (circleId: string) => {
    setLoadingActivity(true);
    try {
      const [sosRes, msgRes] = await Promise.all([
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
          .limit(5)
      ]);

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

      const combined = [...sosActivities, ...msgActivities]
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
      await Clipboard.setStringAsync(activeCircle.invite_code);
      showAlert({
        title: 'Invite Code Copied',
        message: `Invite Code: ${activeCircle.invite_code}\n\nCopied to clipboard. Share this key to invite members.`,
        type: 'success',
        buttonText: 'DONE',
      });
    } else {
      navigation.navigate('Circle');
    }
  };

  const onlineCount = activeCircle ? safeMembers.filter((m) => m.isOnline).length : 0;
  const offlineCount = activeCircle ? Math.max(0, safeMembers.length - onlineCount) : 0;

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
                  backgroundColor: isTrackingActive ? (themeMode === 'minimalist_monochrome' || themeMode === 'bauhaus' ? '#000000' : '#FFF1F1') : 'rgba(16, 185, 129, 0.12)',
                },
              ]}
              onPress={toggleLocationTracking}
            >
              <Ionicons
                name={isTrackingActive ? 'pause-circle-outline' : 'play-circle-outline'}
                size={18}
                color={isTrackingActive ? (themeMode === 'minimalist_monochrome' || themeMode === 'bauhaus' ? '#FFFFFF' : '#DC2626') : '#10B981'}
              />
              <Text
                style={[
                  styles.pauseBtnText,
                  { color: isTrackingActive ? (themeMode === 'minimalist_monochrome' || themeMode === 'bauhaus' ? '#FFFFFF' : '#DC2626') : '#10B981' },
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
              style={[styles.metricBigNumber, { color: themeMode === 'bauhaus' ? '#1040C0' : '#10B981' }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {activeCircle ? onlineCount : 0}
            </Text>
            <Text 
              style={[styles.metricCardLabel, { color: themeMode === 'bauhaus' ? '#1040C0' : '#10B981' }]}
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
            activeOpacity={0.8}
          >
            <Text 
              style={[styles.metricBigNumber, { color: themeMode === 'bauhaus' ? '#D02020' : colors.accentGold }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              {activeCircle ? recentActivities.length : 0}
            </Text>
            <Text 
              style={[styles.metricCardLabel, { color: themeMode === 'bauhaus' ? '#D02020' : colors.accentGold }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
              numberOfLines={2}
            >
              ALERTS{'\n'}LOGGED
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Header: Safety Suite & Controls */}
        <View style={styles.sectionHeaderRow}>
          <Text 
            style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B' }]}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.85}
            numberOfLines={1}
          >
            SAFETY SUITE & CONTROLS
          </Text>
          <View style={[styles.accentLine, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]} />
        </View>

        {/* macOS-Inspired Magnification Dock Component */}
        <MagnificationDock items={dockItems} />

        {/* Activity Log Box Container */}
        <View style={[styles.activityContainerBox, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: isDark ? colors.border : '#E4E4E7' }]}>
          {/* Inner Header Row */}
          <View style={styles.activityBoxHeader}>
            <View style={styles.activityBoxTitleRow}>
              <View style={styles.pulseLiveDot} />
              <Text style={[styles.sectionTitle, { color: isDark ? colors.foreground : '#18181B', fontSize: 13 }]}>ACTIVITY LOG</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Activity')} activeOpacity={0.7}>
              <Text style={[styles.seeAllText, { color: '#B48B1E' }]}>VIEW ALL →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityBoxInnerContent}>
            {loadingActivity ? (
              <ActivityIndicator size="small" color="#B48B1E" style={{ paddingVertical: 20 }} />
            ) : recentActivities.length > 0 ? (
              <AnimatedList
                items={recentActivities}
                maxHeight={410}
                showGradients={true}
                displayScrollbar={true}
                onItemSelect={(item) => navigation.navigate('Activity')}
              />
            ) : (
              <View style={styles.emptyActivityBox}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.textMuted} />
                <Text style={[styles.emptyActivityText, { color: isDark ? colors.textMuted : '#71717A' }]}>
                  No activity recorded in your circle yet.
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
    paddingBottom: 24,
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
  activityContainerBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 12,
  },
  activityBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
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
});
