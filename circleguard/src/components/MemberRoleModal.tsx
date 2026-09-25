import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    supervisor_id?: string | null;
    profile?: {
      full_name: string;
      avatar_url: string | null;
    };
  } | null;
  circleId: string;
  canEdit?: boolean;
  onRoleUpdated?: (userId: string, newRole: CircleRole) => void;
  onAssignGuardian?: (member: any) => void;
}

export default function MemberRoleModal({
  visible,
  onClose,
  member,
  circleId,
  canEdit = true,
  onRoleUpdated,
  onAssignGuardian,
}: MemberRoleModalProps) {
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

  const handleDismiss = React.useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.timing(translateY, {
      toValue: 650,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, translateY]);

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

  const { fetchMembers, removeMember, activeCircle, members } = useCircleStore();
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
    color: '#2E7D5B',
  });

  if (!visible || !member) return null;

  const currentRole = activeRole || member.role || 'member';
  const name = member.profile?.full_name || 'Circle Member';
  const avatarUrl = member.profile?.avatar_url;
  const initial = name.charAt(0).toUpperCase() || 'M';
  const isTargetOwner = currentRole === 'owner';

  const roleOptions: Array<{
    id: CircleRole;
    title: string;
    badgeText: string;
    description: string;
    permissions: string[];
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bgTint: string;
    borderColor: string;
  }> = [
    {
      id: 'co_leader',
      title: 'Co-Leader',
      badgeText: 'EXECUTIVE PRIORITY',
      description: 'Administrative leader with executive circle governance, safe places management, and priority broadcasts.',
      permissions: ['Geofences & Safe Places', 'Invite Code Sharing', 'Promote Guardians', 'Emergency Broadcasts'],
      icon: 'shield-checkmark',
      color: '#7E22CE',
      bgTint: isDark ? 'rgba(168, 85, 247, 0.12)' : '#F5EEFC',
      borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : '#D8B4FE',
    },
    {
      id: 'guardian',
      title: 'Safety Guardian',
      badgeText: 'PRIORITY SOS',
      description: 'Safety moderator responsible for supervising members, perimeter radars, and receiving priority emergency calls.',
      permissions: ['Priority SOS Alerts', 'Geofence Breach Radar', 'Location History', 'Battery Monitoring'],
      icon: 'shield',
      color: '#0284C7',
      bgTint: isDark ? 'rgba(56, 189, 248, 0.12)' : '#EFF8FF',
      borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : '#BAE6FD',
    },
    {
      id: 'member',
      title: 'Standard Member',
      badgeText: 'CORE MEMBER',
      description: 'Standard circle participant sharing real-time GPS location, viewing live map, and receiving family safety alerts.',
      permissions: ['24/7 Live GPS Sharing', 'View Circle Map', 'Emergency SOS Trigger', 'Safe Driving Detection'],
      icon: 'person',
      color: '#2E7D5B',
      bgTint: isDark ? 'rgba(46, 125, 91, 0.12)' : '#E8F5EE',
      borderColor: isDark ? 'rgba(46, 125, 91, 0.35)' : '#A7D7C5',
    },
  ];

  const handleAssignRole = async (newRole: CircleRole) => {
    if (!canEdit) {
      setAlertState({
        visible: true,
        title: 'Permission Notice',
        message: 'Only the Circle Founder & Leader or Co-Leaders can adjust member hierarchy and permissions.',
        icon: 'shield-outline',
        color: '#D97706',
      });
      return;
    }
    if (isTargetOwner) {
      setAlertState({
        visible: true,
        title: 'Circle Founder',
        message: 'The Circle Founder & Owner rank is sovereign and cannot be modified.',
        icon: 'ribbon',
        color: '#D97706',
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
        title: 'Hierarchy Updated',
        message: `Successfully promoted ${name} to ${newRole.replace('_', ' ').toUpperCase()} with updated circle permissions.`,
        icon: 'checkmark-circle',
        color: newRole === 'co_leader' ? '#7E22CE' : (newRole === 'guardian' ? '#0284C7' : '#2E7D5B'),
        onPress: onClose,
      });
    } catch (err: any) {
      setAlertState({
        visible: true,
        title: 'Update Error',
        message: err.message || 'Failed to update member role.',
        icon: 'alert-circle',
        color: '#DC2626',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmRemoveMember = () => {
    if (!canEdit || isTargetOwner) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${name} from "${activeCircle?.name || 'this circle'}"? They will lose access to shared location, geofences, and safety broadcasts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const success = await removeMember(circleId, member.user_id);
              if (!success) throw new Error('Failed to remove member.');

              setAlertState({
                visible: true,
                title: 'Member Removed',
                message: `${name} has been removed from the circle.`,
                icon: 'person-remove-outline',
                color: '#DC2626',
                onPress: onClose,
              });
            } catch (err: any) {
              setAlertState({
                visible: true,
                title: 'Error',
                message: err.message || 'Could not remove member.',
                icon: 'alert-circle',
                color: '#DC2626',
              });
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const getRoleBadgeData = (role: CircleRole) => {
    switch (role) {
      case 'owner':
        return { label: 'FOUNDER & LEADER', color: '#B45309', bg: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7', icon: 'ribbon' as const };
      case 'co_leader':
        return { label: 'CO-LEADER', color: '#7E22CE', bg: isDark ? 'rgba(126, 34, 206, 0.15)' : '#F3E8FF', icon: 'shield-checkmark' as const };
      case 'guardian':
        return { label: 'SAFETY GUARDIAN', color: '#0284C7', bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE', icon: 'shield' as const };
      default:
        return { label: 'STANDARD MEMBER', color: '#2E7D5B', bg: isDark ? 'rgba(46, 125, 91, 0.15)' : '#E8F5EE', icon: 'person' as const };
    }
  };

  const currentRoleBadge = getRoleBadgeData(currentRole);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismiss} />
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#181A1E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#EDEBE6',
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Sheet Handle: Swipe down or tap to dismiss */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragHandleBox}
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D1D5DB' }]} />
          </View>

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.categoryBadge, { backgroundColor: isDark ? 'rgba(46, 125, 91, 0.18)' : '#E8F5EE' }]}>
                <Ionicons name="git-network-outline" size={12} color="#2E7D5B" />
                <Text style={styles.categoryBadgeText}>MEMBERS HIERARCHY & PERMISSIONS</Text>
              </View>
            </View>
          </View>

          {/* Hero Member Banner */}
          <View
            style={[
              styles.heroMemberCard,
              {
                backgroundColor: isDark ? '#111317' : '#FAF9F6',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EDEBE6',
              },
            ]}
          >
            <View style={styles.heroAvatarBox}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImg} />
              ) : (
                <View style={[styles.heroAvatarFallback, { backgroundColor: currentRoleBadge.bg }]}>
                  <Text style={[styles.heroAvatarInitial, { color: currentRoleBadge.color }]}>{initial}</Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.heroMemberName, { color: isDark ? '#FFFFFF' : '#151C27' }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.heroRolePillRow}>
                <View style={[styles.heroRoleBadge, { backgroundColor: currentRoleBadge.bg }]}>
                  <Ionicons name={currentRoleBadge.icon} size={11} color={currentRoleBadge.color} />
                  <Text style={[styles.heroRoleBadgeText, { color: currentRoleBadge.color }]}>
                    {currentRoleBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            {canEdit && !isTargetOwner && (
              <TouchableOpacity
                style={[
                  styles.removeHeaderBtn,
                  {
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
                    borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
                  },
                ]}
                onPress={handleConfirmRemoveMember}
                activeOpacity={0.7}
                disabled={updating}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>

          {/* Owner Banner */}
          {isTargetOwner && (
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: isDark ? 'rgba(217, 119, 6, 0.12)' : '#FEF3C7',
                  borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
                },
              ]}
            >
              <Ionicons name="ribbon" size={18} color="#D97706" />
              <Text style={[styles.infoBannerText, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                {name} is the Circle Founder & Leader with full administrative sovereignty.
              </Text>
            </View>
          )}

          {/* Read-Only Notice */}
          {!canEdit && !isTargetOwner && (
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                },
              ]}
            >
              <Ionicons name="information-circle" size={18} color="#2563EB" />
              <Text style={[styles.infoBannerText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                Viewing hierarchy permissions. Only Circle Founders and Co-Leaders can promote or reassign members.
              </Text>
            </View>
          )}

          {updating ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#2E7D5B" />
              <Text style={[styles.loaderText, { color: isDark ? '#BDCABC' : '#5C665F' }]}>
                Updating hierarchy rank & permissions...
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
              {/* Guardian Assignment Section */}
              {!isTargetOwner && (
                <View
                  style={[
                    styles.guardianCard,
                    {
                      backgroundColor: isDark ? '#111317' : '#FAF9F6',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EDEBE6',
                    },
                  ]}
                >
                  <View style={styles.guardianRow}>
                    <View style={[styles.guardianIconOrb, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guardianOverline, { color: '#0284C7' }]}>
                        SUPERVISION & ESCALATION HIERARCHY
                      </Text>
                      <Text style={[styles.guardianSupervisorName, { color: isDark ? '#FFFFFF' : '#151C27' }]}>
                        {(() => {
                          const liveMember = members.find((m) => m.user_id === member.user_id) || member;
                          const sup = members.find((m) => m.user_id === liveMember.supervisor_id);
                          if (sup) {
                            const supRole =
                              sup.role === 'co_leader' ? 'Co-Leader' : sup.role === 'owner' ? 'Circle Leader' : 'Guardian';
                            return `${sup.profile?.full_name || 'Guardian'} (${supRole})`;
                          }
                          return 'Direct Circle Command (Leader)';
                        })()}
                      </Text>
                      <Text style={[styles.guardianDesc, { color: isDark ? '#BDCABC' : '#5C665F' }]}>
                        {(() => {
                          const liveMember = members.find((m) => m.user_id === member.user_id) || member;
                          return liveMember.supervisor_id
                            ? 'Emergency SOS, perimeter breaches, and safe place alerts escalate to this guardian first.'
                            : 'Supervised directly by Circle Leader. No intermediary guardian assigned.';
                        })()}
                      </Text>
                    </View>
                  </View>

                  {canEdit && (
                    <TouchableOpacity
                      style={[
                        styles.assignGuardianActionBtn,
                        {
                          backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#F0F9FF',
                          borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#BAE6FD',
                        },
                      ]}
                      onPress={() => {
                        const liveMember = members.find((m) => m.user_id === member.user_id) || member;
                        onClose();
                        setTimeout(() => {
                          if (onAssignGuardian) onAssignGuardian(liveMember);
                        }, 220);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#0284C7" />
                      <Text style={[styles.assignGuardianActionText, { color: '#0284C7' }]}>
                        {(() => {
                          const liveMember = members.find((m) => m.user_id === member.user_id) || member;
                          return liveMember.supervisor_id ? 'CHANGE ASSIGNED GUARDIAN' : 'ASSIGN UNDER A GUARDIAN';
                        })()}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Roles Selection */}
              <Text style={[styles.sectionHeading, { color: isDark ? '#BDCABC' : '#5C665F' }]}>
                ASSIGN ROLE & PRIVILEGES
              </Text>

              {roleOptions.map((opt) => {
                const isSelected = currentRole === opt.id;

                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isDark ? '#111317' : '#FFFFFF',
                        borderColor: isSelected ? opt.color : isDark ? 'rgba(255, 255, 255, 0.08)' : '#EDEBE6',
                      },
                      isSelected && {
                        backgroundColor: opt.bgTint,
                        borderColor: opt.color,
                        shadowColor: opt.color,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: isDark ? 0.25 : 0.12,
                        shadowRadius: 8,
                        elevation: 3,
                      },
                    ]}
                    onPress={() => handleAssignRole(opt.id)}
                    activeOpacity={canEdit ? 0.8 : 0.95}
                  >
                    <View style={styles.roleCardHeader}>
                      <View style={[styles.roleIconOrb, { backgroundColor: `${opt.color}15`, borderColor: opt.color }]}>
                        <Ionicons name={opt.icon} size={20} color={opt.color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[styles.roleCardTitle, { color: isDark ? '#FFFFFF' : '#151C27' }]}>
                            {opt.title}
                          </Text>
                          <View
                            style={[
                              styles.roleBadgePill,
                              {
                                backgroundColor: isSelected ? opt.color : isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleBadgePillText,
                                { color: isSelected ? '#FFFFFF' : isDark ? '#9CA3AF' : '#4B5563' },
                              ]}
                            >
                              {opt.badgeText}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.roleCardDesc, { color: isDark ? '#BDCABC' : '#5C665F' }]}>
                          {opt.description}
                        </Text>
                      </View>

                      <View style={styles.radioIndicator}>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isSelected ? opt.color : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
                        />
                      </View>
                    </View>

                    {/* Permissions Chips */}
                    <View style={styles.chipsContainer}>
                      {opt.permissions.map((p, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.chipPill,
                            {
                              backgroundColor: isSelected ? `${opt.color}15` : isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
                              borderColor: isSelected ? `${opt.color}40` : isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                            },
                          ]}
                        >
                          <Ionicons name="checkmark-sharp" size={10} color={isSelected ? opt.color : '#9CA3AF'} />
                          <Text
                            style={[
                              styles.chipPillText,
                              { color: isSelected ? opt.color : isDark ? '#9CA3AF' : '#4B5563' },
                            ]}
                          >
                            {p}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Danger Zone: Remove Member */}
              {canEdit && !isTargetOwner && (
                <View style={styles.dangerZone}>
                  <TouchableOpacity
                    style={[
                      styles.removeMemberFullBtn,
                      {
                        backgroundColor: isDark ? 'rgba(220, 38, 38, 0.1)' : '#FEF2F2',
                        borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FCA5A5',
                      },
                    ]}
                    onPress={handleConfirmRemoveMember}
                    activeOpacity={0.8}
                    disabled={updating}
                  >
                    <Ionicons name="person-remove-outline" size={16} color="#DC2626" />
                    <Text style={styles.removeMemberFullBtnText}>REMOVE MEMBER FROM CIRCLE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* Feedback Modal Overlay */}
          <Modal visible={alertState.visible} transparent animationType="fade">
            <View style={styles.feedbackOverlay}>
              <View
                style={[
                  styles.feedbackCard,
                  {
                    backgroundColor: isDark ? '#1E2023' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#EDEBE6',
                  },
                ]}
              >
                <View style={[styles.feedbackIconOrb, { backgroundColor: `${alertState.color}15`, borderColor: alertState.color }]}>
                  <Ionicons name={alertState.icon} size={28} color={alertState.color} />
                </View>

                <Text style={[styles.feedbackTitle, { color: isDark ? '#FFFFFF' : '#151C27' }]}>
                  {alertState.title}
                </Text>
                <Text style={[styles.feedbackMessage, { color: isDark ? '#BDCABC' : '#5C665F' }]}>
                  {alertState.message}
                </Text>

                <TouchableOpacity
                  style={[styles.feedbackBtn, { backgroundColor: alertState.color }]}
                  onPress={() => {
                    setAlertState((prev) => ({ ...prev, visible: false }));
                    if (alertState.onPress) alertState.onPress();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.feedbackBtnText}>GOT IT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
  dragHandleBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
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
    marginBottom: 14,
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
    color: '#2E7D5B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  heroAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroAvatarImg: {
    width: '100%',
    height: '100%',
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroMemberName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  heroRolePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroRoleBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  removeHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  loaderBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollList: {
    gap: 12,
    paddingBottom: 24,
  },
  guardianCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guardianIconOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardianOverline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  guardianSupervisorName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  guardianDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  assignGuardianActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  assignGuardianActionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 2,
  },
  roleCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  roleIconOrb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  roleBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgePillText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleCardDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  radioIndicator: {
    paddingTop: 2,
    paddingLeft: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  chipPillText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  dangerZone: {
    marginTop: 8,
    marginBottom: 4,
  },
  removeMemberFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  removeMemberFullBtnText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  feedbackIconOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  feedbackTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  feedbackMessage: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 18,
  },
  feedbackBtn: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
