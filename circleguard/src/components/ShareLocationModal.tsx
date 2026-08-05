import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { sendInstantLocationPing } from '../services/LocationBackgroundService';
import { supabase } from '../lib/supabase';

interface ShareLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ShareLocationModal({ visible, onClose, onSuccess }: ShareLocationModalProps) {
  const { colors } = useThemeStore();
  const { profile } = useAuthStore();
  const { members, activeCircle } = useCircleStore();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null); // null = ALL MEMBERS
  const [sharing, setSharing] = useState(false);

  const circleMembers = (members || []).filter(m => m.user_id !== profile?.id);

  const handleExecuteShare = async () => {
    setSharing(true);
    try {
      // 1. Force instant high-accuracy GPS update
      await sendInstantLocationPing();

      // 2. Insert into location_shares table for guaranteed 0ms Postgres Realtime trigger across devices
      if (activeCircle?.id && profile?.id) {
        await supabase.from('location_shares').insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          target_user_id: selectedTargetId || null,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error sharing targeted location:', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={styles.titleBox}>
              <Ionicons name="location-sharp" size={22} color={colors.accentGold} />
              <Text style={[styles.title, { color: colors.foreground }]}>Share Live Location</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select who should receive your live position details on their main map:
          </Text>

          <ScrollView style={{ maxHeight: 240, marginVertical: 12 }}>
            {/* Target 1: All Members */}
            <TouchableOpacity
              style={[
                styles.targetCard,
                {
                  backgroundColor: colors.background,
                  borderColor: selectedTargetId === null ? colors.accentGold : colors.border,
                }
              ]}
              onPress={() => setSelectedTargetId(null)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                <Ionicons name="people" size={20} color={colors.accentGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.targetName, { color: colors.foreground }]}>ALL CIRCLE MEMBERS</Text>
                <Text style={[styles.targetSub, { color: colors.textMuted }]}>Broadcast to everyone in {activeCircle?.name || 'circle'}</Text>
              </View>
              {selectedTargetId === null ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accentGold} />
              ) : null}
            </TouchableOpacity>

            {/* Target 2: Individual Specific Members */}
            {circleMembers.map(m => {
              const isSelected = selectedTargetId === m.user_id;
              const avatar = m.profile?.avatar_url;
              const initial = String(m.profile?.full_name || 'M').charAt(0).toUpperCase();

              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[
                    styles.targetCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: isSelected ? colors.accentGold : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedTargetId(m.user_id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatarBox, { borderColor: colors.border }]}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.foreground }]}>{initial}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.targetName, { color: colors.foreground }]}>{m.profile?.full_name || 'Member'}</Text>
                    <Text style={[styles.targetSub, { color: colors.textMuted }]}>Private 1-on-1 map location sharing</Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accentGold} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.accentGold }]}
            onPress={handleExecuteShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#1A1A1A" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#1A1A1A" />
                <Text style={styles.shareBtnText}>SHARE LIVE POSITION DETAILS</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  targetName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  targetSub: {
    fontSize: 11,
    marginTop: 2,
  },
  shareBtn: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  shareBtnText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
