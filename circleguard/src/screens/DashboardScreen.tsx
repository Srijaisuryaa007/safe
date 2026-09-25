import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, ActivityIndicator, Linking, Platform } from 'react-native';
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
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME, getThemeCardStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';
import MemberRoleModal from '../components/MemberRoleModal';
import SpringTouchable from '../components/SpringTouchable';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import CircleHierarchyTree from '../components/CircleHierarchyTree';
import BranchAssignmentModal from '../components/BranchAssignmentModal';
import CircleQRCodeModal from '../components/CircleQRCodeModal';
import BillionDollarCircleView from '../components/BillionDollarCircleView';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isValidUuid } from '../lib/utils';

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Circle'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, isDark } = useThemeStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  const navigation = useNavigation<DashboardNavigationProp>();
  const { profile } = useAuthStore();
  const { activeCircle, members, circleFetched, isLoading, isSwitchingCircle, switchingTargetName, switchingStepText, fetchActiveCircle, setActiveCircle, setMembers } = useCircleStore();

  const circleMembers = React.useMemo(() => {
    if (!activeCircle?.id || !Array.isArray(members)) return [];
    const filtered = members.filter(m => !m.circle_id || m.circle_id === activeCircle.id);

    const cleanPhone = (p?: string | null) => (p || '').replace(/[^\d]/g, '');
    const selfPhone = cleanPhone(profile?.phone);
    const selfFullName = profile?.full_name?.trim().toLowerCase();

    const deduped: typeof members = [];
    const seenUids = new Set<string>();
    const seenPhones = new Set<string>();

    const selfMember = filtered.find(m => m.user_id === profile?.id);
    if (selfMember) {
      deduped.push(selfMember);
      seenUids.add(selfMember.user_id);
      if (selfPhone) seenPhones.add(selfPhone);
    }

    for (const m of filtered) {
      if (m.user_id === profile?.id) continue;
      if (seenUids.has(m.user_id)) continue;

      const mPhone = cleanPhone(m.profile?.phone);
      const mName = m.profile?.full_name?.trim().toLowerCase();

      const isSelfPhoneDup = !!selfPhone && !!mPhone && mPhone === selfPhone;
      const isSelfNameDup = !!selfFullName && !!mName && mName === selfFullName && (!mPhone || mPhone === selfPhone);

      if (isSelfPhoneDup || isSelfNameDup) continue;
      if (mPhone && seenPhones.has(mPhone)) continue;

      seenUids.add(m.user_id);
      if (mPhone) seenPhones.add(mPhone);
      deduped.push(m);
    }

    return deduped;
  }, [members, activeCircle?.id, profile?.id, profile?.phone, profile?.full_name]);

  const myMemberRecord = circleMembers.find(m => m.user_id === profile?.id);
  const myRole = myMemberRecord?.role || 'member';
  const isOwner = (activeCircle && profile && activeCircle.owner_id === profile.id) || myRole === 'owner';
  const canManageRanks = isOwner || myRole === 'co_leader';

  const [selectedRoleMember, setSelectedRoleMember] = useState<any>(null);
  const [branchModalMember, setBranchModalMember] = useState<any>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [refreshing, setRefreshing] = useState(false);
  const [latestMessage, setLatestMessage] = useState<{
    id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string | null;
    content: string;
    created_at: string;
    message_type?: string;
  } | null>(null);
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
    if (activeCircle?.id) {
      fetchLatestMessage(activeCircle.id);
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
        { event: '*', schema: 'public', table: 'circle_messages', filter: `circle_id=eq.${activeCircle.id}` },
        () => {
          fetchLatestMessage(activeCircle.id);
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

  const fetchLatestMessage = async (circleId: string) => {
    if (!circleId || !isValidUuid(circleId)) return;
    try {
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('circle_messages')
        .select('id, sender_id, content, message_type, created_at, profiles:sender_id(full_name, avatar_url)')
        .eq('circle_id', circleId)
        .is('deleted_at', null)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const msg = data[0] as any;
        let prof = msg.profiles;
        if (Array.isArray(prof)) prof = prof[0];
        setLatestMessage({
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: prof?.full_name || 'Member',
          sender_avatar: prof?.avatar_url || null,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type,
        });
      } else {
        setLatestMessage(null);
      }
    } catch (e) {
      console.warn('Error fetching latest circle message:', e);
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

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
      const currentCircle = activeCircle || useCircleStore.getState().activeCircle;
      if (currentCircle?.id) {
        await Promise.all([
          useCircleStore.getState().fetchMembers(currentCircle.id),
          fetchLatestMessage(currentCircle.id),
          canManageRanks ? fetchPendingRequests() : Promise.resolve(),
        ]);
        useCircleStore.getState().fetchUserCircles(profile.id).catch(() => {});
      } else {
        await useCircleStore.getState().fetchActiveCircle(profile.id);
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

  const handleQuickRemoveMember = (member: any) => {
    if (!activeCircle?.id || !member?.user_id) return;
    const memberName = member?.profile?.full_name || 'this member';

    showConfirm({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberName} from ${activeCircle?.name || 'this circle'}?`,
      confirmText: 'REMOVE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const success = await useCircleStore.getState().removeMember(activeCircle.id, member.user_id);
          if (success) {
            showAlert({
              title: 'Member Removed',
              message: `${memberName} has been removed from the circle.`,
              type: 'info',
            });
          }
        } catch (e: any) {
          showAlert({
            title: 'Error',
            message: e.message || 'Failed to remove member.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleLeaveOrDelete = async () => {
    const userId = profile?.id || (useAuthStore.getState() as any).user?.id;
    if (!activeCircle || !userId) return;

    if (isOwner) {
      showConfirm({
        title: 'Delete Circle',
        message: 'Are you sure you want to delete this circle? All member connections and boundaries will be permanently removed.',
        confirmText: 'DELETE CIRCLE',
        cancelText: 'CANCEL',
        isDestructive: true,
        onConfirm: async () => {
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
              buttonText: 'DONE',
            });
          } catch (err: any) {
            showAlert({
              title: 'Error',
              message: err.message || 'Failed to delete circle.',
              type: 'error',
            });
          }
        },
      });
    } else {
      showConfirm({
        title: 'Leave Circle',
        message: 'Are you sure you want to leave this circle? You will no longer share live location or receive safety alerts.',
        confirmText: 'LEAVE CIRCLE',
        cancelText: 'CANCEL',
        isDestructive: true,
        onConfirm: async () => {
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
              buttonText: 'DONE',
            });
          } catch (err: any) {
            showAlert({
              title: 'Error',
              message: err.message || 'Failed to leave circle.',
              type: 'error',
            });
          }
        },
      });
    }
  };

  // Display luxury custom loading animation while circle syncs from cloud database or switches
  if (isLoading || !circleFetched || isSwitchingCircle) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <LuxuryRadarLoading
          message={switchingTargetName ? `SWITCHING TO ${switchingTargetName.toUpperCase()}...` : 'SYNCING CIRCLE...'}
          subMessage={switchingStepText || 'Connecting members & safe zones'}
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

  // Modern unified interface for both Light and Dark mode
  return <BillionDollarCircleView />;

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
