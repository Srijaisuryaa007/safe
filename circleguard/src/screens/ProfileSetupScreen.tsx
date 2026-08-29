import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import AnimatedCircleGuardLogo from '../components/AnimatedCircleGuardLogo';
import { useCountryStore } from '../store/useCountryStore';
import CountrySelectorModal from '../components/CountrySelectorModal';

export default function ProfileSetupScreen() {
  const { colors, isDark, themeMode } = useThemeStore();
  const { user, profile, setProfile } = useAuthStore();
  const { country, setCountryCode } = useCountryStore();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  
  const [fullName, setFullName] = useState(profile?.full_name && profile.full_name !== 'Circle Member' ? profile.full_name : '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const handleSaveProfile = async () => {
    setErrorMsg('');
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!phone.trim()) {
      setErrorMsg('Please enter your mobile phone number.');
      return;
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const fullPhoneNumber = cleanPhone.startsWith('+') ? cleanPhone : `${country.dialCode} ${cleanPhone}`;

    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert([
          { 
            id: user.id, 
            full_name: fullName.trim(), 
            phone: fullPhoneNumber,
            avatar_url: profile?.avatar_url || null,
          }
        ])
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setProfile(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while saving your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Revolving 3D Brand Logo */}
        <View style={styles.logoSection}>
          <AnimatedCircleGuardLogo size={130} showText={false} isLoading={loading} />
        </View>

        {/* Step Badge & Header */}
        <View style={styles.headerSection}>
          <View
            style={[
              styles.stepBadge,
              {
                backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : colors.accentGoldLight,
                borderColor: colors.accentGold,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={13} color={colors.accentGold} />
            <Text style={[styles.stepBadgeText, { color: colors.accentGold }]}>
              FINAL STEP • SAFETY PROFILE
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Complete Your Identity</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Your name and emergency phone number will be displayed to your trusted circle members.
          </Text>
        </View>

        {/* Form Container */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
            },
          ]}
        >
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.sosRed} />
              <Text style={[styles.errorText, { color: colors.sosRed }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>FULL NAME</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB',
                  borderColor: nameFocused ? colors.accentGold : isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={nameFocused ? colors.accentGold : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.inputField, { color: colors.foreground }]}
                placeholder="e.g. Jai Suryaa"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>PHONE NUMBER</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB',
                  borderColor: phoneFocused ? colors.accentGold : isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.countryCodeBadge, { borderRightColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB' }]}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>{country.flag}</Text>
                <Text style={[styles.countryCodeText, { color: colors.foreground, marginLeft: 4 }]}>{country.dialCode}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <TextInput
                style={[styles.inputField, { color: colors.foreground, paddingLeft: 12 }]}
                placeholder="98765 43210"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Save Profile Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accentGold },
              loading && { opacity: 0.8 },
            ]}
            onPress={handleSaveProfile}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>INITIALIZE PROFILE & ENTER</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Reassurance Footer */}
        <View style={styles.securityFooter}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={[styles.securityText, { color: colors.textMuted }]}>
            End-to-end encrypted • Used strictly for circle safety & emergency SOS.
          </Text>
        </View>
      </ScrollView>

      <CountrySelectorModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    gap: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 10,
    borderRightWidth: 1,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  securityText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
