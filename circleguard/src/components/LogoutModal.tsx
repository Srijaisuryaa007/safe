import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import JellySqueezeButton from './JellySqueezeButton';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogoutModal({
  visible,
  onClose,
}: LogoutModalProps) {
  const { colors, isDark } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!visible) return null;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch (e) {}

      await supabase.auth.signOut();
      useAuthStore.getState().setSession(null);
      useAuthStore.getState().setProfile(null);
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.full_name || 'CircleGuard User';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
            },
          ]}
        >
          {/* Glowing Crimson Top Stripe */}
          <View style={styles.topAccentStripe} />

          {/* Crimson Icon Emblem */}
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Ionicons name="power" size={30} color="#EF4444" />
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: colors.foreground }]}>Disconnect Session?</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Logging out will sign you out of your encrypted profile and temporarily pause live location sharing for <Text style={{ color: colors.foreground, fontWeight: '700' }}>{displayName}</Text>.
          </Text>

          {/* Active Session Info Box */}
          <View style={[styles.sessionBox, { backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border }]}>
            <View style={styles.sessionRow}>
              <Ionicons name="person-circle-outline" size={18} color={colors.accentGold} />
              <Text style={[styles.sessionText, { color: colors.foreground }]} numberOfLines={1}>
                User: {displayName}
              </Text>
            </View>

            {activeCircle ? (
              <View style={styles.sessionRow}>
                <Ionicons name="people-outline" size={18} color="#10B981" />
                <Text style={[styles.sessionText, { color: colors.textMuted }]} numberOfLines={1}>
                  Circle: {activeCircle.name}
                </Text>
              </View>
            ) : null}

            <View style={styles.sessionRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#A855F7" />
              <Text style={[styles.sessionText, { color: colors.textMuted }]}>
                AES-256 Encrypted Session Storage
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {loggingOut ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#EF4444" />
              <Text style={[styles.loaderText, { color: colors.textMuted }]}>Disconnecting active session...</Text>
            </View>
          ) : (
            <View style={styles.buttonCol}>
              <JellySqueezeButton
                glowColor="#EF4444"
                style={styles.confirmJellyBtn}
                onPress={handleConfirmLogout}
              >
                <Ionicons name="power" size={18} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>LOGOUT OF ACCOUNT</Text>
              </JellySqueezeButton>

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9', borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>CANCEL & REMAIN SIGNED IN</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  topAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#EF4444',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  sessionBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
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
  confirmJellyBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#EF4444',
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
