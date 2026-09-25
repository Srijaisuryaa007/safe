import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { ValidationSchema } from '../lib/validationSchema';
import { handleServiceError } from '../lib/errorHandler';
import { RateLimiter } from '../services/RateLimiter';

interface PasswordResetModalProps {
  visible: boolean;
  initialEmail?: string;
  isRecoverySessionActive?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PasswordResetModal({
  visible,
  initialEmail = '',
  isRecoverySessionActive = false,
  onClose,
  onSuccess,
}: PasswordResetModalProps) {
  const { colors, isDark } = useThemeStore();
  const { setSession, setPasswordRecovery } = useAuthStore();

  const [step, setStep] = useState<'request' | 'verify_and_set'>(
    isRecoverySessionActive ? 'verify_and_set' : 'request'
  );

  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRef = useRef<any>(null);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  useEffect(() => {
    if (visible) {
      if (initialEmail) setEmail(initialEmail);
      if (isRecoverySessionActive) {
        setStep('verify_and_set');
      } else {
        setStep('request');
      }
      setStatusMsg('');
      setIsError(false);
      setIsSuccess(false);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setResendCooldown(0);
    }
  }, [visible, initialEmail, isRecoverySessionActive]);

  // STEP 1: Request 1-Time Password OTP Code
  const handleRequestReset = async () => {
    const targetEmail = email.trim();
    const emailValidation = ValidationSchema.validateEmail(targetEmail);
    if (!emailValidation.valid) {
      setStatusMsg(emailValidation.error || 'Please enter a valid email address.');
      setIsError(true);
      return;
    }

    const check = await RateLimiter.checkLimit('AUTH_PASSWORD_RESET', targetEmail);
    if (!check.allowed) {
      setStatusMsg(
        check.reason || `Rate limit active. Please wait ${check.retryAfterSec}s before requesting again.`
      );
      setIsError(true);
      return;
    }

    setLoading(true);
    setStatusMsg('');
    try {
      const redirectUrl =
        Platform.OS === 'web'
          ? (typeof window !== 'undefined' ? window.location.origin : '')
          : Linking.createURL('auth/reset-callback');

      const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.value!, {
        redirectTo: redirectUrl,
      });

      if (error) {
        await RateLimiter.recordAttempt('AUTH_PASSWORD_RESET', false, targetEmail);
        setStatusMsg(handleServiceError('Login:resetPassword', error, 'Failed to send password reset OTP.'));
        setIsError(true);
      } else {
        await RateLimiter.recordAttempt('AUTH_PASSWORD_RESET', true, targetEmail);
        setIsError(false);
        setStatusMsg('1-time password OTP sent! Check your email for the 6-digit code.');
        setStep('verify_and_set');
        setResendCooldown(60);
        setTimeout(() => {
          if (otpInputRef.current) otpInputRef.current.focus();
        }, 300);
      }
    } catch (err: any) {
      await RateLimiter.recordAttempt('AUTH_PASSWORD_RESET', false, targetEmail);
      setStatusMsg(handleServiceError('Login:resetPasswordCatch', err, 'Failed to send password reset OTP.'));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Extract 6-digit OTP or token from pasted text/URL
  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim()) {
        const raw = text.trim();
        // Check if full URL containing token was pasted
        if (raw.includes('http') || raw.includes('token=')) {
          const match = raw.match(/[?&#]token=([^&#]+)/);
          if (match && match[1]) {
            setOtpCode(decodeURIComponent(match[1]));
            setStatusMsg('Code extracted from link! Now enter your new password.');
            setIsError(false);
            return;
          }
        }
        // Match 6 consecutive digits if available
        const digitsMatch = raw.match(/\b\d{6}\b/);
        if (digitsMatch) {
          setOtpCode(digitsMatch[0]);
          setStatusMsg('6-digit OTP code pasted! Enter your new password below.');
          setIsError(false);
          return;
        }
        // Otherwise set cleaned alphanumeric code
        const cleaned = raw.replace(/[^0-9a-zA-Z]/g, '').slice(0, 6);
        setOtpCode(cleaned);
        setStatusMsg('OTP code pasted! Enter your new password below.');
        setIsError(false);
      } else {
        setStatusMsg('Clipboard is empty. Copy the 6-digit OTP code from your email and tap Paste.');
        setIsError(true);
      }
    } catch (e) {
      setStatusMsg('Could not read clipboard. Please type the 6-digit OTP code manually.');
      setIsError(true);
    }
  };

  // STEP 2: Verify OTP & Update Password in Supabase Database
  const handleUpdatePassword = async () => {
    const cleanOtp = otpCode.trim();

    if (!isRecoverySessionActive && !cleanOtp) {
      setStatusMsg('Please enter the 6-digit OTP code sent to your email.');
      setIsError(true);
      if (otpInputRef.current) otpInputRef.current.focus();
      return;
    }

    if (!isRecoverySessionActive && cleanOtp.length < 6) {
      setStatusMsg('Please enter the complete 6-digit OTP code.');
      setIsError(true);
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setStatusMsg('Password must be at least 6 characters long.');
      setIsError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg('Passwords do not match. Please re-enter.');
      setIsError(true);
      return;
    }

    setLoading(true);
    setStatusMsg('');
    try {
      // 1. If not already in active recovery session, verify OTP with Supabase Auth
      if (!isRecoverySessionActive) {
        let otpError: any = null;
        let otpSession: any = null;

        // Long hash or token string from deep link
        if (cleanOtp.length > 20 || cleanOtp.includes('-') || cleanOtp.startsWith('pkce_')) {
          const res = await supabase.auth.verifyOtp({
            token_hash: cleanOtp,
            type: 'recovery',
          });
          otpError = res.error;
          otpSession = res.data?.session;
        } else {
          // Standard 6-digit one-time password OTP code
          const res = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: cleanOtp,
            type: 'recovery',
          });
          otpError = res.error;
          otpSession = res.data?.session;
        }

        if (otpError) {
          setStatusMsg(
            handleServiceError('Login:verifyOtp', otpError, 'Invalid or expired 6-digit OTP code. Please check your email or request a new code.')
          );
          setIsError(true);
          setLoading(false);
          return;
        }

        if (otpSession) {
          setSession(otpSession);
        }
      }

      // 2. Update user's password directly in Supabase Auth database
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setStatusMsg(
          handleServiceError('Login:updateUser', updateError, 'Could not set new password in database. Please try again.')
        );
        setIsError(true);
        setLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsError(false);
      setStatusMsg('🎉 Password changed successfully in database! Logging you in...');
      setPasswordRecovery(false);

      if (updateData?.user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          setSession(sessionData.session);

          // Hydrate user profile and active circle
          const userId = sessionData.session.user.id;
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (existingProfile) {
            useAuthStore.getState().setProfile(existingProfile);
            const circle = await useCircleStore.getState().fetchActiveCircle(userId);
            if (circle?.id) {
              await useCircleStore.getState().fetchMembers(circle.id);
            }
          }
        }
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMsg(handleServiceError('Login:updatePasswordCatch', err, 'Failed to update password.'));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? '#141A17' : '#FFFFFF',
              borderColor: isDark ? '#26342D' : '#E8EDE9',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isSuccess
                      ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#E8F5EE')
                      : (isDark ? '#1E2B23' : '#E8F5EE'),
                  },
                ]}
              >
                <Ionicons
                  name={isSuccess ? 'checkmark-circle' : (step === 'verify_and_set' ? 'shield-checkmark-outline' : 'key-outline')}
                  size={20}
                  color={isSuccess ? '#10B981' : (isDark ? '#3ADFAB' : '#006C4F')}
                />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1F2A24' }]}>
                  {isRecoverySessionActive || step === 'verify_and_set'
                    ? 'VERIFY OTP & RESET'
                    : 'RESET PASSWORD'}
                </Text>
                <Text style={[styles.modalBadgeText, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>
                  1-TIME PASSWORD (OTP) RECOVERY
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={isDark ? '#CAD5CE' : '#6E7E74'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalSubtitle, { color: isDark ? '#9EACA3' : '#5E6E64' }]}>
              {isRecoverySessionActive
                ? 'Your security credentials were confirmed. Choose a secure new password for your account.'
                : step === 'verify_and_set'
                ? `Enter the 6-digit OTP code sent to ${email} and choose your new password.`
                : 'Enter your account email to receive a 6-digit one-time password (OTP) code.'}
            </Text>

            {/* Status Message */}
            {statusMsg ? (
              <View
                style={[
                  styles.statusBox,
                  {
                    borderColor: isError ? '#EF4444' : '#10B981',
                    backgroundColor: isError
                      ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)')
                      : (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)'),
                  },
                ]}
              >
                <Ionicons
                  name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={isError ? '#EF4444' : '#10B981'}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: isError ? '#EF4444' : (isDark ? '#3ADFAB' : '#059669') },
                  ]}
                >
                  {statusMsg}
                </Text>
              </View>
            ) : null}

            {/* STEP 1: Request Email */}
            {step === 'request' && !isRecoverySessionActive && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.inputLabel, { color: isDark ? '#CAD5CE' : '#455A50' }]}>
                  ACCOUNT EMAIL
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#1C2621' : '#F6F8F7',
                      borderColor: isDark ? '#2E3D35' : '#DCE3DF',
                      color: isDark ? '#FFFFFF' : '#1F2A24',
                    },
                  ]}
                  placeholder="name@domain.com"
                  placeholderTextColor={isDark ? '#6E7E74' : '#9EACA3'}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: loading ? '#6B7280' : (isDark ? '#3ADFAB' : '#006C4F'),
                    },
                  ]}
                  onPress={handleRequestReset}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={isDark ? '#002116' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: isDark ? '#002116' : '#FFFFFF' },
                      ]}
                    >
                      SEND 1-TIME OTP CODE
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('verify_and_set')}
                  style={styles.switchStepBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.switchStepText, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>
                    Already have a 6-digit OTP code? Enter it here ›
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Enter 6-Digit OTP & Set New Password */}
            {(step === 'verify_and_set' || isRecoverySessionActive) && (
              <View style={{ marginTop: 14 }}>
                {!isRecoverySessionActive && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.inputLabel, { color: isDark ? '#CAD5CE' : '#455A50', marginBottom: 0 }]}>
                        6-DIGIT OTP CODE
                      </Text>
                      <TouchableOpacity
                        onPress={handlePasteClipboard}
                        style={[styles.pasteBtn, isDark && { backgroundColor: '#1A2F25', borderColor: '#26543D' }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="clipboard-outline" size={13} color={isDark ? '#3ADFAB' : '#006C4F'} />
                        <Text style={[styles.pasteBtnText, isDark && { color: '#3ADFAB' }]}>Paste OTP</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Interactive 6-Cell OTP Display */}
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => {
                        if (otpInputRef.current) otpInputRef.current.focus();
                      }}
                      style={styles.otpBoxesRow}
                    >
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const digit = otpCode[index] || '';
                        const isCurrentActive = otpCode.length === index;
                        return (
                          <View
                            key={index}
                            style={[
                              styles.otpBox,
                              {
                                backgroundColor: isDark ? '#1C2621' : '#F6F8F7',
                                borderColor: digit
                                  ? (isDark ? '#3ADFAB' : '#006C4F')
                                  : isCurrentActive
                                  ? (isDark ? '#3ADFAB' : '#006C4F')
                                  : (isDark ? '#2E3D35' : '#DCE3DF'),
                                borderWidth: isCurrentActive || digit ? 1.8 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.otpBoxText, { color: isDark ? '#FFFFFF' : '#1F2A24' }]}>
                              {digit}
                            </Text>
                          </View>
                        );
                      })}
                    </TouchableOpacity>

                    {/* Hidden Real TextInput for Native Keyboard */}
                    <TextInput
                      ref={otpInputRef}
                      style={styles.hiddenOtpInput}
                      value={otpCode}
                      onChangeText={(txt) => {
                        // Keep only alphanumeric characters, cap to 6
                        const clean = txt.replace(/[^0-9a-zA-Z]/g, '').slice(0, 6);
                        setOtpCode(clean);
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoCapitalize="none"
                      textContentType="oneTimeCode"
                      autoFocus={true}
                    />

                    {/* Resend OTP Row with Timer */}
                    <View style={styles.resendRow}>
                      <Text style={{ fontSize: 12, color: isDark ? '#9EACA3' : '#6E7E74' }}>
                        Didn't receive the OTP code?
                      </Text>
                      {resendCooldown > 0 ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#3ADFAB' : '#006C4F' }}>
                          Resend in {resendCooldown}s
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={handleRequestReset} disabled={loading} activeOpacity={0.7}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#3ADFAB' : '#006C4F' }}>
                            Resend OTP Code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}

                {/* New Password */}
                <Text style={[styles.inputLabel, { color: isDark ? '#CAD5CE' : '#455A50', marginTop: 14 }]}>
                  NEW PASSWORD
                </Text>
                <View
                  style={[
                    styles.passwordContainer,
                    {
                      backgroundColor: isDark ? '#1C2621' : '#F6F8F7',
                      borderColor: isDark ? '#2E3D35' : '#DCE3DF',
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.passwordInput,
                      { color: isDark ? '#FFFFFF' : '#1F2A24' },
                    ]}
                    placeholder="At least 6 characters"
                    placeholderTextColor={isDark ? '#6E7E74' : '#9EACA3'}
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={isDark ? '#9EACA3' : '#6E7E74'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm New Password */}
                <Text style={[styles.inputLabel, { color: isDark ? '#CAD5CE' : '#455A50', marginTop: 12 }]}>
                  CONFIRM NEW PASSWORD
                </Text>
                <View
                  style={[
                    styles.passwordContainer,
                    {
                      backgroundColor: isDark ? '#1C2621' : '#F6F8F7',
                      borderColor: isDark ? '#2E3D35' : '#DCE3DF',
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.passwordInput,
                      { color: isDark ? '#FFFFFF' : '#1F2A24' },
                    ]}
                    placeholder="Re-type new password"
                    placeholderTextColor={isDark ? '#6E7E74' : '#9EACA3'}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={isDark ? '#9EACA3' : '#6E7E74'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: loading || isSuccess ? '#6B7280' : (isDark ? '#3ADFAB' : '#006C4F'),
                      marginTop: 18,
                    },
                  ]}
                  onPress={handleUpdatePassword}
                  disabled={loading || isSuccess}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={isDark ? '#002116' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: isDark ? '#002116' : '#FFFFFF' },
                      ]}
                    >
                      VERIFY OTP & SAVE NEW PASSWORD
                    </Text>
                  )}
                </TouchableOpacity>

                {!isRecoverySessionActive && (
                  <TouchableOpacity
                    onPress={() => setStep('request')}
                    style={styles.switchStepBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.switchStepText, { color: isDark ? '#9EACA3' : '#6E7E74' }]}>
                      ‹ Request a new code or change email
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        } as any)
      : {}),
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 4,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxText: {
    fontSize: 20,
    fontWeight: '800',
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  switchStepBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchStepText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#C3E7D3',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006C4F',
  },
});
