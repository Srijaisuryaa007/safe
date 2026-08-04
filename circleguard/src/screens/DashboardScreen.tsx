import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Clipboard, Image } from 'react-native';
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

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Circle'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation<DashboardNavigationProp>();
  const { profile } = useAuthStore();
  const { activeCircle, members, setActiveCircle, setMembers } = useCircleStore();

  const isOwner = activeCircle && profile && activeCircle.owner_id === profile.id;

  const handleCopyCode = () => {
    if (activeCircle?.invite_code) {
      Clipboard.setString(activeCircle.invite_code);
      Alert.alert('Copied', 'Invite code copied to clipboard!');
    }
  };

  const handleLeaveOrDelete = async () => {
    if (!activeCircle || !profile) return;

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
                Alert.alert('Deleted', 'Circle deleted successfully.');
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
                  .eq('user_id', profile.id);
                if (error) throw error;
                setActiveCircle(null);
                setMembers([]);
                Alert.alert('Left', 'You have left the circle.');
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
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="people-outline" size={60} color={colors.accentGold} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NO ACTIVE CIRCLE</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Create or join a family circle to start tracking live locations & sending distress signals.
        </Text>

        <TouchableOpacity 
          style={[styles.primaryBtn, { backgroundColor: colors.accentGold }]}
          onPress={() => navigation.navigate('CreateJoinCircle' as never)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#1A1A1A" />
          <Text style={styles.primaryBtnText}>CREATE OR JOIN CIRCLE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.overline, { color: colors.accentGold }]}>FAMILY ARCHITECTURE</Text>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{activeCircle.name}</Text>
      </View>

      {/* Invite Code Luxury Card */}
      <View style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.inviteHeader}>
          <View>
            <Text style={[styles.inviteOverline, { color: colors.accentGold }]}>CIRCLE ACCESS CODE</Text>
            <Text style={[styles.circleName, { color: colors.foreground }]}>{activeCircle.name}</Text>
          </View>
          <TouchableOpacity style={styles.copyIconBtn} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={20} color={colors.accentGold} />
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

          return (
            <View key={item.user_id} style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={[styles.memberAvatar, { overflow: 'hidden' }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={styles.avatarText}>{initial}</Text>
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.foreground }]}>{displayName}</Text>
                <Text style={[styles.memberRole, { color: colors.textMuted }]}>{item.role === 'owner' ? 'CIRCLE FOUNDER' : 'MEMBER'}</Text>
              </View>
              <View style={[styles.statusChip, item.isOnline ? styles.onlineChip : styles.offlineChip]}>
                <View style={[styles.statusDot, { backgroundColor: item.isOnline ? '#10B981' : '#9CA3AF' }]} />
                <Text style={[styles.statusText, { color: item.isOnline ? '#10B981' : '#6B7280' }]}>
                  {item.isOnline ? 'ONLINE' : (item.lastSeenText || 'OFFLINE').toUpperCase()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleLeaveOrDelete}>
        <Text style={styles.deleteBtnText}>{isOwner ? 'DELETE CIRCLE' : 'LEAVE CIRCLE'}</Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  emptyContainer: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 2,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
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
  copyIconBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
    marginBottom: 32,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 16,
    gap: 14,
  },
  memberAvatar: {
    width: 42,
    height: 42,
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
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  onlineChip: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  offlineChip: {
    borderColor: LUXURY_THEME.colors.border,
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    width: 6,
    height: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deleteBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: LUXURY_THEME.colors.sosRed,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
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
