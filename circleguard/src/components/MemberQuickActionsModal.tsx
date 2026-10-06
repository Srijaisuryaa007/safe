import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Linking,
  Dimensions,
  PanResponder,
  Animated,
  Alert,
  Vibration,
  Share,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { sendExpoPushNotification } from '../services/PushNotificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SANS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

interface MemberQuickActionsModalProps {
  visible: boolean;
  onClose: () => void;
  member: any | null;
  circleId?: string;
  isSelf: boolean;
  canManageRanks: boolean;
  onRingMember?: (member: any) => void;
  onNudgeMember?: (member: any) => void;
  onNavigateMember?: (member: any) => void;
  onOpenHistory?: (member: any) => void;
  onOpenDriving?: (member: any) => void;
  onChatMember?: (member: any) => void;
  onAssignGuardian?: (member: any) => void;
  onManageRole?: (member: any) => void;
  onRemoveMember?: (member: any) => void;
}

export default function MemberQuickActionsModal({
  visible,
  onClose,
  member,
  circleId,
  isSelf,
  canManageRanks,
  onRingMember,
  onNudgeMember,
  onNavigateMember,
  onOpenHistory,
  onOpenDriving,
  onChatMember,
  onAssignGuardian,
  onManageRole,
  onRemoveMember,
}: MemberQuickActionsModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeStore();
  const translateY = useRef(new Animated.Value(0)).current;

  // Global store hooks - declared unconditionally before any early returns
  const activeCircle = useCircleStore((s) => s.activeCircle);
  const allCircleMembers = useCircleStore((s) => s.members);

  // Local overrides for settings so leader changes toggle with zero latency
  const [localGhost, setLocalGhost] = useState<boolean | null>(null);
  const [localOnline, setLocalOnline] = useState<boolean | null>(null);
  const [localGps, setLocalGps] = useState<string | null>(null);
  const [localShake, setLocalShake] = useState<boolean | null>(null);
  const [localLock, setLocalLock] = useState<boolean | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  useEffect(() => {
    if (member) {
      setLocalGhost(null);
      setLocalOnline(null);
      setLocalGps(null);
      setLocalShake(null);
      setLocalLock(null);
      setIsShareModalOpen(false);
      setIsBroadcasting(false);
    }
  }, [member?.user_id, member?.id]);

  const handleDismiss = React.useCallback(
    (callback?: any) => {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(10); } catch (_) {}
      }
      const safeCb = typeof callback === 'function' ? callback : undefined;
      onClose();

      if (safeCb) {
        // Allow Android native Dialog to finish its exit transition (220ms) before invoking navigation or new modal
        const delay = Platform.OS === 'ios' ? 140 : 220;
        setTimeout(() => {
          try {
            safeCb();
          } catch (err) {
            console.warn('[MemberQuickActionsModal] Dismiss callback error:', err);
          }
        }, delay);
      }
    },
    [onClose]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const isTap = Math.abs(gestureState.dy) < 8 && Math.abs(gestureState.dx) < 8;
        const isDragDown = gestureState.dy > 30 || gestureState.vy > 0.25;

        if (isTap || isDragDown) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!visible || !member) return null;

  const profile = member.profile || {};
  const name = profile.full_name || member.full_name || 'Circle Member';
  const avatarUrl = profile.avatar_url || member.avatar_url;
  const trueLeaderId = activeCircle?.owner_id || allCircleMembers.find((m) => m.role === 'owner')?.user_id;
  const isActualLeader = (member.user_id || member.id) === trueLeaderId;
  const role = isActualLeader ? 'owner' : (member.role === 'owner' ? 'co_leader' : (member.role || 'member'));
  const phone = profile.phone || member.phone || profile.phone_number || member.phone_number || '';
  const battery = member.batteryPct !== undefined && member.batteryPct !== null ? `${member.batteryPct}%` : '—';
  const isLowBattery = member.batteryPct !== undefined && member.batteryPct !== null && member.batteryPct <= 20;
  const isDriving = Boolean(member.isDriving || member.is_driving || ((member.speed_mps || member.speed || 0) * 3.6 > 18));
  const isOnline = member.isOnline !== false;
  const isTargetOwner = role === 'owner';

  // Privacy & GPS Protocols (for Leader Inspection & Control)
  const isGhostActive = localGhost !== null ? localGhost : Boolean(profile.is_ghost_mode);
  const isHideOnline = localOnline !== null ? localOnline : Boolean(profile.hide_online_presence);
  const gpsFrequency = localGps !== null ? localGps : (profile.gps_frequency || 'balanced');
  const isShakeSos = localShake !== null ? localShake : Boolean(profile.shake_sos_enabled);
  const isAppLock = localLock !== null ? localLock : Boolean(profile.app_lock_enabled);

  const gpsFreqLabel =
    gpsFrequency === 'realtime'
      ? 'Ultra Fast • 5s live breadcrumb telemetry'
      : gpsFrequency === 'battery_saver'
      ? 'Eco Mode • 60s battery saver sync'
      : 'Balanced • 15s adaptive movement sync';

  const gpsFreqTag =
    gpsFrequency === 'realtime'
      ? '5s FAST'
      : gpsFrequency === 'battery_saver'
      ? '60s ECO'
      : '15s BAL';

  const targetUserId = member.user_id || member.id;
  const memberLat = member.latitude ?? member.last_latitude ?? profile.last_latitude;
  const memberLng = member.longitude ?? member.last_longitude ?? profile.last_longitude;
  const hasValidLocation = memberLat != null && memberLng != null && !isNaN(Number(memberLat)) && !isNaN(Number(memberLng));
  const mapsUrl = hasValidLocation ? `https://maps.google.com/?q=${memberLat},${memberLng}` : '';

  const handleLeaderToggleSetting = async (
    field: 'is_ghost_mode' | 'hide_online_presence' | 'shake_sos_enabled' | 'app_lock_enabled',
    newValue: boolean
  ) => {
    if (!canManageRanks || isSelf) return;
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }

    // 1. Optimistic local state update
    if (field === 'is_ghost_mode') setLocalGhost(newValue);
    if (field === 'hide_online_presence') setLocalOnline(newValue);
    if (field === 'shake_sos_enabled') setLocalShake(newValue);
    if (field === 'app_lock_enabled') setLocalLock(newValue);

    // 2. Optimistic CircleStore update
    useCircleStore.setState((state) => ({
      members: state.members.map((m: any) =>
        ((m.user_id || m.id) === targetUserId)
          ? {
              ...m,
              profile: {
                full_name: m.profile?.full_name || m.full_name || 'Member',
                avatar_url: m.profile?.avatar_url || m.avatar_url || null,
                ...(m.profile || {}),
                [field]: newValue,
              },
            }
          : m
      ),
    }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: newValue })
        .eq('id', targetUserId);

      if (error) throw error;
    } catch (err: any) {
      console.error(`[MemberQuickActionsModal] Failed to update ${field}:`, err);
      // Rollback
      if (field === 'is_ghost_mode') setLocalGhost(Boolean(profile.is_ghost_mode));
      if (field === 'hide_online_presence') setLocalOnline(Boolean(profile.hide_online_presence));
      if (field === 'shake_sos_enabled') setLocalShake(Boolean(profile.shake_sos_enabled));
      if (field === 'app_lock_enabled') setLocalLock(Boolean(profile.app_lock_enabled));
      Alert.alert('Update Failed', `Could not update member setting. Please verify circle permissions.`);
    }
  };

  const handleCycleGpsFrequency = async () => {
    if (!canManageRanks || isSelf) return;
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }

    const order = ['realtime', 'balanced', 'battery_saver'];
    const currentIndex = order.indexOf(gpsFrequency);
    const nextFreq = order[(currentIndex + 1) % order.length];

    setLocalGps(nextFreq);

    useCircleStore.setState((state) => ({
      members: state.members.map((m: any) =>
        ((m.user_id || m.id) === targetUserId)
          ? {
              ...m,
              profile: {
                full_name: m.profile?.full_name || m.full_name || 'Member',
                avatar_url: m.profile?.avatar_url || m.avatar_url || null,
                ...(m.profile || {}),
                gps_frequency: nextFreq,
              },
            }
          : m
      ),
    }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gps_frequency: nextFreq })
        .eq('id', targetUserId);

      if (error) throw error;
    } catch (err: any) {
      console.error('[MemberQuickActionsModal] Failed to update gps_frequency:', err);
      setLocalGps(profile.gps_frequency || 'balanced');
      Alert.alert('Update Failed', 'Could not update GPS frequency.');
    }
  };

  const handleExternalShare = async () => {
    try {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(10); } catch (_) {}
      }
      const circleName = useCircleStore.getState().circles?.find((c) => c.id === circleId)?.name || 'our Circle';
      const message = hasValidLocation
        ? `📍 CircleGuard Live Location: ${name}'s location in ${circleName}: ${mapsUrl} (Battery: ${battery})`
        : `📍 CircleGuard: ${name} is a member of ${circleName}. Live location is currently syncing.`;

      await Share.share({
        title: `${name}'s Location`,
        message,
      });
    } catch (error) {
      console.warn('[MemberQuickActionsModal] Share error:', error);
    }
  };

  const handlePostLocationToChat = async () => {
    try {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(10); } catch (_) {}
      }
      const currentUserId = useAuthStore.getState().session?.user?.id;
      const circleName = useCircleStore.getState().circles?.find((c) => c.id === circleId)?.name || 'Circle';

      if (!circleId || !currentUserId) {
        Alert.alert('Unable to Share', 'Active circle or user session not found.');
        return;
      }

      const { error } = await supabase.from('circle_messages').insert({
        circle_id: circleId,
        sender_id: currentUserId,
        content: `📍 [Leader Share] ${name}'s Live Location:\n${mapsUrl || 'Coordinates updating...'}`,
      });

      if (error) throw error;

      Alert.alert('Shared to Chat', `${name}'s live location has been posted to ${circleName} group chat.`);
      setIsShareModalOpen(false);
    } catch (err: any) {
      console.error('[Post to chat error]', err);
      Alert.alert('Chat Share Error', 'Failed to post location to chat.');
    }
  };

  const handleBroadcastLocationToCircle = async () => {
    if (isBroadcasting) return;
    setIsBroadcasting(true);
    try {
      const currentUserId = useAuthStore.getState().session?.user?.id;
      const currentUserProfile = useAuthStore.getState().profile;
      const leaderName = currentUserProfile?.full_name || 'Circle Leader';
      const circleName = useCircleStore.getState().circles?.find((c) => c.id === circleId)?.name || 'Circle';

      // 1. Post to circle chat
      if (circleId && currentUserId) {
        await supabase.from('circle_messages').insert({
          circle_id: circleId,
          sender_id: currentUserId,
          content: `📍 [Leader Broadcast] Shared ${name}'s live location with ${circleName}:\n${mapsUrl || 'Location currently updating'}`,
        });
      }

      // 2. Fetch push tokens of other circle members
      if (circleId) {
        const { data: circleMembersData } = await supabase
          .from('circle_members')
          .select('user_id, profiles(push_token, expo_push_token, full_name)')
          .eq('circle_id', circleId)
          .neq('user_id', currentUserId);

        if (circleMembersData && circleMembersData.length > 0) {
          for (const cm of circleMembersData) {
            const prof: any = Array.isArray(cm.profiles) ? cm.profiles[0] : cm.profiles;
            const token = prof?.expo_push_token || prof?.push_token;
            if (token) {
              sendExpoPushNotification(
                token,
                `📍 ${leaderName} shared ${name}'s location`,
                `${name} is currently active. Tap to view on map.`,
                {
                  type: 'leader_location_share',
                  target_user_id: targetUserId,
                  target_name: name,
                  latitude: memberLat,
                  longitude: memberLng,
                  circle_id: circleId,
                }
              ).catch((err) => console.warn('[Broadcast push error]', err));
            }
          }
        }
      }

      Alert.alert(
        'Location Broadcasted',
        `${name}'s live coordinates have been shared to circle chat and sent as a push notification to all members of ${circleName}.`
      );
      setIsShareModalOpen(false);
    } catch (err: any) {
      console.error('[Broadcast error]', err);
      Alert.alert('Broadcast Error', 'Failed to broadcast location to all members.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCall = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    const cleanPhone = (phone || '').replace(/[^\d+]/g, '');
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        Alert.alert('Unable to Call', 'Device dialer could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  const handleMessage = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    const cleanPhone = (phone || '').replace(/[^\d+]/g, '');
    if (cleanPhone) {
      Linking.openURL(`sms:${cleanPhone}`).catch(() => {
        Alert.alert('Unable to SMS', 'Messaging application could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  // Live status subtitle computation with rich context (plain calculation, no hook violation)
  let statusSubtitle = 'Active recently';
  if (isDriving) {
    const speedKmH = Math.round((member.speed_mps || member.speed || 0) * 3.6);
    statusSubtitle = speedKmH > 10 ? `In transit • ${speedKmH} km/h` : 'In transit • Driving safely';
  } else if (member.latestPlaceEvent?.event_type === 'arrival' && member.latestPlaceEvent?.place_name) {
    statusSubtitle = `Safe Zone • ${member.latestPlaceEvent.place_name}`;
  } else if (isOnline) {
    statusSubtitle = 'Active now • Live GPS connected';
  } else if (member.lastActiveText || member.lastSeenText) {
    statusSubtitle = member.lastActiveText || member.lastSeenText;
  }

  const roleLabel =
    role === 'owner'
      ? 'Circle Leader'
      : role === 'co_leader'
      ? 'Co-Leader'
      : role === 'guardian'
      ? 'Guardian'
      : 'Member';

  const roleIcon: keyof typeof Ionicons.glyphMap =
    role === 'owner'
      ? 'shield-checkmark'
      : role === 'co_leader'
      ? 'shield'
      : role === 'guardian'
      ? 'eye'
      : 'person';

  // Bespoke Luxury CircleGuard Role Tokens: Champagne Gold, Neon Mint, Deep Jade & Frosted Platinum
  const roleColor =
    role === 'owner'
      ? (isDark ? '#F5A623' : '#D97706')
      : role === 'co_leader'
      ? (isDark ? '#3ADFAB' : '#059669')
      : role === 'guardian'
      ? (isDark ? '#4AE3B5' : '#047857')
      : (isDark ? '#CAD8D0' : '#475C50');

  const roleBg =
    role === 'owner'
      ? (isDark ? 'rgba(245, 166, 35, 0.14)' : '#FEF3C7')
      : role === 'co_leader'
      ? (isDark ? 'rgba(58, 223, 171, 0.14)' : '#ECFDF5')
      : role === 'guardian'
      ? (isDark ? 'rgba(46, 125, 91, 0.20)' : '#E6F4ED')
      : (isDark ? 'rgba(202, 216, 208, 0.10)' : '#F0F4F2');

  const roleBorder =
    role === 'owner'
      ? (isDark ? 'rgba(245, 166, 35, 0.38)' : 'rgba(217, 119, 6, 0.35)')
      : role === 'co_leader'
      ? (isDark ? 'rgba(58, 223, 171, 0.38)' : 'rgba(5, 150, 105, 0.35)')
      : role === 'guardian'
      ? (isDark ? 'rgba(46, 125, 91, 0.40)' : 'rgba(4, 120, 87, 0.30)')
      : (isDark ? 'rgba(202, 216, 208, 0.22)' : 'rgba(71, 92, 80, 0.20)');

  const handleDirections = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    handleDismiss(() => {
      if (onNavigateMember) {
        onNavigateMember(member);
      } else if (member.latitude && member.longitude) {
        const scheme = Platform.select({
          ios: `maps:0,0?q=${member.latitude},${member.longitude}`,
          android: `geo:0,0?q=${member.latitude},${member.longitude}`,
          web: `https://www.google.com/maps/search/?api=1&query=${member.latitude},${member.longitude}`,
        });
        if (scheme) Linking.openURL(scheme);
      }
    });
  };

  const handleChat = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    handleDismiss(() => {
      if (onChatMember) {
        onChatMember(member);
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => handleDismiss()}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={() => handleDismiss()}
        />

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#121714' : '#FFFFFF',
              borderColor: isDark ? '#233028' : '#E6EBE8',
              paddingBottom: Math.max(insets.bottom + 16, 28),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Header Bar: Centered Drag Indicator & Quick Close X Button */}
          <View style={styles.sheetHeaderBar}>
            <View style={styles.headerBarSpacer} />
            <View
              {...panResponder.panHandlers}
              style={styles.dragPillWrapper}
              accessible={true}
              accessibilityLabel="Drag down or tap to close"
              accessibilityRole="button"
            >
              <View style={[styles.dragPill, { backgroundColor: isDark ? '#2E3D34' : '#D5DDD8' }]} />
            </View>
            <TouchableOpacity
              style={[
                styles.topCloseBtn,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
              ]}
              onPress={() => handleDismiss()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close actions"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={17} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Member Profile & Live Telemetry Card (Glassmorphic Hero Surface) */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: isDark ? '#141C17' : '#FFFFFF',
                borderColor: isDark ? 'rgba(58, 223, 171, 0.18)' : '#E2ECE6',
              },
            ]}
          >
            <View style={styles.profileCardTop}>
              {/* Avatar with Dual Orbit Halo & Live Beacon */}
              <View
                style={[
                  styles.avatarOrbitHalo,
                  {
                    borderColor: isOnline
                      ? (isDark ? 'rgba(58, 223, 171, 0.40)' : 'rgba(16, 185, 129, 0.40)')
                      : (isDark ? '#233028' : '#D1DCD6'),
                  },
                ]}
              >
                <View style={[styles.avatarInnerRing, { backgroundColor: isDark ? '#18221D' : '#F4FAF6' }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1E2B23' : '#E0EFE7' }]}>
                      <Text style={[styles.avatarInitial, { color: roleColor }]}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Live Status Beacon Dot */}
                <View
                  style={[
                    styles.onlineGlowDot,
                    {
                      backgroundColor: isDriving ? '#F5A623' : isOnline ? '#10B981' : '#718579',
                      borderColor: isDark ? '#141C17' : '#FFFFFF',
                    },
                  ]}
                >
                  <Ionicons
                    name={isDriving ? 'car' : isOnline ? 'checkmark' : 'time'}
                    size={7.5}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              {/* Profile Details Column */}
              <View style={styles.profileDetails}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.memberName, { color: isDark ? '#FFFFFF' : '#111814' }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {isSelf && (
                    <View
                      style={[
                        styles.selfTag,
                        {
                          backgroundColor: isDark ? 'rgba(58, 223, 171, 0.15)' : '#E0F5EB',
                          borderColor: isDark ? 'rgba(58, 223, 171, 0.35)' : 'rgba(46, 125, 91, 0.30)',
                        },
                      ]}
                    >
                      <Text style={[styles.selfTagText, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>YOU</Text>
                    </View>
                  )}
                </View>

                {/* Real-time Activity Subtitle */}
                <View style={styles.statusSubtitleRow}>
                  <Ionicons
                    name={isDriving ? 'car-sport' : isOnline ? 'radio' : 'time-outline'}
                    size={11.5}
                    color={isDriving ? '#F5A623' : isOnline ? '#10B981' : (isDark ? '#7E9387' : '#6A7D71')}
                  />
                  <Text
                    style={[
                      styles.statusSubtitleText,
                      {
                        color: isDriving
                          ? (isDark ? '#FCD34D' : '#B45309')
                          : isOnline
                          ? (isDark ? '#3ADFAB' : '#047857')
                          : (isDark ? '#8A9E92' : '#62766A'),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {statusSubtitle}
                  </Text>
                </View>

                {/* Telemetry Micro-Pills */}
                <View style={styles.telemetryRow}>
                  <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleBorder }]}>
                    <Ionicons name={roleIcon} size={9.5} color={roleColor} />
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                  </View>

                  <View
                    style={[
                      styles.batteryBadge,
                      {
                        backgroundColor: isLowBattery
                          ? (isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2')
                          : (isDark ? 'rgba(58, 223, 171, 0.10)' : '#EAF7F0'),
                        borderColor: isLowBattery
                          ? 'rgba(239, 68, 68, 0.40)'
                          : (isDark ? 'rgba(58, 223, 171, 0.22)' : '#D1EAE0'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={isLowBattery ? 'battery-dead' : 'battery-charging'}
                      size={11}
                      color={isLowBattery ? '#EF4444' : (isDark ? '#3ADFAB' : '#007A55')}
                    />
                    <Text
                      style={[
                        styles.batteryText,
                        { color: isLowBattery ? '#EF4444' : (isDark ? '#CAD8D0' : '#143827') },
                      ]}
                    >
                      {battery}
                    </Text>
                  </View>

                  {phone ? (
                    <TouchableOpacity
                      style={[
                        styles.phoneBadge,
                        {
                          backgroundColor: isDark ? '#1C2720' : '#F1F6F3',
                          borderColor: isDark ? '#2B3D32' : '#DEE7E2',
                        },
                      ]}
                      onPress={handleCall}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={9} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                      <Text style={[styles.phoneBadgeText, { color: isDark ? '#9EACA3' : '#4C6054' }]} numberOfLines={1}>
                        {phone}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Integrated Executive 4-Button Action Toolbar */}
            {!isSelf ? (
              <View style={[styles.quickContactStrip, { borderTopColor: isDark ? '#1E2922' : '#E7EFEA' }]}>
                {/* 1. Direct Call */}
                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(58, 223, 171, 0.12)' : '#E8FAF2',
                      borderColor: isDark ? 'rgba(58, 223, 171, 0.28)' : 'rgba(58, 223, 171, 0.45)',
                    },
                  ]}
                  onPress={handleCall}
                  activeOpacity={0.72}
                  accessibilityLabel={`Call ${name}`}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.18)' : '#D0F5E4' }]}>
                    <Ionicons name="call" size={12} color={isDark ? '#3ADFAB' : '#059669'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#3ADFAB' : '#059669' }]}>
                    Call
                  </Text>
                </TouchableOpacity>

                {/* 2. Direct SMS */}
                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(245, 166, 35, 0.12)' : '#FEF8EC',
                      borderColor: isDark ? 'rgba(245, 166, 35, 0.28)' : 'rgba(245, 166, 35, 0.45)',
                    },
                  ]}
                  onPress={handleMessage}
                  activeOpacity={0.72}
                  accessibilityLabel={`SMS ${name}`}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.18)' : '#FDE8C7' }]}>
                    <Ionicons name="chatbubble-ellipses" size={12} color={isDark ? '#F5A623' : '#D97706'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#F5A623' : '#D97706' }]}>
                    SMS
                  </Text>
                </TouchableOpacity>

                {/* 3. Tag in Circle Chat */}
                {onChatMember && (
                  <TouchableOpacity
                    style={[
                      styles.contactActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(46, 125, 91, 0.18)' : '#EBF7F1',
                        borderColor: isDark ? 'rgba(46, 125, 91, 0.35)' : 'rgba(46, 125, 91, 0.40)',
                      },
                    ]}
                    onPress={handleChat}
                    activeOpacity={0.72}
                    accessibilityLabel={`Tag ${name} in Chat`}
                  >
                    <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(46, 125, 91, 0.26)' : '#D7EFE3' }]}>
                      <Ionicons name="chatbubbles" size={12} color={isDark ? '#4AE3B5' : '#047857'} />
                    </View>
                    <Text style={[styles.contactActionBtnText, { color: isDark ? '#4AE3B5' : '#047857' }]}>
                      Chat
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 4. Live Directions */}
                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(0, 210, 255, 0.12)' : '#EDFAFD',
                      borderColor: isDark ? 'rgba(0, 210, 255, 0.28)' : 'rgba(0, 210, 255, 0.40)',
                    },
                  ]}
                  onPress={handleDirections}
                  activeOpacity={0.72}
                  accessibilityLabel={`Route to ${name}`}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.18)' : '#D0F3FB' }]}>
                    <Ionicons name="navigate" size={12} color={isDark ? '#00D2FF' : '#0284C7'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#00D2FF' : '#0284C7' }]}>
                    Route
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.quickContactStrip, { borderTopColor: isDark ? '#1E2922' : '#E7EFEA' }]}>
                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(58, 223, 171, 0.12)' : '#E8FAF2',
                      borderColor: isDark ? 'rgba(58, 223, 171, 0.28)' : 'rgba(58, 223, 171, 0.45)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onRingMember) onRingMember(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.18)' : '#D0F5E4' }]}>
                    <Ionicons name="locate" size={12} color={isDark ? '#3ADFAB' : '#059669'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#3ADFAB' : '#059669' }]}>
                    Locate Me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(245, 166, 35, 0.12)' : '#FEF8EC',
                      borderColor: isDark ? 'rgba(245, 166, 35, 0.28)' : 'rgba(245, 166, 35, 0.45)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onOpenHistory) onOpenHistory(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.18)' : '#FDE8C7' }]}>
                    <Ionicons name="time" size={12} color={isDark ? '#F5A623' : '#D97706'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#F5A623' : '#D97706' }]}>
                    Timeline
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.contactActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.40)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onOpenDriving) onOpenDriving(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#D1FAE5' }]}>
                    <Ionicons name="speedometer" size={12} color={isDark ? '#10B981' : '#047857'} />
                  </View>
                  <Text style={[styles.contactActionBtnText, { color: isDark ? '#10B981' : '#047857' }]}>
                    Driving
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action List & Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Quick Actions Header with Emerald Accent Dot */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWithDot}>
                <View style={[styles.sectionTitleDot, { backgroundColor: isDark ? '#3ADFAB' : '#2E7D5B' }]} />
                <Text style={[styles.sectionTitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                  QUICK ACTIONS
                </Text>
              </View>
            </View>

            {/* 2x2 Tactile Action Grid */}
            <View style={styles.actionGrid}>
              {/* Row 1: Directions & Siren / Locate */}
              <View style={styles.gridRow}>
                {/* Tile 1: Directions */}
                <TouchableOpacity
                  style={[
                    styles.gridTile,
                    {
                      backgroundColor: isDark ? '#16201B' : '#F6FAF7',
                      borderColor: isDark ? 'rgba(58, 223, 171, 0.22)' : 'rgba(46, 125, 91, 0.20)',
                    },
                  ]}
                  onPress={handleDirections}
                  activeOpacity={0.72}
                >
                  <View
                    style={[
                      styles.tileIconSquircle,
                      { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.16)' : '#E3F5EC' },
                    ]}
                  >
                    <Ionicons name="navigate" size={19} color={isDark ? '#3ADFAB' : '#006C4F'} />
                  </View>
                  <View style={styles.tileTextWrap}>
                    <Text style={[styles.tileTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                      Directions
                    </Text>
                    <Text style={[styles.tileSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                      Live GPS route
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Tile 2: Ring / Ping */}
                <TouchableOpacity
                  style={[
                    styles.gridTile,
                    {
                      backgroundColor: isDark ? '#121E24' : '#F4F9FD',
                      borderColor: isDark ? 'rgba(0, 210, 255, 0.22)' : 'rgba(2, 132, 199, 0.20)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onRingMember) onRingMember(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View
                    style={[
                      styles.tileIconSquircle,
                      { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.16)' : '#E0F2FE' },
                    ]}
                  >
                    <Ionicons
                      name={isSelf ? 'locate' : 'notifications'}
                      size={19}
                      color={isDark ? '#00D2FF' : '#0284C7'}
                    />
                  </View>
                  <View style={styles.tileTextWrap}>
                    <Text style={[styles.tileTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                      {isSelf ? 'Locate Phone' : 'Ring Device'}
                    </Text>
                    <Text style={[styles.tileSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                      {isSelf ? 'Center on map' : 'Audible chime'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Row 2: Timeline & Drive Safety */}
              <View style={styles.gridRow}>
                {/* Tile 3: Timeline / History */}
                <TouchableOpacity
                  style={[
                    styles.gridTile,
                    {
                      backgroundColor: isDark ? '#211B14' : '#FEFAF4',
                      borderColor: isDark ? 'rgba(245, 166, 35, 0.22)' : 'rgba(217, 119, 6, 0.20)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onOpenHistory) onOpenHistory(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View
                    style={[
                      styles.tileIconSquircle,
                      { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.16)' : '#FEF3C7' },
                    ]}
                  >
                    <Ionicons name="time" size={19} color={isDark ? '#F5A623' : '#D97706'} />
                  </View>
                  <View style={styles.tileTextWrap}>
                    <Text style={[styles.tileTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                      Timeline
                    </Text>
                    <Text style={[styles.tileSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                      24h breadcrumbs
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Tile 4: Drive Safety Report */}
                <TouchableOpacity
                  style={[
                    styles.gridTile,
                    {
                      backgroundColor: isDark ? '#142019' : '#F4FBF7',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.20)',
                    },
                  ]}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onOpenDriving) onOpenDriving(member);
                    });
                  }}
                  activeOpacity={0.72}
                >
                  <View
                    style={[
                      styles.tileIconSquircle,
                      { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#E6F9F0' },
                    ]}
                  >
                    <Ionicons name="speedometer" size={19} color={isDark ? '#10B981' : '#059669'} />
                  </View>
                  <View style={styles.tileTextWrap}>
                    <Text style={[styles.tileTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                      Drive Safety
                    </Text>
                    <Text style={[styles.tileSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                      Speed & trips
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contextual Attention: Low Battery Nudge Alert */}
            {isLowBattery && (
              <View
                style={[
                  styles.nudgeAlertCard,
                  {
                    backgroundColor: isDark ? '#281717' : '#FFF5F5',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                  },
                ]}
              >
                <View style={styles.nudgeAlertLeft}>
                  <View style={[styles.nudgeIconSquircle, { backgroundColor: isDark ? '#471818' : '#FEE2E2' }]}>
                    <Ionicons name="flash" size={17} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.nudgeAlertTitle}>
                      Low Battery Warning ({battery})
                    </Text>
                    <Text style={[styles.nudgeAlertDesc, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                      Send high-priority vibration ping to charge
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.nudgeActionBtn}
                  onPress={() => {
                    handleDismiss(() => {
                      if (onNudgeMember) onNudgeMember(member);
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="notifications-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.nudgeActionBtnText}>Nudge</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Security & Privacy Protocol Inspection & Leader Controls */}
            {canManageRanks && (
              <>
                <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
                  <View style={styles.sectionTitleWithDot}>
                    <View style={[styles.sectionTitleDot, { backgroundColor: isDark ? '#00D2FF' : '#0284C7' }]} />
                    <Text style={[styles.sectionTitle, { color: isDark ? '#829589' : '#73867A' }]}>
                      {canManageRanks && !isSelf
                        ? 'SECURITY & PRIVACY PROTOCOLS (LEADER CONTROL)'
                        : 'SECURITY & PRIVACY PROTOCOLS (LEADER AUDIT)'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.groupedCard,
                    {
                      backgroundColor: isDark ? '#17201B' : '#F7FAF8',
                      borderColor: isDark ? '#26372E' : '#E3ECE6',
                    },
                  ]}
                >
                  {/* Ghost Mode */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        {
                          backgroundColor: isGhostActive
                            ? (isDark ? 'rgba(245, 166, 35, 0.18)' : '#FEF3C7')
                            : (isDark ? '#1D2E25' : '#E3F5EC'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isGhostActive ? 'eye-off' : 'eye'}
                        size={17}
                        color={isGhostActive ? '#F5A623' : (isDark ? '#3ADFAB' : '#006C4F')}
                      />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Ghost Location Mode
                      </Text>
                      <Text style={[styles.groupedSubtitle, { color: isGhostActive ? '#F5A623' : (isDark ? '#8A9E92' : '#6A7D71') }]}>
                        {isGhostActive ? 'Active • Location fuzzed (~500m offset)' : 'Disabled • Exact real-time GPS stream'}
                      </Text>
                    </View>
                    {canManageRanks && !isSelf ? (
                      <Switch
                        value={isGhostActive}
                        onValueChange={(val) => handleLeaderToggleSetting('is_ghost_mode', val)}
                        trackColor={{ false: isDark ? '#26372E' : '#D1D5DB', true: '#F5A623' }}
                        thumbColor="#FFFFFF"
                      />
                    ) : (
                      <View
                        style={[
                          styles.auditStatusPill,
                          {
                            backgroundColor: isGhostActive
                              ? (isDark ? 'rgba(245, 166, 35, 0.20)' : '#FEF3C7')
                              : (isDark ? 'rgba(58, 223, 171, 0.15)' : '#E3F5EC'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditStatusText,
                            { color: isGhostActive ? '#F5A623' : (isDark ? '#3ADFAB' : '#006C4F') },
                          ]}
                        >
                          {isGhostActive ? 'FUZZED' : 'EXACT'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.hairlineDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* GPS Telemetry Frequency (Tap to Cycle for Leaders) */}
                  <TouchableOpacity
                    style={styles.auditRow}
                    activeOpacity={canManageRanks && !isSelf ? 0.7 : 1}
                    onPress={canManageRanks && !isSelf ? handleCycleGpsFrequency : undefined}
                  >
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.16)' : '#E0F2FE' },
                      ]}
                    >
                      <Ionicons name="pulse" size={17} color={isDark ? '#00D2FF' : '#0284C7'} />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                          GPS Sync Frequency
                        </Text>
                        {canManageRanks && !isSelf && (
                          <Ionicons name="swap-horizontal" size={14} color={isDark ? '#00D2FF' : '#0284C7'} />
                        )}
                      </View>
                      <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {gpsFreqLabel}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.auditStatusPill,
                        { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.16)' : '#E0F2FE' },
                      ]}
                    >
                      <Text style={[styles.auditStatusText, { color: isDark ? '#00D2FF' : '#0284C7' }]}>
                        {gpsFreqTag}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.hairlineDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Online Presence */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        {
                          backgroundColor: isHideOnline
                            ? (isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2')
                            : (isDark ? '#1D2E25' : '#E3F5EC'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isHideOnline ? 'cloud-offline' : 'wifi'}
                        size={17}
                        color={isHideOnline ? '#EF4444' : (isDark ? '#3ADFAB' : '#006C4F')}
                      />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Online Presence
                      </Text>
                      <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isHideOnline ? 'Hidden • Offline stealth status enabled' : 'Visible • Circle broadcast active'}
                      </Text>
                    </View>
                    {canManageRanks && !isSelf ? (
                      <Switch
                        value={!isHideOnline}
                        onValueChange={(val) => handleLeaderToggleSetting('hide_online_presence', !val)}
                        trackColor={{ false: isDark ? '#26372E' : '#D1D5DB', true: isDark ? '#3ADFAB' : '#006C4F' }}
                        thumbColor="#FFFFFF"
                      />
                    ) : (
                      <View
                        style={[
                          styles.auditStatusPill,
                          {
                            backgroundColor: isHideOnline
                              ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2')
                              : (isDark ? 'rgba(58, 223, 171, 0.15)' : '#E3F5EC'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditStatusText,
                            { color: isHideOnline ? '#EF4444' : (isDark ? '#3ADFAB' : '#006C4F') },
                          ]}
                        >
                          {isHideOnline ? 'HIDDEN' : 'BROADCAST'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.hairlineDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Shake Phone for SOS */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        {
                          backgroundColor: isShakeSos
                            ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2')
                            : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Ionicons
                        name="phone-portrait"
                        size={17}
                        color={isShakeSos ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                      />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Shake Phone for SOS
                      </Text>
                      <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isShakeSos ? 'Armed • Accelerometer triggers instant alert' : 'Disabled • Manual alert only'}
                      </Text>
                    </View>
                    {canManageRanks && !isSelf ? (
                      <Switch
                        value={isShakeSos}
                        onValueChange={(val) => handleLeaderToggleSetting('shake_sos_enabled', val)}
                        trackColor={{ false: isDark ? '#26372E' : '#D1D5DB', true: '#EF4444' }}
                        thumbColor="#FFFFFF"
                      />
                    ) : (
                      <View
                        style={[
                          styles.auditStatusPill,
                          {
                            backgroundColor: isShakeSos
                              ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2')
                              : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditStatusText,
                            { color: isShakeSos ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B') },
                          ]}
                        >
                          {isShakeSos ? 'ARMED' : 'OFF'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.hairlineDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Biometric App Lock */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        {
                          backgroundColor: isAppLock
                            ? (isDark ? 'rgba(58, 223, 171, 0.18)' : '#E3F5EC')
                            : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isAppLock ? 'finger-print' : 'lock-open-outline'}
                        size={17}
                        color={isAppLock ? (isDark ? '#3ADFAB' : '#006C4F') : (isDark ? '#94A3B8' : '#64748B')}
                      />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Biometric App Lock
                      </Text>
                      <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isAppLock ? 'Enforced • Biometric authentication active' : 'Disabled • Open launch'}
                      </Text>
                    </View>
                    {canManageRanks && !isSelf ? (
                      <Switch
                        value={isAppLock}
                        onValueChange={(val) => handleLeaderToggleSetting('app_lock_enabled', val)}
                        trackColor={{ false: isDark ? '#26372E' : '#D1D5DB', true: isDark ? '#3ADFAB' : '#006C4F' }}
                        thumbColor="#FFFFFF"
                      />
                    ) : (
                      <View
                        style={[
                          styles.auditStatusPill,
                          {
                            backgroundColor: isAppLock
                              ? (isDark ? 'rgba(58, 223, 171, 0.15)' : '#E3F5EC')
                              : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditStatusText,
                            { color: isAppLock ? (isDark ? '#3ADFAB' : '#006C4F') : (isDark ? '#94A3B8' : '#64748B') },
                          ]}
                        >
                          {isAppLock ? 'ENFORCED' : 'OFF'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Leader Broadcast Location to Other Circle Members */}
                {canManageRanks && !isSelf && (
                  <>
                    <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
                      <View style={styles.sectionTitleWithDot}>
                        <View style={[styles.sectionTitleDot, { backgroundColor: isDark ? '#F5A623' : '#D97706' }]} />
                        <Text style={[styles.sectionTitle, { color: isDark ? '#829589' : '#73867A' }]}>
                          CIRCLE LOCATION SHARING (LEADER ACTION)
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.leaderShareCard,
                        {
                          backgroundColor: isDark ? 'rgba(245, 166, 35, 0.08)' : '#FFFBEB',
                          borderColor: isDark ? 'rgba(245, 166, 35, 0.28)' : '#FDE68A',
                        },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setIsShareModalOpen(true)}
                    >
                      <View
                        style={[
                          styles.leaderShareIconSquircle,
                          { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.18)' : '#FEF3C7' },
                        ]}
                      >
                        <Ionicons name="share-social" size={19} color={isDark ? '#F5A623' : '#D97706'} />
                      </View>
                      <View style={styles.groupedTextCol}>
                        <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                          Share {name}'s Location to Circle
                        </Text>
                        <Text style={[styles.groupedSubtitle, { color: isDark ? '#B0C2B7' : '#788E81' }]}>
                          Broadcast live coordinates to other members via push, chat, or external apps
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={isDark ? '#F5A623' : '#D97706'} />
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* Governance & Member Controls (Apple Inset Surface) */}
            {!isTargetOwner && (
              <>
                <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#829589' : '#73867A' }]}>
                    CIRCLE GOVERNANCE & SUPERVISION
                  </Text>
                </View>

                <View
                  style={[
                    styles.groupedCard,
                    {
                      backgroundColor: isDark ? '#17201B' : '#F7FAF8',
                      borderColor: isDark ? '#26372E' : '#E3ECE6',
                    },
                  ]}
                >
                  {/* Row 1: Assign / Change Guardian Supervisor */}
                  <TouchableOpacity
                    style={styles.groupedRow}
                    onPress={() => {
                      const target = member;
                      handleDismiss(() => {
                        if (onAssignGuardian) onAssignGuardian(target);
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        { backgroundColor: isDark ? '#1D2E25' : '#E3F5EC' },
                      ]}
                    >
                      <Ionicons name="shield-checkmark" size={17} color={isDark ? '#3ADFAB' : '#006C4F'} />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Guardian Supervisor
                      </Text>
                      <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        Designate alert recipient for SOS & zones
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? '#4F6357' : '#94A3B8'} />
                  </TouchableOpacity>

                  {/* Divider */}
                  {canManageRanks && (
                    <View
                      style={[
                        styles.hairlineDivider,
                        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                    />
                  )}

                  {/* Row 2: Manage Member Role */}
                  {canManageRanks && (
                    <TouchableOpacity
                      style={styles.groupedRow}
                      onPress={() => {
                        const target = member;
                        handleDismiss(() => {
                          if (onManageRole) onManageRole(target);
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.groupedIconSquircle,
                          { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.15)' : '#FEF3C7' },
                        ]}
                      >
                        <Ionicons name="ribbon" size={17} color={isDark ? '#F5A623' : '#D97706'} />
                      </View>
                      <View style={styles.groupedTextCol}>
                        <Text style={[styles.groupedTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                          Member Permissions
                        </Text>
                        <Text style={[styles.groupedSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                          Adjust role as Co-Leader, Guardian or Member
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? '#4F6357' : '#94A3B8'} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Destructive Action: Remove Member */}
                {canManageRanks && !isSelf && !isTargetOwner && (
                  <TouchableOpacity
                    style={[
                      styles.destructiveCard,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FFF7F7',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
                      },
                    ]}
                    onPress={() => {
                      handleDismiss(() => {
                        if (onRemoveMember) onRemoveMember(member);
                      });
                    }}
                    activeOpacity={0.72}
                  >
                    <View style={[styles.groupedIconSquircle, { backgroundColor: isDark ? '#3D1B1B' : '#FEE2E2' }]}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </View>
                    <View style={styles.groupedTextCol}>
                      <Text style={styles.destructiveTitle}>
                        Remove from Circle
                      </Text>
                      <Text style={[styles.destructiveSubtitle, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                        Revoke circle access for {name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>

        {/* Dedicated Location Sharing Bottom Sheet for Circle Leader */}
        {isShareModalOpen && (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={styles.shareModalBackdrop}
              activeOpacity={1}
              onPress={() => setIsShareModalOpen(false)}
            />
            <View
              style={[
                styles.shareModalSheet,
                {
                  backgroundColor: isDark ? '#141E18' : '#FFFFFF',
                  borderColor: isDark ? '#26372E' : '#E2ECE6',
                  paddingBottom: Math.max(insets.bottom + 16, 28),
                },
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.shareDragHandleBox}>
                <View style={[styles.shareDragHandle, { backgroundColor: isDark ? '#2E3D34' : '#D1D5DB' }]} />
              </View>

              {/* Header */}
              <View style={styles.shareSheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareSheetTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                    Share {name}'s Location
                  </Text>
                  <Text style={[styles.shareSheetSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                    Broadcast to other circle members or external apps
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.shareCloseBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
                  onPress={() => setIsShareModalOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={isDark ? '#CAD8D0' : '#475C50'} />
                </TouchableOpacity>
              </View>

              {/* Location Status Card */}
              <View
                style={[
                  styles.shareLocationCard,
                  {
                    backgroundColor: isDark ? '#1C2821' : '#F4F9F6',
                    borderColor: isDark ? '#2E4236' : '#DCEDE3',
                  },
                ]}
              >
                <View style={[styles.shareLocationIconBox, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.16)' : '#E3F5EC' }]}>
                  <Ionicons name="location" size={20} color={isDark ? '#3ADFAB' : '#006C4F'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.shareLocationTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]} numberOfLines={1}>
                    {member.latestPlaceEvent?.place_name || (hasValidLocation ? 'Live GPS Coordinates' : 'Location Updating')}
                  </Text>
                  <Text style={[styles.shareLocationCoord, { color: isDark ? '#8A9E92' : '#6A7D71' }]} numberOfLines={1}>
                    {hasValidLocation
                      ? `${Number(memberLat).toFixed(5)}, ${Number(memberLng).toFixed(5)} • ${statusSubtitle}`
                      : 'Connecting to member telemetry...'}
                  </Text>
                </View>
              </View>

              {/* Action 1: Broadcast Push to Circle */}
              <TouchableOpacity
                style={[
                  styles.shareActionCard,
                  {
                    backgroundColor: isDark ? '#1A241E' : '#FFFFFF',
                    borderColor: isDark ? '#2C3E33' : '#E2ECE6',
                  },
                ]}
                activeOpacity={0.75}
                onPress={handleBroadcastLocationToCircle}
                disabled={isBroadcasting}
              >
                <View style={[styles.shareActionIconBox, { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.16)' : '#FEF3C7' }]}>
                  <Ionicons name="radio" size={19} color={isDark ? '#F5A623' : '#D97706'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareActionTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                    Broadcast Push to Circle
                  </Text>
                  <Text style={[styles.shareActionSub, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                    Send high-priority alert & map link to all circle members
                  </Text>
                </View>
                {isBroadcasting ? (
                  <Text style={{ fontSize: 12, color: '#F5A623', fontWeight: '700' }}>Sending...</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={isDark ? '#4F6357' : '#94A3B8'} />
                )}
              </TouchableOpacity>

              {/* Action 2: Post to Circle Chat */}
              <TouchableOpacity
                style={[
                  styles.shareActionCard,
                  {
                    backgroundColor: isDark ? '#1A241E' : '#FFFFFF',
                    borderColor: isDark ? '#2C3E33' : '#E2ECE6',
                  },
                ]}
                activeOpacity={0.75}
                onPress={handlePostLocationToChat}
              >
                <View style={[styles.shareActionIconBox, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.16)' : '#E3F5EC' }]}>
                  <Ionicons name="chatbubbles" size={19} color={isDark ? '#3ADFAB' : '#006C4F'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareActionTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                    Post to Circle Chat
                  </Text>
                  <Text style={[styles.shareActionSub, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                    Pin location into group chat for all members to view
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={isDark ? '#4F6357' : '#94A3B8'} />
              </TouchableOpacity>

              {/* Action 3: External Share (WhatsApp / SMS / Maps) */}
              <TouchableOpacity
                style={[
                  styles.shareActionCard,
                  {
                    backgroundColor: isDark ? '#1A241E' : '#FFFFFF',
                    borderColor: isDark ? '#2C3E33' : '#E2ECE6',
                  },
                ]}
                activeOpacity={0.75}
                onPress={handleExternalShare}
              >
                <View style={[styles.shareActionIconBox, { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.16)' : '#E0F2FE' }]}>
                  <Ionicons name="share-outline" size={19} color={isDark ? '#00D2FF' : '#0284C7'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareActionTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                    External Share (WhatsApp / SMS)
                  </Text>
                  <Text style={[styles.shareActionSub, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                    Share Google Maps live link with external contacts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={isDark ? '#4F6357' : '#94A3B8'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.40,
    shadowRadius: 28,
    elevation: 24,
  },
  sheetHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
    width: '100%',
  },
  headerBarSpacer: {
    width: 32,
    height: 32,
  },
  topCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPillWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  profileCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.2,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOrbitHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: SANS_FONT,
    fontSize: 21,
    fontWeight: '800',
  },
  onlineGlowDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    position: 'absolute',
    bottom: -1,
    right: -1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    gap: 4.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontFamily: SANS_FONT,
    fontSize: 17.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  selfTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  selfTagText: {
    fontFamily: SANS_FONT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 0.5,
  },
  statusSubtitleText: {
    fontFamily: SANS_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontFamily: SANS_FONT,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  batteryText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '700',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  phoneBadgeText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '600',
  },
  quickContactStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  contactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 13,
    borderWidth: 1,
  },
  contactIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 11.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionTitleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    fontFamily: SANS_FONT,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  actionGrid: {
    width: '100%',
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  gridTile: {
    flex: 1,
    minHeight: 90,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1.2,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  tileIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileTextWrap: {
    gap: 2,
  },
  tileTitle: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  tileSubtitle: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '500',
  },
  nudgeAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    gap: 10,
  },
  nudgeAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  nudgeIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeAlertTitle: {
    fontFamily: SANS_FONT,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  nudgeAlertDesc: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    marginTop: 1,
  },
  nudgeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  nudgeActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  groupedCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  hairlineDivider: {
    height: 1,
    marginLeft: 62,
  },
  groupedIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1.5,
  },
  groupedTitle: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '700',
  },
  groupedSubtitle: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    lineHeight: 14,
  },
  destructiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginTop: 10,
  },
  destructiveTitle: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  destructiveSubtitle: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    lineHeight: 14,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 12,
  },
  auditStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditStatusText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  leaderShareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.2,
    gap: 12,
    marginTop: 10,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  leaderShareIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  shareModalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 30,
  },
  shareDragHandleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  shareDragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 999,
  },
  shareSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
  },
  shareSheetTitle: {
    fontFamily: SANS_FONT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  shareSheetSubtitle: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    marginTop: 2,
  },
  shareCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
  },
  shareLocationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLocationTitle: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
  },
  shareLocationCoord: {
    fontFamily: SANS_FONT,
    fontSize: 11.5,
    marginTop: 1,
  },
  shareActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  shareActionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareActionTitle: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '700',
  },
  shareActionSub: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
});
