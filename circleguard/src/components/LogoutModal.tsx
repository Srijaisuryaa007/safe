import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { stopBatteryOptimizedBackgroundLocation } from '../services/LocationBackgroundService';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogoutModal({ visible, onClose }: LogoutModalProps) {
  const { colors, isDark } = useThemeStore();
  const { profile, session } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!visible) return null;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      // 1. Stop background tracking and cleanse in-memory coordinates
      await stopBatteryOptimizedBackgroundLocation().catch(() => {});

      // 2. Google OAuth signout
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch (e) {}

      // 3. Supabase Auth signout
      await supabase.auth.signOut();

      // 4. Cleanse stores and user state
      useAuthStore.getState().resetAuthStore();
      useCircleStore.getState().resetCircleStore();
      useThemeStore.getState().resetThemeToDefault();

      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.full_name || 'Your Account';
  const displayEmail = session?.user?.email || profile?.phone || '';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
            },
          ]}
        >
          {/* Minimalist Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
            <Ionicons name="log-out-outline" size={26} color="#EF4444" />
          </View>

          {/* Clean Typography */}
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            Log Out
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Are you sure you want to log out? You'll need to sign back in to access your circle and live safety features.
          </Text>

          {/* User Capsule */}
          <View style={[styles.userCapsule, { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6' }]}>
            <Ionicons name="person-circle" size={22} color={isDark ? '#D4AF37' : '#D97706'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#111827' }]} numberOfLines={1}>
                {displayName}
              </Text>
              {displayEmail ? (
                <Text style={[styles.userEmail, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                  {displayEmail}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonCol}>
            <TouchableOpacity
              style={[styles.logoutBtn, loggingOut && { opacity: 0.7 }]}
              onPress={handleConfirmLogout}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.logoutBtnText}>Log Out</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6',
                },
              ]}
              onPress={onClose}
              disabled={loggingOut}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#374151' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  userCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 18,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  buttonCol: {
    width: '100%',
    gap: 8,
  },
  logoutBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
