import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore, Circle } from '../store/useCircleStore';
import { RootStackParamList } from '../navigation/AppNavigator';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

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
        const circle = memberData[0].circles as unknown as Circle;
        setActiveCircle(circle);
        await fetchCircleMembers(circle.id);
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
      
      const formattedMembers = data.map(d => ({
        circle_id: circleId,
        user_id: d.user_id,
        role: d.role as 'owner'|'member',
        joined_at: d.joined_at,
        profile: d.profiles ? {
          full_name: (d.profiles as any).full_name,
          avatar_url: (d.profiles as any).avatar_url
        } : undefined
      }));
      setMembers(formattedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
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
          {activeCircle ? activeCircle.name : 'Welcome to CircleGuard'}
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
            keyExtractor={(item) => item.user_id}
            renderItem={({ item }) => (
              <View style={styles.memberCard}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {item.profile?.full_name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.profile?.full_name}</Text>
                  <Text style={styles.memberRole}>{item.role === 'owner' ? 'Owner' : 'Member'}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContainer}
          />

          <View style={styles.footerActions}>
            <Text style={styles.inviteCodeText}>Invite Code: <Text style={styles.bold}>{activeCircle.invite_code}</Text></Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateCircle')}>
                <Text style={styles.actionBtnText}>New Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('JoinCircle')}>
                <Text style={styles.actionBtnText}>Join Circle</Text>
              </TouchableOpacity>
            </View>
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
});
