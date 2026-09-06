import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useCountryStore, SUPPORTED_COUNTRIES, CountryInfo } from '../store/useCountryStore';
import CountrySelectorModal from './CountrySelectorModal';
import {
  validateAndNormalizePhone,
  checkDuplicatePhoneNumber,
  detectCountryFromPhone,
  extractNationalDigits,
  COUNTRY_PHONE_RULES,
  DEFAULT_PHONE_RULE,
} from '../lib/phoneValidation';
import { getThemeCardStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';
import { useLuxuryAlert } from './LuxuryAlertModal';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function EditProfileModal({ visible, onClose, onProfileUpdated }: EditProfileModalProps) {
  const { colors, themeMode, isDark } = useThemeStore();
  const { profile, session, setProfile } = useAuthStore();
  const { country: globalCountry, countryCode: globalCountryCode } = useCountryStore();
  const { showAlert } = useLuxuryAlert();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(globalCountryCode || 'IN');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const cardStyles = getThemeCardStyles(themeMode);
  const primaryBtnStyles = getThemeButtonStyles(themeMode, 'primary');
  const secondaryBtnStyles = getThemeButtonStyles(themeMode, 'secondary');

  const selectedCountry = SUPPORTED_COUNTRIES[phoneCountryCode] || globalCountry || SUPPORTED_COUNTRIES.IN;
  const phoneRule = COUNTRY_PHONE_RULES[phoneCountryCode] || {
    ...DEFAULT_PHONE_RULE,
    dialCode: selectedCountry?.dialCode || '+1',
  };

  const cleanDigits = phone.replace(/\D/g, '');
  const isLengthMatched = phoneRule.minLen === phoneRule.maxLen
    ? cleanDigits.length === phoneRule.minLen
    : cleanDigits.length >= phoneRule.minLen && cleanDigits.length <= phoneRule.maxLen;
  const isOverflow = cleanDigits.length > phoneRule.maxLen;

  const getDobStorageKey = (uid?: string) => uid ? `@circleguard_user_dob_${uid}` : '@circleguard_user_dob';

  useEffect(() => {
    if (visible && profile) {
      setFullName(profile.full_name || '');
      const detected = detectCountryFromPhone(profile.phone, globalCountryCode || 'IN');
      setPhoneCountryCode(detected);
      setPhone(extractNationalDigits(profile.phone, detected));
      setEmail((profile as any)?.email || session?.user?.email || '');
      setAvatarUrl(profile.avatar_url || null);

      // Load persistent DOB
      const loadDob = async () => {
        try {
          const savedDob = await AsyncStorage.getItem(getDobStorageKey(profile.id));
          if (savedDob) {
            setDob(savedDob);
          } else if ((profile as any)?.date_of_birth) {
            setDob((profile as any).date_of_birth);
          } else if ((profile as any)?.dob) {
            setDob((profile as any).dob);
          } else {
            setDob('07/08/2004');
          }
        } catch (e) {
          setDob('07/08/2004');
        }
      };
      loadDob();
    }
  }, [visible, profile, session]);

  const handlePickPhoto = async () => {
    if (!profile?.id) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert({
          title: 'Permission Required',
          message: 'Permission to access photo library is required to update your profile photo.',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setUploadingPhoto(true);
      const uri = result.assets[0].uri;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `${profile.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = publicUrlData.publicUrl;
      setAvatarUrl(newAvatarUrl);

      // Instantly persist avatar to Supabase and Zustand store so it's never lost if modal is closed
      const { error: avatarUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', profile.id);

      if (!avatarUpdateError) {
        setProfile({ ...profile, avatar_url: newAvatarUrl });
      }

      showAlert({
        title: 'Photo Updated',
        message: 'Your new profile photo has been saved successfully.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Photo selection error:', err);
      showAlert({
        title: 'Upload Failed',
        message: err.message || 'Unable to upload profile photo.',
        type: 'error',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    if (!fullName.trim()) {
      showAlert({
        title: 'Missing Name',
        message: 'Please enter your full name.',
        type: 'warning',
      });
      return;
    }

    let validatedPhone: string | null = null;
    if (phone.trim()) {
      // 1. Strict country phone validation & E.164 normalization
      const validation = validateAndNormalizePhone(phone, phoneCountryCode);
      if (!validation.isValid) {
        showAlert({
          title: 'Invalid Phone Number',
          message: validation.error || `Please enter a valid mobile number for ${selectedCountry.name}.`,
          type: 'warning',
        });
        return;
      }

      setSaving(true);
      // 2. Proactive duplicate phone check across all profiles
      const dupCheck = await checkDuplicatePhoneNumber(validation.e164, profile.id);
      if (dupCheck.isDuplicate) {
        showAlert({
          title: 'Phone Number In Use',
          message: dupCheck.error || 'This phone number is already registered to another account. Every member must have a unique mobile number.',
          type: 'error',
        });
        setSaving(false);
        return;
      }

      validatedPhone = validation.e164;
    }

    setSaving(true);
    try {
      // 1. Update Supabase Profiles Table
      const updatePayload: any = {
        full_name: fullName.trim(),
        phone: validatedPhone,
        avatar_url: avatarUrl,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id);

      if (profileError) {
        console.warn('Profile direct update warning:', profileError);
        if (profileError.message && (profileError.message.includes('unique constraint') || profileError.message.includes('profiles_phone_key'))) {
          showAlert({
            title: 'Phone Already Registered',
            message: 'This phone number is already registered to another account. Every member must have a unique mobile number.',
            type: 'error',
          });
          setSaving(false);
          return;
        }
        throw profileError;
      }

      // 2. Persist DOB locally and in metadata
      if (dob.trim()) {
        await AsyncStorage.setItem(getDobStorageKey(profile.id), dob.trim());
      }

      // 3. Update Email if changed and valid
      if (email.trim() && session?.user?.email && email.trim().toLowerCase() !== session.user.email.toLowerCase()) {
        try {
          const { error: emailError } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
          if (emailError) {
            console.warn('Auth email update notice:', emailError.message);
          } else {
            showAlert({
              title: 'Email Confirmation Sent',
              message: `A confirmation link was sent to ${email.trim()}. Please verify your new email address.`,
              type: 'info',
            });
          }
        } catch (e) {}
      }

      // 4. Update Local Zustand Auth Store
      const updatedProfile = {
        ...profile,
        full_name: fullName.trim(),
        phone: validatedPhone,
        avatar_url: avatarUrl,
        email: email.trim(),
        dob: dob.trim(),
      };
      setProfile(updatedProfile);

      showAlert({
        title: 'Profile Updated',
        message: 'Your personal information, contact number, and photo have been updated successfully.',
        type: 'success',
      });

      if (onProfileUpdated) {
        onProfileUpdated();
      }
      onClose();
    } catch (err: any) {
      console.error('Save profile error:', err);
      showAlert({
        title: 'Update Failed',
        message: err.message || 'Unable to update profile info.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const initial = (fullName || profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, cardStyles, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.headerIconBox, { backgroundColor: `${colors.accentGold}18` }]}>
                <Ionicons name="person-outline" size={18} color={colors.accentGold} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>EDIT PROFILE INFO</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Photo Avatar Preview & Change Button */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={[styles.avatarWrapper, { borderColor: colors.accentGold }]}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accentGold }]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}

                <View style={[styles.cameraBadge, { backgroundColor: colors.accentGold }]}>
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#121212" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#121212" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} style={{ marginTop: 8 }}>
                <Text style={[styles.changePhotoText, { color: colors.accentGold }]}>
                  {uploadingPhoto ? 'UPLOADING...' : 'CHANGE PROFILE PHOTO'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FULL NAME</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="person" size={18} color={colors.accentGold} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Mobile Number */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MOBILE NUMBER</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.background,
                      borderColor: isOverflow
                        ? '#EF4444'
                        : isLengthMatched
                        ? '#10B981'
                        : colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.countryBadgeBtn, { borderRightColor: colors.border }]}
                    onPress={() => setCountryModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14 }}>{selectedCountry.flag}</Text>
                    <Text style={[styles.countryDialText, { color: colors.foreground }]}>{phoneRule.dialCode}</Text>
                    <Ionicons name="chevron-down" size={11} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground, paddingLeft: 8 }]}
                    placeholder={phoneRule.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  {isLengthMatched ? (
                    <Ionicons name="checkmark-circle" size={17} color="#10B981" style={{ marginRight: 2 }} />
                  ) : isOverflow ? (
                    <Ionicons name="alert-circle" size={17} color="#EF4444" style={{ marginRight: 2 }} />
                  ) : null}
                </View>

                {/* Country Rule Hint & Digit Counter */}
                <View style={styles.phoneHintRow}>
                  <Text style={[styles.phoneRuleHint, { color: colors.textMuted }]}>
                    {selectedCountry.flag} {selectedCountry.name}: {phoneRule.hint}
                  </Text>
                  <View
                    style={[
                      styles.lengthBadge,
                      {
                        backgroundColor: isLengthMatched
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isOverflow
                          ? 'rgba(239, 68, 68, 0.12)'
                          : cleanDigits.length > 0
                          ? isDark
                            ? 'rgba(212, 175, 55, 0.12)'
                            : 'rgba(212, 175, 55, 0.2)'
                          : isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : '#F3F4F6',
                        borderColor: isLengthMatched
                          ? '#10B981'
                          : isOverflow
                          ? '#EF4444'
                          : cleanDigits.length > 0
                          ? colors.accentGold
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lengthBadgeText,
                        {
                          color: isLengthMatched
                            ? '#10B981'
                            : isOverflow
                            ? '#EF4444'
                            : cleanDigits.length > 0
                            ? colors.accentGold
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {cleanDigits.length} / {phoneRule.minLen === phoneRule.maxLen ? phoneRule.minLen : `${phoneRule.minLen}-${phoneRule.maxLen}`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Date of Birth */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DATE OF BIRTH (DD/MM/YYYY)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="calendar" size={18} color={colors.accentGold} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="e.g. 07/08/2004 or 1998-05-14"
                    placeholderTextColor={colors.textMuted}
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>
              </View>

              {/* Email Address */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>EMAIL ADDRESS</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="mail" size={18} color={colors.accentGold} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.foreground }]}
                    placeholder="your.email@domain.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: secondaryBtnStyles.backgroundColor,
                    borderColor: secondaryBtnStyles.borderColor,
                    borderRadius: secondaryBtnStyles.borderRadius,
                    borderWidth: secondaryBtnStyles.borderWidth,
                  }
                ]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { color: secondaryBtnStyles.textColor }]}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: primaryBtnStyles.backgroundColor,
                    borderColor: primaryBtnStyles.borderColor,
                    borderRadius: primaryBtnStyles.borderRadius,
                    borderWidth: primaryBtnStyles.borderWidth,
                  }
                ]}
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={primaryBtnStyles.textColor} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: primaryBtnStyles.textColor }]}>SAVE CHANGES</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CountrySelectorModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
        onSelectCountry={(c) => {
          setPhoneCountryCode(c.code);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    position: 'relative',
    overflow: 'visible',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#121212',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  changePhotoText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  fieldsContainer: {
    gap: 14,
    marginBottom: 22,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  countryBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
  },
  countryDialText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  phoneHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
    gap: 6,
  },
  phoneRuleHint: {
    fontSize: 10.5,
    fontWeight: '500',
    flex: 1,
  },
  lengthBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lengthBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveBtn: {
    flex: 1.5,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
