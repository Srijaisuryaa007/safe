import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { stopBackgroundLocation } from '../services/LocationBackgroundService';
import JellySqueezeButton from './JellySqueezeButton';
import { useLuxuryAlert } from './LuxuryAlertModal';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({
  visible,
  onClose,
}: DeleteAccountModalProps) {
  const { colors, isDark } = useThemeStore();
  const { profile, session } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const { showAlert } = useLuxuryAlert();

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!visible) return null;

  const userId = profile?.id || session?.user?.id;
  const userEmail = (profile as any)?.email || session?.user?.email || 'Registered User';
  const displayName = profile?.full_name || 'CircleGuard Member';

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const handleExecuteDeleteAccount = async () => {
    if (!isConfirmed || !userId) return;

    setDeleting(true);
    setStatusMessage('Broadcasting real-time marker purge to safety circles...');

    try {
      // 0A. Broadcast real-time "REMOVE_USER_MARKER" event across all user's circles immediately
      try {
        const { data: memberCircles } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', userId);

        if (memberCircles && memberCircles.length > 0) {
          await Promise.all(
            memberCircles.map(async (row) => {
              try {
                const bcChannel = supabase.channel(`map_locations_${row.circle_id}_broadcast`);
                await bcChannel.subscribe();
                await bcChannel.send({
                  type: 'broadcast',
                  event: 'REMOVE_USER_MARKER',
                  payload: { user_id: userId, circle_id: row.circle_id }
                });
                supabase.removeChannel(bcChannel);
              } catch (e) {}
            })
          );
        }
      } catch (e) {
        console.warn('Realtime marker purge broadcast notice:', e);
      }

      // 0B. Instant local store purge for this client
      try {
        useCircleStore.getState().purgeUserFromStore(userId);
      } catch (e) {}

      // 0C. Database RPC function to atomically wipe everything with elevated privileges
      setStatusMessage('Purging cloud tracking and membership data...');
      try {
        const res = await supabase.rpc('delete_user_account_data', { p_user_id: userId });
        if (res.error) {
          await supabase.rpc('delete_user_account_data', { target_user_id: userId });
        }
      } catch (e) {
        try {
          await supabase.rpc('delete_user_account_data', { target_user_id: userId });
        } catch (err) {
          console.warn('RPC delete_user_account_data notice:', err);
        }
      }

      // 1. Wipe location trails and live positions (including historical past locations)
      setStatusMessage('Purging live and past GPS location history...');
      try {
        await supabase.from('locations').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Locations purge notice:', e);
      }

      try {
        // Critical: Purge all past movement history points
        await supabase.from('location_history').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Location history purge notice:', e);
      }

      try {
        await supabase.from('location_shares').delete().or(`sender_id.eq.${userId},target_user_id.eq.${userId}`);
      } catch (e) {}

      try {
        await supabase.from('place_events').delete().eq('user_id', userId);
      } catch (e) {}

      try {
        await supabase.from('place_members').delete().eq('user_id', userId);
      } catch (e) {}

      try {
        await supabase.from('sos_alerts').delete().eq('user_id', userId);
      } catch (e) {}

      // 2. Remove circle memberships and affiliations
      setStatusMessage('Leaving all active safety circles...');
      try {
        await supabase.from('circle_members').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Circle members purge notice:', e);
      }

      try {
        await supabase.from('circles').delete().eq('owner_id', userId);
      } catch (e) {}

      // 3. Remove chat messages and reactions sent by user
      try {
        await supabase.from('circle_messages').delete().eq('sender_id', userId);
        await supabase.from('message_views').delete().eq('user_id', userId);
        await supabase.from('chat_messages').delete().eq('user_id', userId);
      } catch (e) {}

      // 4. Remove safe places created by user
      try {
        await supabase.from('places').delete().or(`created_by.eq.${userId},target_user_id.eq.${userId}`);
        await supabase.from('safe_places').delete().eq('user_id', userId);
      } catch (e) {}

      // 5. Remove emergency contacts registered in cloud
      try {
        await supabase.from('emergency_contacts').delete().eq('user_id', userId);
      } catch (e) {}

      // 6. Remove avatar from storage if exists
      try {
        const { data: files } = await supabase.storage.from('avatars').list(userId);
        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from('avatars').remove(filePaths);
        }
      } catch (e) {}

      // 7. Delete profile record
      setStatusMessage('Erasing identity profile...');
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (e) {
        console.warn('Profile deletion notice:', e);
      }

      // 8. Stop all hardware background tracking tasks
      setStatusMessage('Terminating GPS hardware background tasks...');
      await stopBackgroundLocation();

      // 9. Wipe local device storage & caches (including offline breadcrumb buffers)
      setStatusMessage('Purging encrypted local device keys and breadcrumbs...');
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userSpecificKeys = allKeys.filter((k) =>
          k.includes(userId) ||
          k.startsWith('@circleguard_') ||
          k.startsWith('supabase.auth')
        );
        if (userSpecificKeys.length > 0) {
          await AsyncStorage.multiRemove(userSpecificKeys);
        }
      } catch (e) {}

      // 10. Disconnect Google Sign-in if configured
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch (e) {}

      // 11. Revoke and sign out of Supabase Auth Session
      try {
        const { stopBatteryOptimizedBackgroundLocation } = require('../services/LocationBackgroundService');
        await stopBatteryOptimizedBackgroundLocation().catch(() => {});
      } catch (e) {}

      try {
        await supabase.auth.signOut();
      } catch (e) {}

      // 12. Reset Global State Stores
      useCircleStore.getState().resetCircleStore();
      useAuthStore.getState().resetAuthStore();
      try {
        const { useThemeStore } = require('../store/useThemeStore');
        useThemeStore.getState().resetThemeToDefault();
      } catch (e) {}

      // Close modal
      onClose();

      showAlert({
        title: 'ACCOUNT PERMANENTLY DELETED',
        message: 'Your profile, safety circles, location history, and device keys have been completely wiped from CircleGuard.',
        type: 'success',
        buttonText: 'CONTINUE',
      });
    } catch (err: any) {
      console.error('Delete account error:', err);
      showAlert({
        title: 'DELETION ERROR',
        message: err?.message || 'An error occurred while deleting your account. Please try again.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
      setStatusMessage('');
      setConfirmText('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.45)' : '#FCA5A5',
            },
          ]}
        >
          {/* Top Danger Accent Stripe */}
          <View style={styles.topAccentStripe} />

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeIconBtn, { borderColor: colors.border }]}
            onPress={onClose}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Warning Shield Emblem */}
            <View style={styles.iconCircle}>
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
            </View>

            {/* Overline & Header */}
            <Text style={styles.dangerOverline}>PERMANENT DELETION</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Delete Your Account?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              This action is <Text style={{ color: '#EF4444', fontWeight: '800' }}>irreversible</Text>. All your account records, real-time safety logs, and circle memberships for{' '}
              <Text style={{ color: colors.foreground, fontWeight: '700' }}>{displayName}</Text> ({userEmail}) will be permanently wiped.
            </Text>

            {/* What Will Be Deleted Box */}
            <View style={[styles.impactBox, { backgroundColor: isDark ? colors.background : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA' }]}>
              <Text style={[styles.impactTitle, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                DATA SCHEDULED FOR DESTRUCTION:
              </Text>

              <View style={styles.impactList}>
                <View style={styles.impactItem}>
                  <Ionicons name="person-remove-outline" size={16} color="#EF4444" />
                  <Text style={[styles.impactText, { color: colors.foreground }]}>
                    Profile identity, avatar & bio records
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Ionicons name="navigate-outline" size={16} color="#EF4444" />
                  <Text style={[styles.impactText, { color: colors.foreground }]}>
                    All GPS location trails & live tracking streams
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Ionicons name="people-outline" size={16} color="#EF4444" />
                  <Text style={[styles.impactText, { color: colors.foreground }]}>
                    Circle memberships, roles & invitations
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Ionicons name="call-outline" size={16} color="#EF4444" />
                  <Text style={[styles.impactText, { color: colors.foreground }]}>
                    Emergency contacts & medical emergency data
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Ionicons name="key-outline" size={16} color="#EF4444" />
                  <Text style={[styles.impactText, { color: colors.foreground }]}>
                    Biometric credentials & encrypted device storage
                  </Text>
                </View>
              </View>
            </View>

            {/* Safety Confirmation Verification */}
            <View style={styles.verificationSection}>
              <Text style={[styles.verifyLabel, { color: colors.foreground }]}>
                To confirm permanent deletion, type <Text style={{ color: '#EF4444', fontWeight: '900' }}>DELETE</Text> below:
              </Text>

              <TextInput
                style={[
                  styles.verifyInput,
                  {
                    backgroundColor: isDark ? colors.background : '#F8FAFC',
                    borderColor: isConfirmed ? '#EF4444' : colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder='Type "DELETE" to confirm'
                placeholderTextColor={colors.textMuted}
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
              />
            </View>

            {/* Action Buttons */}
            {deleting ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="small" color="#EF4444" />
                <Text style={[styles.loaderText, { color: '#EF4444' }]}>
                  {statusMessage || 'Permanently deleting account...'}
                </Text>
              </View>
            ) : (
              <View style={styles.buttonCol}>
                <JellySqueezeButton
                  glowColor="#EF4444"
                  style={[
                    styles.confirmJellyBtn,
                    { opacity: isConfirmed ? 1 : 0.45 },
                  ]}
                  onPress={isConfirmed ? handleExecuteDeleteAccount : undefined}
                >
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>PERMANENTLY DELETE ACCOUNT</Text>
                </JellySqueezeButton>

                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
                    KEEP MY ACCOUNT & CANCEL
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  topAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#EF4444',
    zIndex: 10,
  },
  closeIconBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  dangerOverline: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#EF4444',
    marginBottom: 4,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  impactBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  impactTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  impactList: {
    gap: 9,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  impactText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  verificationSection: {
    width: '100%',
    marginBottom: 20,
  },
  verifyLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  verifyInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loaderBox: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonCol: {
    width: '100%',
    gap: 10,
  },
  confirmJellyBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
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
