import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
  Animated,
  PanResponder,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore, CircleMember } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface BranchAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  targetMember: CircleMember | null;
  circleId: string;
  circleOwnerId?: string;
  onAssigned?: (supervisorName: string, memberName: string) => void;
}

export default function BranchAssignmentModal({
  visible,
  onClose,
  targetMember,
  circleId,
  circleOwnerId,
  onAssigned,
}: BranchAssignmentModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeStore();
  const { members, assignMemberSupervisor } = useCircleStore();

  const translateY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const panResponder = React.useMemo(
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
              onClose();
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
    [onClose, translateY]
  );

  // Prevent cycles: Find all descendants of targetMember (they cannot be chosen as supervisor)
  const descendantIds = React.useMemo(() => {
    const set = new Set<string>();
    const uid = targetMember?.user_id || (targetMember as any)?.id;
    if (!uid) return set;
    set.add(uid);

    let added = true;
    let iterations = 0;
    while (added && iterations < 50) {
      iterations++;
      added = false;
      for (const m of members) {
        const mUserId = m?.user_id || (m as any)?.id;
        if (m.supervisor_id && set.has(m.supervisor_id) && mUserId && !set.has(mUserId)) {
          set.add(mUserId);
          added = true;
        }
      }
    }
    return set;
  }, [targetMember, members]);

  // Find Founder / Circle Leader accurately
  const founder = React.useMemo(() => {
    if (!Array.isArray(members) || members.length === 0) return null;
    if (circleOwnerId) {
      const match = members.find((m) => (m.user_id || (m as any).id) === circleOwnerId);
      if (match) return match;
    }
    const owners = members.filter((m) => m.role === 'owner' || (m.role as string) === 'leader');
    return owners.length > 0 ? owners[0] : members[0];
  }, [members, circleOwnerId]);

  if (!visible || !targetMember) return null;

  const targetUserId = targetMember.user_id || (targetMember as any).id;
  const memberName = targetMember.profile?.full_name || (targetMember as any)?.profiles?.full_name || (targetMember as any)?.full_name || 'Member';
  const memberInitial = memberName.charAt(0).toUpperCase() || 'M';
  const avatarUrl = targetMember.profile?.avatar_url || (targetMember as any)?.profiles?.avatar_url || (targetMember as any)?.avatar_url;
  const currentSupervisorId = targetMember.supervisor_id;

  const founderName = founder?.profile?.full_name || (founder as any)?.profiles?.full_name || 'Circle Leader';
  const founderAvatar = founder?.profile?.avatar_url || (founder as any)?.profiles?.avatar_url;

  // All eligible supervisors: Co-Leaders, Guardians, and all other circle members (excluding Founder & descendants)
  const founderUid = founder?.user_id || (founder as any)?.id;
  const eligibleGuardianBranches = members.filter((m) => {
    const uid = m?.user_id || (m as any)?.id;
    return uid && uid !== founderUid && !descendantIds.has(uid);
  });

  const isUnderFounder = !currentSupervisorId || (founder && currentSupervisorId === founderUid);

  const handleSelectSupervisor = async (supervisor: CircleMember | null) => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}

    const targetUid = targetMember.user_id || (targetMember as any).id;
    const supervisorId = supervisor ? (supervisor.user_id || (supervisor as any).id) : (founderUid || null);
    const supName = supervisor ? (supervisor.profile?.full_name || (supervisor as any)?.profiles?.full_name || 'Guardian') : (founderName || 'Circle Leader');

    // If selected member is standard member, promote them to 'guardian' rank as well
    if (supervisor && supervisor.role === 'member') {
      const supUid = supervisor.user_id || (supervisor as any).id;
      try {
        await supabase
          .from('circle_members')
          .update({ role: 'guardian' })
          .eq('circle_id', circleId)
          .eq('user_id', supUid);
      } catch (e) {}

      // Update in local store immediately
      const curr = useCircleStore.getState().members;
      useCircleStore.setState({
        members: curr.map((m) =>
          (m.user_id || (m as any).id) === supUid ? { ...m, role: 'guardian' as const } : m
        ),
      });
    }

    // Instant optimistic update
    await assignMemberSupervisor(circleId, targetUid, supervisorId);
    if (onAssigned) {
      onAssigned(supName, memberName);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop Tap to Dismiss */}
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141A17' : '#FFFFFF',
              borderColor: isDark ? '#283730' : '#EDEBE6',
              paddingBottom: Math.max(insets.bottom, 20),
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
            onPress={onClose}
            activeOpacity={0.7}
            {...panResponder.panHandlers}
            accessibilityLabel="Drag down or tap to close hierarchy assignment"
          >
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#26342D' : '#D1D5DB' }]} />
          </TouchableOpacity>

          {/* Header Row with Badge & Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.categoryBadge, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
                <Text style={styles.categoryBadgeText}>GUARDIAN HIERARCHY ASSIGNMENT</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={16} color={isDark ? '#CAD5CE' : '#5C665F'} />
            </TouchableOpacity>
          </View>

          {/* Target Member Strip */}
          <View
            style={[
              styles.targetMemberCard,
              {
                backgroundColor: isDark ? '#1A231F' : '#FAF9F6',
                borderColor: isDark ? '#283730' : '#EDEBE6',
              },
            ]}
          >
            <View style={styles.avatarBox}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#2E7D5B' : '#E8F5EE' }]}>
                  <Text style={[styles.avatarInitial, { color: isDark ? '#FFFFFF' : '#2E7D5B' }]}>{memberInitial}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.targetTitle, { color: isDark ? '#FFFFFF' : '#151C27' }]}>
                Supervising {memberName}
              </Text>
              <Text style={[styles.targetSubtitle, { color: isDark ? '#CAD5CE' : '#5C665F' }]}>
                Select who will receive priority emergency escalations & geofence alerts for {memberName}.
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            {/* Option 1: Circle Leader & Main Command */}
            <TouchableOpacity
              style={[
                styles.branchCard,
                {
                  backgroundColor: isDark ? '#1A231F' : '#FFFFFF',
                  borderColor: isUnderFounder ? '#D97706' : isDark ? '#283730' : '#EDEBE6',
                },
                isUnderFounder && {
                  backgroundColor: isDark ? 'rgba(217, 119, 6, 0.16)' : '#FFFBEB',
                  shadowColor: '#D97706',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 2,
                },
              ]}
              onPress={() => handleSelectSupervisor(founder || null)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconOrb,
                  {
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.18)' : '#FEF3C7',
                    borderColor: '#D97706',
                  },
                ]}
              >
                <Ionicons name="ribbon" size={20} color="#D97706" />
              </View>

              <View style={styles.cardInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#151C27' }]}>
                    {founderName} (Leader)
                  </Text>
                  <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: '#B45309' }]}>MAIN COMMAND</Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, { color: isDark ? '#CAD5CE' : '#5C665F' }]}>
                  Under direct circle command. Emergency broadcasts reach the Circle Leader first.
                </Text>
              </View>

              <Ionicons
                name={isUnderFounder ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isUnderFounder ? '#D97706' : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
              />
            </TouchableOpacity>

            {/* Option List: All other Circle Members / Guardians */}
            {eligibleGuardianBranches.map((sup) => {
              const isSelected = currentSupervisorId === sup.user_id;
              const supName = sup.profile?.full_name || 'Member';
              const isCoLeader = sup.role === 'co_leader';
              const isGuardian = sup.role === 'guardian';

              const roleColor = isCoLeader ? '#7E22CE' : isGuardian ? '#0284C7' : '#2E7D5B';
              const roleBadge = isCoLeader ? 'CO-LEADER' : isGuardian ? 'GUARDIAN' : 'PROMOTE TO GUARDIAN';
              const roleIcon: keyof typeof Ionicons.glyphMap = isCoLeader
                ? 'shield-checkmark'
                : isGuardian
                ? 'shield'
                : 'shield-outline';
              const bgTint = isCoLeader
                ? (isDark ? 'rgba(126, 34, 206, 0.16)' : '#F5EEFC')
                : isGuardian
                ? (isDark ? 'rgba(2, 132, 199, 0.16)' : '#EFF8FF')
                : (isDark ? 'rgba(46, 125, 91, 0.16)' : '#E8F5EE');

              return (
                <TouchableOpacity
                  key={sup.user_id}
                  style={[
                    styles.branchCard,
                    {
                      backgroundColor: isDark ? '#1A231F' : '#FFFFFF',
                      borderColor: isSelected ? roleColor : isDark ? '#283730' : '#EDEBE6',
                    },
                    isSelected && {
                      backgroundColor: bgTint,
                      borderColor: roleColor,
                      shadowColor: roleColor,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => handleSelectSupervisor(sup)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.iconOrb,
                      {
                        backgroundColor: `${roleColor}15`,
                        borderColor: roleColor,
                      },
                    ]}
                  >
                    <Ionicons name={roleIcon} size={20} color={roleColor} />
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#151C27' }]}>{supName}</Text>
                      <View style={[styles.badgePill, { backgroundColor: `${roleColor}18` }]}>
                        <Text style={[styles.badgeText, { color: roleColor }]}>{roleBadge}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cardDesc, { color: isDark ? '#CAD5CE' : '#5C665F' }]}>
                      Monitored under {supName}'s safety supervision with instant escalation.
                    </Text>
                  </View>

                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? roleColor : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 19, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
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
    paddingTop: 8,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 10,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#0284C7',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
  },
  targetTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  targetSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  listContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 12,
  },
  iconOrb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
});
