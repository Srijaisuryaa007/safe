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
  canEdit?: boolean;
  onRoleUpdated?: (userId: string, newRole: CircleRole) => void;
}

export default function MemberRoleModal({
  visible,
  onClose,
  member,
  circleId,
  canEdit = true,
  onRoleUpdated,
}: MemberRoleModalProps) {
  const { colors } = useThemeStore();
  const { fetchMembers } = useCircleStore();
  const [updating, setUpdating] = useState(false);
  const [activeRole, setActiveRole] = useState<CircleRole | null>(null);

  React.useEffect(() => {
    if (member) {
      setActiveRole(member.role || 'member');
    }
  }, [member?.user_id, member?.role]);

  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    icon: 'information-circle',
    color: colors.accentGold,
  });

  if (!visible || !member) return null;

  const currentRole = activeRole || member.role || 'member';
  const name = member.profile?.full_name || 'Circle Member';
  const isTargetOwner = currentRole === 'owner';

  const roleOptions: Array<{
    id: CircleRole;
    title: string;
    badgeText: string;
    description: string;
    permissions: string[];
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }> = [
    {
      id: 'co_leader',
      title: 'Co-Leader',
      badgeText: 'SPECIAL PRIORITY ⚡',
      description: 'High privilege administrative role with executive circle management powers and Special Priority.',
      permissions: ['Geofences & Safe Places', 'Invite Code Sharing', 'Promote Guardians', 'Emergency Broadcasts'],
      icon: 'shield-checkmark',
      color: '#A855F7',
    },
    {
      id: 'guardian',
      title: 'Safety Guardian',
      badgeText: 'PRIORITY SOS 🛡️',
      description: 'Safety moderator responsible for monitoring family geofences and priority emergency dispatch.',
      permissions: ['Priority SOS Alerts', 'Geofence Breach Radar', 'Location History Access', 'Battery Monitoring'],
      icon: 'shield-outline',
      color: '#3B82F6',
    },
    {
      id: 'member',
      title: 'Standard Member',
      badgeText: 'MEMBER',
      description: 'Standard circle participant sharing GPS location and viewing live map.',
      permissions: ['24/7 Live GPS Sharing', 'View Circle Map', 'Receive Emergency SOS', 'Driving Speed Safety'],
      icon: 'person-outline',
      color: '#10B981',
    },
  ];

  const handleAssignRole = async (newRole: CircleRole) => {
    if (!canEdit) {
      setAlertState({
        visible: true,
        title: 'Permission Notice 👑',
        message: 'Only the Circle Founder & Leader or Co-Leaders can change member ranks.',
        icon: 'shield-outline',
        color: '#F59E0B',
      });
      return;
    }
    if (isTargetOwner) {
      setAlertState({
        visible: true,
        title: 'Circle Founder 👑',
        message: 'The Circle Founder rank cannot be modified.',
        icon: 'star',
        color: '#D4AF37',
      });
      return;
    }
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

      setActiveRole(newRole);
      await fetchMembers(circleId);
      if (onRoleUpdated) {
        onRoleUpdated(member.user_id, newRole);
      }

      setAlertState({
        visible: true,
        title: 'Rank & Special Priority Updated 👑',
        message: `Successfully promoted ${name} to ${newRole.toUpperCase().replace('_', ' ')} with Special Priority Status.`,
        icon: 'checkmark-circle',
        color: newRole === 'co_leader' ? '#A855F7' : (newRole === 'guardian' ? '#3B82F6' : '#10B981'),
        onPress: onClose,
      });
    } catch (err: any) {
      setAlertState({
        visible: true,
        title: 'Update Error',
        message: err.message || 'Failed to update member rank.',
        icon: 'alert-circle',
        color: '#EF4444',
      });
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
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MEMBER HIERARCHY & PERMISSIONS</Text>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {isTargetOwner ? `${name} (Founder)` : (canEdit ? `Promote ${name}` : `${name}'s Rank Info`)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} disabled={updating}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {isTargetOwner ? (
            <View style={[styles.infoBanner, { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderColor: colors.accentGold }]}>
              <Ionicons name="star" size={18} color={colors.accentGold} />
              <Text style={[styles.infoBannerText, { color: colors.accentGold }]}>
                {name} is the Circle Founder & Leader with full executive administrative powers.
              </Text>
            </View>
          ) : !canEdit ? (
            <View style={[styles.infoBanner, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: '#3B82F6' }]}>
              <Ionicons name="information-circle" size={18} color="#3B82F6" />
              <Text style={[styles.infoBannerText, { color: '#3B82F6' }]}>
                Viewing rank privileges. Only Circle Founders and Co-Leaders can change member ranks.
              </Text>
            </View>
          ) : null}

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
                    activeOpacity={canEdit ? 0.8 : 0.95}
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

                      {/* Permission Feature Chips */}
                      <View style={styles.permChipsRow}>
                        {opt.permissions.map((p, idx) => (
                          <View key={idx} style={[styles.permChip, { backgroundColor: `${opt.color}10`, borderColor: `${opt.color}40` }]}>
                            <Ionicons name="checkmark-sharp" size={10} color={opt.color} />
                            <Text style={[styles.permChipText, { color: opt.color }]}>{p.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
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

          {/* Luxury Theme Alert Overlay */}
          <Modal visible={alertState.visible} transparent animationType="fade">
            <View style={styles.alertOverlay}>
              <View style={[styles.alertCard, { backgroundColor: colors.surface, borderColor: alertState.color }]}>
                <View style={[styles.alertIconCircle, { backgroundColor: `${alertState.color}15`, borderColor: alertState.color }]}>
                  <Ionicons name={alertState.icon} size={32} color={alertState.color} />
                </View>

                <Text style={[styles.alertTitle, { color: colors.foreground }]}>{alertState.title}</Text>
                <Text style={[styles.alertMessage, { color: colors.textMuted }]}>{alertState.message}</Text>

                <TouchableOpacity
                  style={[styles.alertBtn, { backgroundColor: alertState.color }]}
                  onPress={() => {
                    setAlertState(prev => ({ ...prev, visible: false }));
                    if (alertState.onPress) alertState.onPress();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.alertBtnText}>GOT IT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
    marginBottom: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
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
    marginBottom: 8,
  },
  permChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  permChipText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  radioBox: {
    paddingLeft: 4,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  alertIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
