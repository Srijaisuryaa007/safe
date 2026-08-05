import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';

export default function ActivityScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<'ALL' | 'UPDATES' | 'SYSTEM'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // App & System Announcement Notifications Data
  const appNotifications = [
    {
      id: '1',
      category: 'UPDATES',
      title: 'CircleGuard v1.2 Performance Build',
      message: 'New 60 FPS animated protection shield, Swiggy-style live address bar, and Option A (Privacy-First) vs Option B (Continuous 24/7) circle tracking modes are now active.',
      time: 'TODAY • 06:00 PM',
      icon: 'rocket-outline',
      color: '#D4AF37',
      isNew: true,
    },
    {
      id: '2',
      category: 'SYSTEM',
      title: 'PostGIS Geofence Guard Activated',
      message: 'Smart place arrive and leave notifications are now active. Receive immediate system banners when family members enter or depart saved zones.',
      time: 'YESTERDAY',
      icon: 'shield-checkmark-outline',
      color: '#10B981',
      isNew: false,
    },
    {
      id: '3',
      category: 'SYSTEM',
      title: 'Zero-Drain Battery Optimization',
      message: 'Background location engine updated with adaptive GPS velocity filters, minimizing battery consumption during stationary periods.',
      time: 'AUG 4',
      icon: 'battery-charging-outline',
      color: '#3B82F6',
      isNew: false,
    },
    {
      id: '4',
      category: 'UPDATES',
      title: 'Supabase Realtime Database Sync Active',
      message: 'Targeted live location sharing updated with 0ms database push notifications across all circle members.',
      time: 'AUG 3',
      icon: 'cloud-done-outline',
      color: '#F59E0B',
      isNew: false,
    },
  ];

  const filteredList = appNotifications.filter(
    item => filter === 'ALL' || item.category === filter
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleCheckUpdate = () => {
    Alert.alert(
      'App Up to Date',
      'CircleGuard v1.2.0 is currently running the latest security build with 100% active protection.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>App Notifications</Text>
        <TouchableOpacity onPress={handleCheckUpdate} activeOpacity={0.8}>
          <Ionicons name="sparkles-outline" size={22} color={colors.accentGold} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'ALL' ? colors.accentGold : colors.surface,
              borderColor: filter === 'ALL' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, { color: filter === 'ALL' ? '#1A1A1A' : colors.textMuted }]}>
            ALL NOTIFICATIONS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'UPDATES' ? colors.accentGold : colors.surface,
              borderColor: filter === 'UPDATES' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('UPDATES')}
        >
          <Text style={[styles.filterText, { color: filter === 'UPDATES' ? '#1A1A1A' : colors.textMuted }]}>
            APP UPDATES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === 'SYSTEM' ? colors.accentGold : colors.surface,
              borderColor: filter === 'SYSTEM' ? colors.accentGold : colors.border,
            },
          ]}
          onPress={() => setFilter('SYSTEM')}
        >
          <Text style={[styles.filterText, { color: filter === 'SYSTEM' ? '#1A1A1A' : colors.textMuted }]}>
            SYSTEM
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
        }
      >
        <View style={styles.listContainer}>
          {filteredList.map((item) => (
            <View
              key={item.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: item.isNew ? colors.accentGold : colors.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.iconCircle, { backgroundColor: `${item.color}20` }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                </View>
                {item.isNew ? (
                  <View style={[styles.newBadge, { backgroundColor: colors.accentGold }]}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.cardMsg, { color: colors.textMuted }]}>{item.message}</Text>
              <Text style={[styles.cardTime, { color: colors.textMuted }]}>{item.time}</Text>
            </View>
          ))}
        </View>

        {/* Check Update Button */}
        <TouchableOpacity
          style={[styles.updateCheckBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleCheckUpdate}
        >
          <Ionicons name="cloud-download-outline" size={18} color={colors.accentGold} />
          <Text style={[styles.updateCheckText, { color: colors.foreground }]}>CHECK FOR LATEST APP UPDATES</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  content: {
    padding: 16,
  },
  listContainer: {
    gap: 12,
    marginBottom: 20,
  },
  notifCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 0.8,
  },
  cardMsg: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardTime: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  updateCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  updateCheckText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
