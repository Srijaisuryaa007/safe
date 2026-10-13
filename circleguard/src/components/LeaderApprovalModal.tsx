import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SANS_FONT = Platform.OS === 'web' ? 'Inter, -apple-system, sans-serif' : undefined;

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
  const { isDark } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, circles, members, myRoleByCircle } = useCircleStore();
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Smooth entrance animation
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRequestSent(false);
      scaleAnim.setValue(0.92);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const featureName =
    requestedFeature === 'ghost_mode'
      ? 'Ghost Privacy Mode'
      : requestedFeature === 'hide_online'
      ? 'Hide Online Presence'
      : 'Disable GPS Location';

  const myId = profile?.id || useAuthStore.getState().user?.id;
  // If activeCircle is a circle where the user is NOT owner, use activeCircle.
  // Otherwise, if user is in any circle where role is 'member', target that circle's leader!
  const targetCircle = (activeCircle && activeCircle.owner_id !== myId)
    ? activeCircle
    : (circles.find((c: any) => (myRoleByCircle?.[c.id] === 'member' || c.my_role === 'member' || (c.owner_id && c.owner_id !== myId))) || activeCircle);

  const leaderMember = members.find(
    (m) => m.role === 'owner' || m.user_id === targetCircle?.owner_id
  );
  const leaderName = leaderMember?.profile?.full_name || 'Circle Leader';

  const handleRequestApproval = async () => {
    const circleToUse = targetCircle || activeCircle;
    if (!profile || !circleToUse) return;

    setSending(true);
    try {
      const leaderId = circleToUse.owner_id;
      const memberName = profile.full_name || 'Circle Member';

      // 1. Dispatch push notification to Leader
      if (leaderId) {
        await sendExpoPushNotification(
          leaderId,
          'Member Permission Request',
          `${memberName} is requesting approval to enable ${featureName} under Option B 24/7 Safety Mode.`,
          { type: 'privacy_request', circle_id: circleToUse.id, member_id: profile.id }
        );
      }

      // 2. Insert into circle messages so the request is logged in circle chat
      await supabase.from('circle_messages').insert({
        circle_id: circleToUse.id,
        sender_id: profile.id,
        content: `PERMISSION REQUEST [target:${profile.id}]: Requesting Circle Leader authorization to enable ${featureName}.`,
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

  useEffect(() => {
    if (!visible || !requestSent || !profile?.id) return;

    const channel = supabase
      .channel(`modal_privacy_status_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'circle_messages' },
        (payload) => {
          const content = payload.new?.content || '';
          const isTarget =
            content.includes(`[target:${profile.id}]`) ||
            (profile.full_name && content.includes(profile.full_name));

          if (!isTarget) return;

          if (content.startsWith('PERMISSION AUTHORIZED') || content.startsWith('PERMISSION GRANTED')) {
            const isGhost = content.toLowerCase().includes('ghost');
            const isOnline = content.toLowerCase().includes('online');
            const updateField: any = {};
            if (isGhost) updateField.is_ghost_mode = true;
            if (isOnline) updateField.hide_online_presence = true;

            supabase.from('profiles').update(updateField).eq('id', profile.id).then(() => {}, () => {});
            useAuthStore.getState().setProfile({
              ...useAuthStore.getState().profile!,
              ...updateField,
            });
            if (isGhost) AsyncStorage.setItem('@circleguard_ghost_mode', 'true').catch(() => {});
            if (isOnline) AsyncStorage.setItem('@circleguard_hide_online', 'true').catch(() => {});
            onClose();
          } else if (content.startsWith('PERMISSION DECLINED') || content.startsWith('PERMISSION DENIED')) {
            onClose();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, requestSent, profile?.id, profile?.full_name, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? '#141A17' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#ECEAE4',
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header Row: Icon Squircle + Title + Close Button */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconSquircle,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7' },
              ]}
            >
              <Ionicons name="shield-half" size={24} color="#D97706" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.categoryTag}>• PROTOCOL GOVERNANCE</Text>
              <Text
                style={[styles.title, { color: isDark ? '#FFFFFF' : '#1F2A24' }]}
                numberOfLines={1}
              >
                Leader Approval Required
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeCircleBtn,
                { backgroundColor: isDark ? '#233029' : '#F0EFEA' },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={17} color={isDark ? '#D8E2DC' : '#5C665F'} />
            </TouchableOpacity>
          </View>

          {/* Protocol Badge Pill */}
          <View
            style={[
              styles.protocolPill,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A',
              },
            ]}
          >
            <View style={styles.pulseDot} />
            <Text style={styles.protocolText}>OPTION B • CONTINUOUS 24/7 SAFETY MODE</Text>
          </View>

          {/* Structured Message & Policy Context Box */}
          <View
            style={[
              styles.messageBox,
              {
                backgroundColor: isDark ? '#0F1411' : '#F7F6F2',
                borderColor: isDark ? '#233029' : '#EDEBE6',
              },
            ]}
          >
            <Text style={[styles.messageText, { color: isDark ? '#CAD5CE' : '#4E5F55' }]}>
              Your Circle Leader has activated continuous family protection. Enabling{' '}
              <Text style={{ color: isDark ? '#FBBF24' : '#D97706', fontWeight: '700' }}>
                {featureName}
              </Text>{' '}
              requires explicit authorization from your Circle Leader.
            </Text>

            {/* Structured Metadata Row */}
            <View
              style={[
                styles.metaDivider,
                { backgroundColor: isDark ? '#1C2621' : '#E8E6DE' },
              ]}
            />
            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: isDark ? '#7E8B83' : '#8C9790' }]}>
                  CIRCLE
                </Text>
                <Text
                  style={[styles.metaValue, { color: isDark ? '#FFFFFF' : '#1F2A24' }]}
                  numberOfLines={1}
                >
                  {activeCircle?.name || 'Active Circle'}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: isDark ? '#7E8B83' : '#8C9790' }]}>
                  GOVERNED BY
                </Text>
                <Text
                  style={[styles.metaValue, { color: isDark ? '#FFFFFF' : '#1F2A24' }]}
                  numberOfLines={1}
                >
                  {leaderName}
                </Text>
              </View>
            </View>
          </View>

          {/* Success Dispatched Notification Card */}
          {requestSent ? (
            <View
              style={[
                styles.sentBox,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
                },
              ]}
            >
              <View
                style={[
                  styles.sentIconCircle,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' },
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sentTitle, { color: isDark ? '#34D399' : '#059669' }]}>
                  Request Dispatched to Leader
                </Text>
                <Text style={[styles.sentDesc, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                  {leaderName} has been notified via priority push notification and circle safety feed.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          {sending ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={[styles.loaderText, { color: isDark ? '#CAD5CE' : '#4E5F55' }]}>
                Transmitting authorization request...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              {!requestSent ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: isDark ? '#1C2621' : '#F0EFEA',
                        borderColor: isDark ? '#2D3D35' : '#E2E0D8',
                      },
                    ]}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.secondaryActionBtnText,
                        { color: isDark ? '#D8E2DC' : '#5C665F' },
                      ]}
                    >
                      Maintain Safety
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]}
                    onPress={handleRequestApproval}
                    activeOpacity={0.84}
                  >
                    <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Request Approval</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: '#10B981' }]}
                  onPress={onClose}
                  activeOpacity={0.84}
                >
                  <Text style={styles.doneBtnText}>Understood</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 12, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconSquircle: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  categoryTag: {
    fontFamily: SANS_FONT,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#D97706',
    marginBottom: 2,
  },
  title: {
    fontFamily: SANS_FONT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  protocolText: {
    fontFamily: SANS_FONT,
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  messageBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  messageText: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19.5,
  },
  metaDivider: {
    height: 1,
    width: '100%',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: SANS_FONT,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: SANS_FONT,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  sentIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: {
    fontFamily: SANS_FONT,
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  sentDesc: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  loaderBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryActionBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  doneBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 3,
  },
  doneBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
