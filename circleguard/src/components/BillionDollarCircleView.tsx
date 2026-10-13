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
  Linking,
  Share,
  Vibration,
  StatusBar,
  Alert,
  Modal,
  Animated,
  Easing,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore, formatZoneArrival } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { navigationRef } from '../navigation/AppNavigator';
import CircleQRCodeModal from './CircleQRCodeModal';
import CircleSwitcherModal from './CircleSwitcherModal';
import OrbitalGoldenLogoBadge from './OrbitalGoldenLogoBadge';
import MemberRoleModal from './MemberRoleModal';
import BranchAssignmentModal from './BranchAssignmentModal';
import CircleHierarchyTree from './CircleHierarchyTree';
import MemberQuickActionsModal from './MemberQuickActionsModal';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { getSafeTopInset } from '../utils/safeArea';
import { useLuxuryAlert } from './LuxuryAlertModal';
import RadarPulseBeacon from './ui/RadarPulseBeacon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


export default function BillionDollarCircleView() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const scrollViewRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Header dynamic elevation & border opacity
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 5],
    extrapolate: 'clamp',
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [30, 80],
    outputRange: [0.7, 1],
    extrapolate: 'clamp',
  });

  const headerTitleScale = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0.94, 1],
    extrapolate: 'clamp',
  });

  // Hero section parallax & elastic pull-down stretch
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 85],
    outputRange: [1, 0.15],
    extrapolate: 'clamp',
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [-120, 0, 100],
    outputRange: [-24, 0, -18],
    extrapolate: 'clamp',
  });

  const heroScale = scrollY.interpolate({
    inputRange: [-120, 0, 100],
    outputRange: [1.14, 1, 0.94],
    extrapolate: 'clamp',
  });

  // Micro Scroll Progress Bar width
  const scrollProgressWidth = scrollY.interpolate({
    inputRange: [0, 600],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // Floating Back-to-Top pill entrance
  const floatingBackToTopOpacity = scrollY.interpolate({
    inputRange: [160, 240],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const floatingBackToTopTranslateY = scrollY.interpolate({
    inputRange: [160, 240],
    outputRange: [24, 0],
    extrapolate: 'clamp',
  });

  const { profile } = useAuthStore();
  const { activeCircle, members, places, fetchMembers, fetchPlaces, fetchActiveCircle } = useCircleStore();
  const { isDark } = useThemeStore();
  const { showConfirm, showAlert } = useLuxuryAlert();

  const displayMembers = useMemo(() => {
    let list = (members && members.length > 0)
      ? members
      : (activeCircle?.id ? useCircleStore.getState().membersByCircle[activeCircle.id] || [] : []);
    if (!activeCircle?.id) return list;
    return list.filter((m: any) => !m.circle_id || m.circle_id === activeCircle.id);
  }, [members, activeCircle?.id]);

  const [copyStatus, setCopyStatus] = useState('Copy');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [circleSwitcherVisible, setCircleSwitcherVisible] = useState(false);
  const [roleModalMember, setRoleModalMember] = useState<any>(null);
  const [branchModalMember, setBranchModalMember] = useState<any>(null);
  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
  const [reopenHierarchyAfterBranch, setReopenHierarchyAfterBranch] = useState(false);
  const [selectedActionsMember, setSelectedActionsMember] = useState<any>(null);
  const subActionHandledRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__openMemberShortProfile = (m: any) => setSelectedActionsMember(m);
    }
  }, []);

  const navigateToScreen = React.useCallback((screenName: string, params?: any) => {
    const isTab = ['Home', 'Map', 'Activity', 'Circle', 'SOS'].includes(screenName);

    if (isTab) {
      // 1. Try local tab navigation directly
      try {
        if (navigation && typeof navigation.navigate === 'function') {
          (navigation as any).navigate(screenName, params);
          return;
        }
      } catch (_) {}

      // 2. Try root navigation targeting MainTabs
      try {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('MainTabs', {
            screen: screenName,
            params,
          });
          return;
        }
      } catch (_) {}

      // 3. Try parent navigator
      try {
        const parent = navigation.getParent?.();
        if (parent && typeof parent.navigate === 'function') {
          parent.navigate('MainTabs', { screen: screenName, params });
          return;
        }
      } catch (_) {}

      // 4. Web fallback
      if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__navigationRef?.isReady?.()) {
        (window as any).__navigationRef.navigate('MainTabs', { screen: screenName, params });
      }
    } else {
      // Root stack screens (LocationHistory, DrivingReports, Chat, Profile, SafePlaces, etc.)
      // 1. Try root navigationRef
      try {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate(screenName, params);
          return;
        }
      } catch (_) {}

      // 2. Try parent navigation
      try {
        const parent = navigation.getParent?.();
        if (parent && typeof parent.navigate === 'function') {
          parent.navigate(screenName, params);
          return;
        }
      } catch (_) {}

      // 3. Try direct navigation
      try {
        if (navigation && typeof navigation.navigate === 'function') {
          (navigation as any).navigate(screenName, params);
          return;
        }
      } catch (_) {}

      // 4. Web fallback
      if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__navigationRef?.isReady?.()) {
        (window as any).__navigationRef.navigate(screenName, params);
      }
    }
  }, [navigation]);

  const effectiveUserId = profile?.id || 
    (useAuthStore.getState() as any).session?.user?.id || 
    (useAuthStore.getState() as any).user?.id;

  const founder = useMemo(() => {
    if (!Array.isArray(members) || members.length === 0) return null;
    if (activeCircle?.owner_id) {
      const match = members.find((m) => (m.user_id || (m as any).id) === activeCircle.owner_id);
      if (match) return match;
    }
    const owners = members.filter((m) => m.role === 'owner' || (m.role as string) === 'leader');
    return owners.length > 0 ? owners[0] : members[0];
  }, [members, activeCircle?.owner_id]);
  const founderName = founder?.profile?.full_name || 'Circle Leader';
  const trueLeaderId = activeCircle?.owner_id || founder?.user_id || (founder as any)?.id;

  const myMemberRecord = members.find((m) => (m.user_id || (m as any).id) === effectiveUserId);
  const isOwner = Boolean(effectiveUserId && trueLeaderId && effectiveUserId === trueLeaderId);
  const myRole = isOwner ? 'owner' : (myMemberRecord?.role === 'owner' ? 'co_leader' : (myMemberRecord?.role || 'member'));
  const canManageRanks = isOwner || myRole === 'co_leader';

  useEffect(() => {
    if (activeCircle?.id) {
      fetchMembers(activeCircle.id);
      fetchPlaces(activeCircle.id);
    } else {
      const uid = profile?.id || useAuthStore.getState().user?.id;
      if (uid) {
        fetchActiveCircle(uid);
      }
    }
  }, [activeCircle?.id, profile?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const inviteCode = activeCircle?.invite_code || '------';
  const circleName = activeCircle?.name || 'My Family Circle';

  const handleCopyCode = async () => {
    if (!inviteCode || inviteCode === '------') return;
    await Clipboard.setStringAsync(inviteCode);
    setCopyStatus('Copied!');
    showToast(`Circle code ${inviteCode} copied to clipboard!`);
    setTimeout(() => setCopyStatus('Copy'), 2200);
  };

  const handleShareSMS = async () => {
    try {
      await Share.share({
        message: `Join my private CircleGuard safety circle "${circleName}". Use invite code: ${inviteCode}`,
      });
    } catch (e) {
      showToast('Sharing cancelled');
    }
  };

  const handleRingMember = async (member: any) => {
    const targetUserId = member.user_id || member.id;
    const name = member.profile?.full_name || 'Circle Member';
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate([0, 200, 100, 200]); } catch (_) {}
    }
    showToast(`Sending high-priority chime to ${name}...`);
    (async () => {
      try {
        await sendExpoPushNotification(
          targetUserId,
          `High-Priority Chime: ${profile?.full_name || 'Circle Member'}`,
          `${profile?.full_name || 'A circle member'} is pinging your device with an urgent audible chime!`,
          { type: 'RING_DEVICE', senderId: profile?.id, timestamp: Date.now(), isEmergency: true }
        );
        if (activeCircle?.id && profile?.id) {
          await supabase.from('circle_messages').insert({
            circle_id: activeCircle.id,
            sender_id: profile.id,
            content: `CHIME ALERT: Dispatched audible radar chime to ${name}'s device.`,
          });
        }
        showToast(`Audible radar chime delivered to ${name}!`);
      } catch (e: any) {
        showToast(`Radar chime signal broadcasted to ${name}`);
      }
    })();
  };

  const handleNudgeMember = async (member: any) => {
    const targetUserId = member.user_id || member.id;
    const name = member.profile?.full_name || 'Circle Member';
    const batteryPct = member.batteryPct ?? member.battery_level ?? 15;
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate([0, 150, 100, 150]); } catch (_) {}
    }
    showToast(`Sending battery reminder to ${name}...`);
    (async () => {
      try {
        await sendExpoPushNotification(
          targetUserId,
          `Low Battery Reminder: ${name}`,
          `${profile?.full_name || 'A circle member'} noticed your battery is at ${batteryPct}%. Please connect to a charger!`,
          { type: 'LOW_BATTERY', senderId: profile?.id, timestamp: Date.now() }
        );
        if (activeCircle?.id && profile?.id) {
          await supabase.from('circle_messages').insert({
            circle_id: activeCircle.id,
            sender_id: profile.id,
            content: `BATTERY NUDGE: Reminded ${name} to charge device (${batteryPct}%).`,
          });
        }
        showToast(`Battery reminder delivered to ${name}!`);
      } catch (e) {
        showToast(`Battery reminder dispatched to ${name}`);
      }
    })();
  };

  const [memberFilter, setMemberFilter] = useState<'all' | 'moving' | 'safe' | 'battery'>('all');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const movingCount = useMemo(() => {
    return displayMembers.filter((m) => Boolean(m.isDriving)).length;
  }, [displayMembers]);

  const safePlaceCount = useMemo(() => {
    return displayMembers.filter((m) => m.latestPlaceEvent?.event_type === 'arrival').length;
  }, [displayMembers]);

  const lowBatteryCount = useMemo(() => {
    return displayMembers.filter((m) => m.batteryPct != null && m.batteryPct <= 20).length;
  }, [displayMembers]);

  const filteredMembers = useMemo(() => {
    let result = displayMembers;
    if (memberSearchQuery.trim()) {
      const q = memberSearchQuery.toLowerCase().trim();
      result = result.filter((m) => {
        const name = (m.profile?.full_name || '').toLowerCase();
        const phone = (m.profile?.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    }

    if (memberFilter === 'moving') {
      result = result.filter((m) => Boolean(m.isDriving));
    } else if (memberFilter === 'safe') {
      result = result.filter((m) => m.latestPlaceEvent?.event_type === 'arrival');
    } else if (memberFilter === 'battery') {
      result = result.filter((m) => m.batteryPct != null && m.batteryPct <= 20);
    }

    return result;
  }, [displayMembers, memberFilter, memberSearchQuery]);

  const handleLocateMember = (member: any) => {
    subActionHandledRef.current = true;
    setTimeout(() => { subActionHandledRef.current = false; }, 350);
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }
    const name = member.profile?.full_name?.split(' ')[0] || 'Member';
    showToast(`Focusing ${name} on live map...`);
    navigateToScreen('Home');
  };

  const handleCallMember = (member: any) => {
    subActionHandledRef.current = true;
    setTimeout(() => { subActionHandledRef.current = false; }, 350);
    const phone = member.profile?.phone;
    if (phone) {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(12); } catch (_) {}
      }
      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
        showToast('Unable to open phone dialer');
      });
    } else {
      showToast(`${member.profile?.full_name?.split(' ')[0] || 'Member'} has no registered phone number`);
    }
  };

  const handleChatMember = (member: any) => {
    subActionHandledRef.current = true;
    setTimeout(() => { subActionHandledRef.current = false; }, 350);
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }
    navigateToScreen('Chat', { member });
  };

  const handleTimelineMember = (member: any) => {
    subActionHandledRef.current = true;
    setTimeout(() => { subActionHandledRef.current = false; }, 350);
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }
    navigateToScreen('LocationHistory', { member, circleId: activeCircle?.id });
  };

  const normalBatteryCount = useMemo(() => {
    return members.filter((m) => (m.batteryPct == null || m.batteryPct > 20)).length;
  }, [members]);

  const circlePlaces = useMemo(() => {
    if (!activeCircle?.id) return [];
    return (places || []).filter((p) => p && p.circle_id === activeCircle.id);
  }, [places, activeCircle?.id]);

  const handleDeleteOrLeaveCircle = () => {
    if (!activeCircle) return;
    const circleTitle = activeCircle.name || 'this circle';

    if (isOwner) {
      Alert.alert(
        'Delete Circle',
        `Are you sure you want to permanently delete "${circleTitle}"? All member connections, safe places, and location history will be erased. This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Circle',
            style: 'destructive',
            onPress: async () => {
              showToast('Deleting circle...');
              const res = await useCircleStore.getState().deleteCircle(activeCircle.id);
              if (res.success) {
                showToast('Circle deleted successfully');
                const remaining = useCircleStore.getState().circles;
                if (remaining.length === 0) {
                  navigation.navigate('Home');
                }
              } else {
                Alert.alert('Error', res.error || 'Failed to delete circle');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Leave Circle',
        `Are you sure you want to leave "${circleTitle}"? You will no longer share your location or receive alerts with this circle.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Circle',
            style: 'destructive',
            onPress: async () => {
              if (!profile?.id) return;
              showToast('Leaving circle...');
              const res = await useCircleStore.getState().leaveCircle(activeCircle.id, profile.id);
              if (res.success) {
                showToast('You left the circle');
                const remaining = useCircleStore.getState().circles;
                if (remaining.length === 0) {
                  navigation.navigate('Home');
                }
              } else {
                Alert.alert('Error', res.error || 'Failed to leave circle');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0F1411' }]}>
      {/* Header Bar */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: topInset, height: 56 + topInset },
          isDark && { backgroundColor: '#141A17', borderBottomColor: '#212C26' },
          {
            elevation: headerElevation,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: headerElevation.interpolate({
              inputRange: [0, 6],
              outputRange: [0, 0.12],
            }),
            shadowRadius: 6,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <OrbitalGoldenLogoBadge
            size={34}
            onPress={() => navigateToScreen('Home')}
            accessibilityLabel="CircleGuard Logo"
          />
          <Animated.View
            style={[
              styles.headerTitleWrap,
              {
                opacity: headerTitleOpacity,
                transform: [{ scale: headerTitleScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.circleSelectorBtn, isDark && { backgroundColor: '#1C2621' }]}
              onPress={() => setCircleSwitcherVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.headerActiveDot} />
              <Text style={[styles.circleSelectorText, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {circleName}
              </Text>
              <Ionicons name="chevron-down" size={14} color={isDark ? '#9EACA3' : '#5C665F'} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconButton, isDark && { backgroundColor: '#1C2621' }]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try { Vibration.vibrate(10); } catch (_) {}
              }
              navigateToScreen('Chat');
            }}
            activeOpacity={0.7}
            accessibilityLabel="Open Circle Chat"
          >
            <Ionicons name="chatbubbles-outline" size={19} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.profileAvatarBtn, isDark && { borderColor: '#3ADFAB' }]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try { Vibration.vibrate(10); } catch (_) {}
              }
              navigateToScreen('Profile');
            }}
            activeOpacity={0.7}
            accessibilityLabel="Open Profile & Settings"
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1C2621' }]}>
                <Text style={[styles.avatarFallbackText, isDark && { color: '#3ADFAB' }]}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Micro Luxury Scroll Progress Bar */}
        <Animated.View
          style={[
            styles.scrollProgressBar,
            {
              width: scrollProgressWidth,
              backgroundColor: isDark ? '#3ADFAB' : '#2E7D5B',
            },
          ]}
        />
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Circle Header with Parallax & Elastic Stretch */}
        <Animated.View
          style={[
            styles.topSection,
            {
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
            },
          ]}
        >
          <View style={styles.titleRow}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
              onPress={() => setCircleSwitcherVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Switch active safety circle"
            >
              <Text style={[styles.headlineText, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {circleName}
              </Text>
              <Ionicons name="chevron-down" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
            </TouchableOpacity>
          </View>

          {/* Quick Switch Suggestion if on empty/testing circle while other circles exist */}
          {displayMembers.length <= 1 && useCircleStore.getState().circles.some(c => c.id !== activeCircle?.id) && (
            <TouchableOpacity
              style={[
                styles.quickSwitchBanner,
                isDark && { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderColor: 'rgba(212, 175, 55, 0.3)' }
              ]}
              onPress={() => setCircleSwitcherVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={16} color={isDark ? '#D4AF37' : '#926C15'} />
              <Text style={[styles.quickSwitchBannerText, isDark && { color: '#E8EDE9' }]}>
                Switch circle or select family group
              </Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? '#D4AF37' : '#926C15'} />
            </TouchableOpacity>
          )}

          {/* Active Circle Status Banner */}
          <View style={[styles.activeBanner, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <View style={[styles.greenPulseDot, isDark && { backgroundColor: '#30D158' }]} />
            <Text style={[styles.bannerText, isDark && { color: '#94A3B8' }]}>
              <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#151C27' }}>
                {displayMembers.length} Connected
              </Text>
              {'  ·  '}
              <Text>{circlePlaces.length} Zones Protected</Text>
              {'  ·  '}
              <Text style={{ color: isDark ? '#30D158' : '#006C4F', fontWeight: '600' }}>
                {normalBatteryCount} Good Battery
              </Text>
            </Text>
          </View>
        </Animated.View>

        {/* Common Circle Group Chat Hub */}
        <TouchableOpacity
          style={[styles.commonChatCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}
          onPress={() => navigateToScreen('Chat')}
          activeOpacity={0.85}
        >
          <View style={[styles.commonChatIconBox, isDark && { backgroundColor: '#1A1C22' }]}>
            <Ionicons name="chatbubbles" size={22} color={isDark ? '#30D158' : '#FFFFFF'} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.commonChatTitle, isDark && { color: '#FFFFFF' }]}>Circle Messages</Text>
              <View style={[styles.liveChatBadge, isDark && { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                <Text style={[styles.liveChatBadgeText, isDark && { color: '#30D158' }]}>Live</Text>
              </View>
            </View>
            <Text style={[styles.commonChatSub, isDark && { color: '#94A3B8' }]}>
              Instant family check-ins & status updates
            </Text>
          </View>
          <View style={[styles.commonChatAction, isDark && { backgroundColor: '#1A1C22' }]}>
            <Text style={[styles.commonChatActionText, isDark && { color: '#30D158' }]}>Open</Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#30D158' : '#2E7D5B'} />
          </View>
        </TouchableOpacity>

        {/* Family Members Section Header */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Circle Members</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#1A1C22' }]}>
              <Text style={[styles.countText, isDark && { color: '#30D158' }]}>{displayMembers.length}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.hierarchyTreeBtn,
                isDark && { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderColor: 'rgba(212, 175, 55, 0.3)' },
              ]}
              onPress={() => setHierarchyModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="git-network-outline" size={13} color={isDark ? '#D4AF37' : '#926C15'} />
              <Text style={[styles.hierarchyTreeBtnText, isDark && { color: '#D4AF37' }]}>Hierarchy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigateToScreen('Home')}>
              <Text style={[styles.sectionLink, isDark && { color: '#30D158' }]}>Live Map View ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Member Status Quick-Filter Chips */}
        {displayMembers.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.memberFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.memberFilterChip,
                isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
                memberFilter === 'all' && (isDark ? { backgroundColor: '#30D158', borderColor: '#30D158' } : styles.memberFilterChipActive),
              ]}
              onPress={() => setMemberFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.memberFilterChipText,
                isDark && { color: '#94A3B8' },
                memberFilter === 'all' && (isDark ? { color: '#000000', fontWeight: '700' } : styles.memberFilterChipTextActive)
              ]}>
                All ({displayMembers.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.memberFilterChip,
                isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
                memberFilter === 'moving' && (isDark ? { backgroundColor: '#F5A623', borderColor: '#F5A623' } : styles.memberFilterChipActive),
              ]}
              onPress={() => setMemberFilter('moving')}
              activeOpacity={0.8}
            >
              <Ionicons name="car" size={13} color={memberFilter === 'moving' ? (isDark ? '#000000' : '#FFFFFF') : '#F5A623'} />
              <Text style={[
                styles.memberFilterChipText,
                isDark && { color: '#94A3B8' },
                memberFilter === 'moving' && (isDark ? { color: '#000000', fontWeight: '700' } : styles.memberFilterChipTextActive)
              ]}>
                Moving ({movingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.memberFilterChip,
                isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
                memberFilter === 'safe' && (isDark ? { backgroundColor: '#30D158', borderColor: '#30D158' } : styles.memberFilterChipActive),
              ]}
              onPress={() => setMemberFilter('safe')}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={13} color={memberFilter === 'safe' ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#30D158' : '#10B981')} />
              <Text style={[
                styles.memberFilterChipText,
                isDark && { color: '#94A3B8' },
                memberFilter === 'safe' && (isDark ? { color: '#000000', fontWeight: '700' } : styles.memberFilterChipTextActive)
              ]}>
                In Zone ({safePlaceCount})
              </Text>
            </TouchableOpacity>

            {lowBatteryCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.memberFilterChip,
                  isDark && { backgroundColor: '#2A1818', borderColor: '#4A2323' },
                  memberFilter === 'battery' && { backgroundColor: '#EF4444', borderColor: '#DC2626' },
                ]}
                onPress={() => setMemberFilter('battery')}
                activeOpacity={0.8}
              >
                <Ionicons name="battery-dead" size={13} color={memberFilter === 'battery' ? '#FFFFFF' : '#EF4444'} />
                <Text style={[styles.memberFilterChipText, { color: memberFilter === 'battery' ? '#FFFFFF' : '#EF4444' }]}>
                  Low Battery ({lowBatteryCount})
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Search Bar when 3 or more members exist */}
        {displayMembers.length >= 3 && (
          <View style={[styles.memberSearchBox, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Ionicons name="search" size={16} color={isDark ? '#64748B' : '#9CA3AF'} />
            <TextInput
              style={[styles.memberSearchInput, isDark && { color: '#FFFFFF' }]}
              placeholder="Find circle member..."
              placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              clearButtonMode="while-editing"
            />
            {memberSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={isDark ? '#64748B' : '#9CA3AF'} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Circle Members List */}
        {filteredMembers.length > 0 ? (
          <View style={{ width: '100%' }}>
            {filteredMembers.map((member, index) => {
              const name = member.profile?.full_name || 'Family Member';
              const memberUserId = member.user_id || (member as any).id;
              const isSelf = memberUserId === profile?.id;
              const isTargetOwner = Boolean(memberUserId && trueLeaderId && memberUserId === trueLeaderId);
              const effectiveRole = isTargetOwner ? 'owner' : (member.role === 'owner' ? 'co_leader' : (member.role || 'member'));
              const role = effectiveRole;
              const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
              const isLowBattery = (member.batteryPct != null && member.batteryPct <= 20);
              const batteryPctVal = member.batteryPct ?? 100;
              const isDriving = Boolean(member.isDriving);
              const isOnline = member.isOnline !== false;
              const isGhostMode = Boolean(member.profile?.is_ghost_mode);
              const hasPhone = Boolean(member.profile?.phone);

              // Match safe place
              const matchedPlace = circlePlaces.find((p) => p.id === member.latestPlaceEvent?.place_id);
              const isInSafePlace = member.latestPlaceEvent?.event_type === 'arrival';
              const placeName = matchedPlace?.name ? matchedPlace.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : 'Safe Place';

              const roleLabel =
                effectiveRole === 'owner'
                  ? 'Leader'
                  : effectiveRole === 'co_leader'
                  ? 'Co-Leader'
                  : effectiveRole === 'guardian'
                  ? 'Guardian'
                  : 'Member';

              const roleColor =
                effectiveRole === 'owner'
                  ? (isDark ? '#F5A623' : '#D97706')
                  : effectiveRole === 'co_leader'
                  ? (isDark ? '#3ADFAB' : '#059669')
                  : effectiveRole === 'guardian'
                  ? (isDark ? '#4AE3B5' : '#047857')
                  : (isDark ? '#CAD8D0' : '#475C50');

              const roleBg =
                effectiveRole === 'owner'
                  ? (isDark ? 'rgba(245, 166, 35, 0.14)' : '#FEF3C7')
                  : effectiveRole === 'co_leader'
                  ? (isDark ? 'rgba(58, 223, 171, 0.14)' : '#ECFDF5')
                  : effectiveRole === 'guardian'
                  ? (isDark ? 'rgba(46, 125, 91, 0.20)' : '#E6F4ED')
                  : (isDark ? 'rgba(202, 216, 208, 0.10)' : '#F0F4F2');

              const roleBorder =
                effectiveRole === 'owner'
                  ? (isDark ? 'rgba(245, 166, 35, 0.38)' : 'rgba(217, 119, 6, 0.35)')
                  : effectiveRole === 'co_leader'
                  ? (isDark ? 'rgba(58, 223, 171, 0.38)' : 'rgba(5, 150, 105, 0.35)')
                  : effectiveRole === 'guardian'
                  ? (isDark ? 'rgba(46, 125, 91, 0.40)' : 'rgba(4, 120, 87, 0.30)')
                  : (isDark ? 'rgba(202, 216, 208, 0.22)' : 'rgba(71, 92, 80, 0.20)');

              const memberKey = member.user_id 
                ? `member_${member.user_id}` 
                : ((member as any).id ? `member_${(member as any).id}` : `member_idx_${index}`);

              return (
                <View key={memberKey} style={{ width: '100%' }}>
                  <TouchableOpacity
                    style={[
                      styles.memberCard,
                      isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
                      isTargetOwner && { borderColor: isDark ? 'rgba(245, 166, 35, 0.35)' : 'rgba(217, 119, 6, 0.3)' },
                    ]}
                    onPress={() => {
                      if (subActionHandledRef.current) return;
                      if (Platform.OS !== 'web') {
                        try { Vibration.vibrate(10); } catch (_) {}
                      }
                      setSelectedActionsMember(member);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.memberCardContent}>
                      {/* Avatar with Radar Pulse Beacon */}
                      <RadarPulseBeacon
                        size={46}
                        color={isDriving ? '#F5A623' : '#30D158'}
                        isPulsing={isOnline && !isGhostMode}
                      >
                        <View style={styles.memberAvatarWrapper}>
                          {member.profile?.avatar_url ? (
                            <Image source={{ uri: member.profile.avatar_url }} style={styles.avatarImg} />
                          ) : (
                            <View style={[styles.avatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1A1C22' }]}>
                              <Text style={[styles.avatarFallbackText, { color: roleColor }]}>
                                {name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.avatarStatusBadge,
                              isDark && { backgroundColor: '#101114', borderColor: '#101114' },
                              isDriving && { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.20)' : '#FEF3C7', borderColor: isDark ? '#F5A623' : '#D97706' },
                            ]}
                          >
                            {isDriving ? (
                              <Ionicons name="car" size={10} color={isDark ? '#F5A623' : '#D97706'} />
                            ) : (
                              <View
                                style={[
                                  styles.avatarStatusDot,
                                  { backgroundColor: isOnline ? '#30D158' : '#64748B' },
                                ]}
                              />
                            )}
                          </View>
                        </View>
                      </RadarPulseBeacon>

                      {/* Member Info */}
                      <View style={styles.memberInfoCol}>
                        {/* Name + Role Pill */}
                        <View style={styles.memberNameRow}>
                          <Text style={[styles.memberName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                            {isSelf ? `${name} (You)` : name}
                          </Text>

                          <View
                            style={[
                              styles.roleTag,
                              { backgroundColor: roleBg, borderColor: roleBorder },
                            ]}
                          >
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
                              size={10}
                              color={roleColor}
                            />
                            <Text style={[styles.roleTagText, { color: roleColor }]}>
                              {roleLabel}
                            </Text>
                          </View>
                        </View>

                        {/* Live Location / Zone Status with Icon */}
                        <View style={styles.memberStatusRow}>
                          <Ionicons
                            name={
                              isDriving
                                ? 'car-outline'
                                : isInSafePlace
                                ? 'home-outline'
                                : isOnline
                                ? 'radio-outline'
                                : 'time-outline'
                            }
                            size={12}
                            color={
                              isDriving
                                ? '#F5A623'
                                : isInSafePlace
                                ? '#30D158'
                                : isOnline
                                ? (isDark ? '#30D158' : '#2E7D5B')
                                : (isDark ? '#64748B' : '#9CA3AF')
                            }
                          />
                          <Text style={[styles.memberStatusText, isDark && { color: '#94A3B8' }]} numberOfLines={1}>
                            {isDriving
                              ? 'In transit • Driving'
                              : isInSafePlace && member.latestPlaceEvent?.occurred_at
                              ? `In ${placeName} • ${formatZoneArrival(member.latestPlaceEvent.occurred_at).sinceText}`
                              : isOnline
                              ? 'Active now • Live GPS'
                              : (member.lastActiveText || member.lastSeenText || 'Active recently')}
                          </Text>

                          {isGhostMode && (
                            <View style={[styles.ghostPill, isDark && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                              <Ionicons name="eye-off" size={9} color={isDark ? '#94A3B8' : '#64748B'} />
                              <Text style={[styles.ghostPillText, isDark && { color: '#94A3B8' }]}>Ghost</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Right Edge: Battery Pill & Sleek Chevron */}
                      <View style={styles.cardHeaderRightIcons}>
                        <View
                          style={[
                            styles.cardBatteryPill,
                            isDark && { backgroundColor: '#1A1C22' },
                            isLowBattery && { backgroundColor: isDark ? '#4A1D1D' : '#FFDAD7' },
                          ]}
                        >
                          <Ionicons
                            name={isLowBattery ? 'battery-dead' : 'battery-full'}
                            size={11}
                            color={isLowBattery ? '#EF4444' : batteryPctVal > 50 ? (isDark ? '#30D158' : '#16A34A') : '#F59E0B'}
                          />
                          <Text
                            style={[
                              styles.cardBatteryText,
                              isDark && { color: '#F1F5F9' },
                              isLowBattery && { color: '#EF4444', fontWeight: '800' },
                            ]}
                          >
                            {battery}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={isDark ? '#475569' : '#B5C4BB'} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Ionicons name="search-outline" size={32} color={isDark ? '#30D158' : '#2E7D5B'} />
            <Text style={[styles.emptyCardTitle, isDark && { color: '#FFFFFF' }]}>No Members Match Filter</Text>
            <Text style={[styles.emptyCardSub, isDark && { color: '#9EACA3' }]}>
              Try clearing your search query or selecting "All" to view all circle members.
            </Text>
            <TouchableOpacity
              style={[styles.clearFilterBtn, isDark && { backgroundColor: '#1A1C22' }]}
              onPress={() => { setMemberFilter('all'); setMemberSearchQuery(''); }}
            >
              <Text style={[styles.clearFilterBtnText, isDark && { color: '#30D158' }]}>Reset Filter</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Monitored Safe Places */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Monitored Places</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#1A1C22' }]}>
              <Text style={[styles.countText, isDark && { color: '#30D158' }]}>{circlePlaces.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigateToScreen('SafePlaces')}>
            <Text style={[styles.sectionLink, isDark && { color: '#30D158' }]}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {circlePlaces && circlePlaces.length > 0 ? (
          circlePlaces.map((place) => (
            <View key={place.id} style={[styles.placeCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <View style={[styles.placeIconBox, { backgroundColor: isDark ? 'rgba(48, 209, 88, 0.15)' : '#E8F5EE' }]}>
                <Ionicons name="location" size={20} color={isDark ? '#30D158' : '#2E7D5B'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.placeName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <View style={[styles.avatarStatusDot, { width: 6, height: 6, backgroundColor: '#30D158' }]} />
                </View>
                <Text style={[styles.placeMeta, isDark && { color: '#94A3B8' }]}>
                  Radius {place.radius_m || 150}m · Entry & Exit notifications
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.placeEditBtn, isDark && { backgroundColor: '#1A1C22' }]}
                onPress={() => navigateToScreen('SafePlaces')}
              >
                <Ionicons name="options-outline" size={18} color={isDark ? '#94A3B8' : '#444656'} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPlaceCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Text style={[styles.emptyPlaceText, isDark && { color: '#94A3B8' }]}>
              No safe places set up yet. Add home, school, or work to get automatic arrival & exit alerts.
            </Text>
          </View>
        )}

        {/* Add New Safe Place Button */}
        <TouchableOpacity
          style={[styles.addPlaceCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}
          onPress={() => navigateToScreen('SafePlaces')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={isDark ? '#30D158' : '#2E7D5B'} />
          <Text style={[styles.addPlaceText, isDark && { color: '#30D158' }]}>Add New Safe Place</Text>
        </TouchableOpacity>

        {/* Family Invite Code Section */}
        <View style={[styles.inviteCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <View style={styles.inviteCardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="key" size={18} color={isDark ? '#30D158' : '#2E7D5B'} />
              <Text style={[styles.inviteCardTitle, isDark && { color: '#FFFFFF' }]}>Family Invite Key & QR</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={handleCopyCode}
            >
              <Ionicons name="copy-outline" size={14} color={isDark ? '#30D158' : '#2E7D5B'} />
              <Text style={[styles.copyLinkText, isDark && { color: '#30D158' }]}>{copyStatus}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inviteCodeRow, isDark && { backgroundColor: '#090A0C' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inviteCodeText, isDark && { color: '#FFFFFF' }]}>{inviteCode}</Text>
              <Text style={[styles.inviteCodeSub, isDark && { color: '#94A3B8' }]}>Private Circle Key</Text>
            </View>

            {/* Direct Tap-to-Enlarge QR Thumbnail Preview */}
            <TouchableOpacity
              style={styles.qrThumbnailBtn}
              onPress={() => setQrModalVisible(true)}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('circleguard://join/' + inviteCode)}&bgcolor=FFFFFF&color=0F172A&margin=1`
                }}
                style={styles.qrThumbnailImg}
              />
              <View style={styles.qrZoomBadge}>
                <Ionicons name="scan-outline" size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.inviteActionsRow}>
            <TouchableOpacity
              style={[styles.codeActionBtn, isDark && { backgroundColor: '#1A1C22', borderColor: 'rgba(255, 255, 255, 0.12)' }]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={13} color={isDark ? '#30D158' : '#2E7D5B'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtn, isDark && { backgroundColor: '#1A1C22', borderColor: 'rgba(255, 255, 255, 0.12)' }]}
              onPress={handleShareSMS}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={13} color={isDark ? '#30D158' : '#2E7D5B'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Share Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtnActive, isDark && { backgroundColor: '#30D158' }]}
              onPress={() => setQrModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code" size={13} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text style={[styles.codeActionTextActive, isDark && { color: '#000000', fontWeight: '700' }]}>View QR</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.inviteCodeNote, isDark && { color: '#94A3B8' }]}>
            Family members can scan the QR code with their camera or enter the 6-digit key to join instantly.
          </Text>
        </View>

        {/* Circle Management & Danger Zone */}
        <View style={[styles.dangerZoneCard, isDark && { backgroundColor: '#231414', borderColor: '#421C1C' }]}>
          <View style={styles.dangerZoneHeader}>
            <View style={styles.dangerIconBox}>
              <Ionicons
                name={isOwner ? 'trash-outline' : 'log-out-outline'}
                size={18}
                color="#EF4444"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerZoneTitle, isDark && { color: '#FFFFFF' }]}>
                {isOwner ? 'Delete Circle' : 'Leave Circle'}
              </Text>
              <Text style={[styles.dangerZoneSubtitle, isDark && { color: '#CAD5CE' }]}>
                {isOwner
                  ? 'Permanently erase this circle, safe places, and member history'
                  : 'Disconnect and stop sharing location with this circle'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.dangerActionBtn, isDark && { backgroundColor: '#3D1B1B', borderColor: '#5C2424' }]}
            onPress={handleDeleteOrLeaveCircle}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isOwner ? 'trash' : 'exit-outline'}
              size={16}
              color="#EF4444"
            />
            <Text style={[styles.dangerActionBtnText, isDark && { color: '#EF4444' }]}>
              {isOwner ? 'Delete Circle' : 'Leave Circle'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Circle QR Code Modal */}
      <CircleQRCodeModal
        visible={qrModalVisible}
        circle={activeCircle}
        onClose={() => setQrModalVisible(false)}
      />

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Member Role Promotion & Hierarchy Modal */}
      <MemberRoleModal
        visible={!!roleModalMember}
        member={roleModalMember}
        circleId={activeCircle?.id || ''}
        canEdit={canManageRanks}
        onClose={() => {
          setRoleModalMember(null);
          if (reopenHierarchyAfterBranch) {
            setTimeout(() => {
              setHierarchyModalVisible(true);
              setReopenHierarchyAfterBranch(false);
            }, Platform.OS === 'ios' ? 140 : 250);
          }
        }}
        onRoleUpdated={(userId, newRole) => {
          setRoleModalMember((prev: any) => (prev ? { ...prev, role: newRole } : null));
          if (activeCircle?.id) fetchMembers(activeCircle.id);
          showToast(`Role updated to ${newRole.replace('_', ' ').toUpperCase()}`);
        }}
        onAssignGuardian={(m) => {
          setRoleModalMember(null);
          setTimeout(() => {
            setBranchModalMember(m);
          }, Platform.OS === 'ios' ? 120 : 220);
        }}
      />

      {/* Safety Guardian Assignment Modal */}
      <BranchAssignmentModal
        visible={!!branchModalMember}
        targetMember={branchModalMember}
        circleId={activeCircle?.id || ''}
        circleOwnerId={activeCircle?.owner_id || (activeCircle as any)?.created_by}
        onAssigned={(supName, memName) => {
          showToast(`${memName} is now assigned to ${supName}`);
          if (activeCircle?.id) fetchMembers(activeCircle.id);
          if (reopenHierarchyAfterBranch) {
            setTimeout(() => {
              setHierarchyModalVisible(true);
              setReopenHierarchyAfterBranch(false);
            }, Platform.OS === 'ios' ? 140 : 250);
          }
        }}
        onClose={() => {
          setBranchModalMember(null);
          if (activeCircle?.id) fetchMembers(activeCircle.id);
          if (reopenHierarchyAfterBranch) {
            setTimeout(() => {
              setHierarchyModalVisible(true);
              setReopenHierarchyAfterBranch(false);
            }, Platform.OS === 'ios' ? 140 : 250);
          }
        }}
      />

      {/* Circle Hierarchy Tree Modal */}
      <Modal
        visible={hierarchyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent={true}
        onRequestClose={() => setHierarchyModalVisible(false)}
      >
        <View
          style={[
            styles.hierarchyModalContainer,
            isDark && { backgroundColor: '#111613' },
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={[styles.hierarchyModalHeader, { paddingTop: topInset + 8 }, isDark && { borderBottomColor: '#1E2922', backgroundColor: '#16201A' }]}>
            <View>
              <Text style={[styles.hierarchyModalTitle, isDark && { color: '#FFFFFF' }]}>Circle Protection Hierarchy</Text>
              <Text style={[styles.hierarchyModalSub, isDark && { color: '#88988E' }]}>Emergency escalation structure</Text>
            </View>
            <TouchableOpacity
              onPress={() => setHierarchyModalVisible(false)}
              style={[styles.hierarchyCloseBtn, isDark && { backgroundColor: '#26342D' }]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#1F2A24'} />
            </TouchableOpacity>
          </View>
          <CircleHierarchyTree
            members={members}
            currentUserId={profile?.id}
            circleOwnerId={activeCircle?.owner_id || (activeCircle as any)?.created_by}
            isOwner={isOwner}
            canManageRanks={canManageRanks}
            onSelectMember={(m) => {
              setReopenHierarchyAfterBranch(true);
              setHierarchyModalVisible(false);
              setTimeout(() => {
                setRoleModalMember(m);
              }, Platform.OS === 'ios' ? 140 : 250);
            }}
            onMoveBranch={(m) => {
              setReopenHierarchyAfterBranch(true);
              setHierarchyModalVisible(false);
              setTimeout(() => {
                setBranchModalMember(m);
              }, Platform.OS === 'ios' ? 140 : 250);
            }}
          />
        </View>
      </Modal>

      {/* Unified Member Profile & Quick Actions Modal */}
      <MemberQuickActionsModal
        visible={Boolean(selectedActionsMember)}
        onClose={() => setSelectedActionsMember(null)}
        member={selectedActionsMember}
        circleId={activeCircle?.id}
        isSelf={(selectedActionsMember?.user_id || selectedActionsMember?.id) === (profile?.id || (useAuthStore.getState() as any).session?.user?.id)}
        canManageRanks={canManageRanks}
        onChatMember={(m) => {
          setSelectedActionsMember(null);
          const targetName = m?.profile?.full_name || m?.full_name || 'Member';
          const targetUserId = m?.user_id || m?.id;
          navigateToScreen('Chat', {
            memberId: targetUserId,
            memberName: targetName,
            taggedMember: m,
            initialText: `@${targetName} `,
          });
        }}
        onNavigateMember={(m) => {
          setSelectedActionsMember(null);
          const targetUserId = m?.user_id || m?.id;
          const allMembers = useCircleStore.getState().members;
          const memberInStore = allMembers.find((x) => (x.user_id || (x as any).id) === targetUserId) || m;
          const targetLat = memberInStore?.latitude ?? m?.latitude;
          const targetLng = memberInStore?.longitude ?? m?.longitude;
          const targetName = memberInStore?.profile?.full_name || m?.profile?.full_name || 'Member';

          showToast(`Opening live route to ${targetName}...`);

          if (targetLat != null && targetLng != null && !isNaN(Number(targetLat)) && !isNaN(Number(targetLng))) {
            const lat = Number(targetLat);
            const lng = Number(targetLng);

            // Focus on member on live Map
            navigateToScreen('Map', {
              focusUserId: targetUserId,
              focusLat: lat,
              focusLng: lng,
              focusUserName: targetName,
              targetMember: memberInStore,
              timestamp: Date.now(),
            });
          } else {
            // Member hasn't shared GPS yet: navigate to map and ping device
            navigateToScreen('Map', {
              focusUserId: targetUserId,
              focusUserName: targetName,
              targetMember: memberInStore,
              timestamp: Date.now(),
            });
            showToast(`Location refresh ping dispatched to ${targetName}`);
            sendExpoPushNotification(
              targetUserId,
              `Location Check: ${profile?.full_name || 'Circle Member'}`,
              `Requesting live location update to verify your perimeter safety.`,
              { type: 'LOCATION_PING', senderId: profile?.id, timestamp: Date.now() }
            ).catch(() => {});
          }
        }}
        onRingMember={(m) => {
          setSelectedActionsMember(null);
          const targetUid = m?.user_id || m?.id;
          const currentUid = profile?.id || (useAuthStore.getState() as any).session?.user?.id;
          if (targetUid === currentUid) {
            if (Platform.OS !== 'web') {
              try { Vibration.vibrate([100, 100, 200]); } catch (_) {}
            }
            showToast('Centering map on your device');
            const myLat = myMemberRecord?.latitude ?? (profile as any)?.latitude;
            const myLng = myMemberRecord?.longitude ?? (profile as any)?.longitude;
            navigateToScreen('Map', {
              focusUserId: profile?.id,
              focusLat: myLat,
              focusLng: myLng,
              focusUserName: profile?.full_name || 'You',
              targetMember: myMemberRecord,
              timestamp: Date.now(),
            });
          } else {
            handleRingMember(m);
          }
        }}
        onOpenHistory={(m) => {
          setSelectedActionsMember(null);
          const targetName = m?.profile?.full_name || m?.full_name || 'Member';
          const targetUserId = m?.user_id || m?.id;
          showToast(`Loading 24h timeline for ${targetName}...`);
          navigateToScreen('LocationHistory', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onOpenDriving={(m) => {
          setSelectedActionsMember(null);
          const targetName = m?.profile?.full_name || m?.full_name || 'Member';
          const targetUserId = m?.user_id || m?.id;
          showToast(`Loading drive safety report for ${targetName}...`);
          navigateToScreen('DrivingReports', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onNudgeMember={(m) => {
          setSelectedActionsMember(null);
          handleNudgeMember(m);
        }}
        onAssignGuardian={(m) => {
          setSelectedActionsMember(null);
          setTimeout(() => {
            setBranchModalMember(m);
          }, Platform.OS === 'ios' ? 120 : 220);
        }}
        onManageRole={(m) => {
          setSelectedActionsMember(null);
          setTimeout(() => {
            setRoleModalMember(m);
          }, Platform.OS === 'ios' ? 120 : 220);
        }}
        onRemoveMember={(m) => {
          setSelectedActionsMember(null);
          showConfirm({
            title: 'Remove Member',
            message: `Are you sure you want to remove ${m?.profile?.full_name || 'this member'} from the circle?`,
            confirmText: 'Remove Member',
            cancelText: 'Cancel',
            isDestructive: true,
            onConfirm: async () => {
              if (!activeCircle?.id) return;
              try {
                showToast('Removing member from circle...');
                const success = await useCircleStore.getState().removeMember(activeCircle.id, m.user_id || m.id);
                if (success) {
                  showToast('Member removed from circle');
                  fetchMembers(activeCircle.id);
                } else {
                  showToast('Failed to remove member');
                }
              } catch (e: any) {
                showToast(e?.message || 'Failed to remove member');
              }
            },
          });
        }}
      />

      {/* Circle Switcher Modal */}
      <CircleSwitcherModal
        visible={circleSwitcherVisible}
        onClose={() => setCircleSwitcherVisible(false)}
      />

      {/* Floating Scroll to Top Pill */}
      <Animated.View
        style={[
          styles.floatingBackToTopWrap,
          {
            opacity: floatingBackToTopOpacity,
            transform: [{ translateY: floatingBackToTopTranslateY }],
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[
            styles.floatingBackToTopBtn,
            isDark && { backgroundColor: '#16221C', borderColor: '#2E4A3B' },
          ]}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.84}
        >
          <View style={[styles.floatingBackToTopIconWrap, isDark && { backgroundColor: 'rgba(58, 223, 171, 0.16)' }]}>
            <Ionicons name="arrow-up" size={13} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
          </View>
          <Text style={[styles.floatingBackToTopText, isDark && { color: '#E8F5EE' }]}>
            {circleName} • Top
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const SANS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

const styles = StyleSheet.create({
  scrollProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    borderRadius: 2,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3ADFAB',
    marginRight: 2,
  },
  floatingBackToTopWrap: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    zIndex: 99,
  },
  floatingBackToTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingBackToTopIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBackToTopText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2A24',
  },
  quickSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  quickSwitchBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#151C27',
    fontWeight: '500',
  },
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
  headerSOSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  headerSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  topSection: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headlineText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addMemberText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D5B',
  },
  bannerText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
  },
  commonChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 16,
    gap: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  commonChatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonChatTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2A24',
  },
  liveChatBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveChatBadgeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  commonChatSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
    marginTop: 2,
  },
  commonChatAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  commonChatActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2A24',
  },
  countBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  sectionLink: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  memberFilterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  memberFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F5F2',
    borderWidth: 1,
    borderColor: '#D8E5DE',
  },
  memberFilterChipActive: {
    backgroundColor: '#2E7D5B',
    borderColor: '#2E7D5B',
  },
  memberFilterChipText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#475C50',
  },
  memberFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  memberSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F7F5',
    borderWidth: 1,
    borderColor: '#DDE6E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: 12,
  },
  memberSearchInput: {
    flex: 1,
    fontFamily: SANS_FONT,
    fontSize: 13,
    color: '#151C27',
    padding: 0,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 8,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  memberAvatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006C4F',
  },
  memberInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontFamily: SANS_FONT,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#151C27',
    flexShrink: 1,
  },
  threeDotsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F2F6F4',
    borderWidth: 1,
    borderColor: '#E1E9E4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  roleTag: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4E8DC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  roleTagText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EBF5F0',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  cardBatteryText: {
    fontFamily: SANS_FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#444656',
  },
  memberStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    flexWrap: 'nowrap',
  },
  memberStatusText: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    color: '#6E7E74',
    flexShrink: 1,
  },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  ghostPillText: {
    fontFamily: SANS_FONT,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  memberActionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F2',
  },
  memberActionDockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6.5,
    borderRadius: 10,
    backgroundColor: '#F5F8F6',
  },
  memberActionDockText: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  memberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionPillBtn: {
    flex: 1,
    height: 36,
    backgroundColor: '#EFF6F2',
    borderWidth: 1,
    borderColor: '#E2ECE6',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPillText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#151C27',
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6F2',
    borderWidth: 1,
    borderColor: '#E2ECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowBatteryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 218, 215, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginTop: 10,
  },
  lowBatteryText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '600',
    color: '#930014',
  },
  nudgeBtn: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D4E8DC',
    marginBottom: 10,
  },
  emptyCardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  emptyCardSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    textAlign: 'center',
    lineHeight: 16,
  },
  clearFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    marginTop: 6,
  },
  clearFilterBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2ECE6',
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#151C27',
  },
  placeMeta: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    marginTop: 2,
  },
  placeEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6F2',
  },
  emptyPlaceCard: {
    backgroundColor: '#F4F9F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2ECE6',
  },
  emptyPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    lineHeight: 16,
  },
  addPlaceCard: {
    backgroundColor: '#F2FAF6',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#D4E8DC',
    borderStyle: 'dashed',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 16,
  },
  addPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  inviteCard: {
    backgroundColor: '#F2FAF6',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1.2,
    borderColor: '#D4E8DC',
    shadowColor: '#151C27',
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  inviteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#151C27',
  },
  copyLinkText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DFEAE3',
  },
  inviteCodeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#151C27',
  },
  inviteCodeSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    fontWeight: '500',
    marginTop: 2,
  },
  qrThumbnailBtn: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 3,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  qrThumbnailImg: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
  },
  qrZoomBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  codeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E8DC',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  codeActionBtnActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#2E7D5B',
  },
  codeActionTextActive: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inviteCodeNote: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    lineHeight: 16,
  },
  floatingSOSButton: {
    position: 'absolute',
    right: 18,
    bottom: 95,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#DC2626',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 12,
    zIndex: 9999,
  },
  sosPulseAura: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    opacity: 0.4,
  },
  floatingSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
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
  dangerZoneCard: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 44,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 16,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dangerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerZoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  dangerZoneSubtitle: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  hierarchyTreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF8EB',
    borderWidth: 1,
    borderColor: '#F3E5BE',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  hierarchyTreeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#926C15',
  },
  escalationStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  guardianPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EBF6F1',
    borderWidth: 1,
    borderColor: '#CBE6D7',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    maxWidth: '100%',
  },
  guardianPillText: {
    fontSize: 11,
    color: '#344A3F',
  },
  supervisingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  supervisingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  hierarchyModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  hierarchyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  hierarchyModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2A24',
  },
  hierarchyModalSub: {
    fontSize: 12,
    color: '#6E7E74',
    marginTop: 2,
  },
  hierarchyCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
