import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';

export default function ActivityScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation();
  const { activeCircle } = useCircleStore();
  
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeCircle?.id) {
      fetchRealActivities(activeCircle.id);
    } else {
      setLoading(false);
    }
  }, [activeCircle?.id]);

  const fetchRealActivities = async (circleId: string) => {
    setLoading(true);
    try {
      const { data: sosData } = await supabase
        .from('sos_alerts')
        .select('id, created_at, status, user_id, profiles(full_name)')
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false });

      const formatted = (sosData || []).map(item => {
        let name = 'A circle member';
        if (item.profiles) {
          name = Array.isArray(item.profiles) ? item.profiles[0]?.full_name : (item.profiles as any).full_name;
        }
        return {
          id: item.id,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `${name || 'Member'} triggered SOS Emergency Alert`,
          color: '#EF4444',
          date: new Date(item.created_at).toLocaleDateString(),
        };
      });

      setActivities(formatted);
    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Circle Activity Log</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />
        ) : activities.length > 0 ? (
          <View style={styles.timelineList}>
            {activities.map((item) => (
              <View key={item.id} style={styles.timelineItem}>
                <Text style={styles.time}>{item.time}</Text>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={styles.activityText}>{item.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Activity Logs Yet</Text>
            <Text style={styles.emptySubtitle}>All member location updates and emergency alerts in your circle will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    padding: 20,
  },
  timelineList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: {
    fontSize: 12,
    color: '#6B7280',
    width: 64,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
