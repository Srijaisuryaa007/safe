import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  PanResponder,
  Animated,
  Platform,
  Alert,
  Share,
  Switch,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { sendExpoPushNotification } from '../services/PushNotificationService';

interface MemberShortProfileModalProps {
  visible: boolean;
  onClose: () => void;
  member: any;
  circleId?: string;
  onNavigateToHistory?: (member: any) => void;
  onNavigateToDriving?: (member: any) => void;
  onNavigateToMap?: (member: any) => void;
  onNavigateToChat?: (member: any) => void;
}

export default function MemberShortProfileModal({
  visible,
  onClose,
  member,
  circleId,
  onNavigateToHistory,
  onNavigateToDriving,
  onNavigateToMap,
  onNavigateToChat,
}: MemberShortProfileModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeStore();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const isClosingRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible]);

  const handleDismiss = React.useCallback(
    (callback?: (() => void) | any) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      // When a navigation callback is triggered, execute immediately without animation lag
      if (typeof callback === 'function') {
        onClose();
        callback();
        return;
      }

      Animated.timing(translateY, {
        toValue: 650,
        duration: 160,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        onClose();
      });
    },
    [onClose, translateY]
  );

  const panResponder = React.useRef(
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
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
    })
  ).current;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const activeCircle = useCircleStore((s) => s.activeCircle);
  const circleMembers = useCircleStore((s) => s.members);

  // Local overrides for settings so leader changes toggle with zero latency
  const [localGhost, setLocalGhost] = useState<boolean | null>(null);
  const [localOnline, setLocalOnline] = useState<boolean | null>(null);
  const [localGps, setLocalGps] = useState<string | null>(null);
  const [localShake, setLocalShake] = useState<boolean | null>(null);
  const [localLock, setLocalLock] = useState<boolean | null>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

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

  if (!visible || !member) return null;

  const profile = member.profile || {};
  const name = profile.full_name || 'Circle Member';
  const trueLeaderId = activeCircle?.owner_id || circleMembers.find((m) => m.role === 'owner')?.user_id;
  const isActualLeader = (member.user_id || member.id) === trueLeaderId;
  const role = isActualLeader ? 'owner' : (member.role === 'owner' ? 'co_leader' : (member.role || 'member'));
  const phone = profile.phone || '';
  const avatarUrl = profile.avatar_url;
  const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
  const isLowBattery = member.batteryPct != null && member.batteryPct <= 20;
  const isDriving = Boolean(member.isDriving);
  const isOnline = member.isOnline !== false;

  const myMember = circleMembers.find((m) => m.user_id === currentUserId);
  const isLeader = myMember?.role === 'owner' || myMember?.role === 'co_leader';

  const isSelf = (member.user_id || member.id) === currentUserId;

  // Privacy & GPS Protocols (for Leader Inspection & Control)
  const isGhostActive = localGhost !== null ? localGhost : Boolean(profile.is_ghost_mode);
  const isHideOnline = localOnline !== null ? localOnline : Boolean(profile.hide_online_presence);
  const gpsFrequency = localGps !== null ? localGps : (profile.gps_frequency || 'balanced');
  const isShakeSos = localShake !== null ? localShake : Boolean(profile.shake_sos_enabled);
  const isAppLock = localLock !== null ? localLock : Boolean(profile.app_lock_enabled);

  const gpsFreqLabel =
    gpsFrequency === 'realtime'
      ? 'Ultra Fast • 5s live breadcrumbs'
      : gpsFrequency === 'battery_saver'
      ? 'Eco Mode • 60s battery saver'
      : 'Balanced • 15s adaptive sync';

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
    if (!isLeader || isSelf) return;
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }

    if (field === 'is_ghost_mode') setLocalGhost(newValue);
    if (field === 'hide_online_presence') setLocalOnline(newValue);
    if (field === 'shake_sos_enabled') setLocalShake(newValue);
    if (field === 'app_lock_enabled') setLocalLock(newValue);

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
      console.error(`[MemberShortProfileModal] Failed to update ${field}:`, err);
      if (field === 'is_ghost_mode') setLocalGhost(Boolean(profile.is_ghost_mode));
      if (field === 'hide_online_presence') setLocalOnline(Boolean(profile.hide_online_presence));
      if (field === 'shake_sos_enabled') setLocalShake(Boolean(profile.shake_sos_enabled));
      if (field === 'app_lock_enabled') setLocalLock(Boolean(profile.app_lock_enabled));
      Alert.alert('Update Failed', `Could not update setting. Please verify circle permissions.`);
    }
  };

  const handleCycleGpsFrequency = async () => {
    if (!isLeader || isSelf) return;
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
      console.error('[MemberShortProfileModal] Failed to update gps_frequency:', err);
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
      console.warn('[MemberShortProfileModal] Share error:', error);
    }
  };

  const handlePostLocationToChat = async () => {
    try {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(10); } catch (_) {}
      }
      const myId = useAuthStore.getState().session?.user?.id;
      const circleName = useCircleStore.getState().circles?.find((c) => c.id === circleId)?.name || 'Circle';

      if (!circleId || !myId) {
        Alert.alert('Unable to Share', 'Active circle or user session not found.');
        return;
      }

      const { error } = await supabase.from('circle_messages').insert({
        circle_id: circleId,
        sender_id: myId,
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
      const myId = useAuthStore.getState().session?.user?.id;
      const currentUserProfile = useAuthStore.getState().profile;
      const leaderName = currentUserProfile?.full_name || 'Circle Leader';
      const circleName = useCircleStore.getState().circles?.find((c) => c.id === circleId)?.name || 'Circle';

      if (circleId && myId) {
        await supabase.from('circle_messages').insert({
          circle_id: circleId,
          sender_id: myId,
          content: `📍 [Leader Broadcast] Shared ${name}'s live location with ${circleName}:\n${mapsUrl || 'Location currently updating'}`,
        });
      }

      if (circleId) {
        const { data: circleMembersData } = await supabase
          .from('circle_members')
          .select('user_id, profiles(push_token, expo_push_token, full_name)')
          .eq('circle_id', circleId)
          .neq('user_id', myId);

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
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
        Alert.alert('Unable to Call', 'Device dialer could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  const handleMessage = () => {
    if (phone) {
      Linking.openURL(`sms:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
        Alert.alert('Unable to SMS', 'Messaging application could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  const roleLabel =
    role === 'owner'
      ? 'Circle Leader'
      : role === 'co_leader'
      ? 'Co-Leader'
      : role === 'guardian'
      ? 'Guardian'
      : 'Member';

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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => handleDismiss()}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => handleDismiss()} />

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#121714' : '#FFFFFF',
              borderColor: isDark ? '#233029' : '#E5E7EB',
              paddingBottom: Math.max(insets.bottom + 16, 28),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Interactive Drag Handle */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragHandleBox}
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.dragHandle, isDark && { backgroundColor: '#2E3D34' }]} />
          </View>

          {/* Top-Right Tap Close Button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              isDark ? { backgroundColor: 'rgba(255, 255, 255, 0.08)' } : { backgroundColor: '#F1F5F9' },
            ]}
            onPress={() => handleDismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close profile"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={17} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
            {/* Header Profile Section */}
            <View style={styles.heroSection}>
              <View style={styles.avatarWrapper}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={[styles.avatarLarge, { borderColor: roleBorder }]} />
                ) : (
                  <View style={[styles.avatarLarge, styles.avatarFallback, { borderColor: roleBorder, backgroundColor: isDark ? '#1E2B24' : '#E8F5EE' }]}>
                    <Text style={[styles.avatarFallbackText, { color: roleColor }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.statusRingDot,
                    {
                      backgroundColor: isDriving ? '#F5A623' : isOnline ? '#10B981' : '#718579',
                      borderColor: isDark ? '#121714' : '#FFFFFF',
                    },
                  ]}
                >
                  <Ionicons
                    name={isDriving ? 'car' : isOnline ? 'checkmark' : 'time'}
                    size={10}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.heroName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {name}
              </Text>

              <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleBorder }]}>
                <Ionicons
                  name={
                    role === 'owner'
                      ? 'shield-checkmark'
                      : role === 'co_leader'
                      ? 'shield'
                      : role === 'guardian'
                      ? 'eye'
                      : 'person'
                  }
                  size={12}
                  color={roleColor}
                />
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                  {roleLabel}
                </Text>
              </View>

              {phone ? (
                <Text style={[styles.heroPhone, { color: isDark ? '#8A9E92' : '#64748B' }]}>{phone}</Text>
              ) : null}
            </View>

            {/* Quick Contact Actions: Symmetrical 4-Card Luxury Row */}
            <View style={styles.actionShortcutsRow}>
              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark
                    ? { backgroundColor: 'rgba(58, 223, 171, 0.12)', borderColor: 'rgba(58, 223, 171, 0.28)' }
                    : { backgroundColor: '#E8FAF2', borderColor: 'rgba(58, 223, 171, 0.40)' },
                ]}
                onPress={handleCall}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Call member"
              >
                <Ionicons name="call" size={18} color={isDark ? '#3ADFAB' : '#059669'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#3ADFAB' : '#059669' }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark
                    ? { backgroundColor: 'rgba(245, 166, 35, 0.12)', borderColor: 'rgba(245, 166, 35, 0.28)' }
                    : { backgroundColor: '#FEF8EC', borderColor: 'rgba(245, 166, 35, 0.40)' },
                ]}
                onPress={handleMessage}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="SMS member"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={isDark ? '#F5A623' : '#D97706'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#F5A623' : '#D97706' }]}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark
                    ? { backgroundColor: 'rgba(0, 210, 255, 0.12)', borderColor: 'rgba(0, 210, 255, 0.28)' }
                    : { backgroundColor: '#EDFAFD', borderColor: 'rgba(0, 210, 255, 0.40)' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToMap) onNavigateToMap(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Location on Map"
              >
                <Ionicons name="navigate" size={18} color={isDark ? '#00D2FF' : '#0284C7'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#00D2FF' : '#0284C7' }]}>Route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark
                    ? { backgroundColor: 'rgba(46, 125, 91, 0.18)', borderColor: 'rgba(46, 125, 91, 0.32)' }
                    : { backgroundColor: '#ECFDF5', borderColor: 'rgba(46, 125, 91, 0.35)' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToChat) onNavigateToChat(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Chat with member"
              >
                <Ionicons name="chatbubbles" size={18} color={isDark ? '#4AE3B5' : '#047857'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#4AE3B5' : '#047857' }]}>Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Status & Activity Grid */}
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>CURRENT STATUS</Text>
            </View>

            <View style={styles.telemetryGrid}>
              {/* Battery Card */}
              <View
                style={[
                  styles.telemetryCard,
                  isDark
                    ? { backgroundColor: '#16201B', borderColor: 'rgba(58, 223, 171, 0.20)' }
                    : { backgroundColor: '#F8FAF9', borderColor: '#E2ECE6' },
                ]}
              >
                <View style={styles.telemetryCardTop}>
                  <Ionicons
                    name={isLowBattery ? 'battery-dead' : 'battery-charging'}
                    size={16}
                    color={isLowBattery ? '#EF4444' : (isDark ? '#3ADFAB' : '#059669')}
                  />
                  <Text style={[styles.telemetryLabel, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>BATTERY</Text>
                </View>
                <Text
                  style={[
                    styles.telemetryValue,
                    isDark && { color: '#FFFFFF' },
                    isLowBattery && { color: '#EF4444' },
                  ]}
                >
                  {battery}
                </Text>
                <Text style={[styles.telemetrySub, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                  {isLowBattery ? 'Low Battery' : 'Normal Power'}
                </Text>
              </View>

              {/* Movement Card */}
              <View
                style={[
                  styles.telemetryCard,
                  isDark
                    ? { backgroundColor: '#16201B', borderColor: 'rgba(58, 223, 171, 0.20)' }
                    : { backgroundColor: '#F8FAF9', borderColor: '#E2ECE6' },
                ]}
              >
                <View style={styles.telemetryCardTop}>
                  <Ionicons
                    name={isDriving ? 'car-sport' : isOnline ? 'radio' : 'time-outline'}
                    size={16}
                    color={isDriving ? '#F5A623' : isOnline ? '#10B981' : (isDark ? '#7E9387' : '#6A7D71')}
                  />
                  <Text style={[styles.telemetryLabel, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>MOVEMENT</Text>
                </View>
                <Text style={[styles.telemetryValue, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                  {isDriving ? 'In Transit' : isOnline ? 'Active' : 'Offline'}
                </Text>
                <Text style={[styles.telemetrySub, { color: isDark ? '#8A9E92' : '#6A7D71' }]} numberOfLines={1}>
                  {isDriving ? 'Driving safely' : isOnline ? 'Sharing live location' : 'Recently active'}
                </Text>
              </View>
            </View>

            {/* Navigation Actions (Side by Side 2-Card Row) */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[
                  styles.navActionRow,
                  { flex: 1 },
                  isDark
                    ? { backgroundColor: '#16201B', borderColor: 'rgba(245, 166, 35, 0.22)' }
                    : { backgroundColor: '#FFFFFF', borderColor: '#E2ECE6' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToHistory) onNavigateToHistory(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Location History"
              >
                <View style={[styles.navActionIconBox, { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.15)' : '#FEF3C7' }]}>
                  <Ionicons name="time" size={18} color={isDark ? '#F5A623' : '#D97706'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navActionTitle, isDark && { color: '#FFFFFF' }]}>Timeline</Text>
                  <Text style={[styles.navActionSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]} numberOfLines={1}>
                    24h breadcrumbs
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navActionRow,
                  { flex: 1 },
                  isDark
                    ? { backgroundColor: '#16201B', borderColor: 'rgba(16, 185, 129, 0.22)' }
                    : { backgroundColor: '#FFFFFF', borderColor: '#E2ECE6' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToDriving) onNavigateToDriving(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Driving Summary"
              >
                <View style={[styles.navActionIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                  <Ionicons name="car-sport" size={18} color={isDark ? '#10B981' : '#059669'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navActionTitle, isDark && { color: '#FFFFFF' }]}>Drive Safety</Text>
                  <Text style={[styles.navActionSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]} numberOfLines={1}>
                    Speed & trips
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Security & Privacy Protocol Inspection & Leader Controls */}
            {isLeader && (
              <View style={{ marginTop: 14 }}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={[styles.sectionHeading, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                    {isLeader && !isSelf
                      ? 'SECURITY & GPS PROTOCOLS (LEADER CONTROL)'
                      : 'SECURITY & GPS PROTOCOLS (LEADER AUDIT)'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.auditCard,
                    isDark
                      ? { backgroundColor: '#16201B', borderColor: 'rgba(58, 223, 171, 0.20)' }
                      : { backgroundColor: '#F8FAF9', borderColor: '#E2ECE6' },
                  ]}
                >
                  {/* Ghost Mode */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.auditIconBox,
                        {
                          backgroundColor: isGhostActive
                            ? (isDark ? 'rgba(245, 166, 35, 0.18)' : '#FEF3C7')
                            : (isDark ? '#1D2E25' : '#E3F5EC'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isGhostActive ? 'eye-off' : 'eye'}
                        size={16}
                        color={isGhostActive ? '#F5A623' : (isDark ? '#3ADFAB' : '#006C4F')}
                      />
                    </View>
                    <View style={styles.auditTextCol}>
                      <Text style={[styles.auditTitle, isDark && { color: '#FFFFFF' }]}>
                        Ghost Location Mode
                      </Text>
                      <Text style={[styles.auditSubtitle, { color: isGhostActive ? '#F5A623' : (isDark ? '#8A9E92' : '#6A7D71') }]}>
                        {isGhostActive ? 'Active • Location fuzzed (~500m offset)' : 'Disabled • Exact real-time GPS stream'}
                      </Text>
                    </View>
                    {isLeader && !isSelf ? (
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
                      styles.auditDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* GPS Sync Frequency (Tap to Cycle for Leaders) */}
                  <TouchableOpacity
                    style={styles.auditRow}
                    activeOpacity={isLeader && !isSelf ? 0.7 : 1}
                    onPress={isLeader && !isSelf ? handleCycleGpsFrequency : undefined}
                  >
                    <View
                      style={[
                        styles.auditIconBox,
                        { backgroundColor: isDark ? 'rgba(0, 210, 255, 0.16)' : '#E0F2FE' },
                      ]}
                    >
                      <Ionicons name="pulse" size={16} color={isDark ? '#00D2FF' : '#0284C7'} />
                    </View>
                    <View style={styles.auditTextCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.auditTitle, isDark && { color: '#FFFFFF' }]}>
                          GPS Sync Frequency
                        </Text>
                        {isLeader && !isSelf && (
                          <Ionicons name="swap-horizontal" size={14} color={isDark ? '#00D2FF' : '#0284C7'} />
                        )}
                      </View>
                      <Text style={[styles.auditSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
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
                      styles.auditDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Online Presence */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.auditIconBox,
                        {
                          backgroundColor: isHideOnline
                            ? (isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2')
                            : (isDark ? '#1D2E25' : '#E3F5EC'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isHideOnline ? 'cloud-offline' : 'wifi'}
                        size={16}
                        color={isHideOnline ? '#EF4444' : (isDark ? '#3ADFAB' : '#006C4F')}
                      />
                    </View>
                    <View style={styles.auditTextCol}>
                      <Text style={[styles.auditTitle, isDark && { color: '#FFFFFF' }]}>
                        Online Presence
                      </Text>
                      <Text style={[styles.auditSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isHideOnline ? 'Hidden • Offline stealth mode active' : 'Visible • Circle broadcast active'}
                      </Text>
                    </View>
                    {isLeader && !isSelf ? (
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
                      styles.auditDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Shake Phone for SOS */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.auditIconBox,
                        {
                          backgroundColor: isShakeSos
                            ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2')
                            : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Ionicons
                        name="phone-portrait"
                        size={16}
                        color={isShakeSos ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                      />
                    </View>
                    <View style={styles.auditTextCol}>
                      <Text style={[styles.auditTitle, isDark && { color: '#FFFFFF' }]}>
                        Shake Phone for SOS
                      </Text>
                      <Text style={[styles.auditSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isShakeSos ? 'Armed • Accelerometer triggers alert' : 'Disabled • Manual alert only'}
                      </Text>
                    </View>
                    {isLeader && !isSelf ? (
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
                      styles.auditDivider,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                    ]}
                  />

                  {/* Biometric Lock */}
                  <View style={styles.auditRow}>
                    <View
                      style={[
                        styles.auditIconBox,
                        {
                          backgroundColor: isAppLock
                            ? (isDark ? 'rgba(58, 223, 171, 0.18)' : '#E3F5EC')
                            : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Ionicons
                        name={isAppLock ? 'finger-print' : 'lock-open-outline'}
                        size={16}
                        color={isAppLock ? (isDark ? '#3ADFAB' : '#006C4F') : (isDark ? '#94A3B8' : '#64748B')}
                      />
                    </View>
                    <View style={styles.auditTextCol}>
                      <Text style={[styles.auditTitle, isDark && { color: '#FFFFFF' }]}>
                        Biometric App Lock
                      </Text>
                      <Text style={[styles.auditSubtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        {isAppLock ? 'Enforced • Biometrics active' : 'Disabled'}
                      </Text>
                    </View>
                    {isLeader && !isSelf ? (
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

                {/* Circle Location Sharing (Leader Action) */}
                {isLeader && !isSelf && (
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
                        styles.leaderShareIconBox,
                        { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.18)' : '#FEF3C7' },
                      ]}
                    >
                      <Ionicons name="share-social" size={18} color={isDark ? '#F5A623' : '#D97706'} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.leaderShareTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                        Share {name}'s Location to Circle
                      </Text>
                      <Text style={[styles.leaderShareSub, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                        Broadcast live coordinates to other members via push, chat, or external apps
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={isDark ? '#F5A623' : '#D97706'} />
                  </TouchableOpacity>
                )}
              </View>
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
              <View style={styles.shareDragHandleBox}>
                <View style={[styles.shareDragHandle, { backgroundColor: isDark ? '#2E3D34' : '#D1D5DB' }]} />
              </View>

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
                    {hasValidLocation ? 'Live GPS Coordinates' : 'Location Updating'}
                  </Text>
                  <Text style={[styles.shareLocationCoord, { color: isDark ? '#8A9E92' : '#6A7D71' }]} numberOfLines={1}>
                    {hasValidLocation
                      ? `${Number(memberLat).toFixed(5)}, ${Number(memberLng).toFixed(5)}`
                      : 'Connecting to member telemetry...'}
                  </Text>
                </View>
              </View>

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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarLarge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#334155',
  },
  statusRingDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroPhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  actionShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  shortcutBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeadingRow: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  telemetryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  telemetryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#64748B',
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  telemetrySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  navActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  navActionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  auditCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  auditIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  auditSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  auditStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  auditDivider: {
    height: 1,
    marginLeft: 56,
  },
  leaderShareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.2,
    gap: 12,
    marginTop: 10,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  leaderShareIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderShareTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  leaderShareSub: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
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
    marginTop: 4,
    marginBottom: 12,
  },
  shareSheetTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  shareSheetSubtitle: {
    fontSize: 11.5,
    marginTop: 1.5,
  },
  shareCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  shareLocationIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLocationTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  shareLocationCoord: {
    fontSize: 11,
    marginTop: 1,
  },
  shareActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  shareActionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareActionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  shareActionSub: {
    fontSize: 10.5,
    lineHeight: 13.5,
    marginTop: 1,
  },
});
