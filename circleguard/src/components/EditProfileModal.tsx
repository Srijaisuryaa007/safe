import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useCountryStore, SUPPORTED_COUNTRIES } from '../store/useCountryStore';
import CountrySelectorModal from './CountrySelectorModal';
import {
  validateAndNormalizePhone,
  checkDuplicatePhoneNumber,
  detectCountryFromPhone,
  extractNationalDigits,
  COUNTRY_PHONE_RULES,
  DEFAULT_PHONE_RULE,
} from '../lib/phoneValidation';
import { useLuxuryAlert } from './LuxuryAlertModal';
import { validateImageUpload, readLocalFileAsBase64Async } from '../lib/fileUploadSecurity';
import { handleServiceError } from '../lib/errorHandler';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function EditProfileModal({ visible, onClose, onProfileUpdated }: EditProfileModalProps) {
  const { isDark } = useThemeStore();
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
      const asset = result.assets[0];
      const base64 = await readLocalFileAsBase64Async(asset.uri);

      const validation = validateImageUpload({
        base64Content: base64,
        fileSizeBytes: asset.fileSize,
        userId: profile.id,
      });

      if (!validation.valid || !validation.sanitizedPath) {
        showAlert({
          title: 'Photo Upload',
          message: validation.error || 'Please select a valid image under 5MB.',
          type: 'warning',
        });
        setUploadingPhoto(false);
        return;
      }

      const fileName = validation.sanitizedPath;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: validation.detectedMimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = publicUrlData.publicUrl;
      setAvatarUrl(newAvatarUrl);

      const { error: avatarUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', profile.id);

      if (!avatarUpdateError) {
        setProfile({ ...profile, avatar_url: newAvatarUrl });
      }

      showAlert({
        title: 'Photo Updated',
        message: 'Your profile photo has been updated.',
        type: 'success',
      });
    } catch (err: any) {
      const cleanMessage = handleServiceError('EditProfileModal:uploadPhoto', err, 'Unable to upload profile photo.');
      showAlert({
        title: 'Upload Failed',
        message: cleanMessage,
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
        title: 'Name Required',
        message: 'Please enter your full name.',
        type: 'warning',
      });
      return;
    }

    let validatedPhone: string | null = null;
    if (phone.trim()) {
      const validation = validateAndNormalizePhone(phone, phoneCountryCode);
      if (!validation.isValid) {
        showAlert({
          title: 'Invalid Mobile Number',
          message: validation.error || `Please enter a valid mobile number for ${selectedCountry.name}.`,
          type: 'warning',
        });
        return;
      }

      setSaving(true);
      const dupCheck = await checkDuplicatePhoneNumber(validation.e164, profile.id);
      if (dupCheck.isDuplicate) {
        showAlert({
          title: 'Phone Number in Use',
          message: dupCheck.error || 'This mobile number is already registered to another account.',
          type: 'error',
        });
        setSaving(false);
        return;
      }

      validatedPhone = validation.e164;
    }

    setSaving(true);
    try {
      const safeAvatarUrl = avatarUrl ? avatarUrl : (profile.avatar_url || null);
      const updatePayload: any = {
        full_name: fullName.trim(),
        phone: validatedPhone,
        ...(safeAvatarUrl ? { avatar_url: safeAvatarUrl } : {}),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id);

      if (profileError) throw profileError;

      if (dob.trim()) {
        await AsyncStorage.setItem(getDobStorageKey(profile.id), dob.trim());
      }

      if (email.trim() && email.trim().toLowerCase() !== (session?.user?.email || '').toLowerCase()) {
        try {
          await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
        } catch (_) {}
      }

      const updatedProfile = {
        ...profile,
        full_name: fullName.trim(),
        phone: validatedPhone,
        avatar_url: safeAvatarUrl,
        email: email.trim(),
        dob: dob.trim(),
      };
      setProfile(updatedProfile);

      if (onProfileUpdated) {
        onProfileUpdated();
      }
      onClose();
    } catch (err: any) {
      const cleanMessage = handleServiceError('EditProfileModal:saveProfile', err, 'Unable to update profile.');
      showAlert({
        title: 'Update Failed',
        message: cleanMessage,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const initial = (fullName || profile?.full_name || 'U').charAt(0).toUpperCase();

  // Color tokens
  const bgCard = isDark ? '#101114' : '#FFFFFF';
  const bgInput = isDark ? '#181A20' : '#F6F8FA';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const accentColor = isDark ? '#FFFFFF' : '#0F172A';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: textPrimary }]}>Edit Profile</Text>

            <TouchableOpacity
              onPress={handleSaveProfile}
              activeOpacity={0.7}
              disabled={saving}
              style={styles.headerBtn}
            >
              {saving ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Text style={[styles.headerBtnText, { color: accentColor, fontWeight: '700' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={[styles.avatarWrap, { backgroundColor: bgInput }]}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarInitial, { color: accentColor }]}>{initial}</Text>
                )}

                {uploadingPhoto && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
                style={styles.changePhotoBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.changePhotoText, { color: accentColor }]}>
                  {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Full Name</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: bgInput, borderColor, color: textPrimary }]}
                  placeholder="Enter full name"
                  placeholderTextColor={textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              {/* Mobile Number */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Mobile Number</Text>
                <View style={[styles.phoneInputRow, { backgroundColor: bgInput, borderColor }]}>
                  <TouchableOpacity
                    style={[styles.dialCodeBtn, { borderRightColor: borderColor }]}
                    onPress={() => setCountryModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dialCodeText, { color: textPrimary }]}>
                      {selectedCountry.dialCode}
                    </Text>
                    <Text style={[styles.dialChevron, { color: textSecondary }]}>▾</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.phoneTextInput, { color: textPrimary }]}
                    placeholder={phoneRule.placeholder}
                    placeholderTextColor={textSecondary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.phoneHintRow}>
                  <Text style={[styles.phoneHintText, { color: textSecondary }]}>
                    {selectedCountry.name}: {cleanDigits.length}/{phoneRule.minLen === phoneRule.maxLen ? phoneRule.minLen : `${phoneRule.minLen}-${phoneRule.maxLen}`} digits
                  </Text>
                </View>
              </View>

              {/* Date of Birth */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Date of Birth</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: bgInput, borderColor, color: textPrimary }]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={textSecondary}
                  value={dob}
                  onChangeText={setDob}
                />
              </View>

              {/* Email Address */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Email Address</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: bgInput, borderColor, color: textPrimary }]}
                  placeholder="your.email@example.com"
                  placeholderTextColor={textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 50,
  },
  headerBtnText: {
    fontSize: 15,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scrollBody: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    marginTop: 8,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldsContainer: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dialCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 1,
    height: '100%',
    gap: 4,
  },
  dialCodeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialChevron: {
    fontSize: 12,
  },
  phoneTextInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 15,
  },
  phoneHintRow: {
    paddingLeft: 2,
    marginTop: 2,
  },
  phoneHintText: {
    fontSize: 12,
  },
});
