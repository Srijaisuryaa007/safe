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
import { EmergencyMedicalService, getPrimaryContactStorageKey } from '../services/EmergencyMedicalService';


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
    if (!profile?.id) {
      setEmergencyContact(null);
      return;
    }

    // 1. Check profile in auth store
    const cloudContacts = profile?.emergency_contacts;
    if (Array.isArray(cloudContacts) && cloudContacts.length > 0) {
      setEmergencyContact({ name: cloudContacts[0].name, phone: cloudContacts[0].phone });
      return;
    }

    try {
      const res = await EmergencyMedicalService.fetchEmergencyContacts(profile.id);
      if (res.data && res.data.length > 0) {
        setEmergencyContact({ name: res.data[0].name, phone: res.data[0].phone });
      } else {
        const saved = await AsyncStorage.getItem(getPrimaryContactStorageKey(profile.id));
        if (saved) {
          setEmergencyContact(JSON.parse(saved));
        } else {
          setEmergencyContact(null);
        }
      }
    } catch (e) {
      setEmergencyContact(null);
    }
  }, [profile?.id, profile?.emergency_contacts]);

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
          title: 'Contacts Access Needed',
          message: 'To choose an emergency responder directly from your phone, please enable contacts access in your device settings.',
          type: 'info',
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
            title: 'Phone Number Needed',
            message: `${contactName} doesn't have a phone number saved. Please select a contact with a valid phone number.`,
            type: 'info',
          });
          return;
        }

        const item: PrimaryContact = {
          name: contactName,
          phone: phoneNumber,
        };

        setEmergencyContact(item);

        if (profile?.id) {
          try {
            await AsyncStorage.setItem(getPrimaryContactStorageKey(profile.id), JSON.stringify(item));
            await EmergencyMedicalService.addEmergencyContact(profile.id, {
              name: contactName,
              phone: phoneNumber,
              relationship: 'Emergency Contact',
              sort_order: 0,
            });
          } catch (storageErr) {
            console.warn('[ProfileScreen] Contact persist error:', storageErr);
          }
        }

        triggerToast('Emergency contact added successfully');
      }
    } catch (err: any) {
      console.error('Error selecting contact:', err);
      const rawMsg = (err?.message || '').toLowerCase();
      const isStorageIssue =
        rawMsg.includes('disk') ||
        rawMsg.includes('sqlite') ||
        rawMsg.includes('full') ||
        rawMsg.includes('storage') ||
        rawMsg.includes('code 13') ||
        rawMsg.includes('enospc');

      showAlert({
        title: isStorageIssue ? 'Device Storage Is Low' : 'Unable to Open Contacts',
        message: isStorageIssue
          ? 'Your phone is currently low on storage space, so we could not open your contacts. Please free up a little space on your device, or you can manage your emergency contacts directly in the directory.'
          : 'We were unable to open your contacts list right now. You can try again in a moment, or add your emergency responder directly in the directory.',
        type: 'info',
        tag: isStorageIssue ? '• STORAGE NOTICE' : '• CONTACTS NOTICE',
        buttonText: 'Got It',
        secondaryButtonText: 'Open Directory',
        onSecondaryPress: () => setContactsModalVisible(true),
      });
    }
  };

  const handleDeletePrimaryContact = () => {
    showConfirm({
      title: 'Remove Emergency Contact',
      message: `Would you like to remove ${emergencyContact?.name || 'this contact'} as your primary emergency contact?`,
      confirmText: 'Remove',
      cancelText: 'Keep',
      isDestructive: true,
      onConfirm: async () => {
        const removedPhone = emergencyContact?.phone;
        setEmergencyContact(null);
        if (profile?.id) {
          try {
            await AsyncStorage.removeItem(getPrimaryContactStorageKey(profile.id));
            const currentList = profile.emergency_contacts || [];
            const found = currentList.find((c: any) => c.phone === removedPhone);
            if (found?.id) {
              await EmergencyMedicalService.deleteEmergencyContact(profile.id, found.id);
            }
          } catch (storageErr) {
            console.warn('[ProfileScreen] Removing contact error:', storageErr);
          }
        }
        triggerToast('Emergency contact removed');
      },
    });
  };

  const onRefresh = async () => {
    if (profile?.id) {
      setRefreshing(true);
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
        if (data) setProfile(data);
        await Promise.all([
          EmergencyMedicalService.fetchMedicalInfo(profile.id),
          EmergencyMedicalService.fetchEmergencyContacts(profile.id),
          EmergencyMedicalService.syncPendingQueues(profile.id),
        ]);
        await loadPrimaryEmergencyContact();
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
          title: 'Photo Access Needed',
          message: 'Please allow access to your photos in settings so you can choose a profile picture.',
          type: 'info',
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
          title: 'Photo Selection',
          message: validation.error || 'Please select a photo in JPEG, PNG, or WebP format under 5MB.',
          type: 'info',
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
        message: 'Your new profile photo has been saved.',
        type: 'success',
      });
    } catch (err: any) {
      const cleanMessage = handleServiceError('ProfileScreen:uploadAvatar', err, 'We could not update your profile photo right now. Please try again in a moment.');
      showAlert({
        title: 'Upload Incomplete',
        message: cleanMessage,
        type: 'info',
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
          onSaved={() => triggerToast('Medical profile updated successfully')}
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
