import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import MascotShieldHeader from '../components/MascotShieldHeader';
import AppearanceModal from '../components/AppearanceModal';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);

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
      } else {
        setIsSuccess(true);
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
    <KeyboardAvoidingView
      style={styles.flexContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Mascot & 3D Gold Shield Header */}
        <MascotShieldHeader
          isPasswordFocused={isPasswordFocused}
          isSuccess={isSuccess}
          onOpenSettings={() => setShowAppearanceModal(true)}
        />

        {/* Login Input Form */}
        <View style={styles.formContainer}>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Email Address Field */}
          <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.underlineInput}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#475569"
            selectionColor="#00F5D4"
          />

          {/* Password Field with Eye Toggle & Reactive Focus */}
          <Text style={styles.inputLabel}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.underlineInput, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#475569"
              selectionColor="#00F5D4"
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>
          </View>

          {/* SIGN IN Primary Button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#D4AF37" />
            ) : (
              <Text style={styles.signInButtonText}>SIGN IN</Text>
            )}
          </TouchableOpacity>

          {/* OR Accent Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* CONTINUE WITH GOOGLE Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Ionicons name="logo-google" size={16} color="#FFFFFF" />
            <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
          </TouchableOpacity>

          {/* CREATE AN ACCOUNT Subtext Link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SignUp' as never)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>CREATE AN ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Appearance Modal */}
      <AppearanceModal
        visible={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#090A0F', // Obsidian Void Background
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  formContainer: {
    gap: 14,
    marginTop: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 1.8,
    marginTop: 4,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 8,
    fontSize: 14,
    color: '#00F5D4', // Electric Cyan typing text
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 8,
  },
  eyeBtn: {
    padding: 8,
  },
  signInButton: {
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F3E5AB',
    shadowColor: '#F3E5AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  signInButtonText: {
    color: '#B48B1E',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#A855F7', // Accent Purple/Magenta divider
    opacity: 0.6,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 1.5,
  },
  googleButton: {
    flexDirection: 'row',
    height: 48,
    borderWidth: 1,
    borderColor: '#3B2D54',
    backgroundColor: '#1A1726', // Dark Purple Container
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  linkButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
