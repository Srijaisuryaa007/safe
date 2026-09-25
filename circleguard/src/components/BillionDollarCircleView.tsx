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
  Linking,
  Share,
  Vibration,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { navigationRef } from '../navigation/AppNavigator';
import CircleQRCodeModal from './CircleQRCodeModal';
import CircleSwitcherModal from './CircleSwitcherModal';
import OrbitalGoldenLogoBadge from './OrbitalGoldenLogoBadge';
import MemberRoleModal from './MemberRoleModal';
import BranchAssignmentModal from './BranchAssignmentModal';
import CircleHierarchyTree from './CircleHierarchyTree';
import MemberQuickActionsModal from './MemberQuickActionsModal';
import MemberShortProfileModal from './MemberShortProfileModal';
import AnimatedList from './AnimatedList';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { getSafeTopInset } from '../utils/safeArea';
import { useLuxuryAlert } from './LuxuryAlertModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillionDollarCircleView() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { profile } = useAuthStore();
  const { activeCircle, members, places, fetchMembers, fetchPlaces } = useCircleStore();
  const { isDark } = useThemeStore();
  const { showConfirm } = useLuxuryAlert();

  const [copyStatus, setCopyStatus] = useState('Copy');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [circleSwitcherVisible, setCircleSwitcherVisible] = useState(false);
  const [roleModalMember, setRoleModalMember] = useState<any>(null);
  const [branchModalMember, setBranchModalMember] = useState<any>(null);
  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
  const [selectedActionsMember, setSelectedActionsMember] = useState<any>(null);
  const [shortProfileMember, setShortProfileMember] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__openMemberShortProfile = (m: any) => setShortProfileMember(m);
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

  const myMemberRecord = members.find((m) => m.user_id === profile?.id);
  const myRole = myMemberRecord?.role || 'member';
  const isOwner = (activeCircle && profile && activeCircle.owner_id === profile.id) ||
    (activeCircle && profile && (activeCircle as any).created_by === profile.id) ||
    myRole === 'owner' ||
    (myRole as string) === 'leader';
  const canManageRanks = isOwner; // STRICT: Only circle leader / founder has permission to promote or edit roles

  const founder = useMemo(() => {
    const owners = members.filter((m) => m.role === 'owner');
    return owners.length > 0 ? owners[0] : members[0];
  }, [members]);
  const founderName = founder?.profile?.full_name || 'Circle Leader';

  useEffect(() => {
    if (activeCircle?.id) {
      fetchMembers(activeCircle.id);
      fetchPlaces(activeCircle.id);
    }
  }, [activeCircle?.id]);

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
    const name = member.profile?.full_name || 'Family Member';
    if (Platform.OS !== 'web') {
      Vibration.vibrate([150, 100, 150, 100, 300]);
    }
    showToast(`Ringing ${name}'s device with audible chime...`);
    try {
      await sendExpoPushNotification(
        member.user_id,
        'Urgent Audible Ring',
        `${profile?.full_name || 'A circle member'} is ringing your device with an urgent audible chime!`,
        { type: 'RING' }
      );
      showToast(`Audible chime sent to ${name}'s device!`);
    } catch (e) {
      showToast(`Chime alert dispatched to ${name}!`);
    }
  };

  const handleNudgeMember = async (member: any) => {
    const name = member.profile?.full_name || 'Family Member';
    showToast(`Sending recharge reminder to ${name}...`);
    try {
      await sendExpoPushNotification(
        member.user_id,
        'Low Battery Alert',
        `${profile?.full_name || 'A circle member'} noticed your battery is at ${member.batteryPct || 15}%. Please plug in your charger!`,
        { type: 'LOW_BATTERY' }
      );
      showToast(`Recharge prompt sent to ${name}!`);
    } catch (e) {
      showToast(`Sent prompt to ${name}!`);
    }
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
      <View
        style={[
          styles.header,
          { paddingTop: topInset, height: 56 + topInset },
          isDark && { backgroundColor: '#141A17', borderBottomColor: '#212C26' },
        ]}
      >
        <View style={styles.headerLeft}>
          <OrbitalGoldenLogoBadge
            size={34}
            onPress={() => navigation.navigate('Home')}
            accessibilityLabel="CircleGuard Logo"
          />
          <TouchableOpacity
            style={[styles.circleSelectorBtn, isDark && { backgroundColor: '#1C2621' }]}
            onPress={() => setCircleSwitcherVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.circleSelectorText, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
              {circleName}
            </Text>
            <Ionicons name="chevron-down" size={15} color={isDark ? '#9EACA3' : '#5C665F'} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconButton, isDark && { backgroundColor: '#1C2621' }]}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={19} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.profileAvatarBtn, isDark && { borderColor: '#3ADFAB' }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
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
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Circle Header */}
        <View style={styles.topSection}>
          <View style={styles.titleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={[styles.headlineText, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {circleName}
              </Text>
            </View>
          </View>

          {/* Active Circle Status Banner */}
          <View style={[styles.activeBanner, isDark && { backgroundColor: '#161E1A', borderColor: '#26342D' }]}>
            <View style={styles.greenPulseDot} />
            <Text style={[styles.bannerText, isDark && { color: '#9EACA3' }]}>
              <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#151C27' }}>
                {members.length} {members.length === 1 ? 'Active' : 'Active'}
              </Text>
              {'  ·  '}
              <Text>{circlePlaces.length} Geofences Monitored</Text>
              {'  ·  '}
              <Text style={{ color: isDark ? '#3ADFAB' : '#006C4F', fontWeight: '600' }}>
                {normalBatteryCount} Normal Battery
              </Text>
            </Text>
          </View>
        </View>

        {/* Common Circle Group Chat Hub */}
        <TouchableOpacity
          style={[styles.commonChatCard, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.85}
        >
          <View style={[styles.commonChatIconBox, isDark && { backgroundColor: '#2E7D5B' }]}>
            <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.commonChatTitle, isDark && { color: '#FFFFFF' }]}>Circle Group Chat</Text>
              <View style={[styles.liveChatBadge, isDark && { backgroundColor: 'rgba(58, 223, 171, 0.15)' }]}>
                <Text style={[styles.liveChatBadgeText, isDark && { color: '#3ADFAB' }]}>Active</Text>
              </View>
            </View>
            <Text style={[styles.commonChatSub, isDark && { color: '#9EACA3' }]}>
              Common chat with all {members.length} circle members
            </Text>
          </View>
          <View style={[styles.commonChatAction, isDark && { backgroundColor: '#26342D' }]}>
            <Text style={[styles.commonChatActionText, isDark && { color: '#3ADFAB' }]}>Open</Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#3ADFAB' : '#183CE6'} />
          </View>
        </TouchableOpacity>

        {/* Family Members Section */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Family Members</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#26342D' }]}>
              <Text style={[styles.countText, isDark && { color: '#FFFFFF' }]}>{members.length}</Text>
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
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <Text style={[styles.sectionLink, isDark && { color: '#3ADFAB' }]}>Live Map View ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Circle Members Animated List */}
        {members.length > 0 ? (
          <AnimatedList
            items={members}
            showGradients={members.length > 3}
            maxHeight={members.length > 3 ? 460 : undefined}
            gradientColor={isDark ? '#111613' : '#FAF9F6'}
            onItemSelect={(member) => setShortProfileMember(member)}
            renderItem={(member) => {
              const name = member.profile?.full_name || 'Family Member';
              const isSelf = member.user_id === profile?.id;
              const role = member.role || 'member';
              const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
              const isLowBattery = (member.batteryPct != null && member.batteryPct <= 20);
              const isDriving = Boolean(member.isDriving);
              const isOnline = member.isOnline !== false;

              const isTargetOwner = role === 'owner';
              const roleLabel =
                role === 'owner'
                  ? 'Leader'
                  : role === 'co_leader'
                  ? 'Co-Leader'
                  : role === 'guardian'
                  ? 'Guardian'
                  : 'Member';

              const roleColor =
                role === 'owner'
                  ? (isDark ? '#3ADFAB' : '#059669')
                  : role === 'co_leader'
                  ? (isDark ? '#818CF8' : '#4F46E5')
                  : role === 'guardian'
                  ? (isDark ? '#2DD4BF' : '#0D9488')
                  : (isDark ? '#94A3B8' : '#64748B');

              const roleBg =
                role === 'owner'
                  ? (isDark ? 'rgba(58, 223, 171, 0.12)' : '#ECFDF5')
                  : role === 'co_leader'
                  ? (isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF')
                  : role === 'guardian'
                  ? (isDark ? 'rgba(13, 148, 136, 0.12)' : '#F0FDFA')
                  : (isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9');

              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={[
                    styles.memberCard,
                    isDark && { backgroundColor: '#1A231F', borderColor: '#283730' },
                  ]}
                  onPress={() => setShortProfileMember(member)}
                  activeOpacity={0.85}
                >
                  <View style={styles.memberCardTop}>
                    {/* Avatar */}
                    <View style={styles.memberAvatarWrapper}>
                      {member.profile?.avatar_url ? (
                        <Image source={{ uri: member.profile.avatar_url }} style={styles.avatarImg} />
                      ) : (
                        <View style={[styles.avatarImg, styles.avatarFallback, isDark && { backgroundColor: '#26342D' }]}>
                          <Text style={[styles.avatarFallbackText, isDark && { color: '#3ADFAB' }]}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.avatarStatusBadge,
                          isDriving && { backgroundColor: isDark ? '#1E254A' : '#DEE0FF' },
                        ]}
                      >
                        {isDriving ? (
                          <Ionicons name="car" size={10} color={isDark ? '#818CF8' : '#183CE6'} />
                        ) : (
                          <View
                            style={[
                              styles.avatarStatusDot,
                              { backgroundColor: isOnline ? '#10B981' : '#94A3B8' }
                            ]}
                          />
                        )}
                      </View>
                    </View>

                    <View style={styles.memberInfoCol}>
                      {/* Line 1: Member Name & 3-Dots Action Button */}
                      <View style={styles.memberNameRow}>
                        <Text style={[styles.memberName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                          {isSelf ? `${name} (You)` : name}
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.threeDotsBtn,
                            isDark && {
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              borderColor: 'rgba(255, 255, 255, 0.12)',
                            },
                          ]}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            setSelectedActionsMember(member);
                          }}
                          activeOpacity={0.65}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityLabel={`Actions for ${name}`}
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={16}
                            color={isDark ? '#3ADFAB' : '#2E7D5B'}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Line 2: Role Badge, Battery Chip & Status */}
                      <View style={styles.memberMetaRow}>
                        <TouchableOpacity
                          style={[
                            styles.roleTag,
                            {
                              backgroundColor: roleBg,
                              borderColor: roleColor,
                            },
                          ]}
                          onPress={(e) => {
                            if (canManageRanks && !isTargetOwner) {
                              e.stopPropagation();
                              setRoleModalMember(member);
                            }
                          }}
                          activeOpacity={canManageRanks && !isTargetOwner ? 0.7 : 1}
                        >
                          <Ionicons
                            name={
                              role === 'owner'
                                ? 'shield-checkmark'
                                : role === 'co_leader'
                                ? 'shield'
                                : 'person'
                            }
                            size={10}
                            color={roleColor}
                          />
                          <Text
                            style={[
                              styles.roleTagText,
                              { color: roleColor },
                            ]}
                          >
                            {roleLabel}
                          </Text>
                          {canManageRanks && !isTargetOwner && (
                            <Ionicons name="pencil" size={9} color={roleColor} style={{ marginLeft: 3 }} />
                          )}
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.cardBatteryPill,
                            isDark && { backgroundColor: '#26342D' },
                            isLowBattery && { backgroundColor: isDark ? '#4A1D1D' : '#FFDAD7' },
                          ]}
                        >
                          <Ionicons
                            name={isLowBattery ? 'battery-dead' : 'battery-full'}
                            size={12}
                            color={isLowBattery ? '#EF4444' : (isDark ? '#3ADFAB' : '#006C4F')}
                          />
                          <Text
                            style={[
                              styles.cardBatteryText,
                              isDark && { color: '#E8EDE9' },
                              isLowBattery && { color: '#EF4444', fontWeight: '700' },
                            ]}
                          >
                            {battery}
                          </Text>
                        </View>

                        <Text style={[styles.memberStatusText, isDark && { color: '#9EACA3' }]} numberOfLines={1}>
                          • {isDriving
                            ? 'In transit'
                            : isOnline
                            ? 'Sharing location'
                            : 'Active recently'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isLowBattery && (
                    <View style={[styles.lowBatteryNotice, isDark && { backgroundColor: '#2A1818', borderColor: '#4A2323' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="battery-dead" size={15} color="#EF4444" />
                        <Text style={[styles.lowBatteryText, isDark && { color: '#FCA5A5' }]}>Low battery ({battery})</Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleNudgeMember(member);
                        }}
                      >
                        <Text style={[styles.nudgeBtn, isDark && { color: '#EF4444' }]}>Remind</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <View style={[styles.emptyCard, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
            <Ionicons name="person-add-outline" size={32} color={isDark ? '#3ADFAB' : '#183CE6'} />
            <Text style={[styles.emptyCardTitle, isDark && { color: '#FFFFFF' }]}>No Members In This Circle Yet</Text>
            <Text style={[styles.emptyCardSub, isDark && { color: '#9EACA3' }]}>
              Share your invite code below with family to see their real-time location and safety status.
            </Text>
          </View>
        )}

        {/* Monitored Safe Places */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.sectionTitle, isDark && { color: '#FFFFFF' }]}>Monitored Places</Text>
            <View style={[styles.countBadge, isDark && { backgroundColor: '#26342D' }]}>
              <Text style={[styles.countText, isDark && { color: '#FFFFFF' }]}>{circlePlaces.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SafePlaces')}>
            <Text style={[styles.sectionLink, isDark && { color: '#3ADFAB' }]}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {circlePlaces && circlePlaces.length > 0 ? (
          circlePlaces.map((place) => (
            <View key={place.id} style={[styles.placeCard, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
              <View style={[styles.placeIconBox, { backgroundColor: isDark ? '#1C2E24' : '#DEE0FF' }]}>
                <Ionicons name="location" size={20} color={isDark ? '#3ADFAB' : '#183CE6'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.placeName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <View style={[styles.avatarStatusDot, { width: 6, height: 6 }]} />
                </View>
                <Text style={[styles.placeMeta, isDark && { color: '#9EACA3' }]}>
                  Radius {place.radius_m || 150}m · Entry & Exit notifications
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.placeEditBtn, isDark && { backgroundColor: '#26342D' }]}
                onPress={() => navigation.navigate('SafePlaces')}
              >
                <Ionicons name="options-outline" size={18} color={isDark ? '#CAD5CE' : '#444656'} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={[styles.emptyPlaceCard, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
            <Text style={[styles.emptyPlaceText, isDark && { color: '#CAD5CE' }]}>
              No safe places set up yet. Add home, school, or work to get automatic arrival & exit alerts.
            </Text>
          </View>
        )}

        {/* Add New Safe Place Button */}
        <TouchableOpacity
          style={[styles.addPlaceCard, isDark && { backgroundColor: '#161E1A', borderColor: '#26342D' }]}
          onPress={() => navigation.navigate('SafePlaces')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={isDark ? '#3ADFAB' : '#183CE6'} />
          <Text style={[styles.addPlaceText, isDark && { color: '#3ADFAB' }]}>Add New Safe Place</Text>
        </TouchableOpacity>

        {/* Family Invite Code Section */}
        <View style={[styles.inviteCard, isDark && { backgroundColor: '#1A231F', borderColor: '#283730' }]}>
          <View style={styles.inviteCardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="key" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.inviteCardTitle, isDark && { color: '#FFFFFF' }]}>Family Invite Key & QR</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={handleCopyCode}
            >
              <Ionicons name="copy-outline" size={14} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.copyLinkText, isDark && { color: '#3ADFAB' }]}>{copyStatus}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inviteCodeRow, isDark && { backgroundColor: '#141A17' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inviteCodeText, isDark && { color: '#FFFFFF' }]}>{inviteCode}</Text>
              <Text style={[styles.inviteCodeSub, isDark && { color: '#9EACA3' }]}>Private Circle Key</Text>
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
              style={[styles.codeActionBtn, isDark && { backgroundColor: '#26342D', borderColor: '#33463C' }]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={13} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtn, isDark && { backgroundColor: '#26342D', borderColor: '#33463C' }]}
              onPress={handleShareSMS}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={13} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.codeActionText, isDark && { color: '#FFFFFF' }]}>Share Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtnActive, isDark && { backgroundColor: '#2E7D5B' }]}
              onPress={() => setQrModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code" size={13} color="#FFFFFF" />
              <Text style={styles.codeActionTextActive}>View QR</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.inviteCodeNote, isDark && { color: '#9EACA3' }]}>
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
      </ScrollView>

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
        onClose={() => setRoleModalMember(null)}
        onRoleUpdated={(userId, newRole) => {
          setRoleModalMember((prev: any) => (prev ? { ...prev, role: newRole } : null));
          if (activeCircle?.id) fetchMembers(activeCircle.id);
          showToast(`Role updated to ${newRole.replace('_', ' ').toUpperCase()}`);
        }}
        onAssignGuardian={(m) => {
          setBranchModalMember(m);
        }}
      />

      {/* Safety Guardian Assignment Modal */}
      <BranchAssignmentModal
        visible={!!branchModalMember}
        targetMember={branchModalMember}
        circleId={activeCircle?.id || ''}
        onAssigned={(supName, memName) => {
          showToast(`${memName} is now assigned to ${supName}`);
          if (activeCircle?.id) fetchMembers(activeCircle.id);
        }}
        onClose={() => {
          setBranchModalMember(null);
          if (activeCircle?.id) fetchMembers(activeCircle.id);
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
            isOwner={isOwner}
            canManageRanks={canManageRanks}
            onSelectMember={(m) => {
              setHierarchyModalVisible(false);
              setRoleModalMember(m);
            }}
            onMoveBranch={(m) => {
              setHierarchyModalVisible(false);
              setBranchModalMember(m);
            }}
          />
        </View>
      </Modal>

      {/* Member Short Profile Modal (Triggered by Member Avatar / Card Tap) */}
      <MemberShortProfileModal
        visible={Boolean(shortProfileMember)}
        member={shortProfileMember}
        circleId={activeCircle?.id}
        onClose={() => setShortProfileMember(null)}
        onNavigateToHistory={(m) => {
          setShortProfileMember(null);
          const targetUserId = m.user_id || m.id;
          navigateToScreen('LocationHistory', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onNavigateToDriving={(m) => {
          setShortProfileMember(null);
          const targetUserId = m.user_id || m.id;
          navigateToScreen('DrivingReports', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onNavigateToMap={(m) => {
          setShortProfileMember(null);
          const targetUserId = m?.user_id || m?.id;
          const allMembers = useCircleStore.getState().members;
          const memberInStore = allMembers.find((x) => x.user_id === targetUserId) || m;
          const targetLat = memberInStore?.latitude ?? m?.latitude;
          const targetLng = memberInStore?.longitude ?? m?.longitude;
          const targetName = memberInStore?.profile?.full_name || m?.profile?.full_name || 'Member';

          navigateToScreen('Map', {
            focusUserId: targetUserId,
            focusLat: targetLat,
            focusLng: targetLng,
            focusUserName: targetName,
            targetMember: memberInStore,
            timestamp: Date.now(),
          });
        }}
        onNavigateToChat={(_m) => {
          setShortProfileMember(null);
          navigateToScreen('Chat');
        }}
      />

      {/* Member 3-Dots Quick Actions Bottom Sheet (STRICT: ONLY opened by clicking the 3 dots button) */}
      <MemberQuickActionsModal
        visible={Boolean(selectedActionsMember)}
        onClose={() => setSelectedActionsMember(null)}
        member={selectedActionsMember}
        circleId={activeCircle?.id}
        isSelf={selectedActionsMember?.user_id === profile?.id}
        canManageRanks={canManageRanks}
        onNavigateMember={(m) => {
          setSelectedActionsMember(null);
          const targetUserId = m?.user_id || m?.id;
          const allMembers = useCircleStore.getState().members;
          const memberInStore = allMembers.find((x) => x.user_id === targetUserId) || m;
          const targetLat = memberInStore?.latitude ?? m?.latitude;
          const targetLng = memberInStore?.longitude ?? m?.longitude;
          const targetName = memberInStore?.profile?.full_name || m?.profile?.full_name || 'Member';

          navigateToScreen('Map', {
            focusUserId: targetUserId,
            focusLat: targetLat,
            focusLng: targetLng,
            focusUserName: targetName,
            targetMember: memberInStore,
            timestamp: Date.now(),
          });
        }}
        onRingMember={(m) => {
          if (m?.user_id === profile?.id) {
            if (Platform.OS !== 'web') {
              Vibration.vibrate([100, 100, 200]);
            }
            showToast('Centering on your location...');
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
          const targetUserId = m?.user_id || m?.id;
          navigateToScreen('LocationHistory', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onOpenDriving={(m) => {
          const targetUserId = m?.user_id || m?.id;
          navigateToScreen('DrivingReports', {
            member: m,
            memberId: targetUserId,
            circleId: activeCircle?.id,
          });
        }}
        onNudgeMember={(m) => {
          handleNudgeMember(m);
        }}
        onAssignGuardian={(m) => {
          setBranchModalMember(m);
        }}
        onManageRole={(m) => {
          setRoleModalMember(m);
        }}
        onRemoveMember={(m) => {
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
                const success = await useCircleStore.getState().removeMember(activeCircle.id, m.user_id);
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
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  memberCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  memberAvatarWrapper: {
    position: 'relative',
    marginTop: 2,
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
    justifyContent: 'space-between',
    gap: 8,
  },
  memberName: {
    fontFamily: SANS_FONT,
    fontSize: 15,
    fontWeight: '700',
    color: '#151C27',
    flex: 1,
    minWidth: 0,
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
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  roleTag: {
    backgroundColor: '#E2E8F8',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
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
    backgroundColor: '#F0F3FF',
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
  memberStatusText: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    color: '#6E7E74',
    flexShrink: 1,
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
    backgroundColor: '#F0F3FF',
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
    backgroundColor: '#F0F3FF',
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
    color: '#183CE6',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7EEFE',
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
  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7EEFE',
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
    backgroundColor: '#F0F3FF',
  },
  emptyPlaceCard: {
    backgroundColor: '#F0F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  emptyPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    lineHeight: 16,
  },
  addPlaceCard: {
    backgroundColor: '#F0F3FF',
    borderRadius: 18,
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
    color: '#183CE6',
  },
  inviteCard: {
    backgroundColor: '#E7EEFE',
    borderRadius: 20,
    padding: 16,
    gap: 10,
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
    color: '#183CE6',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    backgroundColor: '#F0F3FF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#183CE6',
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
