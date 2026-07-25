import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore, Circle } from '../store/useCircleStore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { MainTabParamList } from '../navigation/MainTabNavigator';

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Members'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { profile, setSession } = useAuthStore();
  const { activeCircle, setActiveCircle, members, setMembers } = useCircleStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyCircles();
  }, []);

  const fetchMyCircles = async () => {
    setLoading(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles(*)')
        .eq('user_id', profile?.id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        // Set the first circle as active for now
        let circle = memberData[0].circles as unknown as Circle;
        if (Array.isArray(circle)) {
          circle = circle[0];
        }
        setActiveCircle(circle);
      } else {
        setActiveCircle(null);
        setMembers([]);
      }
    } catch (err: any) {
      console.error('Error fetching circles:', err);
      Alert.alert('Error', 'Failed to load your circles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeCircle) {
      fetchCircleMembers(activeCircle.id);

      // Subscribe to real-time changes on circle_members for the active circle
      const channel = supabase
        .channel(`public:circle_members:circle_id=eq.${activeCircle.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'circle_members',
            filter: `circle_id=eq.${activeCircle.id}`
          },
          (payload) => {
            // When a member is added, updated, or removed, refetch the members
            fetchCircleMembers(activeCircle.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeCircle?.id]);

  const fetchCircleMembers = async (circleId: string) => {
    try {
      const { data, error } = await supabase
        .from('circle_members')
        .select(`
          user_id, role, joined_at,
          profiles (full_name, avatar_url)
        `)
        .eq('circle_id', circleId);

      if (error) throw error;
      
      const uniqueMembersMap = new Map();
      (data || []).forEach(d => {
        if (d && d.user_id && !uniqueMembersMap.has(d.user_id)) {
          let profObj: any = d.profiles;
          if (Array.isArray(profObj)) {
            profObj = profObj[0];
          }
          const fullName = (profObj && typeof profObj.full_name === 'string') ? profObj.full_name : 'Member';
          const avatarUrl = (profObj && typeof profObj.avatar_url === 'string') ? profObj.avatar_url : null;

          uniqueMembersMap.set(d.user_id, {
            circle_id: circleId,
            user_id: d.user_id,
            role: d.role as 'owner'|'member',
            joined_at: d.joined_at,
            profile: {
              full_name: fullName,
              avatar_url: avatarUrl
            }
          });
        }
      });

      const formattedMembers = Array.from(uniqueMembersMap.values());
      setMembers(formattedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const handleLeaveOrDelete = async () => {
    if (!activeCircle || !profile) return;
    const isOwner = activeCircle.owner_id === profile.id;
    
    Alert.alert(
      isOwner ? "Delete Circle" : "Leave Circle",
      isOwner ? `Are you sure you want to delete ${activeCircle.name}? This will remove all members.` : `Are you sure you want to leave ${activeCircle.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: isOwner ? "Delete" : "Leave", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              if (isOwner) {
                const { error } = await supabase
                  .from('circles')
                  .delete()
                  .eq('id', activeCircle.id);
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from('circle_members')
                  .delete()
                  .eq('circle_id', activeCircle.id)
                  .eq('user_id', profile.id);
                if (error) throw error;
              }
              await fetchMyCircles();
            } catch (err: any) {
              console.error('Error leaving/deleting circle:', err);
              Alert.alert('Error', 'Failed to perform action.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {activeCircle ? (activeCircle.name || 'My Circle') : 'Welcome to CircleGuard'}
        </Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {!activeCircle ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You aren't in any circles yet.</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('CreateCircle')}
          >
            <Text style={styles.primaryButtonText}>Create a Circle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('JoinCircle')}
          >
            <Text style={styles.secondaryButtonText}>Join with Invite Code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.circleContent}>
          <Text style={styles.sectionTitle}>Circle Members</Text>
          <FlatList
            data={members}
            keyExtractor={(item, index) => item?.user_id ? `${item.user_id}-${index}` : `member-${index}`}
            renderItem={({ item }) => {
              const fullName = item?.profile?.full_name;
              const displayName = (typeof fullName === 'string' && fullName.trim().length > 0) ? fullName : 'Unknown';
              const initial = (typeof fullName === 'string' && fullName.trim().length > 0) ? fullName.trim().charAt(0).toUpperCase() : '?';

              return (
                <View style={styles.memberCard}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberRole}>{item?.role === 'owner' ? 'Owner' : 'Member'}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.listContainer}
          />

          <View style={styles.footerActions}>
            <Text style={styles.inviteCodeText}>Invite Code: <Text style={styles.bold}>{activeCircle.invite_code || '---'}</Text></Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateCircle')}>
                <Text style={styles.actionBtnText}>New Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('JoinCircle')}>
                <Text style={styles.actionBtnText}>Join Circle</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.actionBtn, styles.leaveBtn]} onPress={handleLeaveOrDelete}>
              <Text style={styles.leaveBtnText}>
                {activeCircle.owner_id === profile?.id ? 'Delete Circle' : 'Leave Circle'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  logoutBtn: {
    padding: 8,
  },
  logoutText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  secondaryButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
  },
  circleContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 24,
    marginBottom: 16,
    color: '#1a1a1a',
  },
  listContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  memberRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  footerActions: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 16,
  },
  inviteCodeText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
  bold: {
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#333',
    fontWeight: '600',
  },
  leaveBtn: {
    backgroundColor: '#ffe6e6',
    marginTop: 8,
  },
  leaveBtnText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
});
