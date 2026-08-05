import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

import { scheduleLocalNotification } from '../services/PushNotificationService';

export default function GlobalLocationShareModal() {
  const { colors } = useThemeStore();
  const { activeCircle } = useCircleStore();
  const { profile } = useAuthStore();
  const navigation = useNavigation<any>();

  const [activeShare, setActiveShare] = useState<{ senderName: string; senderId: string } | null>(null);

  useEffect(() => {
    if (!activeCircle?.id || !profile?.id) return;

    // Listen for incoming location share database events on active circle
    const channel = supabase
      .channel(`public:location_shares:${activeCircle.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'location_shares' },
        async (payload) => {
          const row = payload.new;
          if (row.circle_id !== activeCircle.id) return;
          if (row.sender_id === profile.id) return; // Ignore own share

          if (!row.target_user_id || row.target_user_id === profile.id) {
            // Fetch sender profile name
            const { data: pData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.sender_id)
              .single();

            const senderName = pData?.full_name || 'A circle member';

            // 1. Strong double pulse vibration
            Vibration.vibrate([0, 500, 200, 500]);

            // 2. Drop down local system notification banner
            scheduleLocalNotification(
              '📍 Live Location Shared',
              `${senderName} is now sharing live location details with you! Tap to view on main map.`,
              { screen: 'Map', senderId: row.sender_id }
            );

            // 3. Show luxury golden in-app popup modal
            setActiveShare({
              senderName,
              senderId: row.sender_id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle?.id, profile?.id]);

  if (!activeShare) return null;

  return (
    <Modal visible={!!activeShare} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accentGold }]}>
          <View style={styles.goldLine} />

          <View style={[styles.iconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
            <Ionicons name="location-sharp" size={34} color={colors.accentGold} />
          </View>

          <Text style={[styles.overline, { color: colors.textMuted }]}>INCOMING LIVE POSITION BROADCAST</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {activeShare.senderName} Shared Location
          </Text>

          <Text style={[styles.message, { color: colors.textMuted }]}>
            {activeShare.senderName} has shared their live position, battery, and motion status with you.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accentGold }]}
            onPress={() => {
              setActiveShare(null);
              navigation.navigate('MainTabs', { screen: 'Map' });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={18} color="#1A1A1A" />
            <Text style={styles.primaryBtnText}>VIEW ON MAIN MAP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setActiveShare(null)}
          >
            <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>DISMISS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  goldLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#D4AF37',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
