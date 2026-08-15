import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogoutModal({
  visible,
  onClose,
}: LogoutModalProps) {
  const { colors } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!visible) return null;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.full_name || 'CircleGuard User';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: '#EF4444' }]}>
          {/* Crimson Icon Emblem */}
          <View style={styles.iconCircle}>
            <Ionicons name="log-out" size={32} color="#EF4444" />
          </View>

          {/* Title & Subtitle */}
          <Text style={[styles.title, { color: colors.foreground }]}>Disconnect Session?</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Logging out will temporarily pause live GPS circle tracking for {displayName}.
          </Text>

          {/* Active Session Info Box */}
          <View style={[styles.sessionBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.sessionRow}>
              <Ionicons name="person-circle-outline" size={18} color={colors.accentGold} />
              <Text style={[styles.sessionText, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
              </Text>
            </View>

            {activeCircle ? (
              <View style={styles.sessionRow}>
                <Ionicons name="people-outline" size={18} color="#10B981" />
                <Text style={[styles.sessionText, { color: colors.textMuted }]} numberOfLines={1}>
                  Active Circle: {activeCircle.name}
                </Text>
              </View>
            ) : null}

            <View style={styles.sessionRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#A855F7" />
              <Text style={[styles.sessionText, { color: colors.textMuted }]}>
                AES-256 Encrypted Session Vault
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {loggingOut ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#EF4444" />
              <Text style={[styles.loaderText, { color: colors.textMuted }]}>Disconnecting session...</Text>
            </View>
          ) : (
            <View style={styles.buttonCol}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="power-outline" size={18} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>LOGOUT OF CIRCLEGUARD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 350,
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  sessionBox: {
    width: '100%',
    borderRadius: 14,
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
    fontWeight: '700',
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
  confirmBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
