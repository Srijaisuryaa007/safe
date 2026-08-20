import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, Platform, NativeModules, TurboModuleRegistry } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const navigation = useNavigation<any>();

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        Alert.alert('Account Created', 'Your account has been created successfully!');
      } else {
        Alert.alert('Verification Sent', 'Please check your email to confirm your account.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong during sign up.');
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
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logoImage} 
          resizeMode="contain"
        />
        <Text style={styles.overline}>JOIN THE NETWORK</Text>
        <Text style={styles.brandSubtitle}>Your Circle. Your Safety. Always.</Text>
      </View>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

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

        <Text style={styles.inputLabel}>CREATE PASSWORD</Text>
        <TextInput
          style={styles.underlineInput}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={LUXURY_THEME.colors.textMuted}
        />

        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={LUXURY_THEME.colors.accentGold} />
          ) : (
            <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
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
          onPress={() => navigation.navigate('Login' as never)}
          disabled={loading}
        >
          <Text style={styles.linkText}>I ALREADY HAVE AN ACCOUNT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
    padding: 28,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 44,
  },
  shieldBg: {
    width: 80,
    height: 80,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 32,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
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
  successText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 13,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    padding: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
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
