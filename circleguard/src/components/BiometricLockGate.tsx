import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  AppState,
  AppStateStatus,
  Easing,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

const APP_LOCK_KEY = '@circleguard_app_lock';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BiometricMode = 'face_id' | 'touch_id' | 'fingerprint' | 'biometric';

interface BiometricLockGateProps {
  children: React.ReactNode;
}

export default function BiometricLockGate({ children }: BiometricLockGateProps) {
  const { colors, isDark } = useThemeStore();
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [biometricMode, setBiometricMode] = useState<BiometricMode>('biometric');
  const hasUnlockedSession = useRef(false);
  const lastBackgroundedAt = useRef<number>(0);

  // Smooth breathing pulse animation for the biometric hub
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const errorShakeAnim = useRef(new Animated.Value(0)).current;

  // Detect exact platform & hardware capabilities
  useEffect(() => {
    (async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

        if (Platform.OS === 'ios') {
          if (hasFace) {
            setBiometricMode('face_id');
          } else if (hasFingerprint) {
            setBiometricMode('touch_id');
          } else {
            setBiometricMode('biometric');
          }
        } else {
          // Android: Devices often report both camera face unlock and fingerprint
          if (hasFingerprint && hasFace) {
            setBiometricMode('biometric');
          } else if (hasFingerprint) {
            setBiometricMode('fingerprint');
          } else if (hasFace) {
            setBiometricMode('face_id');
          } else {
            setBiometricMode('biometric');
          }
        }
      } catch (err) {
        console.warn('[BiometricLock] Detection error:', err);
      }
    })();

    // Organic breathing glow animation loop
    const breathingLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.05,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 2000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    breathingLoop.start();

    if (typeof window !== 'undefined') {
      (window as any).__triggerBiometricLock = async (mode?: BiometricMode) => {
        try {
          await AsyncStorage.setItem(APP_LOCK_KEY, 'true');
        } catch (_) {}
        if (mode) setBiometricMode(mode);
        hasUnlockedSession.current = false;
        setIsLocked(true);
      };
    }

    return () => breathingLoop.stop();
  }, []);

  const triggerErrorShake = () => {
    Animated.sequence([
      Animated.timing(errorShakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const authenticate = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsAuthenticating(true);
      setTimeout(() => {
        hasUnlockedSession.current = true;
        setIsLocked(false);
        setIsAuthenticating(false);
      }, 500);
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        hasUnlockedSession.current = true;
        setIsLocked(false);
        return;
      }

      const isIOS = Platform.OS === 'ios';
      const promptLabel =
        biometricMode === 'face_id' && isIOS
          ? 'Confirm Face ID to unlock CircleGuard'
          : biometricMode === 'touch_id'
          ? 'Touch sensor to unlock CircleGuard'
          : 'Unlock CircleGuard';

      const promptDesc =
        biometricMode === 'biometric'
          ? 'Touch the fingerprint sensor or look at the screen'
          : biometricMode === 'fingerprint'
          ? 'Touch the fingerprint sensor'
          : biometricMode === 'face_id'
          ? 'Look at the screen to verify'
          : 'Verify your identity to proceed';

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptLabel,
        promptSubtitle: 'Verify your identity to continue',
        promptDescription: promptDesc,
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        // Crucial for Android: 'weak' allows Class 2 camera face unlock in BiometricPrompt
        biometricsSecurityLevel: 'weak',
      });

      if (result.success) {
        hasUnlockedSession.current = true;
        setIsLocked(false);
        setAuthError(null);
      } else {
        if (result.error !== 'user_cancel') {
          triggerErrorShake();
          setAuthError('Authentication unsuccessful. Tap to retry.');
        }
      }
    } catch (err: any) {
      triggerErrorShake();
      setAuthError(err?.message || 'Biometric authentication unavailable');
    } finally {
      setIsAuthenticating(false);
    }
  }, [biometricMode]);

  const checkAndPromptLock = useCallback(async () => {
    if (hasUnlockedSession.current) {
      setIsLocked(false);
      return;
    }

    try {
      const lockEnabled = await AsyncStorage.getItem(APP_LOCK_KEY);
      if (lockEnabled === 'true') {
        setIsLocked(true);
        // Automatically prompt on mobile devices; on web keep lock screen visible until user interacts
        if (Platform.OS !== 'web') {
          authenticate();
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('[BiometricLock] Check error:', e);
    }
  }, [authenticate]);

  const handleDevicePasscodeFallback = async () => {
    if (Platform.OS === 'web') {
      hasUnlockedSession.current = true;
      setIsLocked(false);
      return;
    }
    try {
      setIsAuthenticating(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock with Device PIN or Passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        hasUnlockedSession.current = true;
        setIsLocked(false);
        setAuthError(null);
      }
    } catch (e: any) {
      setAuthError(e?.message || 'Passcode entry failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    checkAndPromptLock();
  }, []); // Run on mount only

  // AppState listener: re-lock when app returns from background after 30s
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        lastBackgroundedAt.current = Date.now();
      } else if (nextAppState === 'active') {
        const lockEnabled = await AsyncStorage.getItem(APP_LOCK_KEY);
        if (lockEnabled === 'true') {
          const elapsed = Date.now() - lastBackgroundedAt.current;
          // Re-lock if backgrounded for more than 15 seconds
          if (elapsed > 15000 && lastBackgroundedAt.current > 0) {
            hasUnlockedSession.current = false;
            setIsLocked(true);
            authenticate();
          }
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [authenticate]);

  if (isLocked) {
    const isFace = biometricMode === 'face_id';
    const isIOS = Platform.OS === 'ios';

    // Human-grade labels matching device conventions
    let primaryButtonLabel = 'Unlock with Biometrics';
    let subtitleText = 'Touch the fingerprint sensor or glance at the screen to unlock.';
    let iconName: any = 'finger-print-outline';

    if (isIOS) {
      if (isFace) {
        primaryButtonLabel = 'Unlock with Face ID';
        subtitleText = 'Use Face ID to confirm your identity.';
        iconName = 'scan-outline';
      } else {
        primaryButtonLabel = 'Unlock with Touch ID';
        subtitleText = 'Touch the sensor to verify your identity.';
        iconName = 'finger-print-outline';
      }
    } else {
      // Android
      if (biometricMode === 'fingerprint') {
        primaryButtonLabel = 'Unlock with Fingerprint';
        subtitleText = 'Touch the fingerprint sensor to unlock.';
        iconName = 'finger-print-outline';
      } else if (biometricMode === 'face_id') {
        primaryButtonLabel = 'Unlock with Face';
        subtitleText = 'Look at the screen to verify your identity.';
        iconName = 'scan-outline';
      } else {
        primaryButtonLabel = 'Unlock with Biometrics';
        subtitleText = 'Touch sensor or look at screen to unlock.';
        iconName = 'finger-print-outline';
      }
    }

    return (
      <View style={[styles.lockScreen, { backgroundColor: isDark ? '#0A0F0C' : '#F8FAF8' }]}>
        {/* Subtle Ambient Radial Lighting */}
        <View
          style={[
            styles.ambientAura,
            {
              backgroundColor: isDark ? 'rgba(46, 125, 91, 0.08)' : 'rgba(46, 125, 91, 0.05)',
            },
          ]}
        />

        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateX: errorShakeAnim }],
            },
          ]}
        >
          {/* Top Brand Anchor */}
          <View style={styles.brandRow}>
            <View style={[styles.brandIconBox, isDark && styles.brandIconBoxDark]}>
              <Ionicons name="shield-checkmark" size={14} color="#2E7D5B" />
            </View>
            <Text style={[styles.brandText, isDark && styles.brandTextDark]}>CIRCLEGUARD</Text>
          </View>

          {/* Central Hero Biometric Sensor */}
          <View style={styles.sensorArea}>
            {/* Soft Ambient Breathing Ring */}
            <Animated.View
              style={[
                styles.breathingHalo,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity,
                  borderColor: isDark ? '#3ADFAB' : '#2E7D5B',
                },
              ]}
            />

            {/* Inner Interactive Sensor Disc */}
            <TouchableOpacity
              style={[
                styles.sensorDisc,
                {
                  backgroundColor: isDark ? 'rgba(46, 125, 91, 0.16)' : 'rgba(46, 125, 91, 0.07)',
                  borderColor: isDark ? 'rgba(58, 223, 171, 0.28)' : 'rgba(46, 125, 91, 0.22)',
                },
              ]}
              onPress={authenticate}
              activeOpacity={0.8}
              disabled={isAuthenticating}
            >
              <Ionicons
                name={iconName}
                size={40}
                color={isDark ? '#3ADFAB' : '#2E7D5B'}
              />
            </TouchableOpacity>
          </View>

          {/* Title & Human-Friendly Subtitle */}
          <Text style={[styles.title, isDark && styles.titleDark]}>
            CircleGuard Locked
          </Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            {subtitleText}
          </Text>

          {/* Error Notice (if any) */}
          {authError ? (
            <View style={styles.errorPill}>
              <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              isAuthenticating && { opacity: 0.75 },
            ]}
            onPress={authenticate}
            activeOpacity={0.85}
            disabled={isAuthenticating}
          >
            <Ionicons
              name={isFace ? 'scan' : 'finger-print'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.primaryBtnText}>
              {isAuthenticating ? 'Verifying…' : primaryButtonLabel}
            </Text>
          </TouchableOpacity>

          {/* Secondary Passcode Action */}
          <TouchableOpacity
            style={styles.passcodeBtn}
            onPress={handleDevicePasscodeFallback}
            activeOpacity={0.65}
          >
            <Ionicons
              name="keypad-outline"
              size={15}
              color={isDark ? '#8E9E95' : '#5C665F'}
            />
            <Text style={[styles.passcodeBtnText, isDark && styles.passcodeBtnTextDark]}>
              Use Device Passcode
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Minimal Footer */}
        <View style={styles.footer}>
          <Ionicons
            name="lock-closed"
            size={11}
            color={isDark ? '#4B554E' : '#9CA3AF'}
          />
          <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
            Secured on this device
          </Text>
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
    zIndex: 999999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  ambientAura: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 44,
  },
  brandIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconBoxDark: {
    backgroundColor: 'rgba(46, 125, 91, 0.25)',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#3B4A41',
  },
  brandTextDark: {
    color: '#8E9E95',
  },
  sensorArea: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  breathingHalo: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1.5,
  },
  sensorDisc: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E7D5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    color: '#121A15',
    marginBottom: 8,
  },
  titleDark: {
    color: '#F1F5F3',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
    color: '#5C665F',
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  subtitleDark: {
    color: '#8E9E95',
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '500',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2E7D5B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    shadowColor: '#2E7D5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  passcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  passcodeBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#5C665F',
  },
  passcodeBtnTextDark: {
    color: '#8E9E95',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: 0.2,
  },
  footerTextDark: {
    color: '#4B554E',
  },
});
