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
  const { profile, session } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!visible) return null;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await stopBatteryOptimizedBackgroundLocation().catch(() => {});

      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch (e) {}

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
        <View style={styles.modalCard}>
          {/* Icon Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="log-out-outline" size={26} color="#E07A5F" />
          </View>

          {/* Typography */}
          <Text style={styles.title}>Log Out</Text>
          <Text style={styles.subtitle}>
            Are you sure you want to log out? You will need to sign back in to access your circle and live safety radar.
          </Text>

          {/* User Capsule */}
          <View style={styles.userCapsule}>
            <Ionicons name="person-circle" size={24} color="#2E7D5B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
              {displayEmail ? (
                <Text style={styles.userEmail} numberOfLines={1}>
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
                <Text style={styles.logoutBtnText}>LOG OUT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loggingOut}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#1F2A24',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2A24',
    marginBottom: 6,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#5C665F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  userCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    marginBottom: 18,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  userEmail: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  buttonCol: {
    width: '100%',
    gap: 8,
  },
  logoutBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E07A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  cancelBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
