import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
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
}

export default function BranchAssignmentModal({
  visible,
  onClose,
  targetMember,
  circleId,
}: BranchAssignmentModalProps) {
  const { colors } = useThemeStore();
  const { members, assignMemberSupervisor } = useCircleStore();

  if (!visible || !targetMember) return null;

  const memberName = targetMember.profile?.full_name || 'Member';
  const currentSupervisorId = targetMember.supervisor_id;

  // Find Founder / Circle Leader
  const founder = members.find(m => m.role === 'owner') || members[0];
  const founderName = founder?.profile?.full_name || 'Circle Leader';

  // All eligible supervisors: Co-Leaders, Guardians, and all other circle members (excluding Founder & target member)
  const eligibleGuardianBranches = members.filter(
    m => m.user_id !== founder?.user_id && m.user_id !== targetMember.user_id
  );

  const isUnderFounder = !currentSupervisorId || (founder && currentSupervisorId === founder.user_id);

  const handleSelectSupervisor = async (supervisor: CircleMember | null) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}

    const supervisorId = supervisor ? supervisor.user_id : null;

    // If selected member is standard member, promote them to 'guardian' rank as well
    if (supervisor && supervisor.role === 'member') {
      try {
        await supabase
          .from('circle_members')
          .update({ role: 'guardian' })
          .eq('circle_id', circleId)
          .eq('user_id', supervisor.user_id);
      } catch (e) {}
    }

    // Instant optimistic update (0ms lag)
    await assignMemberSupervisor(circleId, targetMember.user_id, supervisorId);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.overline, { color: colors.accentGold }]}>SAFETY GUARDIAN ASSIGNMENT</Text>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                Assign {memberName}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select a Safety Guardian to supervise and receive priority emergency alerts for {memberName}:
          </Text>

          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
              {/* Option 1: Circle Leader & Main Command */}
              <TouchableOpacity
                style={[
                  styles.branchCard,
                  { backgroundColor: colors.background, borderColor: isUnderFounder ? colors.accentGold : colors.border },
                  isUnderFounder && styles.branchCardActive,
                ]}
                onPress={() => handleSelectSupervisor(null)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: colors.accentGold }]}>
                  <Ionicons name="star" size={20} color={colors.accentGold} />
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{founderName} (Leader)</Text>
                    <View style={[styles.badgePill, { backgroundColor: 'rgba(212, 175, 55, 0.2)' }]}>
                      <Text style={[styles.badgeText, { color: colors.accentGold }]}>MAIN COMMAND</Text>
                    </View>
                  </View>
                  <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                    Under the direct command of the Circle Leader.
                  </Text>
                </View>

                <Ionicons
                  name={isUnderFounder ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isUnderFounder ? colors.accentGold : colors.textMuted}
                />
              </TouchableOpacity>

              {/* Option List: All other Circle Members / Guardians */}
              {eligibleGuardianBranches.map((sup) => {
                const isSelected = currentSupervisorId === sup.user_id;
                const supName = sup.profile?.full_name || 'Member';
                const isCoLeader = sup.role === 'co_leader';
                const isGuardian = sup.role === 'guardian';

                const roleColor = isCoLeader ? '#A855F7' : (isGuardian ? '#3B82F6' : '#10B981');
                const roleBadge = isCoLeader ? 'CO-LEADER' : (isGuardian ? 'GUARDIAN' : 'ASSIGN AS GUARDIAN');
                const roleIcon: keyof typeof Ionicons.glyphMap = isCoLeader ? 'shield-checkmark' : (isGuardian ? 'shield' : 'shield-outline');

                return (
                  <TouchableOpacity
                    key={sup.user_id}
                    style={[
                      styles.branchCard,
                      { backgroundColor: colors.background, borderColor: isSelected ? roleColor : colors.border },
                      isSelected && styles.branchCardActive,
                    ]}
                    onPress={() => handleSelectSupervisor(sup)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${roleColor}15`, borderColor: roleColor }]}>
                      <Ionicons name={roleIcon} size={20} color={roleColor} />
                    </View>

                    <View style={styles.cardInfo}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{supName}</Text>
                        <View style={[styles.badgePill, { backgroundColor: `${roleColor}20` }]}>
                          <Text style={[styles.badgeText, { color: roleColor }]}>{roleBadge}</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                        Monitored under {supName}'s safety supervision.
                      </Text>
                    </View>

                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? roleColor : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: '75%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
  },
  loaderBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  branchCardActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  iconBox: {
    width: 42,
    height: 42,
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
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
});
