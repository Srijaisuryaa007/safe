import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, NativeModules, TurboModuleRegistry, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/useThemeStore';
import { useRateLimitCountdown } from '../hooks/useRateLimitCountdown';
import { ValidationSchema } from '../lib/validationSchema';
import { ENV } from '../constants/env';
import { handleServiceError } from '../lib/errorHandler';

import AnimatedCircleGuardLogo from '../components/AnimatedCircleGuardLogo';
import ConstellationBackground from '../components/ConstellationBackground';
import { useCountryStore } from '../store/useCountryStore';
import CountrySelectorModal from '../components/CountrySelectorModal';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors, isDark } = useThemeStore();
  const { country, countryCode } = useCountryStore();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation();

  // Rate Limiting with Exponential Backoff (Per-Account & Per-Device)
  const loginLimiter = useRateLimitCountdown('AUTH_LOGIN', email.trim());

  // Password Reset State & Rate Limiter
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatusMsg, setResetStatusMsg] = useState('');
  const [resetIsError, setResetIsError] = useState(false);
  const pwResetLimiter = useRateLimitCountdown('AUTH_PASSWORD_RESET', resetEmail.trim() || email.trim());

  const handleLogin = async () => {
    setErrorMsg('');

    // 1. Strict Input Schema Validation
    const emailValidation = ValidationSchema.validateEmail(email);
    if (!emailValidation.valid) {
      setErrorMsg(emailValidation.error || 'Invalid email address format.');
      return;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      setErrorMsg('Please enter your password.');
      return;
    }

    // 2. Enforce Client/Account Rate Limit & Exponential Backoff
    const limitCheck = await loginLimiter.checkStatus();
    if (!limitCheck.allowed) {
      setErrorMsg(
        limitCheck.reason ||
          `Rate limit backoff active. Please wait ${limitCheck.retryAfterSec}s before retrying.`
      );
      return;
    }

    setLoading(true);
    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: emailValidation.value!,
        password,
      });

      if (signInResult.error) {
        // Only penalize rate limit for bad credentials (not for network or service outages)
        const isBadCredential = /Invalid login credentials/i.test(signInResult.error.message || '');
        if (isBadCredential) {
          const record = await loginLimiter.recordAttempt(false);
          if (!record.allowed) {
            setErrorMsg(
              record.reason ||
                `Too many failed sign-in attempts. Exponential backoff active: please wait ${record.retryAfterSec}s.`
            );
            return;
          }
        }
        setErrorMsg(handleServiceError('Login:signIn', signInResult.error, 'Invalid email or password. Please try again.'));
      } else {
        // Success - clear failures and backoff, then immediately sync session to store
        await loginLimiter.recordAttempt(true);
        if (signInResult.data?.session) {
          const { useAuthStore } = require('../store/useAuthStore');
          useAuthStore.getState().setSession(signInResult.data.session);
        }
      }
    } catch (err: any) {
      setErrorMsg(handleServiceError('Login:catch', err, 'Something went wrong during sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const targetEmail = (resetEmail || email).trim();
    
    // Strict schema validation for password reset email
    const emailValidation = ValidationSchema.validateEmail(targetEmail);
    if (!emailValidation.valid) {
      setResetStatusMsg(emailValidation.error || 'Please enter a valid email address.');
      setResetIsError(true);
      return;
    }

    const check = await pwResetLimiter.checkStatus();
    if (!check.allowed) {
      setResetStatusMsg(
        check.reason || `Rate limit active. Please wait ${check.retryAfterSec}s before requesting again.`
      );
      setResetIsError(true);
      return;
    }

    setResetLoading(true);
    setResetStatusMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.value!, {
        redirectTo:
          Platform.OS === 'web'
            ? window.location.origin
            : Linking.createURL('auth/reset-callback', { scheme: 'circleguard' }),
      });

      if (error) {
        await pwResetLimiter.recordAttempt(false);
        setResetStatusMsg(handleServiceError('Login:resetPassword', error, 'Failed to send password reset email.'));
        setResetIsError(true);
      } else {
        await pwResetLimiter.recordAttempt(true);
        setResetStatusMsg('Password reset link sent! Check your inbox.');
        setResetIsError(false);
      }
    } catch (err: any) {
      await pwResetLimiter.recordAttempt(false);
      setResetStatusMsg(handleServiceError('Login:resetPasswordCatch', err, 'Failed to send password reset email.'));
      setResetIsError(true);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const isNativeGoogleAvailable = Platform.OS !== 'web' && Boolean(NativeModules && (NativeModules as any).RNGoogleSignin);

      if (isNativeGoogleAvailable) {
        try {
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          GoogleSignin.configure({
            webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
          });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          try {
            await GoogleSignin.signOut();
          } catch (e) {}
          const response = await GoogleSignin.signIn();
          
          const idToken = response?.data?.idToken || response?.idToken || (response as any)?.data?.idToken || (response as any)?.idToken;

          if (idToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: idToken,
            });

            if (sessionErr) throw sessionErr;

            if (sessionData?.session) {
              const { useAuthStore } = require('../store/useAuthStore');
              useAuthStore.getState().setSession(sessionData.session);

              const user = sessionData.session.user;
              let { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

              if (!prof) {
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Circle Member';
                const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

                const { data: newProf } = await supabase
                  .from('profiles')
                  .upsert([
                    {
                      id: user.id,
                      full_name: fullName,
                      avatar_url: avatarUrl,
                      phone: user.phone || null,
                    }
                  ])
                  .select()
                  .single();

                if (newProf) prof = newProf;
              }

              if (prof) {
                useAuthStore.getState().setProfile(prof);
              }
              return;
            }
          }
        } catch (nativeErr: any) {
          console.log('Native Google sign in skipped/fallback:', nativeErr?.message);
          const isCancelled = nativeErr?.code === '13' || nativeErr?.code === 'SIGN_IN_CANCELLED' || nativeErr?.message?.toLowerCase()?.includes('cancel');
          if (isCancelled) {
            return;
          }
          // If native module had an error, fall through gracefully to browser OAuth
        }
      }

      const redirectUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : Linking.createURL('auth/callback', { scheme: 'circleguard' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        Alert.alert('Google Sign-In Error', handleServiceError('Login:googleOAuth', error, 'Google sign-in could not be completed. Please try again.'));
        return;
      }

      if (Platform.OS !== 'web' && data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const params: Record<string, string> = {};
          const match = res.url.match(/[#?](.*)/);
          if (match && match[1]) {
            match[1].split('&').forEach(pair => {
              const [k, v] = pair.split('=');
              if (k && v) params[k] = decodeURIComponent(v);
            });
          }

          if (params.access_token && params.refresh_token) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });

            if (sessionErr) throw sessionErr;

            if (sessionData?.session) {
              const { useAuthStore } = require('../store/useAuthStore');
              useAuthStore.getState().setSession(sessionData.session);

              const user = sessionData.session.user;
              let { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

              if (!prof) {
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Circle Member';
                const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

                const { data: newProf } = await supabase
                  .from('profiles')
                  .upsert([
                    {
                      id: user.id,
                      full_name: fullName,
                      avatar_url: avatarUrl,
                      phone: user.phone || null,
                    }
                  ])
                  .select()
                  .single();

                if (newProf) prof = newProf;
              }

              if (prof) {
                useAuthStore.getState().setProfile(prof);
              }
            }
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Error', handleServiceError('Login:googleCatch', err, 'Failed to initialize Google sign-in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ConstellationBackground opacity={0.45} />
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <AnimatedCircleGuardLogo size={180} showText={true} isLoading={loading} />
        </View>

        <View style={styles.form}>
        {errorMsg ? <Text style={[styles.errorText, { color: colors.sosRed, borderColor: colors.sosRed }]}>{errorMsg}</Text> : null}

        {/* Region / Country Selector */}
        <Text style={[styles.inputLabel, { color: colors.foreground }]}>REGION & EMERGENCY DIAL</Text>
        <TouchableOpacity
          accessibilityRole="button"
          aria-label="Select Region and Country"
          style={[
            styles.countrySelectCard,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
            },
          ]}
          onPress={() => setCountryModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Text style={{ fontSize: 24 }}>{country.flag}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.foreground }}>{country.name}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentGold }}>({country.dialCode})</Text>
              </View>
              <Text style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 2 }}>
                {country.code === 'IN' ? 'Police 100 • Ambulance 108 • Fire 101 • ERSS 112' : `Emergency: ${country.primaryEmergency}`}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 4 }]}>EMAIL ADDRESS</Text>
        <TextInput
          style={[styles.underlineInput, { borderBottomColor: colors.foreground, color: colors.foreground }]}
          placeholder="name@domain.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>PASSWORD</Text>
        <View style={[styles.passwordContainer, { borderBottomColor: colors.foreground }]}>
          <TextInput
            style={[styles.underlineInput, { flex: 1, marginBottom: 0, borderBottomWidth: 0, color: colors.foreground }]}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity 
            accessibilityRole="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={styles.eyeBtn} 
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.accentGold} />
          </TouchableOpacity>
        </View>

        {/* Forgot Password Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, marginBottom: 4 }}>
          <TouchableOpacity
            accessibilityRole="button"
            aria-label="Forgot Password"
            onPress={() => {
              setResetEmail(email);
              setResetStatusMsg('');
              setResetModalVisible(true);
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentGold, letterSpacing: 0.8 }}>
              FORGOT PASSWORD?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Exponential Backoff Warning Banner */}
        {loginLimiter.isBlocked && (
          <View style={[styles.backoffBadge, { borderColor: colors.sosRed, backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <Ionicons name="timer-outline" size={16} color={colors.sosRed} />
            <Text style={[styles.backoffText, { color: colors.sosRed }]}>
              Exponential backoff active. Retry in {loginLimiter.secondsRemaining}s
            </Text>
          </View>
        )}

        <TouchableOpacity 
          accessibilityRole="button"
          aria-label="Sign In"
          style={[
            styles.button, 
            { 
              backgroundColor: (loginLimiter.isBlocked || loading) ? '#6B7280' : colors.accentGold,
              opacity: (loginLimiter.isBlocked || loading) ? 0.75 : 1
            }
          ]} 
          onPress={handleLogin} 
          disabled={loading || loginLimiter.isBlocked}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : loginLimiter.isBlocked ? (
            <Text style={styles.buttonText}>PLEASE WAIT ({loginLimiter.secondsRemaining}S)</Text>
          ) : (
            <Text style={styles.buttonText}>SIGN IN</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* High-Visibility Google Login Button */}
        <TouchableOpacity
          accessibilityRole="button"
          aria-label="Continue with Google"
          style={[
            styles.googleButton,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#D1D5DB',
              borderWidth: 1.5,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.06,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={[styles.googleButtonText, { color: isDark ? '#FFFFFF' : '#111111' }]}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          aria-label="Create an account"
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignUp' as never)}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: colors.accentGold }]}>CREATE AN ACCOUNT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Country Selector Modal */}
    <CountrySelectorModal
      visible={countryModalVisible}
      onClose={() => setCountryModalVisible(false)}
    />

    {/* Password Reset Modal with Exponential Backoff Rate Limiting */}
    <Modal
      visible={resetModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setResetModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>RESET PASSWORD</Text>
            <TouchableOpacity onPress={() => setResetModalVisible(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
            Enter the email address associated with your CircleGuard account to receive secure recovery instructions.
          </Text>

          {resetStatusMsg ? (
            <View style={[styles.resetStatusBox, { borderColor: resetIsError ? colors.sosRed : '#10B981', backgroundColor: resetIsError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)' }]}>
              <Text style={{ fontSize: 12, color: resetIsError ? colors.sosRed : '#10B981', textAlign: 'center', fontWeight: '600' }}>
                {resetStatusMsg}
              </Text>
            </View>
          ) : null}

          {pwResetLimiter.isBlocked && (
            <View style={[styles.backoffBadge, { borderColor: colors.sosRed, backgroundColor: 'rgba(239, 68, 68, 0.1)', marginVertical: 8 }]}>
              <Ionicons name="timer-outline" size={14} color={colors.sosRed} />
              <Text style={[styles.backoffText, { color: colors.sosRed }]}>
                Exponential backoff active: retry in {pwResetLimiter.secondsRemaining}s
              </Text>
            </View>
          )}

          <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 12 }]}>ACCOUNT EMAIL</Text>
          <TextInput
            style={[styles.underlineInput, { borderBottomColor: colors.foreground, color: colors.foreground, marginBottom: 16 }]}
            placeholder="name@domain.com"
            value={resetEmail}
            onChangeText={setResetEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: (pwResetLimiter.isBlocked || resetLoading) ? '#6B7280' : colors.accentGold,
                marginTop: 8,
                opacity: (pwResetLimiter.isBlocked || resetLoading) ? 0.75 : 1,
              },
            ]}
            onPress={handleResetPassword}
            disabled={resetLoading || pwResetLimiter.isBlocked}
          >
            {resetLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : pwResetLimiter.isBlocked ? (
              <Text style={styles.buttonText}>PLEASE WAIT ({pwResetLimiter.secondsRemaining}S)</Text>
            ) : (
              <Text style={styles.buttonText}>SEND RESET LINK</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  countrySelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    borderWidth: 1,
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  backoffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  backoffText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  eyeBtn: {
    padding: 8,
  },
  underlineInput: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  googleButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  linkButton: {
    padding: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  resetStatusBox: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
});
