import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { MainTabParamList } from '../navigation/MainTabNavigator';
import { LUXURY_THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import MemberRoleModal from '../components/MemberRoleModal';
import SpringTouchable from '../components/SpringTouchable';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import CircleHierarchyTree from '../components/CircleHierarchyTree';
import BranchAssignmentModal from '../components/BranchAssignmentModal';

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Circle'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const { colors } = useThemeStore();
  const { showAlert } = useLuxuryAlert();
  const navigation = useNavigation<DashboardNavigationProp>();
  const { profile } = useAuthStore();
  const { activeCircle, members, circleFetched, isLoading, fetchActiveCircle, setActiveCircle, setMembers } = useCircleStore();

  const myMemberRecord = members.find(m => m.user_id === profile?.id);
  const myRole = myMemberRecord?.role || 'member';
  const isOwner = (activeCircle && profile && activeCircle.owner_id === profile.id) || myRole === 'owner';
  const canManageRanks = isOwner || myRole === 'co_leader';

  const [selectedRoleMember, setSelectedRoleMember] = useState<any>(null);
  const [branchModalMember, setBranchModalMember] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Array<{
    id: string;
    user_id: string;
    memberName: string;
    feature: string;
    created_at: string;
  }>>([]);

  React.useEffect(() => {
    if (profile?.id && !activeCircle) {
      fetchActiveCircle(profile.id);
    }
    if (activeCircle?.id && canManageRanks) {
      fetchPendingRequests();
    }
  }, [profile?.id, activeCircle?.id, canManageRanks]);

  React.useEffect(() => {
    if (!activeCircle?.id) return;
    const channelUid = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`dashboard_circle_members_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_members', filter: `circle_id=eq.${activeCircle.id}` },
        () => {
          useCircleStore.getState().fetchMembers(activeCircle.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'circle_messages', filter: `circle_id=eq.${activeCircle.id}` },
        () => {
          if (canManageRanks) {
            fetchPendingRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle?.id, canManageRanks]);

  const fetchPendingRequests = async () => {
    if (!activeCircle?.id) return;
    try {
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('circle_messages')
        .select('id, sender_id, content, created_at, profiles:sender_id(full_name)')
        .eq('circle_id', activeCircle.id)
        .gte('created_at', cutoffTime)
        .ilike('content', '%PERMISSION REQUEST%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        const formatted = data.map((m: any) => {
          let prof = m.profiles;
          if (Array.isArray(prof)) prof = prof[0];
          return {
            id: m.id,
            user_id: m.sender_id,
            memberName: prof?.full_name || 'Member',
            feature: m.content.includes('Ghost') ? 'Ghost Privacy Mode' : 'Hide Location',
            created_at: m.created_at,
          };
        });
        setPendingRequests(formatted);
      }
    } catch (e) {
      console.warn('Error fetching pending requests:', e);
    }
  };

  const handleApproveRequest = async (req: any) => {
    try {
      const isGhost = req.feature.toLowerCase().includes('ghost');
      const updatePayload = isGhost ? { is_ghost_mode: true } : { hide_online_presence: true };

      await supabase.from('profiles').update(updatePayload).eq('id', req.user_id);
      await supabase.from('circle_messages').insert({
        circle_id: activeCircle?.id,
        sender_id: profile?.id,
        content: `PERMISSION GRANTED: Leader approved ${req.feature} for ${req.memberName}.`,
      });
      await supabase.from('circle_messages').delete().eq('id', req.id);

      const { sendExpoPushNotification } = require('../services/PushNotificationService');
      await sendExpoPushNotification(
        req.user_id,
        'Leader Approved Privacy Request',
        `Your Circle Leader approved your request to activate ${req.feature}!`,
        { type: 'privacy_approved' }
      );

      showAlert({
        title: 'Permission Granted',
        message: `Approved ${req.feature} for ${req.memberName}.`,
        type: 'success',
      });
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      if (activeCircle?.id) {
        await useCircleStore.getState().fetchMembers(activeCircle.id);
      }
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to approve request',
        type: 'error',
      });
    }
  };

  const handleDenyRequest = async (req: any) => {
    try {
      await supabase.from('circle_messages').insert({
        circle_id: activeCircle?.id,
        sender_id: profile?.id,
        content: `PERMISSION DENIED: Leader maintained 24/7 Safety Mode for ${req.memberName}.`,
      });
      await supabase.from('circle_messages').delete().eq('id', req.id);

      showAlert({
        title: 'Request Denied',
        message: `Maintained 24/7 Safety Mode for ${req.memberName}.`,
        type: 'warning',
      });
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to deny request',
        type: 'error',
      });
    }
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await useCircleStore.getState().fetchActiveCircle(profile.id);
      if (activeCircle?.id) {
        await useCircleStore.getState().fetchMembers(activeCircle.id);
      }
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyCode = async () => {
    if (activeCircle?.invite_code) {
      await Clipboard.setStringAsync(activeCircle.invite_code);
      showAlert({
        title: 'Invite Code Copied',
        message: `Share this 6-character encryption key (${activeCircle.invite_code}) to add members.`,
        type: 'success',
        buttonText: 'DONE',
      });
    }
  };

  const handleLeaveOrDelete = async () => {
    const userId = profile?.id || (useAuthStore.getState() as any).user?.id;
    if (!activeCircle || !userId) return;

    if (isOwner) {
      Alert.alert(
        'Delete Circle',
        'Are you sure you want to delete this circle? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: async () => {
              try {
                const { error } = await supabase.from('circles').delete().eq('id', activeCircle.id);
                if (error) throw error;

                setActiveCircle(null);
                setMembers([]);
                await useCircleStore.getState().fetchActiveCircle(userId);
                showAlert({
                  title: 'Circle Deleted',
                  message: 'Your circle has been removed.',
                  type: 'info',
                });
              } catch (err: any) {
                showAlert({
                  title: 'Error',
                  message: err.message || 'Failed to delete circle.',
                  type: 'error',
                });
              }
            } 
          }
        ]
      );
    } else {
      Alert.alert(
        'Leave Circle',
        'Are you sure you want to leave this circle?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive', 
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('circle_members')
                  .delete()
                  .eq('circle_id', activeCircle.id)
                  .eq('user_id', userId);

                if (error) throw error;

                setActiveCircle(null);
                setMembers([]);
                await useCircleStore.getState().fetchActiveCircle(userId);
                showAlert({
                  title: 'Left Circle',
                  message: 'You have left the circle.',
                  type: 'info',
                });
              } catch (err: any) {
                showAlert({
                  title: 'Error',
                  message: err.message || 'Failed to leave circle.',
                  type: 'error',
                });
              }
            } 
          }
        ]
      );
    }
  };

  // Display luxury custom loading animation while circle syncs from cloud database
  if (isLoading || !circleFetched) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <LuxuryRadarLoading
          message="SYNCING FAMILY CIRCLE..."
          subMessage="Fetching encrypted circle data & member status"
          size={130}
        />
      </View>
    );
  }

  if (!activeCircle) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Ionicons name="people-outline" size={56} color={colors.accentGold} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NO ACTIVE CIRCLE</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Create a new circle or join an existing family group with an invite code.
        </Text>

        <View style={{ width: '100%', gap: 12, marginTop: 24 }}>
          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: colors.accentGold }]}
            onPress={() => navigation.navigate('CreateCircle')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#1A1A1A" />
            <Text style={styles.primaryBtnText}>CREATE A NEW CIRCLE</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('JoinCircle')}
          >
            <Ionicons name="log-in-outline" size={20} color={colors.foreground} />
            <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>JOIN WITH INVITE CODE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.overline, { color: colors.accentGold }]}>FAMILY ARCHITECTURE & SAFETY</Text>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{activeCircle.name}</Text>
      </View>

      {/* Circle Overview Statistics Grid */}
      <View style={styles.statsGridRow}>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-sharp" size={20} color={colors.accentGold} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>{members.length} Members</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>MONITORED 24/7</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="key-outline" size={20} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {myRole === 'owner' ? 'FOUNDER' : myRole.toUpperCase().replace('_', ' ')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>YOUR RANK</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={20} color="#A855F7" />
          <Text style={[styles.statValue, { color: colors.foreground }]}>AES-256</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>ENCRYPTED</Text>
        </View>
      </View>

      {/* Tracking Mode Protocol Badge Card */}
      <View style={[styles.trackingModeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.protocolIconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
            <Ionicons
              name={activeCircle?.tracking_mode === 'privacy' ? 'shield-half-outline' : 'radio-outline'}
              size={22}
              color={colors.accentGold}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackingModeLabel, { color: colors.accentGold }]}>CIRCLE TRACKING PROTOCOL</Text>
            <Text style={[styles.trackingModeTitle, { color: colors.foreground }]}>
              {activeCircle?.tracking_mode === 'privacy'
                ? 'Option A: Privacy-First Disconnect'
                : 'Option B: Continuous 24/7 Safety Mode'}
            </Text>
            <Text style={[styles.trackingModeDesc, { color: colors.textMuted }]}>
              {activeCircle?.tracking_mode === 'privacy'
                ? 'Location disconnects and shows offline when app is closed.'
                : 'Location updates continuously 24/7 even when app is closed.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Pending Member Permission Requests (Leader Panel) */}
      {canManageRanks && pendingRequests.length > 0 ? (
        <View style={[styles.trackingModeCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: '#F59E0B', borderWidth: 1.5 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Ionicons name="notifications-circle-outline" size={24} color="#F59E0B" />
            <Text style={[styles.trackingModeTitle, { color: colors.foreground, fontSize: 13, fontWeight: '800' }]}>
              PENDING PRIVACY REQUESTS ({pendingRequests.length})
            </Text>
          </View>

          {pendingRequests.map((req) => (
            <View key={req.id} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.foreground, marginBottom: 2 }}>
                {req.memberName} requested permission
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>
                Feature: <Text style={{ color: colors.accentGold, fontWeight: '700' }}>{req.feature}</Text> under Option B 24/7 Safety
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, height: 36, backgroundColor: '#10B981', borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 }}
                  onPress={() => handleApproveRequest(req)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' }}>APPROVE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, height: 36, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 }}
                  onPress={() => handleDenyRequest(req)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-sharp" size={14} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 10.5, fontWeight: '900' }}>DENY</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Invite Code Luxury Card */}
      <View style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.inviteHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.inviteOverline, { color: colors.accentGold }]}>CIRCLE ACCESS CODE</Text>
            <Text style={[styles.circleName, { color: colors.foreground }]} numberOfLines={1}>{activeCircle.name}</Text>
          </View>
          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.accentGold }]} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={14} color="#1A1A1A" />
            <Text style={styles.copyBtnText}>SHARE</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.codeText, { color: colors.accentGold }]}>{activeCircle.invite_code}</Text>
        </View>
        <Text style={[styles.inviteTip, { color: colors.textMuted }]}>Share this 6-character encryption key to add members.</Text>
      </View>

      {/* Members Directory Header & View Switcher */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>MEMBERS ({members.length})</Text>
        
        <View style={[styles.viewModeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'tree' && { backgroundColor: colors.accentGold }]}
            onPress={() => setViewMode('tree')}
            activeOpacity={0.8}
          >
            <Ionicons name="git-network" size={13} color={viewMode === 'tree' ? '#1A1A1A' : colors.textMuted} />
            <Text style={[styles.toggleBtnText, { color: viewMode === 'tree' ? '#1A1A1A' : colors.textMuted }]}>TREE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.accentGold }]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Ionicons name="list" size={13} color={viewMode === 'list' ? '#1A1A1A' : colors.textMuted} />
            <Text style={[styles.toggleBtnText, { color: viewMode === 'list' ? '#1A1A1A' : colors.textMuted }]}>LIST</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'tree' ? (
        <CircleHierarchyTree
          members={members}
          currentUserId={profile?.id}
          isOwner={isOwner}
          canManageRanks={canManageRanks}
          onSelectMember={(m) => setSelectedRoleMember(m)}
          onMoveBranch={(m) => setBranchModalMember(m)}
        />
      ) : (
        <View style={styles.membersList}>
          {[...members]
            .sort((a, b) => {
              const weights: Record<string, number> = { owner: 1, co_leader: 2, guardian: 3, member: 4 };
              return (weights[a.role] || 99) - (weights[b.role] || 99);
            })
            .map((item) => {
              const fullName = item?.profile?.full_name;
              const displayName = (typeof fullName === 'string' && fullName.trim().length > 0) ? fullName : 'Member';
              const initial = String(displayName).charAt(0).toUpperCase();
              const avatarUrl = item?.profile?.avatar_url;
              const isTargetOwner = item.role === 'owner';
              const isSelf = item.user_id === profile?.id;

              let roleTitle = 'MEMBER';
              let roleColor = '#10B981';
              let roleIcon: keyof typeof Ionicons.glyphMap = 'person-outline';

              if (item.role === 'owner') {
                roleTitle = 'FOUNDER & LEADER';
                roleColor = '#D4AF37';
                roleIcon = 'star-sharp';
              } else if (item.role === 'co_leader') {
                roleTitle = 'CO-LEADER';
                roleColor = '#A855F7';
                roleIcon = 'shield-checkmark-sharp';
              } else if (item.role === 'guardian') {
                roleTitle = 'SAFETY GUARDIAN';
                roleColor = '#3B82F6';
                roleIcon = 'shield-outline';
              }

              return (
                <SpringTouchable
                  key={item.user_id}
                  style={[
                    styles.memberCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: item.role === 'co_leader' ? '#A855F7' : (item.role === 'guardian' ? '#3B82F6' : (item.role === 'owner' ? colors.accentGold : colors.border)),
                      borderWidth: item.role !== 'member' ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setSelectedRoleMember(item)}
                  scaleTo={0.96}
                >
                  <View style={styles.memberTopRow}>
                    <View style={styles.memberLeft}>
                      <View style={[styles.memberAvatar, { overflow: 'hidden', borderColor: roleColor, borderWidth: 1.5 }]}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={styles.avatarText}>{initial}</Text>
                        )}
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
                          {displayName} {isSelf ? '(You)' : ''}
                        </Text>
                        <View style={styles.roleBadgeRow}>
                          <Ionicons name={roleIcon} size={12} color={roleColor} />
                          <Text style={[styles.memberRole, { color: roleColor }]} numberOfLines={1}>{roleTitle}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.manageRoleBtn, { borderColor: roleColor, backgroundColor: `${roleColor}15` }]}>
                      <Ionicons name={canManageRanks && !isTargetOwner && !isSelf ? "ribbon-outline" : "information-circle-outline"} size={13} color={roleColor} />
                      <Text style={[styles.manageRoleText, { color: roleColor }]}>
                        {canManageRanks && !isTargetOwner && !isSelf ? "RANK" : "INFO"}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusChip, { backgroundColor: colors.background, borderColor: item.isOnline ? '#10B981' : colors.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: item.isOnline ? '#10B981' : '#9CA3AF' }]} />
                    <Text style={[styles.statusText, { color: item.isOnline ? '#10B981' : colors.textMuted }]} numberOfLines={1}>
                      {item.isOnline ? 'ONLINE' : (item.lastSeenText || 'OFFLINE').toUpperCase()}
                    </Text>
                  </View>
                </SpringTouchable>
              );
            })}
        </View>
      )}

      <TouchableOpacity style={styles.deleteBtn} onPress={handleLeaveOrDelete}>
        <Text style={styles.deleteBtnText}>{isOwner ? 'DELETE CIRCLE' : 'LEAVE CIRCLE'}</Text>
      </TouchableOpacity>

      <MemberRoleModal
        visible={!!selectedRoleMember}
        member={selectedRoleMember}
        circleId={activeCircle.id}
        canEdit={canManageRanks}
        onClose={() => setSelectedRoleMember(null)}
        onRoleUpdated={(userId, newRole) => {
          setSelectedRoleMember((prev: any) => prev ? { ...prev, role: newRole } : null);
        }}
      />

      <BranchAssignmentModal
        visible={!!branchModalMember}
        targetMember={branchModalMember}
        circleId={activeCircle.id}
        onClose={() => setBranchModalMember(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    marginBottom: 20,
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  inviteCard: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    padding: 24,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: LUXURY_THEME.colors.accentGold,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteOverline: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  circleName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#1A1A1A',
  },
  codeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  codeText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  inviteTip: {
    color: LUXURY_THEME.colors.surfaceMuted,
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  accentLine: {
    flex: 1,
    height: 1,
    backgroundColor: LUXURY_THEME.colors.border,
  },
  membersList: {
    gap: 14,
    marginBottom: 32,
  },
  memberCard: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 16,
    gap: 12,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 10,
    fontWeight: '800',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  manageRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'center',
  },
  manageRoleText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  deleteBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  deleteBtnText: {
    color: LUXURY_THEME.colors.sosRed,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  trackingModeCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  protocolIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingModeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  trackingModeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  trackingModeDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
