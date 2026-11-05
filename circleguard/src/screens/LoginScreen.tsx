import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, NativeModules, TurboModuleRegistry, Modal } from 'react-native';
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
import { useCountryStore } from '../store/useCountryStore';
import CountrySelectorModal from '../components/CountrySelectorModal';
import PasswordResetModal from '../components/PasswordResetModal';
import ReactBitsAuthentication2 from '../components/auth/ReactBitsAuthentication2';
import { safeNativeGoogleSignIn } from '../lib/googleAuthHelper';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  console.log('[LoginScreen] render');
  const { colors, isDark } = useThemeStore();
  const { country, countryCode } = useCountryStore();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const navigation = useNavigation();

  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  // Rate Limiting with Exponential Backoff (Per-Account & Per-Device)
  const loginLimiter = useRateLimitCountdown('AUTH_LOGIN', email.trim());

  // Password Reset Modal State
  const [resetModalVisible, setResetModalVisible] = useState(false);

  const handleLogin = async (emailInput?: string, passwordInput?: string) => {
    setErrorMsg('');

    const targetEmail = (emailInput !== undefined ? emailInput : email).trim();
    const targetPassword = passwordInput !== undefined ? passwordInput : password;
    setEmail(targetEmail);
    if (passwordInput !== undefined) setPassword(passwordInput);

    // 1. Strict Input Schema Validation
    const emailValidation = ValidationSchema.validateEmail(targetEmail);
    if (!emailValidation.valid) {
      setErrorMsg(emailValidation.error || 'Invalid email address format.');
      return;
    }

    if (!targetPassword || typeof targetPassword !== 'string' || targetPassword.length === 0) {
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
        password: targetPassword,
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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const nativeToken = await safeNativeGoogleSignIn(ENV.GOOGLE_WEB_CLIENT_ID);
      if (nativeToken === 'CANCELLED') {
        return;
      }

      if (nativeToken) {
        const { data: sessionData, error: sessionErr } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: nativeToken,
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

  const handleOAuthSignIn = async (provider: 'github' | 'apple') => {
    try {
      setLoading(true);
      setErrorMsg('');

      const redirectUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : Linking.createURL('auth/callback', { scheme: 'circleguard' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        setErrorMsg(error.message || `${provider} sign-in failed.`);
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
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to initialize ${provider} sign-in.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSSOSignIn = async (domain: string) => {
    try {
      if (!domain.trim()) {
        setErrorMsg('Please enter your organization domain.');
        return;
      }
      setLoading(true);
      setErrorMsg('');

      const redirectUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : Linking.createURL('auth/callback', { scheme: 'circleguard' });

      const { data, error } = await supabase.auth.signInWithSSO({
        domain: domain.trim(),
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Single Sign-On failed for this domain.');
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
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initialize Single Sign-On.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }}>
      <ReactBitsAuthentication2
        brandName="CircleGuard"
        brandInitial="CG"
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={(em, pwd) => handleLogin(em, pwd)}
        onSSOSignIn={handleSSOSignIn}
        onCreateAccount={() => navigation.navigate('SignUp' as never)}
        onForgotPassword={() => setResetModalVisible(true)}
        loading={loading}
        errorMsg={errorMsg}
        blockedSecondsRemaining={loginLimiter.secondsRemaining}
      />

      {/* Password Reset Modal with In-App Code Verification & Direct Reset */}
      <PasswordResetModal
        visible={resetModalVisible}
        initialEmail={email}
        onClose={() => setResetModalVisible(false)}
        onSuccess={() => setResetModalVisible(false)}
      />
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
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  countrySelectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  countryFlagText: {
    fontSize: 20,
  },
  countryNameText: {
    fontSize: 14.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  dialCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dialCodeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputContainerFocused: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 14.5,
    fontWeight: '500',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 6,
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
