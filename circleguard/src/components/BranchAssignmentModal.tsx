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
  onAssigned?: (supervisorName: string, memberName: string) => void;
}

export default function BranchAssignmentModal({
  visible,
  onClose,
  targetMember,
  circleId,
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
    if (!targetMember) return set;
    set.add(targetMember.user_id);

    let added = true;
    while (added) {
      added = false;
      for (const m of members) {
        if (m.supervisor_id && set.has(m.supervisor_id) && !set.has(m.user_id)) {
          set.add(m.user_id);
          added = true;
        }
      }
    }
    return set;
  }, [targetMember, members]);

  if (!visible || !targetMember) return null;

  const memberName = targetMember.profile?.full_name || 'Member';
  const memberInitial = memberName.charAt(0).toUpperCase() || 'M';
  const avatarUrl = targetMember.profile?.avatar_url;
  const currentSupervisorId = targetMember.supervisor_id;

  // Find Founder / Circle Leader
  const founder = members.find((m) => m.role === 'owner') || members[0];
  const founderName = founder?.profile?.full_name || 'Circle Leader';
  const founderAvatar = founder?.profile?.avatar_url;

  // All eligible supervisors: Co-Leaders, Guardians, and all other circle members (excluding Founder & descendants)
  const eligibleGuardianBranches = members.filter(
    (m) => m.user_id !== founder?.user_id && !descendantIds.has(m.user_id)
  );

  const isUnderFounder = !currentSupervisorId || (founder && currentSupervisorId === founder.user_id);

  const handleSelectSupervisor = async (supervisor: CircleMember | null) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}

    const supervisorId = supervisor ? supervisor.user_id : null;
    const supName = supervisor ? (supervisor.profile?.full_name || 'Guardian') : (founderName || 'Circle Leader');

    // If selected member is standard member, promote them to 'guardian' rank as well
    if (supervisor && supervisor.role === 'member') {
      try {
        await supabase
          .from('circle_members')
          .update({ role: 'guardian' })
          .eq('circle_id', circleId)
          .eq('user_id', supervisor.user_id);
      } catch (e) {}

      // Update in local store immediately
      const curr = useCircleStore.getState().members;
      useCircleStore.setState({
        members: curr.map((m) =>
          m.user_id === supervisor.user_id ? { ...m, role: 'guardian' as const } : m
        ),
      });
    }

    // Instant optimistic update
    await assignMemberSupervisor(circleId, targetMember.user_id, supervisorId);
    if (onAssigned) {
      onAssigned(supName, memberName);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
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

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.categoryBadge, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
                <Text style={styles.categoryBadgeText}>GUARDIAN HIERARCHY ASSIGNMENT</Text>
              </View>
            </View>
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
              onPress={() => handleSelectSupervisor(null)}
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
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
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
