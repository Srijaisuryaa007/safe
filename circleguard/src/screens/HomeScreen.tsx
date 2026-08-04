import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';

import { useThemeStore } from '../store/useThemeStore';

import FakeCallModal from '../components/FakeCallModal';

export default function HomeScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();
  
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [fakeCallVisible, setFakeCallVisible] = useState(false);

  const safeMembers = members || [];
  const firstName = String(profile?.full_name || 'User').split(' ')[0];

  useEffect(() => {
    if (activeCircle?.id) {
      fetchCircleActivity(activeCircle.id);
    }
  }, [activeCircle?.id]);

  const fetchCircleActivity = async (circleId: string) => {
    setLoadingActivity(true);
    try {
      const { data: sosData } = await supabase
        .from('sos_alerts')
        .select('id, created_at, status, user_id, profiles(full_name)')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(5);

      const formatted = (sosData || []).map(item => {
        let name = 'A member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        return {
          id: item.id,
          title: `${name || 'Member'} triggered SOS alert`,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          color: colors.accentGold,
        };
      });

      setRecentActivities(formatted);
    } catch (err) {
      console.warn('Error fetching activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleShareLocation = () => {
    setSharingLocation(prev => !prev);
    Alert.alert(
      sharingLocation ? 'Location Sharing Paused' : 'Live Location Active',
      sharingLocation 
        ? 'Your live GPS location broadcast has been paused.' 
        : 'Your live location is now being broadcast to circle members.'
    );
  };

  const handleInviteMember = async () => {
    if (activeCircle?.invite_code) {
      await Clipboard.setStringAsync(activeCircle.invite_code);
      Alert.alert('Invite Code Copied', `Invite Code: ${activeCircle.invite_code}\n\nCopied to clipboard.`);
    } else {
      navigation.navigate('Circle');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Editorial Overline & Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatarImg} />
            ) : (
              <View style={[styles.headerAvatarFallback, { backgroundColor: colors.accentGold }]}>
                <Text style={styles.headerAvatarText}>
                  {String(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={[styles.overlineText, { color: colors.accentGold }]}>VOL. 01 — LIVE STATUS</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>{profile?.full_name || 'Welcome Back'}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.bellBtn, { borderColor: colors.border }]} onPress={() => navigation.navigate('Activity')}>
          <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          {recentActivities.length > 0 ? <View style={styles.notificationDot} /> : null}
        </TouchableOpacity>
      </View>

      {/* Main Luxury Banner */}
      <View style={[styles.statusBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bannerTopRow}>
          <View style={styles.goldPill}>
            <View style={styles.goldDot} />
            <Text style={styles.goldPillText}>PROTECTED</Text>
          </View>
          <Text style={[styles.bannerDate, { color: colors.textMuted }]}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</Text>
        </View>

        <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
          {activeCircle ? `${activeCircle.name}` : 'CircleGuard Protection'}
        </Text>
        <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
          {activeCircle 
            ? `${safeMembers.length} member${safeMembers.length === 1 ? '' : 's'} actively connected`
            : 'Join or initialize a private circle'}
        </Text>
        
        {safeMembers.length > 0 ? (
          <View style={styles.avatarRow}>
            {safeMembers.slice(0, 4).map((item, idx) => {
              const initial = String(item?.profile?.full_name || 'M').charAt(0).toUpperCase();
              const avatarUrl = item?.profile?.avatar_url;

              return (
                <View key={idx} style={[styles.avatarSquare, { backgroundColor: colors.surface, borderColor: colors.border, overflow: 'hidden' }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.foreground }]}>{initial}</Text>
                  )}
                </View>
              );
            })}
            {safeMembers.length > 4 ? (
              <View style={[styles.avatarSquare, styles.moreAvatar, { borderColor: colors.border }]}>
                <Text style={[styles.moreAvatarText, { color: colors.textMuted }]}>+{safeMembers.length - 4}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Circle Metrics Grid */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>CIRCLE METRICS</Text>
        <View style={[styles.accentLine, { backgroundColor: colors.border }]} />
      </View>

      {(() => {
        const onlineCount = safeMembers.filter(m => m.isOnline).length;
        const offlineCount = Math.max(0, safeMembers.length - onlineCount);

        return (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: '#10B981' }]}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{onlineCount}</Text>
              <Text style={[styles.statLabel, { color: '#10B981' }]}>MEMBERS ONLINE</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statNumber, { color: colors.textMuted }]}>{offlineCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>MEMBERS OFFLINE</Text>
            </View>

            <View style={[styles.statCard, styles.statCardGold, { backgroundColor: colors.surface, borderColor: colors.accentGold }]}>
              <Text style={[styles.statNumber, { color: colors.accentGold }]}>{recentActivities.length}</Text>
              <Text style={[styles.statLabel, { color: colors.accentGold }]}>ALERTS LOGGED</Text>
            </View>
          </View>
        );
      })()}

      {/* Quick Actions */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>DIRECT ACTIONS</Text>
        <View style={[styles.accentLine, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleShareLocation}
          disabled={sharingLocation}
        >
          {sharingLocation ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Ionicons name="location-outline" size={22} color={colors.foreground} />
          )}
          <Text style={[styles.actionText, { color: colors.foreground }]}>SHARE LOCATION</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('SafePlaces')}
        >
          <Ionicons name="compass-outline" size={22} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>ADD GEOFENCE</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.accentGold }]}
          onPress={() => setFakeCallVisible(true)}
        >
          <Ionicons name="call-outline" size={22} color={colors.accentGold} />
          <Text style={[styles.actionText, { color: colors.accentGold }]}>GHOST ESCORT</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleInviteMember}
        >
          <Ionicons name="person-add-outline" size={22} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>INVITE MEMBER</Text>
        </TouchableOpacity>
      </View>

      <FakeCallModal 
        visible={fakeCallVisible} 
        onClose={() => setFakeCallVisible(false)} 
      />

      {/* Recent Activity */}
      <View style={styles.activityHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ACTIVITY LOG</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
          <Text style={[styles.seeAllText, { color: colors.accentGold }]}>VIEW ALL →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.activityList}>
        {loadingActivity ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : recentActivities.length > 0 ? (
          recentActivities.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <View style={styles.goldIndicatorDot} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{act.title}</Text>
                <Text style={styles.activityTime}>{act.time}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyActivityText}>No activity recorded in your circle yet.</Text>
        )}
      </View>
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
  overlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
    marginBottom: 4,
  },
  userName: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
  },
  headerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  headerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  headerAvatarText: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bellBtn: {
    width: 44,
    height: 44,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  statusBanner: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    padding: 24,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: LUXURY_THEME.colors.accentGold,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  goldDot: {
    width: 6,
    height: 6,
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  goldPillText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  bannerDate: {
    color: LUXURY_THEME.colors.surfaceMuted,
    fontSize: 10,
    letterSpacing: 2,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: LUXURY_THEME.colors.surfaceMuted,
    fontSize: 13,
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarSquare: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  moreAvatar: {
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  moreAvatarText: {
    color: LUXURY_THEME.colors.foreground,
    fontSize: 12,
    fontWeight: 'bold',
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    alignItems: 'center',
  },
  statCardGold: {
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  statNumber: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 90,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  activityList: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 20,
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  goldIndicatorDot: {
    width: 6,
    height: 6,
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  activityInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: LUXURY_THEME.colors.foreground,
  },
  activityTime: {
    fontSize: 11,
    color: LUXURY_THEME.colors.textMuted,
  },
  emptyActivityText: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
