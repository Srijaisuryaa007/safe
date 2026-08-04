import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigation = useNavigation();

  const handleSignUp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Account initialized successfully. You can now log in.');
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) Alert.alert('Google Sign-In', error.message);
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

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading}>
          <Ionicons name="logo-google" size={18} color={LUXURY_THEME.colors.foreground} />
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
    backgroundColor: LUXURY_THEME.colors.foreground,
    height: 50,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
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
    borderColor: LUXURY_THEME.colors.foreground,
    backgroundColor: LUXURY_THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: LUXURY_THEME.colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  linkButton: {
    padding: 16,
    alignItems: 'center',
  },
  linkText: {
    color: LUXURY_THEME.colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
