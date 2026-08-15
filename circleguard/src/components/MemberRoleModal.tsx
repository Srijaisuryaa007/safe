import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';

export type CircleRole = 'owner' | 'co_leader' | 'guardian' | 'member';

interface MemberRoleModalProps {
  visible: boolean;
  onClose: () => void;
  member: {
    user_id: string;
    role: CircleRole;
    profile?: {
      full_name: string;
      avatar_url: string | null;
    };
  } | null;
  circleId: string;
}

export default function MemberRoleModal({
  visible,
  onClose,
  member,
  circleId,
}: MemberRoleModalProps) {
  const { colors } = useThemeStore();
  const { fetchMembers } = useCircleStore();
  const [updating, setUpdating] = useState(false);

  if (!visible || !member) return null;

  const currentRole = member.role || 'member';
  const name = member.profile?.full_name || 'Circle Member';

  const roleOptions: Array<{
    id: CircleRole;
    title: string;
    badgeText: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }> = [
    {
      id: 'co_leader',
      title: 'Co-Leader',
      badgeText: 'CO-LEADER',
      description: 'High privilege: Can manage geofences, invite new members, promote Guardians, and broadcast alerts.',
      icon: 'shield-checkmark',
      color: '#A855F7', // Vivid Purple
    },
    {
      id: 'guardian',
      title: 'Safety Guardian',
      badgeText: 'GUARDIAN',
      description: 'Safety Moderator: Receives priority SOS alerts, monitors geofence breaches, and views location history.',
      icon: 'shield-outline',
      color: '#3B82F6', // Blue
    },
    {
      id: 'member',
      title: 'Standard Member',
      badgeText: 'MEMBER',
      description: 'Standard participant: Shares live GPS location, views circle map, and receives general alerts.',
      icon: 'person-outline',
      color: '#10B981', // Emerald Green
    },
  ];

  const handleAssignRole = async (newRole: CircleRole) => {
    if (newRole === currentRole) {
      onClose();
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('circle_members')
        .update({ role: newRole })
        .eq('circle_id', circleId)
        .eq('user_id', member.user_id);

      if (error) throw error;

      await fetchMembers(circleId);
      Alert.alert('Rank Updated 👑', `Updated ${name}'s rank to ${newRole.toUpperCase().replace('_', ' ')}.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Error Updating Rank', err.message || 'Failed to update member rank');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MEMBER HIERARCHY & RANKS</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Promote {name}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} disabled={updating}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {updating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color={colors.accentGold} />
              <Text style={[styles.loaderText, { color: colors.textMuted }]}>Updating rank permissions...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
              {roleOptions.map((opt) => {
                const isSelected = currentRole === opt.id;

                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.roleCard,
                      { backgroundColor: colors.background, borderColor: isSelected ? opt.color : colors.border },
                      isSelected && styles.roleCardActive,
                    ]}
                    onPress={() => handleAssignRole(opt.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, { backgroundColor: `${opt.color}15`, borderColor: opt.color }]}>
                      <Ionicons name={opt.icon} size={22} color={opt.color} />
                    </View>

                    <View style={styles.cardInfo}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{opt.title}</Text>
                        <View style={[styles.badgePill, { backgroundColor: isSelected ? opt.color : 'rgba(156, 163, 175, 0.15)' }]}>
                          <Text style={[styles.badgeText, { color: isSelected ? '#FFFFFF' : '#9CA3AF' }]}>
                            {opt.badgeText}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{opt.description}</Text>
                    </View>

                    <View style={styles.radioBox}>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? opt.color : colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    marginBottom: 20,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
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
    gap: 14,
    paddingBottom: 20,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  roleCardActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBox: {
    width: 44,
    height: 44,
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
    fontSize: 14,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  radioBox: {
    paddingLeft: 4,
  },
});
