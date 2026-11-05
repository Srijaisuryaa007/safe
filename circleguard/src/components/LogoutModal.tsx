import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { stopBatteryOptimizedBackgroundLocation } from '../services/LocationBackgroundService';

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogoutModal({ visible, onClose }: LogoutModalProps) {
  const { isDark } = useThemeStore();
  const { profile, session } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!visible) return null;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await stopBatteryOptimizedBackgroundLocation().catch(() => {});

      const { safeGoogleSignOut } = require('../lib/googleAuthHelper');
      await safeGoogleSignOut();

      await supabase.auth.signOut();

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
              backgroundColor: isDark ? '#11141A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            },
          ]}
        >
          {/* Icon Squircle Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : '#FECACA',
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={24} color="#DC2626" />
          </View>

          {/* Typography */}
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Log Out</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Are you sure you want to log out? You will need to sign back in to access your circle and live safety radar.
          </Text>

          {/* User Capsule */}
          <View
            style={[
              styles.userCapsule,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons name="person-circle" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                {displayName}
              </Text>
              {displayEmail ? (
                <Text style={[styles.userEmail, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
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
              activeOpacity={0.84}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.logoutBtnText}>LOG OUT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
              onPress={onClose}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>CANCEL</Text>
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
    backgroundColor: 'rgba(5, 7, 10, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1.2,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  userCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  userEmail: {
    fontSize: 11.5,
    marginTop: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  buttonCol: {
    width: '100%',
    gap: 9,
  },
  logoutBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1.0,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  cancelBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
