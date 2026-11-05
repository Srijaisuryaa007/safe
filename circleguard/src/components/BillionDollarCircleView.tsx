import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
import { navigationRef } from '../navigation/navigationRef';
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
import ParallaxMemberCard from './ui/ParallaxMemberCard';
import ReactBitsParallaxCards from './ui/ReactBitsParallaxCards';

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
  const { activeCircle, members, places, fetchMembers, fetchPlaces, fetchActiveCircle, fetchUserCircles } = useCircleStore();
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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handlePullToRefresh = async () => {
    setIsRefreshing(true);
    try {
      const uid = profile?.id || useAuthStore.getState().user?.id;
      if (uid) {
        await fetchUserCircles(uid);
      }
      const curCircle = useCircleStore.getState().activeCircle;
      if (curCircle?.id) {
        await Promise.all([
          fetchMembers(curCircle.id),
          fetchPlaces(curCircle.id),
        ]);
      } else if (uid) {
        await fetchActiveCircle(uid);
      }
    } catch (_) {
    } finally {
      setIsRefreshing(false);
    }
  };

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

  const [membersViewMode, setMembersViewMode] = useState<'tree' | 'cards'>('tree');

  const handleLocateMember = (member: any) => {
    subActionHandledRef.current = true;
    setTimeout(() => { subActionHandledRef.current = false; }, 350);
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(12); } catch (_) {}
    }
    const name = member.profile?.full_name?.split(' ')[0] || 'Member';
    showToast(`Focusing ${name} on live map...`);
    const lat = member.latitude ?? member.location?.latitude ?? member.profile?.latitude;
    const lng = member.longitude ?? member.location?.longitude ?? member.profile?.longitude;
    const memberUserId = member.user_id || (member as any).id;
    navigateToScreen('Map', { focusUserId: memberUserId, focusLat: lat, focusLng: lng });
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
            onPress: () => {
              useCircleStore.getState().startDeleteCircleWithAnimation(
                activeCircle.id,
                activeCircle.name || 'this circle'
              );
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
            onPress: () => {
              if (!profile?.id || !activeCircle?.id) return;
              useCircleStore.getState().startLeaveCircleWithAnimation(
                activeCircle.id,
                activeCircle.name || 'this circle',
                profile.id
              );
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
            <Ionicons name="chatbubbles-outline" size={19} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.profileAvatarBtn, isDark && { borderColor: 'rgba(255, 255, 255, 0.2)' }]}
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
              <View style={[styles.profileAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1A1C22' }]}>
                <Text style={[styles.avatarFallbackText, isDark && { color: '#FFFFFF' }]}>
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
              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullToRefresh}
            tintColor={isDark ? '#F59E0B' : '#D97706'}
            colors={['#F59E0B', '#D97706']}
          />
        }
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
              <Ionicons name="chevron-down" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {/* Quick Switch Suggestion if on empty/testing circle while other circles exist */}
          {displayMembers.length <= 1 && useCircleStore.getState().circles.some(c => c.id !== activeCircle?.id) && (
            <TouchableOpacity
              style={[
                styles.quickSwitchBanner,
                isDark && { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' }
              ]}
              onPress={() => setCircleSwitcherVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.quickSwitchBannerText, isDark && { color: '#E8EDE9' }]}>
                Switch circle or select family group
              </Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          )}

          {/* Active Circle Status Banner */}
          <View style={[styles.activeBanner, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <View style={[styles.greenPulseDot, isDark && { backgroundColor: '#FFFFFF' }]} />
            <Text style={[styles.bannerText, isDark && { color: '#94A3B8' }]}>
              <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#151C27' }}>
                {displayMembers.length} Connected
              </Text>
              {'  ·  '}
              <Text>{circlePlaces.length} Zones Protected</Text>
              {'  ·  '}
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
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
            <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.commonChatTitle, isDark && { color: '#FFFFFF' }]}>Circle Messages</Text>
              <View style={[styles.liveChatBadge, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <Text style={[styles.liveChatBadgeText, isDark && { color: '#FFFFFF' }]}>Live</Text>
              </View>
            </View>
            <Text style={[styles.commonChatSub, isDark && { color: '#94A3B8' }]}>
              Instant family check-ins & status updates
            </Text>
          </View>
          <View style={[styles.commonChatAction, isDark && { backgroundColor: '#1A1C22' }]}>
            <Text style={[styles.commonChatActionText, isDark && { color: '#FFFFFF' }]}>Open</Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </View>
        </TouchableOpacity>

        {/* Family Members Section Header */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Circle Members</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#1A1C22' }]}>
              <Text style={[styles.countText, isDark && { color: '#30D158' }]}>{displayMembers.length}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {displayMembers.length > 0 && (
              <View style={[
                styles.segmentContainer,
                isDark ? { backgroundColor: '#15181D', borderColor: 'rgba(255, 255, 255, 0.12)' } : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }
              ]}>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    membersViewMode === 'cards' && (isDark ? styles.segmentBtnActiveDark : styles.segmentBtnActiveLight)
                  ]}
                  onPress={() => setMembersViewMode('cards')}
                  activeOpacity={0.7}
                  accessibilityLabel="View 3D Cards"
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={12}
                    color={membersViewMode === 'cards' ? (isDark ? '#A855F7' : '#7E22CE') : (isDark ? '#94A3B8' : '#64748B')}
                  />
                  <Text style={[
                    styles.segmentBtnText,
                    membersViewMode === 'cards' && (isDark ? { color: '#A855F7', fontWeight: '800' } : { color: '#7E22CE', fontWeight: '800' }),
                    membersViewMode !== 'cards' && (isDark ? { color: '#94A3B8' } : { color: '#64748B' }),
                  ]}>
                    3D
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => navigateToScreen('Home')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              activeOpacity={0.7}
              accessibilityLabel="View members on live map"
            >
              <Text style={[styles.sectionLink, isDark && { color: '#30D158' }]}>Map</Text>
              <Ionicons name="chevron-forward" size={14} color={isDark ? '#30D158' : '#0F172A'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Tree View Inline */}
        {membersViewMode === 'tree' && displayMembers.length > 0 && (
          <View style={[
            styles.inlineTreeCard,
            isDark ? { backgroundColor: '#101412', borderColor: 'rgba(255, 255, 255, 0.08)' } : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }
          ]}>
            <CircleHierarchyTree
              members={displayMembers}
              currentUserId={profile?.id}
              circleOwnerId={trueLeaderId}
              isOwner={isOwner}
              canManageRanks={canManageRanks}
              isInline={true}
              onExpandFullScreen={() => setHierarchyModalVisible(true)}
              onSelectMember={(m) => {
                setRoleModalMember(m);
              }}
              onMoveBranch={(m) => {
                setBranchModalMember(m);
              }}
            />
          </View>
        )}

        {/* 3D Parallax View if toggled */}
        {membersViewMode === 'cards' && displayMembers.length > 0 && (
          <ReactBitsParallaxCards
            members={displayMembers}
            activeCircle={activeCircle}
            isDark={isDark}
            circlePlaces={circlePlaces}
            trueLeaderId={trueLeaderId}
            currentUserId={profile?.id}
            onLocateMember={handleLocateMember}
            onChatMember={handleChatMember}
            onCallMember={handleCallMember}
            onMemberActions={(m) => setSelectedActionsMember(m)}
          />
        )}

        {/* Empty state when circle has no members */}
        {displayMembers.length === 0 && (
          <View style={[styles.emptyCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Ionicons name="people-outline" size={32} color={isDark ? '#FFFFFF' : '#0F172A'} />
            <Text style={[styles.emptyCardTitle, isDark && { color: '#FFFFFF' }]}>No Circle Members</Text>
            <Text style={[styles.emptyCardSub, isDark && { color: '#9EACA3' }]}>
              Invite family members using your private invite code below.
            </Text>
          </View>
        )}

        {/* Monitored Safe Places */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Monitored Places</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#1A1C22' }]}>
              <Text style={[styles.countText, isDark && { color: '#FFFFFF' }]}>{circlePlaces.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigateToScreen('SafePlaces')}>
            <Text style={[styles.sectionLink, isDark && { color: '#FFFFFF' }]}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {circlePlaces && circlePlaces.length > 0 ? (
          circlePlaces.map((place) => {
            const rawNameLower = (place.name || '').toLowerCase();
            const placeCategory = place.category || (rawNameLower.includes('home') ? 'home' : rawNameLower.includes('school') ? 'school' : rawNameLower.includes('work') ? 'work' : rawNameLower.includes('gym') ? 'fitness' : 'general');
            const catIcon = placeCategory === 'home' ? 'home' : placeCategory === 'work' ? 'briefcase' : placeCategory === 'school' ? 'school' : placeCategory === 'fitness' ? 'fitness' : 'shield-checkmark';

            const occupants = displayMembers.filter(
              (m) => m.latestPlaceEvent?.place_id === place.id && m.latestPlaceEvent?.event_type === 'arrival'
            );

            return (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeCard,
                  isDark && { backgroundColor: '#101114', borderColor: occupants.length > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)' },
                ]}
                onPress={() => navigateToScreen('SafePlaces')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.placeIconBox,
                    {
                      backgroundColor: occupants.length > 0
                        ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7')
                        : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'),
                    },
                  ]}
                >
                  <Ionicons
                    name={occupants.length > 0 ? 'shield-checkmark' : (catIcon as any)}
                    size={18}
                    color={occupants.length > 0 ? '#10B981' : (isDark ? '#FFFFFF' : '#0F172A')}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={[styles.placeName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                      {place.name}
                    </Text>

                    {occupants.length > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#10B981' }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' }} />
                        <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#34D399' : '#047857' }}>
                          {occupants.length} INSIDE
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }}>
                        <Text style={{ fontSize: 8.5, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B' }}>
                          ARMED
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.placeMeta, isDark && { color: '#94A3B8' }]}>
                    Radius {place.radius_m || 150}m · Instant Arrival & Exit Radar
                  </Text>

                  {/* Occupant member pills if any inside */}
                  {occupants.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {occupants.map((occ) => {
                        const occName = occ.profile?.full_name?.split(' ')[0] || 'Member';
                        return (
                          <View
                            key={occ.user_id || (occ as any).id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                            }}
                          >
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isDark ? '#FFFFFF' : '#0F172A', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 7, fontWeight: '900', color: isDark ? '#000000' : '#FFFFFF' }}>
                                {occName.charAt(0)}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                              {occName}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.placeEditBtn, isDark && { backgroundColor: '#1A1C22' }]}
                  onPress={() => navigateToScreen('SafePlaces')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
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
          <Ionicons name="add-circle-outline" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
          <Text style={[styles.addPlaceText, isDark && { color: '#FFFFFF' }]}>Configure New Safe Zone</Text>
        </TouchableOpacity>

        {/* Family Invite Code Section */}
        <View style={[styles.inviteCard, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <View style={styles.inviteCardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="key" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.inviteCardTitle, isDark && { color: '#FFFFFF' }]}>Family Invite Key & QR</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={handleCopyCode}
            >
              <Ionicons name="copy-outline" size={14} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.copyLinkText, isDark && { color: '#FFFFFF' }]}>{copyStatus}</Text>
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
              <Ionicons name="copy-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtn, isDark && { backgroundColor: '#1A1C22', borderColor: 'rgba(255, 255, 255, 0.12)' }]}
              onPress={handleShareSMS}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Share Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtnActive, isDark && { backgroundColor: '#FFFFFF' }]}
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
            members={displayMembers}
            currentUserId={profile?.id}
            circleOwnerId={trueLeaderId || activeCircle?.owner_id || (activeCircle as any)?.created_by}
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
            isDark && { backgroundColor: '#1A1C22', borderColor: 'rgba(255, 255, 255, 0.12)' },
          ]}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.84}
        >
          <View style={[styles.floatingBackToTopIconWrap, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Ionicons name="arrow-up" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </View>
          <Text style={[styles.floatingBackToTopText, isDark && { color: '#FFFFFF' }]}>
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
    backgroundColor: '#0F172A',
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
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBackToTopText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  circleSelectorText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
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
    backgroundColor: '#F1F5F9',
  },
  profileAvatarBtn: {
    padding: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  profileAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: '#0F172A',
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
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F172A',
  },
  bannerText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#64748B',
  },
  commonChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  commonChatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonChatTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  liveChatBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveChatBadgeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  commonChatSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  commonChatAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  commonChatActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionLink: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberFilterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  memberFilterChipText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
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
    backgroundColor: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },
  clearFilterBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
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
    backgroundColor: '#F1F5F9',
  },
  emptyPlaceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    lineHeight: 16,
  },
  addPlaceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
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
    color: '#0F172A',
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
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
    color: '#0F172A',
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
    borderColor: '#E2E8F0',
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
    color: '#64748B',
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
    backgroundColor: '#0F172A',
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
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
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
    backgroundColor: '#0F172A',
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
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 7,
    gap: 3,
  },
  segmentBtnActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnActiveDark: {
    backgroundColor: '#20252C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineTreeCard: {
    width: '100%',
    height: 480,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 16,
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
    color: '#0F172A',
  },
  hierarchyModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  hierarchyCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactBitsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  reactBitsBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
