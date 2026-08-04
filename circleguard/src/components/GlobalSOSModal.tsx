import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Vibration, Linking, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { LUXURY_THEME } from '../constants/theme';

interface GlobalSOSModalProps {
  onNavigateToMap?: (user_id: string) => void;
}

export default function GlobalSOSModal({ onNavigateToMap }: GlobalSOSModalProps) {
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const [activeSOS, setActiveSOS] = useState<any | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeCircle || !profile) return;

    // 1. Initial check for active SOS alerts in this circle
    const checkActiveSOS = async () => {
      try {
        const { data } = await supabase
          .from('sos_alerts')
          .select('*, profiles(*)')
          .eq('circle_id', activeCircle.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0 && data[0].user_id !== profile.id) {
          const alert = data[0];
          // Only show if created within last 10 minutes
          const diffMs = Date.now() - new Date(alert.created_at).getTime();
          if (diffMs < 600000) {
            setActiveSOS(alert);
          }
        }
      } catch (e) {
        console.error('Error checking active SOS:', e);
      }
    };

    checkActiveSOS();

    // 2. Realtime listener for incoming SOS alerts across ALL screens
    const sosChannel = supabase
      .channel(`global:sos:${activeCircle.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts', filter: `circle_id=eq.${activeCircle.id}` },
        async (payload) => {
          const newAlert = payload.new;
          if (newAlert.user_id === profile.id) return;
          if (newAlert.status !== 'active') return;

          // Fetch sender profile
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newAlert.user_id)
            .single();

          setActiveSOS({
            ...newAlert,
            profiles: profData
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_alerts', filter: `circle_id=eq.${activeCircle.id}` },
        (payload) => {
          if (payload.new.status === 'resolved' || payload.new.status === 'cancelled') {
            setActiveSOS(null);
            Vibration.cancel();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sosChannel);
    };
  }, [activeCircle?.id, profile?.id]);

  useEffect(() => {
    if (activeSOS) {
      // Trigger repeated emergency vibration pattern
      try {
        Vibration.vibrate([0, 500, 200, 500, 200, 500], true);
      } catch (e) {}

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        ])
      ).start();
    } else {
      try {
        Vibration.cancel();
      } catch (e) {}
    }
  }, [activeSOS]);

  const handleDismiss = () => {
    try {
      Vibration.cancel();
    } catch (e) {}
    setActiveSOS(null);
  };

  const handleCallSender = () => {
    const phone = activeSOS?.profiles?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  if (!activeSOS) return null;

  const senderMember = members.find(m => m.user_id === activeSOS.user_id);
  const senderName = activeSOS.profiles?.full_name || senderMember?.profile?.full_name || 'A Circle Member';
  const senderPhone = activeSOS.profiles?.phone || senderMember?.profile?.phone;

  return (
    <Modal visible={true} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.overline}>CRITICAL BROADCAST</Text>
          <Text style={styles.title}>EMERGENCY SOS DISTRESS</Text>
        </View>

        <View style={styles.centerBox}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.sosIconCircle}>
            <Ionicons name="alert-circle" size={72} color={LUXURY_THEME.colors.accentGold} />
          </View>
        </View>

        <View style={styles.alertContent}>
          <Text style={styles.senderName}>{senderName}</Text>
          <Text style={styles.alertDesc}>
            Has triggered an immediate emergency SOS distress signal! Their location is broadcasting live.
          </Text>

          <View style={styles.actionButtons}>
            {senderPhone ? (
              <TouchableOpacity style={styles.callButton} onPress={handleCallSender}>
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>CALL {senderName.split(' ')[0].toUpperCase()}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <Text style={styles.dismissText}>DISMISS ALARM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.foreground,
    padding: 28,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  overline: {
    color: LUXURY_THEME.colors.sosRed,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  centerBox: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.sosRed,
  },
  sosIconCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: LUXURY_THEME.colors.sosRed,
    borderWidth: 3,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  senderName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertDesc: {
    fontSize: 13,
    color: LUXURY_THEME.colors.surfaceMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  callButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  dismissButton: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
