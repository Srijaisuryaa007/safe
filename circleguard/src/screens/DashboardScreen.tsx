import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
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

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Circle'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation<DashboardNavigationProp>();
  const { profile } = useAuthStore();
  const { activeCircle, members, setActiveCircle, setMembers } = useCircleStore();

  const myMemberRecord = members.find(m => m.user_id === profile?.id);
  const myRole = myMemberRecord?.role || 'member';
  const isOwner = (activeCircle && profile && activeCircle.owner_id === profile.id) || myRole === 'owner';
  const canManageRanks = isOwner || myRole === 'co_leader';

  const [selectedRoleMember, setSelectedRoleMember] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      Alert.alert('Copied', 'Invite code copied to clipboard!');
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
                Alert.alert('Circle Deleted', 'Your circle has been removed.');
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to delete circle.');
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
                Alert.alert('Left Circle', 'You have left the circle.');
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to leave circle.');
              }
            } 
          }
        ]
      );
    }
  };

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
        <Text style={[styles.overline, { color: colors.accentGold }]}>FAMILY ARCHITECTURE</Text>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{activeCircle.name}</Text>
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

      {/* Members List Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>MEMBERS DIRECTORY ({members.length})</Text>
        <View style={[styles.accentLine, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.membersList}>
        {members.map((item) => {
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
            roleTitle = '👑 FOUNDER & LEADER';
            roleColor = '#D4AF37';
            roleIcon = 'star-sharp';
          } else if (item.role === 'co_leader') {
            roleTitle = '⚡ CO-LEADER';
            roleColor = '#A855F7';
            roleIcon = 'shield-checkmark-sharp';
          } else if (item.role === 'guardian') {
            roleTitle = '🛡️ SAFETY GUARDIAN';
            roleColor = '#3B82F6';
            roleIcon = 'shield-outline';
          }

          const canClickToManage = canManageRanks && !isTargetOwner && !isSelf;

          return (
            <TouchableOpacity
              key={item.user_id}
              style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                if (canClickToManage) setSelectedRoleMember(item);
              }}
              activeOpacity={canClickToManage ? 0.75 : 1.0}
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
                      <Text style={[styles.memberRole, { color: roleColor }]}>{roleTitle}</Text>
                    </View>
                  </View>
                </View>

                {canClickToManage ? (
                  <View style={[styles.manageRoleBtn, { borderColor: roleColor, backgroundColor: `${roleColor}15` }]}>
                    <Ionicons name="ribbon-outline" size={13} color={roleColor} />
                    <Text style={[styles.manageRoleText, { color: roleColor }]}>RANK 👑</Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.statusChip, { backgroundColor: colors.background, borderColor: item.isOnline ? '#10B981' : colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: item.isOnline ? '#10B981' : '#9CA3AF' }]} />
                <Text style={[styles.statusText, { color: item.isOnline ? '#10B981' : colors.textMuted }]} numberOfLines={1}>
                  {item.isOnline ? 'ONLINE' : (item.lastSeenText || 'OFFLINE').toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleLeaveOrDelete}>
        <Text style={styles.deleteBtnText}>{isOwner ? 'DELETE CIRCLE' : 'LEAVE CIRCLE'}</Text>
      </TouchableOpacity>

      <MemberRoleModal
        visible={!!selectedRoleMember}
        member={selectedRoleMember}
        circleId={activeCircle.id}
        onClose={() => setSelectedRoleMember(null)}
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
    marginBottom: 28,
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
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
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
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 10,
    fontWeight: '800',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.2,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  manageRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
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
