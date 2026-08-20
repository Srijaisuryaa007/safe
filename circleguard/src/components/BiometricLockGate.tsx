import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, AppStateStatus, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

const APP_LOCK_KEY = '@circleguard_app_lock';

interface BiometricLockGateProps {
  children: React.ReactNode;
}

export default function BiometricLockGate({ children }: BiometricLockGateProps) {
  const { colors } = useThemeStore();
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasUnlockedSession = useRef(false);

  const checkAndPromptLock = async () => {
    if (hasUnlockedSession.current) {
      setIsLocked(false);
      return;
    }

    try {
      const lockEnabled = await AsyncStorage.getItem(APP_LOCK_KEY);
      if (lockEnabled === 'true') {
        setIsLocked(true);
        authenticate();
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('[BiometricLock] Check error:', e);
    }
  };

  const authenticate = async () => {
    if (Platform.OS === 'web') {
      setIsLocked(false);
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Fallback: If device doesn't have biometric hardware enrolled, allow unlock
        hasUnlockedSession.current = true;
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CircleGuard Security',
        fallbackLabel: 'Use Device PIN / Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        hasUnlockedSession.current = true;
        setIsLocked(false);
        setAuthError(null);
      } else {
        setAuthError(result.error === 'user_cancel' ? 'Authentication cancelled' : 'Authentication failed. Tap unlock to retry.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric authentication unavailable');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    // Initial launch check only (Cold Start / Fresh App Open)
    checkAndPromptLock();
  }, []);

  if (isLocked) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: colors.background }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Animated Gold Security Shield */}
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: colors.accentGold }]}>
            <Ionicons name="finger-print-outline" size={48} color={colors.accentGold} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>CIRCLEGUARD SECURE</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Biometric Authentication & App Lock is active on this device.
          </Text>

          {authError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.unlockBtn, { backgroundColor: colors.accentGold }]}
            onPress={authenticate}
            activeOpacity={0.8}
            disabled={isAuthenticating}
          >
            <Ionicons name="lock-open-outline" size={20} color="#1A1A1A" />
            <Text style={styles.unlockBtnText}>
              {isAuthenticating ? 'AUTHENTICATING...' : 'UNLOCK WITH BIOMETRICS'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  lockScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  unlockBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  unlockBtnText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
