import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, NativeModules, TurboModuleRegistry } from 'react-native';
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

export default function SignUpScreen() {
  const { colors, isDark } = useThemeStore();
  const { country, countryCode } = useCountryStore();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const navigation = useNavigation<any>();

  // Rate Limiting with Exponential Backoff (Per-Account & Per-Device)
  const signUpLimiter = useRateLimitCountdown('AUTH_SIGNUP', email.trim());

  const handleSignUp = async () => {
    setErrorMsg(null);

    // 1. Strict Input Schema Validation (Type, Length, Format)
    const emailValidation = ValidationSchema.validateEmail(email);
    if (!emailValidation.valid) {
      setErrorMsg(emailValidation.error || 'Invalid email address format.');
      return;
    }

    const passwordValidation = ValidationSchema.validatePassword(password);
    if (!passwordValidation.valid) {
      setErrorMsg(passwordValidation.error || 'Password does not meet security requirements.');
      return;
    }

    // 2. Enforce Client/Account Rate Limit & Exponential Backoff
    const limitCheck = await signUpLimiter.checkStatus();
    if (!limitCheck.allowed) {
      setErrorMsg(
        limitCheck.reason ||
          `Rate limit backoff active. Please wait ${limitCheck.retryAfterSec}s before retrying.`
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const signUpResult = await supabase.auth.signUp({
        email: emailValidation.value!,
        password: password.trim(),
      });

      const { data, error } = signUpResult;

      if (error) {
        const record = await signUpLimiter.recordAttempt(false);
        if (!record.allowed) {
          setErrorMsg(
            record.reason ||
              `Too many registration attempts. Exponential backoff active: please wait ${record.retryAfterSec}s.`
          );
        } else {
          setErrorMsg(handleServiceError('SignUp:signUp', error, 'Registration failed. Please check your inputs and try again.'));
        }
      } else {
        await signUpLimiter.recordAttempt(true);
        if (data.session) {
          const { useAuthStore } = require('../store/useAuthStore');
          useAuthStore.getState().setSession(data.session);
          Alert.alert('Account Created', 'Your account has been created successfully!');
        } else {
          Alert.alert('Verification Sent', 'Please check your email to confirm your account.');
        }
      }
    } catch (err: any) {
      setErrorMsg(handleServiceError('SignUp:catch', err, 'Something went wrong during sign up. Please try again.'));
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
          } catch (e) { }
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
        Alert.alert('Google Sign-In Error', handleServiceError('SignUp:googleOAuth', error, 'Google sign-in could not be completed. Please try again.'));
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
      Alert.alert('Error', handleServiceError('SignUp:googleCatch', err, 'Failed to initialize Google sign-in.'));
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
          <AnimatedCircleGuardLogo size={160} showText={true} isLoading={loading} />
        </View>

        <View style={styles.form}>
        {errorMsg ? <Text style={[styles.errorText, { color: colors.sosRed, borderColor: colors.sosRed }]}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={[styles.successText, { color: colors.accentGold, borderColor: colors.accentGold }]}>{successMsg}</Text> : null}

        {/* Country / Region Selector */}
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
        <TextInput
          style={[styles.underlineInput, { borderBottomColor: colors.foreground, color: colors.foreground }]}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={colors.textMuted}
        />

        {/* Live Exponential Backoff Warning Banner */}
        {signUpLimiter.isBlocked && (
          <View style={[styles.backoffBadge, { borderColor: colors.sosRed, backgroundColor: 'rgba(239, 68, 68, 0.1)', marginTop: 4 }]}>
            <Ionicons name="timer-outline" size={16} color={colors.sosRed} />
            <Text style={[styles.backoffText, { color: colors.sosRed }]}>
              Exponential backoff active. Retry in {signUpLimiter.secondsRemaining}s
            </Text>
          </View>
        )}

        <TouchableOpacity 
          accessibilityRole="button"
          aria-label="Create Account"
          style={[
            styles.button, 
            { 
              backgroundColor: (signUpLimiter.isBlocked || loading) ? '#6B7280' : colors.accentGold,
              opacity: (signUpLimiter.isBlocked || loading) ? 0.75 : 1
            }
          ]} 
          onPress={handleSignUp} 
          disabled={loading || signUpLimiter.isBlocked}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : signUpLimiter.isBlocked ? (
            <Text style={styles.buttonText}>PLEASE WAIT ({signUpLimiter.secondsRemaining}S)</Text>
          ) : (
            <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* High-Visibility Google Sign-Up Button */}
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
          aria-label="Already have an account? Sign in"
          style={styles.linkButton}
          onPress={() => navigation.navigate('Login' as never)}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: colors.accentGold }]}>ALREADY HAVE AN ACCOUNT? SIGN IN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    <CountrySelectorModal
      visible={countryModalVisible}
      onClose={() => setCountryModalVisible(false)}
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
  successText: {
    fontSize: 13,
    textAlign: 'center',
    borderWidth: 1,
    padding: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
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
});
