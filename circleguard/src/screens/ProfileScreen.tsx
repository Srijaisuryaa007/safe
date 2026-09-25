import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Contacts from 'expo-contacts/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME, getThemeCardStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';
import { validateImageUpload } from '../lib/fileUploadSecurity';
import { handleServiceError } from '../lib/errorHandler';

// Modals
import EmergencyContactsModal from '../components/EmergencyContactsModal';
import MedicalInfoModal from '../components/MedicalInfoModal';
import AppearanceModal from '../components/AppearanceModal';
import PrivacySecurityModal from '../components/PrivacySecurityModal';
import NotificationsModal from '../components/NotificationsModal';
import SettingsModal from '../components/SettingsModal';
import AboutCircleGuardModal from '../components/AboutCircleGuardModal';
import LogoutModal from '../components/LogoutModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import EditProfileModal from '../components/EditProfileModal';
import CountrySelectorModal from '../components/CountrySelectorModal';
import BillionDollarProfileView from '../components/BillionDollarProfileView';
import { useCountryStore } from '../store/useCountryStore';

import SpringTouchable from '../components/SpringTouchable';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';

import PaywallModal from '../components/PaywallModal';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

interface PrimaryContact {
  name: string;
  phone: string;
}

export default function ProfileScreen() {
  const { colors, isDark, themeMode } = useThemeStore();
  const { profile, session, setProfile } = useAuthStore();
  const { isPremium } = useSubscriptionStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [userDob, setUserDob] = useState('07/08/2004');
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [profile?.avatar_url]);

  const [emergencyContact, setEmergencyContact] = useState<PrimaryContact | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = React.useRef<any>(null);

  const userEmail = (profile as any)?.email || session?.user?.email || 'No email registered';
  const userPhone = profile?.phone || 'No phone number added';

  const getPrimaryContactKey = (uid?: string) => uid ? `@circleguard_primary_emergency_contact_${uid}` : '@circleguard_primary_emergency_contact';
  const getContactsListKey = (uid?: string) => uid ? `@circleguard_emergency_contacts_${uid}` : '@circleguard_emergency_contacts';
  const getDobStorageKey = (uid?: string) => uid ? `@circleguard_user_dob_${uid}` : '@circleguard_user_dob';

  React.useEffect(() => {
    const loadUserDob = async () => {
      if (!profile?.id) return;
      try {
        const saved = await AsyncStorage.getItem(getDobStorageKey(profile.id));
        if (saved) {
          setUserDob(saved);
        } else if ((profile as any)?.dob) {
          setUserDob((profile as any).dob);
        } else if ((profile as any)?.date_of_birth) {
          setUserDob((profile as any).date_of_birth);
        }
      } catch (e) {}
    };
    loadUserDob();
  }, [profile?.id, profile]);

  const loadPrimaryEmergencyContact = React.useCallback(async () => {
    // 1. Check cloud profile
    const cloudContacts = (profile as any)?.emergency_contacts;
    if (Array.isArray(cloudContacts) && cloudContacts.length > 0) {
      setEmergencyContact({ name: cloudContacts[0].name, phone: cloudContacts[0].phone });
      return;
    }

    if (!profile?.id) {
      const globalSaved = await AsyncStorage.getItem('@circleguard_primary_emergency_contact');
      if (globalSaved) {
        try {
          setEmergencyContact(JSON.parse(globalSaved));
        } catch (e) {}
      }
      return;
    }

    try {
      const saved = await AsyncStorage.getItem(getPrimaryContactKey(profile.id));
      if (saved) {
        setEmergencyContact(JSON.parse(saved));
      } else {
        const savedList = await AsyncStorage.getItem(getContactsListKey(profile.id));
        if (savedList) {
          const list = JSON.parse(savedList);
          if (list && list.length > 0) {
            setEmergencyContact({ name: list[0].name, phone: list[0].phone });
          } else {
            setEmergencyContact(null);
          }
        } else {
          const globalSaved = await AsyncStorage.getItem('@circleguard_primary_emergency_contact');
          if (globalSaved) {
            setEmergencyContact(JSON.parse(globalSaved));
          } else {
            setEmergencyContact(null);
          }
        }
      }
    } catch (e) {}
  }, [profile?.id, profile]);

  React.useEffect(() => {
    loadPrimaryEmergencyContact();
  }, [loadPrimaryEmergencyContact]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handlePickEmergencyContactFromPhone = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Denied',
          message: 'Permission to access contacts is required to select an emergency contact from your phone.',
          type: 'warning',
        });
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();
      if (contact) {
        const contactName =
          contact.name ||
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
          'Emergency Contact';

        let phoneNumber = '';
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          phoneNumber = contact.phoneNumbers[0].number || '';
        }

        if (!phoneNumber) {
          showAlert({
            title: 'No Phone Number',
            message: `${contactName} does not have a valid phone number in your contacts.`,
            type: 'warning',
          });
          return;
        }

        const item: PrimaryContact = {
          name: contactName,
          phone: phoneNumber,
        };

        setEmergencyContact(item);
        await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify(item));
        if (profile?.id) {
          await AsyncStorage.setItem(getPrimaryContactKey(profile.id), JSON.stringify(item));

          // Synchronize with the emergency contacts list and cloud profile
          try {
            const savedList = await AsyncStorage.getItem(getContactsListKey(profile.id));
            let currentList: any[] = savedList ? JSON.parse(savedList) : [];
            if (!currentList.some((c: any) => c.phone === phoneNumber)) {
              currentList.push({
                id: Date.now().toString(),
                name: contactName,
                phone: phoneNumber,
                relationship: 'Emergency Contact',
              });
              await AsyncStorage.setItem(getContactsListKey(profile.id), JSON.stringify(currentList));
              await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(currentList));
              useAuthStore.getState().setProfile({ ...profile, emergency_contacts: currentList });
              await supabase.from('profiles').update({ emergency_contacts: currentList }).eq('id', profile.id);
            }
          } catch (e) {}
        }

        triggerToast('Emergency contact number added successfully');
      }
    } catch (err: any) {
      console.error('Error selecting contact:', err);
      showAlert({
        title: 'Contact Picker Error',
        message: err.message || 'Unable to open phone contacts.',
        type: 'error',
      });
    }
  };

  const handleDeletePrimaryContact = () => {
    showConfirm({
      title: 'Remove Emergency Contact',
      message: `Remove ${emergencyContact?.name || 'this contact'} as your primary emergency contact?`,
      confirmText: 'REMOVE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        const removedPhone = emergencyContact?.phone;
        setEmergencyContact(null);
        await AsyncStorage.removeItem('@circleguard_primary_emergency_contact');
        if (profile?.id) {
          await AsyncStorage.removeItem(getPrimaryContactKey(profile.id));
          try {
            const savedList = await AsyncStorage.getItem(getContactsListKey(profile.id));
            if (savedList) {
              let currentList: any[] = JSON.parse(savedList);
              currentList = currentList.filter((c: any) => c.phone !== removedPhone);
              await AsyncStorage.setItem(getContactsListKey(profile.id), JSON.stringify(currentList));
              await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(currentList));
              useAuthStore.getState().setProfile({ ...profile, emergency_contacts: currentList });
              await supabase.from('profiles').update({ emergency_contacts: currentList }).eq('id', profile.id);
            }
          } catch (e) {}
        }
        triggerToast('Emergency contact removed successfully');
      },
    });
  };

  const onRefresh = async () => {
    if (profile?.id) {
      setRefreshing(true);
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
        if (data) setProfile(data);
      } catch(e) {}
      setRefreshing(false);
    }
  };

  // Modal Visibility State
  const { country } = useCountryStore();
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [medicalModalVisible, setMedicalModalVisible] = useState(false);
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);

  const handlePickAvatar = async () => {
    if (!profile) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert({
          title: 'Permission Required',
          message: 'Permission to access media library is required to update profile picture.',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      const asset = result.assets[0];
      const uri = asset.uri;
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Strict validation: File size, magic bytes, script/SVG rejection, path isolation
      const validation = validateImageUpload({
        base64Content: base64,
        fileSizeBytes: asset.fileSize,
        userId: profile.id,
      });

      if (!validation.valid || !validation.sanitizedPath) {
        showAlert({
          title: 'Invalid Image',
          message: validation.error || 'Please select a valid JPEG, PNG, or WebP image under 5MB.',
          type: 'warning',
        });
        setUploading(false);
        return;
      }

      const fileName = validation.sanitizedPath;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: validation.detectedMimeType || 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: avatarUrl });
      showAlert({
        title: 'Profile Updated',
        message: 'Your profile details have been saved.',
        type: 'success',
      });
    } catch (err: any) {
      const cleanMessage = handleServiceError('ProfileScreen:uploadAvatar', err, 'Failed to update profile picture. Please try again.');
      showAlert({
        title: 'Upload Failed',
        message: cleanMessage,
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleMenuPress = (label: string) => {
    switch (label) {
      case 'Emergency Contacts':
        setContactsModalVisible(true);
        break;
      case 'Emergency Region & Hotlines':
        setCountryModalVisible(true);
        break;
      case 'Medical Information':
        setMedicalModalVisible(true);
        break;
      case 'Appearance':
        setAppearanceModalVisible(true);
        break;
      case 'Phone & Notifications':
        setNotifModalVisible(true);
        break;
      case 'Settings':
        setSettingsModalVisible(true);
        break;
      case 'Privacy & Security':
        setPrivacyModalVisible(true);
        break;
      case 'About CircleGuard':
        setAboutModalVisible(true);
        break;
      default:
        showAlert({
          title: label,
          message: `${label} settings are fully configured and up to date.`,
          type: 'info',
          buttonText: 'OK',
        });
        break;
    }
  };

  const initial = String(profile?.full_name || 'U').charAt(0).toUpperCase();

  const menuSections = [
    {
      title: 'SAFETY & EMERGENCY PROTOCOLS',
      items: [
        { icon: 'call-outline', label: 'Emergency Contacts' },
        { icon: 'globe-outline', label: `Emergency Region & Hotlines (${country.flag} ${country.name})` },
        { icon: 'medical-outline', label: 'Medical Information' },
        { icon: 'notifications-outline', label: 'Phone & Notifications' },
      ],
    },
    {
      title: 'SYSTEM & PREFERENCES',
      items: [
        { icon: 'settings-outline', label: 'Settings' },
        { icon: 'lock-closed-outline', label: 'Privacy & Security' },
        { icon: 'color-palette-outline', label: 'Appearance' },
      ],
    },
    {
      title: 'APPLICATION INFO',
      items: [
        { icon: 'information-circle-outline', label: 'About CircleGuard' },
      ],
    },
  ];

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <LuxuryRadarLoading
          message="LOADING PROFILE..."
          subMessage="Decrypting settings"
          size={130}
        />
      </View>
    );
  }

  // Modern unified interface for both Light and Dark mode
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#111317' : '#FAF9F6' }}>
      <BillionDollarProfileView
          profile={profile}
          userPhone={userPhone}
          userEmail={userEmail}
          userDob={userDob}
          uploading={uploading}
          imageError={imageError}
          setImageError={setImageError}
          emergencyContact={emergencyContact}
          country={country}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onPickAvatar={handlePickAvatar}
          onEditProfile={() => setEditProfileModalVisible(true)}
          onOpenContacts={() => setContactsModalVisible(true)}
          onPickContactFromPhone={handlePickEmergencyContactFromPhone}
          onDeleteContact={handleDeletePrimaryContact}
          onOpenMedical={() => setMedicalModalVisible(true)}
          onOpenCountry={() => setCountryModalVisible(true)}
          onOpenAppearance={() => setAppearanceModalVisible(true)}
          onOpenNotifications={() => setNotifModalVisible(true)}
          onOpenPrivacy={() => setPrivacyModalVisible(true)}
          onOpenSettings={() => setSettingsModalVisible(true)}
          onOpenAbout={() => setAboutModalVisible(true)}
          onOpenLogout={() => setLogoutModalVisible(true)}
          onOpenDeleteAccount={() => setDeleteAccountModalVisible(true)}
          showToast={(msg) => triggerToast(msg)}
        />

        {/* Floating Success/Status Toast Banner */}
        {toastMessage && (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={[styles.toastCard, { backgroundColor: '#1F2A24' }]}>
              <View style={[styles.toastIconCircle, { backgroundColor: '#2E7D5B' }]}>
                <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
              </View>
              <Text style={[styles.toastText, { color: '#FAF9F6' }]}>{toastMessage}</Text>
            </View>
          </View>
        )}

        {/* Interactive Modals */}
        <EmergencyContactsModal 
          visible={contactsModalVisible} 
          onClose={() => setContactsModalVisible(false)} 
          onContactsUpdated={loadPrimaryEmergencyContact}
        />
        <MedicalInfoModal 
          visible={medicalModalVisible} 
          onClose={() => setMedicalModalVisible(false)} 
        />
        <AppearanceModal 
          visible={appearanceModalVisible} 
          onClose={() => setAppearanceModalVisible(false)} 
        />
        <PrivacySecurityModal
          visible={privacyModalVisible}
          onClose={() => setPrivacyModalVisible(false)}
        />
        <NotificationsModal
          visible={notifModalVisible}
          onClose={() => setNotifModalVisible(false)}
        />
        <SettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
        />
        <AboutCircleGuardModal
          visible={aboutModalVisible}
          onClose={() => setAboutModalVisible(false)}
        />
        <LogoutModal
          visible={logoutModalVisible}
          onClose={() => setLogoutModalVisible(false)}
        />
        <DeleteAccountModal
          visible={deleteAccountModalVisible}
          onClose={() => setDeleteAccountModalVisible(false)}
        />
        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          gatedFeatureName="CircleGuard Plus Executive Features"
        />
        <EditProfileModal
          visible={editProfileModalVisible}
          onClose={() => setEditProfileModalVisible(false)}
          onProfileUpdated={onRefresh}
        />
        <CountrySelectorModal
          visible={countryModalVisible}
          onClose={() => setCountryModalVisible(false)}
        />
      </View>
    );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
