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
import ConstellationBackground from '../components/ConstellationBackground';
import { useCountryStore } from '../store/useCountryStore';
import CountrySelectorModal from '../components/CountrySelectorModal';
import PasswordResetModal from '../components/PasswordResetModal';

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
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const navigation = useNavigation();

  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  // Rate Limiting with Exponential Backoff (Per-Account & Per-Device)
  const loginLimiter = useRateLimitCountdown('AUTH_LOGIN', email.trim());

  // Password Reset Modal State
  const [resetModalVisible, setResetModalVisible] = useState(false);

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
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <AnimatedCircleGuardLogo size={180} showText={true} isLoading={loading} />
        </View>

        <View style={styles.form}>
        {errorMsg ? <Text style={[styles.errorText, { color: colors.sosRed, borderColor: colors.sosRed }]}>{errorMsg}</Text> : null}

        {/* Country / Region Selector */}
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>COUNTRY / REGION</Text>
        <TouchableOpacity
          accessibilityRole="button"
          aria-label="Select Country"
          style={[
            styles.countrySelectCard,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
            },
          ]}
          onPress={() => setCountryModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.countrySelectContent}>
            <Text style={styles.countryFlagText}>{country.flag}</Text>
            <Text style={[styles.countryNameText, { color: colors.foreground }]} numberOfLines={1}>
              {country.name}
            </Text>
            <View style={[styles.dialCodeBadge, { backgroundColor: isDark ? 'rgba(0, 229, 153, 0.12)' : 'rgba(46, 125, 91, 0.08)' }]}>
              <Text style={[styles.dialCodeBadgeText, { color: isDark ? '#00E599' : '#2E7D5B' }]}>
                {country.dialCode}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: 4 }]}>EMAIL ADDRESS</Text>
        <Pressable 
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: focusedField === 'email' ? '#00E599' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'),
            },
            focusedField === 'email' && styles.inputContainerFocused,
          ]}
          onPress={() => emailInputRef.current?.focus()}
        >
          <Ionicons 
            name="mail-outline" 
            size={18} 
            color={focusedField === 'email' ? '#00E599' : colors.textMuted} 
            style={styles.inputLeadingIcon}
          />
          <TextInput
            ref={emailInputRef}
            style={[
              styles.textInput, 
              { 
                color: colors.foreground,
                backgroundColor: 'transparent',
              }
            ]}
            placeholder="name@domain.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="noExcludeDescendants"
            placeholderTextColor={colors.textMuted}
            underlineColorAndroid="transparent"
            cursorColor={isDark ? '#00E599' : '#2E7D5B'}
            selectionColor={isDark ? 'rgba(0, 229, 153, 0.3)' : 'rgba(46, 125, 91, 0.3)'}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
          {email.length > 0 && (
            <TouchableOpacity 
              onPress={() => setEmail('')}
              style={{ padding: 4 }}
              accessibilityRole="button"
              aria-label="Clear email"
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </Pressable>

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>PASSWORD</Text>
        <Pressable 
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: focusedField === 'password' ? '#00E599' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'),
            },
            focusedField === 'password' && styles.inputContainerFocused,
          ]}
          onPress={() => passwordInputRef.current?.focus()}
        >
          <Ionicons 
            name="lock-closed-outline" 
            size={18} 
            color={focusedField === 'password' ? '#00E599' : colors.textMuted} 
            style={styles.inputLeadingIcon}
          />
          <TextInput
            ref={passwordInputRef}
            style={[
              styles.textInput, 
              { 
                color: colors.foreground,
                backgroundColor: 'transparent',
              }
            ]}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="noExcludeDescendants"
            placeholderTextColor={colors.textMuted}
            underlineColorAndroid="transparent"
            cursorColor={isDark ? '#00E599' : '#2E7D5B'}
            selectionColor={isDark ? 'rgba(0, 229, 153, 0.3)' : 'rgba(46, 125, 91, 0.3)'}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />
          <TouchableOpacity 
            accessibilityRole="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={styles.eyeBtn} 
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={focusedField === 'password' ? '#00E599' : colors.textMuted} />
          </TouchableOpacity>
        </Pressable>

        {/* Forgot Password Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, marginBottom: 4 }}>
          <TouchableOpacity
            accessibilityRole="button"
            aria-label="Forgot Password"
            onPress={() => setResetModalVisible(true)}
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
    shadowColor: '#00E599',
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
