import React, { useRef, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

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
  onAssignGuardian,
  onManageRole,
  onRemoveMember,
}: MemberQuickActionsModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeStore();
  const translateY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible]);

  const handleDismiss = React.useCallback(
    (callback?: any) => {
      const safeCb = typeof callback === 'function' ? callback : undefined;
      if (isClosingRef.current) {
        if (safeCb) safeCb();
        return;
      }
      isClosingRef.current = true;

      Animated.timing(translateY, {
        toValue: 650,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        onClose();
        if (safeCb) {
          setTimeout(() => {
            safeCb();
          }, 80);
        }
      });
    },
    [onClose, translateY]
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
  const name = profile.full_name || 'Circle Member';
  const avatarUrl = profile.avatar_url;
  const role = member.role || 'member';
  const battery = member.batteryPct !== undefined && member.batteryPct !== null ? `${member.batteryPct}%` : '—';
  const isLowBattery = member.batteryPct !== undefined && member.batteryPct !== null && member.batteryPct <= 20;
  const isDriving = Boolean(member.isDriving || member.is_driving || ((member.speed_mps || member.speed || 0) * 3.6 > 18));
  const isOnline = member.isOnline !== false;
  const isTargetOwner = role === 'owner';

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
          {/* Top Drag Indicator: Both Tap to Close and Drag Down to Dismiss */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragPillWrapper}
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.dragPill, { backgroundColor: isDark ? '#2E3D34' : '#D5DDD8' }]} />
          </View>

          {/* Member Profile & Live Telemetry Card */}
          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: isDark ? '#18201B' : '#F6FAF7',
                borderColor: isDark ? '#25352B' : '#E4ECE7',
              },
            ]}
          >
            <View style={styles.profileCardLeft}>
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: isOnline ? '#10B981' : (isDark ? '#33463C' : '#CBD5E1'),
                  },
                ]}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#223028' : '#E3EFE8' }]}>
                    <Text style={[styles.avatarInitial, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.onlineGlowDot,
                    {
                      backgroundColor: isOnline ? '#10B981' : '#94A3B8',
                      borderColor: isDark ? '#18201B' : '#FFFFFF',
                    },
                  ]}
                />
              </View>

              <View style={styles.profileDetails}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.memberName, { color: isDark ? '#FFFFFF' : '#141E18' }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {isSelf && (
                    <View style={[styles.selfTag, { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.15)' : '#E0F2E9' }]}>
                      <Text style={[styles.selfTagText, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>YOU</Text>
                    </View>
                  )}
                </View>

                {/* Telemetry Chips */}
                <View style={styles.telemetryRow}>
                  <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleColor }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                  </View>

                  <View
                    style={[
                      styles.batteryBadge,
                      {
                        backgroundColor: isLowBattery
                          ? (isDark ? '#3D1B1B' : '#FFECEB')
                          : (isDark ? '#1F2C24' : '#EAF2EC'),
                        borderColor: isLowBattery
                          ? '#EF4444'
                          : (isDark ? '#2B3F33' : '#D7E5DC'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={isLowBattery ? 'battery-dead' : 'battery-full'}
                      size={12}
                      color={isLowBattery ? '#EF4444' : (isDark ? '#3ADFAB' : '#006C4F')}
                    />
                    <Text
                      style={[
                        styles.batteryText,
                        { color: isLowBattery ? '#EF4444' : (isDark ? '#CAD8D0' : '#3B4E43') },
                      ]}
                    >
                      {battery}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.motionBadge,
                      {
                        backgroundColor: isDark ? '#1F2C24' : '#EAF2EC',
                        borderColor: isDark ? '#2B3F33' : '#D7E5DC',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isDriving ? 'car' : (isOnline ? 'radio' : 'time')}
                      size={11}
                      color={isDriving ? '#818CF8' : (isOnline ? '#10B981' : '#94A3B8')}
                    />
                    <Text style={[styles.motionBadgeText, { color: isDark ? '#CAD8D0' : '#475C50' }]} numberOfLines={1}>
                      {isDriving ? 'Driving' : isOnline ? 'Live' : 'Active'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action List & Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Quick Actions Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#829589' : '#73867A' }]}>
                QUICK ACTIONS
              </Text>
            </View>

            {/* 2x2 Tactile Action Grid */}
            <View style={styles.actionGrid}>
              {/* Tile 1: Directions */}
              <TouchableOpacity
                style={[
                  styles.gridTile,
                  {
                    backgroundColor: isDark ? '#19221D' : '#F6FAF7',
                    borderColor: isDark ? 'rgba(58, 223, 171, 0.22)' : 'rgba(46, 125, 91, 0.20)',
                  },
                ]}
                onPress={() => {
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
                }}
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
                    backgroundColor: isDark ? '#162028' : '#F4F9FD',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.20)',
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
                    { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE' },
                  ]}
                >
                  <Ionicons
                    name={isSelf ? 'locate' : 'notifications'}
                    size={19}
                    color={isSelf ? '#38BDF8' : '#2563EB'}
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

              {/* Tile 3: Timeline / History */}
              <TouchableOpacity
                style={[
                  styles.gridTile,
                  {
                    backgroundColor: isDark ? '#231E17' : '#FEFAF4',
                    borderColor: isDark ? 'rgba(251, 191, 36, 0.22)' : 'rgba(217, 119, 6, 0.20)',
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
                    { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.16)' : '#FEF3C7' },
                  ]}
                >
                  <Ionicons name="time" size={19} color="#F59E0B" />
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
                    backgroundColor: isDark ? '#231822' : '#FDF6FB',
                    borderColor: isDark ? 'rgba(232, 121, 249, 0.22)' : 'rgba(192, 38, 211, 0.20)',
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
                    { backgroundColor: isDark ? 'rgba(232, 121, 249, 0.16)' : '#FCE7F3' },
                  ]}
                >
                  <Ionicons name="speedometer" size={19} color="#D946EF" />
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

            {/* Governance & Member Controls (Apple Inset Surface) */}
            {canManageRanks && !isTargetOwner && (
              <>
                <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#829589' : '#73867A' }]}>
                    CIRCLE GOVERNANCE
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
                  {/* Row 1: Assign / Change Guardian */}
                  {!isTargetOwner && (
                    <TouchableOpacity
                      style={styles.groupedRow}
                      onPress={() => {
                        handleDismiss(() => {
                          if (onAssignGuardian) onAssignGuardian(member);
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
                  )}

                  {/* Divider */}
                  {!isTargetOwner && (
                    <View
                      style={[
                        styles.hairlineDivider,
                        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                    />
                  )}

                  {/* Row 2: Manage Member Role */}
                  <TouchableOpacity
                    style={styles.groupedRow}
                    onPress={() => {
                      handleDismiss(() => {
                        if (onManageRole) onManageRole(member);
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.groupedIconSquircle,
                        { backgroundColor: isDark ? '#271D33' : '#F3E8FF' },
                      ]}
                    >
                      <Ionicons name="ribbon" size={17} color="#A855F7" />
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
                </View>

                {/* Destructive Action: Remove Member */}
                {canManageRanks && !isSelf && !isTargetOwner && (
                  <TouchableOpacity
                    style={[
                      styles.destructiveCard,
                      {
                        backgroundColor: isDark ? '#241717' : '#FFF7F7',
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '88%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 20,
  },
  dragPillWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  profileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: SANS_FONT,
    fontSize: 18,
    fontWeight: '800',
  },
  onlineGlowDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontFamily: SANS_FONT,
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  selfTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selfTagText: {
    fontFamily: SANS_FONT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontFamily: SANS_FONT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  batteryText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '700',
  },
  motionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  motionBadgeText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: SANS_FONT,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridTile: {
    width: (SCREEN_WIDTH - 36 - 10) / 2,
    minHeight: 88,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tileIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileTextWrap: {
    gap: 1,
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
    padding: 12,
    borderRadius: 16,
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
    width: 34,
    height: 34,
    borderRadius: 10,
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
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 12,
  },
  hairlineDivider: {
    height: 1,
    marginLeft: 58,
  },
  groupedIconSquircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    padding: 13,
    borderRadius: 18,
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
});
