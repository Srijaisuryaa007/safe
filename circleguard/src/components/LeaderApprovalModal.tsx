import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { supabase } from '../lib/supabase';

interface LeaderApprovalModalProps {
  visible: boolean;
  onClose: () => void;
  requestedFeature: 'ghost_mode' | 'hide_online' | 'location_off';
}

export default function LeaderApprovalModal({
  visible,
  onClose,
  requestedFeature,
}: LeaderApprovalModalProps) {
  const { colors } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  if (!visible) return null;

  const featureName =
    requestedFeature === 'ghost_mode'
      ? 'Ghost Privacy Mode'
      : requestedFeature === 'hide_online'
      ? 'Hide Online Presence'
      : 'Disable GPS Location';

  const handleRequestApproval = async () => {
    if (!profile || !activeCircle) return;

    setSending(true);
    try {
      const leaderId = activeCircle.owner_id;
      const memberName = profile.full_name || 'Circle Member';

      // 1. Dispatch push notification to Leader
      if (leaderId) {
        await sendExpoPushNotification(
          leaderId,
          '👑 Member Permission Request',
          `${memberName} is requesting approval to enable ${featureName} under Option B 24/7 Safety Mode.`,
          { type: 'privacy_request', circle_id: activeCircle.id, member_id: profile.id }
        );
      }

      // 2. Insert into circle messages so the request is logged in circle chat
      await supabase.from('circle_messages').insert({
        circle_id: activeCircle.id,
        sender_id: profile.id,
        content: `🔒 PERMISSION REQUEST: Requesting Circle Leader authorization to enable ${featureName}.`,
      });

      setRequestSent(true);
    } catch (err: any) {
      console.warn('Error sending approval request:', err);
      Alert.alert('Notice', 'Approval request logged in Circle Feed.');
      setRequestSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: '#F59E0B' }]}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="shield-half" size={32} color="#F59E0B" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>Circle Leader Approval Required</Text>

          {/* Protocol Badge */}
          <View style={styles.protocolPill}>
            <Ionicons name="radio-sharp" size={12} color="#F59E0B" />
            <Text style={styles.protocolText}>OPTION B: CONTINUOUS 24/7 SAFETY MODE</Text>
          </View>

          {/* Subtitle / Policy */}
          <Text style={[styles.message, { color: colors.textMuted }]}>
            Your Circle Leader has enabled Option B (Continuous 24/7 Safety Mode). Turning on{' '}
            <Text style={{ color: colors.accentGold, fontWeight: 'bold' }}>{featureName}</Text> requires explicit permission from your Circle Leader.
          </Text>

          {requestSent ? (
            <View style={[styles.sentBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sentTitle}>Request Dispatched 📩</Text>
                <Text style={styles.sentDesc}>
                  Your request to activate {featureName} has been sent to your Circle Leader. You will be notified once authorized.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          {sending ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color={colors.accentGold} />
              <Text style={[styles.loaderText, { color: colors.textMuted }]}>Sending request to Circle Leader...</Text>
            </View>
          ) : (
            <View style={styles.buttonCol}>
              {!requestSent ? (
                <TouchableOpacity
                  style={[styles.requestBtn, { backgroundColor: colors.accentGold }]}
                  onPress={handleRequestApproval}
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane-outline" size={18} color="#1A1A1A" />
                  <Text style={styles.requestBtnText}>REQUEST LEADER APPROVAL 📩</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
                  {requestSent ? 'CLOSE' : 'CANCEL & MAINTAIN SAFETY'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  protocolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 14,
  },
  protocolText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  sentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  sentTitle: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  sentDesc: {
    color: '#D1D5DB',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 14,
  },
  loaderBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  buttonCol: {
    width: '100%',
    gap: 10,
  },
  requestBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
  },
  requestBtnText: {
    color: '#1A1A1A',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
