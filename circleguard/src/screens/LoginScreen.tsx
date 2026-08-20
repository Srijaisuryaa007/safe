import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform, NativeModules, TurboModuleRegistry } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';

import AnimatedCircleGuardLogo from '../components/AnimatedCircleGuardLogo';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation();

  const handleLogin = async () => {
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const hasNativeModule = Platform.OS !== 'web' && (
        !!(NativeModules as any)?.RNGoogleSignin ||
        !!(TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function' && TurboModuleRegistry.get('RNGoogleSignin'))
      );

      if (hasNativeModule) {
        try {
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          GoogleSignin.configure({
            webClientId: '648921591929-dspid5vmlhk9hm9213vcln5v5tftr079.apps.googleusercontent.com',
            offlineAccess: true,
          });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          try {
            await GoogleSignin.signOut();
          } catch (e) {}
          const response = await GoogleSignin.signIn();
          
          const idToken = response?.data?.idToken || response?.idToken || (response as any)?.data?.idToken || (response as any)?.idToken;

          if (!idToken) {
            throw new Error('Google did not return an ID token. Please verify your Web Client ID and SHA-1 in Google Cloud Console.');
          }

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
        } catch (nativeErr: any) {
          console.error('Native Google sign in error:', nativeErr);
          const isCancelled = nativeErr?.code === '13' || nativeErr?.code === 'SIGN_IN_CANCELLED' || nativeErr?.message?.toLowerCase()?.includes('cancel');
          if (!isCancelled) {
            Alert.alert('Google Sign-In Error', nativeErr?.message || 'Failed to authenticate with Google.');
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
        Alert.alert('Google Sign-In Error', error.message);
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
      Alert.alert('Error', err.message || 'Failed to initialize Google sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <AnimatedCircleGuardLogo size={180} showText={true} />
      </View>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
        <TextInput
          style={styles.underlineInput}
          placeholder="name@domain.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={LUXURY_THEME.colors.textMuted}
        />

        <Text style={styles.inputLabel}>PASSWORD</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.underlineInput, { flex: 1, marginBottom: 0 }]}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor={LUXURY_THEME.colors.textMuted}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={LUXURY_THEME.colors.accentGold} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={LUXURY_THEME.colors.accentGold} />
          ) : (
            <Text style={styles.buttonText}>SIGN IN</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading} activeOpacity={0.8}>
          <Ionicons name="logo-google" size={18} color="#FFFFFF" />
          <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignUp' as never)}
          disabled={loading}
        >
          <Text style={styles.linkText}>CREATE AN ACCOUNT</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: LUXURY_THEME.colors.background,
    padding: 28,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  errorText: {
    color: LUXURY_THEME.colors.sosRed,
    fontSize: 13,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.foreground,
    marginBottom: 8,
  },
  eyeBtn: {
    padding: 8,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.foreground,
    paddingVertical: 10,
    fontSize: 15,
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 8,
  },
  button: {
    backgroundColor: LUXURY_THEME.colors.accentGold,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#1A1A1A',
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
    backgroundColor: LUXURY_THEME.colors.border,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
  },
  googleButton: {
    flexDirection: 'row',
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  linkButton: {
    padding: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
