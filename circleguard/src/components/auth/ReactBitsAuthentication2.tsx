import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/useThemeStore';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import TermsOfServiceModal from '../TermsOfServiceModal';

export interface ReactBitsAuthentication2Props {
  brandName?: string;
  brandInitial?: string;
  onGoogleSignIn: () => Promise<void> | void;
  onGitHubSignIn?: () => Promise<void> | void;
  onAppleSignIn?: () => Promise<void> | void;
  onEmailSignIn: (email: string, password?: string) => Promise<void> | void;
  onSSOSignIn?: (domain: string) => Promise<void> | void;
  onCreateAccount: () => void;
  onForgotPassword?: () => void;
  loading?: boolean;
  errorMsg?: string;
  blockedSecondsRemaining?: number;
}

export default function ReactBitsAuthentication2({
  brandName = 'CircleGuard',
  brandInitial = 'CG',
  onGoogleSignIn,
  onGitHubSignIn,
  onAppleSignIn,
  onEmailSignIn,
  onSSOSignIn,
  onCreateAccount,
  onForgotPassword,
  loading = false,
  errorMsg = '',
  blockedSecondsRemaining = 0,
}: ReactBitsAuthentication2Props) {
  const { isDark } = useThemeStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ssoDomain, setSsoDomain] = useState('');
  const [isSsoMode, setIsSsoMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'sso' | null>(null);

  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);
  const ssoInputRef = useRef<any>(null);

  const handleSubmit = () => {
    if (isSsoMode) {
      if (onSSOSignIn && ssoDomain.trim()) {
        onSSOSignIn(ssoDomain.trim());
      }
    } else {
      onEmailSignIn(email.trim(), password);
    }
  };

  const isBlocked = blockedSecondsRemaining > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F8FAFC' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Navigation Bar: Brand Badge & Create Account Pill */}
        <View style={styles.navBar}>
          <View style={styles.brandGroup}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.brandLogoImg}
              resizeMode="cover"
            />
            <Text style={[styles.brandNameText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {brandName}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.createAccountBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#CBD5E1',
              },
            ]}
            onPress={onCreateAccount}
            activeOpacity={0.7}
            accessibilityLabel="Create account"
            accessibilityRole="button"
          >
            <Text style={[styles.createAccountBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Welcome back
          </Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Sign in to pick up your circle tracking, safe havens, and safety alerts exactly where you left them.
          </Text>
        </View>

        {/* Provider-First Sign-in Stack */}
        <View style={styles.providersStack}>
          {/* Google Button */}
          <TouchableOpacity
            style={[
              styles.providerBtn,
              {
                backgroundColor: isDark ? '#14171F' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              },
            ]}
            onPress={onGoogleSignIn}
            disabled={loading || isBlocked}
            activeOpacity={0.8}
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
          >
            <Ionicons name="logo-google" size={17} color="#EA4335" style={styles.providerIcon} />
            <Text style={[styles.providerBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
          <Text style={[styles.dividerLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
        </View>

        {/* Error Notice */}
        {errorMsg ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              },
            ]}
          >
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Form Header with SSO Toggle Link */}
        <View style={styles.formHeaderRow}>
          <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {isSsoMode ? 'Company domain' : 'Work or personal email'}
          </Text>
          <TouchableOpacity
            style={styles.ssoToggleBtn}
            onPress={() => setIsSsoMode(!isSsoMode)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSsoMode ? 'mail-outline' : 'key-outline'}
              size={12}
              color={isDark ? '#FFFFFF' : '#0F172A'}
            />
            <Text style={[styles.ssoToggleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {isSsoMode ? 'Use password' : 'Use single sign-on'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SSO Mode vs Password Mode Form */}
        {isSsoMode ? (
          <View style={styles.inputGroup}>
            <View
              style={[
                styles.textInputBox,
                {
                  backgroundColor: isDark ? '#14171F' : '#FFFFFF',
                  borderColor:
                    focusedField === 'sso'
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? 'rgba(255,255,255,0.1)'
                      : '#CBD5E1',
                },
              ]}
            >
              <TextInput
                ref={ssoInputRef}
                style={[styles.inputEl, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder="acme.com or company.okta.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={ssoDomain}
                onChangeText={setSsoDomain}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onFocus={() => setFocusedField('sso')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <Text style={[styles.inputHintText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
              Enter your organization's domain to authenticate via enterprise SAML / OIDC Single Sign-On.
            </Text>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            {/* Email Input */}
            <View
              style={[
                styles.textInputBox,
                {
                  backgroundColor: isDark ? '#14171F' : '#FFFFFF',
                  borderColor:
                    focusedField === 'email'
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? 'rgba(255,255,255,0.1)'
                      : '#CBD5E1',
                },
              ]}
            >
              <TextInput
                ref={emailInputRef}
                style={[styles.inputEl, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                placeholder="you@company.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
              {email.length > 0 && (
                <TouchableOpacity onPress={() => setEmail('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color={isDark ? '#64748B' : '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.inputHintText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
              We match your email to an existing circle security profile.
            </Text>

            {/* Password Input */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.passwordLabelRow}>
                <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Password
                </Text>
                {onForgotPassword && (
                  <TouchableOpacity onPress={onForgotPassword} activeOpacity={0.7}>
                    <Text style={[styles.forgotPasswordText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={[
                  styles.textInputBox,
                  {
                    backgroundColor: isDark ? '#14171F' : '#FFFFFF',
                    borderColor:
                      focusedField === 'password'
                        ? isDark
                          ? '#FFFFFF'
                          : '#0F172A'
                        : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : '#CBD5E1',
                  },
                ]}
              >
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.inputEl, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ padding: 4 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={isDark ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Rate Limit Block Banner */}
        {isBlocked && (
          <View
            style={[
              styles.backoffCard,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: 'rgba(239, 68, 68, 0.25)',
              },
            ]}
          >
            <Ionicons name="timer-outline" size={15} color="#EF4444" />
            <Text style={styles.backoffText}>
              Too many attempts. Exponential backoff active: please wait {blockedSecondsRemaining}s.
            </Text>
          </View>
        )}

        {/* Submit Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueBtn,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              opacity: loading || isBlocked ? 0.6 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={loading || isBlocked}
          activeOpacity={0.8}
          accessibilityLabel={isSsoMode ? 'Continue with SSO' : 'Continue to sign in'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} size="small" />
          ) : isBlocked ? (
            <Text style={[styles.continueBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
              Please wait ({blockedSecondsRemaining}s)
            </Text>
          ) : (
            <View style={styles.continueBtnContent}>
              <Text style={[styles.continueBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                {isSsoMode ? 'Continue with SSO' : 'Continue'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={isDark ? '#000000' : '#FFFFFF'}
                style={{ marginLeft: 6 }}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Footer Legal Terms */}
        <View style={styles.footerLegal}>
          <Text style={[styles.footerLegalText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            By continuing you agree to the{' '}
            <Text
              style={[styles.footerLegalLink, { color: isDark ? '#CBD5E1' : '#334155' }]}
              onPress={() => setTermsModalVisible(true)}
            >
              terms of service
            </Text>{' '}
            and{' '}
            <Text
              style={[styles.footerLegalLink, { color: isDark ? '#CBD5E1' : '#334155' }]}
              onPress={() => setPrivacyModalVisible(true)}
            >
              privacy policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>

      {/* Modals for Terms & Privacy */}
      <TermsOfServiceModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 44,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeInitial: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandNameText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  createAccountBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  createAccountBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  heroHeading: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 340,
  },
  providersStack: {
    gap: 10,
    marginBottom: 22,
  },
  providerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  providerIcon: {
    marginRight: 10,
  },
  providerBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12.5,
    flex: 1,
    lineHeight: 17,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputFieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  ssoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ssoToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 18,
  },
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  inputEl: {
    flex: 1,
    fontSize: 13.5,
    height: '100%',
  },
  inputHintText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  backoffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  backoffText: {
    color: '#EF4444',
    fontSize: 11.5,
    flex: 1,
  },
  continueBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  continueBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  footerLegal: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  footerLegalText: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  footerLegalLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
