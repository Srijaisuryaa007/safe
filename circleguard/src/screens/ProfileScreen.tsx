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
import { LUXURY_THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';

// Modals
import EmergencyContactsModal from '../components/EmergencyContactsModal';
import MedicalInfoModal from '../components/MedicalInfoModal';
import AppearanceModal from '../components/AppearanceModal';
import PrivacySecurityModal from '../components/PrivacySecurityModal';
import NotificationsModal from '../components/NotificationsModal';
import SettingsModal from '../components/SettingsModal';
import AboutCircleGuardModal from '../components/AboutCircleGuardModal';
import LogoutModal from '../components/LogoutModal';

import SpringTouchable from '../components/SpringTouchable';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';

import PaywallModal from '../components/PaywallModal';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

interface PrimaryContact {
  name: string;
  phone: string;
}

export default function ProfileScreen() {
  const { colors, isDark } = useThemeStore();
  const { profile, session, setProfile } = useAuthStore();
  const { isPremium } = useSubscriptionStore();
  const { showAlert } = useLuxuryAlert();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const [emergencyContact, setEmergencyContact] = useState<PrimaryContact | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = React.useRef<any>(null);

  const userEmail = (profile as any)?.email || session?.user?.email || 'mylambo0708@gmail.com';
  const userPhone = profile?.phone || '+91 80729 86912';

  React.useEffect(() => {
    const loadPrimaryEmergencyContact = async () => {
      try {
        const saved = await AsyncStorage.getItem('@circleguard_primary_emergency_contact');
        if (saved) {
          setEmergencyContact(JSON.parse(saved));
        } else {
          const savedList = await AsyncStorage.getItem('@circleguard_emergency_contacts');
          if (savedList) {
            const list = JSON.parse(savedList);
            if (list && list.length > 0) {
              setEmergencyContact({ name: list[0].name, phone: list[0].phone });
            }
          }
        }
      } catch (e) {}
    };
    loadPrimaryEmergencyContact();
  }, []);

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

        // Synchronize with the emergency contacts list
        try {
          const savedList = await AsyncStorage.getItem('@circleguard_emergency_contacts');
          let currentList: any[] = savedList ? JSON.parse(savedList) : [];
          if (!currentList.some((c: any) => c.phone === phoneNumber)) {
            currentList.push({
              id: Date.now().toString(),
              name: contactName,
              phone: phoneNumber,
              relationship: 'Emergency Contact',
            });
            await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(currentList));
          }
        } catch (e) {}

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
    Alert.alert(
      'Remove Emergency Contact',
      `Remove ${emergencyContact?.name || 'this contact'} as your emergency contact?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setEmergencyContact(null);
            await AsyncStorage.removeItem('@circleguard_primary_emergency_contact');
            triggerToast('Emergency contact removed successfully');
          },
        },
      ]
    );
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
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [medicalModalVisible, setMedicalModalVisible] = useState(false);
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

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
      const uri = result.assets[0].uri;
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `${profile.id}/${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
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
      console.error('Avatar upload error:', err);
      showAlert({
        title: 'Upload Failed',
        message: err.message || 'Failed to update profile picture.',
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
        Alert.alert(label, `${label} settings are up to date.`);
        break;
    }
  };

  const initial = String(profile?.full_name || 'U').charAt(0).toUpperCase();

  const menuSections = [
    {
      title: 'SAFETY & EMERGENCY PROTOCOLS',
      items: [
        { icon: 'call-outline', label: 'Emergency Contacts' },
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
        }
      >
        {/* Top Navigation Header Title */}
        <View style={styles.topNavRow}>
          <Text style={[styles.topNavTitle, { color: colors.foreground }]}>My Profile</Text>
        </View>

        {/* Profile Card Matching Screenshots */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 20 }]}>
          {/* Avatar and Edit Icon */}
          <View style={styles.avatarRow}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploading}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.foreground }]}>
                  <Text style={[styles.avatarText, { color: colors.background }]}>{initial}</Text>
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: colors.accentGold }]}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.topRightEditBtn}
              onPress={handlePickAvatar}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* User Full Name */}
          <Text style={[styles.name, { color: colors.foreground }]}>
            {(profile?.full_name || 'SRI JAI SURYAA').toUpperCase()}
          </Text>

          {/* Profile Details (Phone, Email, Birthday) */}
          <View style={styles.profileDetailsCol}>
            <View style={styles.detailItemRow}>
              <Ionicons name="call-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.detailItemText, { color: colors.foreground }]}>{userPhone}</Text>
            </View>

            <View style={styles.detailItemRow}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.detailItemText, { color: colors.foreground }]}>{userEmail}</Text>
            </View>

            <View style={styles.detailItemRow}>
              <Ionicons name="gift-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.detailItemText, { color: colors.foreground }]}>
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '07/08/2004'}
              </Text>
            </View>
          </View>
        </View>

      {/* Segregated Menu Sections */}
      {menuSections.map((section, secIdx) => (
        <View key={secIdx} style={styles.sectionContainer}>
          <Text style={[styles.sectionTitleHeader, { color: colors.textMuted }]}>
            {section.title}
          </Text>
          <View style={[styles.menuContainer, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 }]}>
            {section.items.map((item, index) => {
              const isEmergencyRow = item.label === 'Emergency Contacts';

              if (isEmergencyRow) {
                return (
                  <View 
                    key={index} 
                    style={[styles.menuItem, styles.emergencyCombinedItem, { borderBottomColor: index === section.items.length - 1 ? 'transparent' : colors.border }]}
                  >
                    <TouchableOpacity 
                      style={styles.emergencyLeftCombined} 
                      onPress={() => setContactsModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call-outline" size={20} color={colors.foreground} />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.menuLabel, { color: colors.foreground }]}>Emergency Contacts</Text>
                        <Text style={[styles.emergencySubLabel, { color: emergencyContact ? colors.foreground : colors.textMuted }]}>
                          {emergencyContact ? `${emergencyContact.name}, ${emergencyContact.phone}` : 'Choose Your Emergency Contact'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.emergencyActionsCombined}>
                      {emergencyContact ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <TouchableOpacity 
                            onPress={handlePickEmergencyContactFromPhone}
                            style={styles.actionPencilBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="pencil-outline" size={20} color="#EF4444" />
                          </TouchableOpacity>

                          <TouchableOpacity 
                            onPress={handleDeletePrimaryContact}
                            style={styles.actionTrashBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => setContactsModalVisible(true)}>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity 
                            onPress={handlePickEmergencyContactFromPhone}
                            style={styles.actionAddPlusBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add-circle-outline" size={28} color="#EF4444" />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => setContactsModalVisible(true)}>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }

              return (
                <SpringTouchable 
                  key={index} 
                  style={[styles.menuItem, { borderBottomColor: index === section.items.length - 1 ? 'transparent' : colors.border }]} 
                  onPress={() => handleMenuPress(item.label)}
                  scaleTo={0.97}
                >
                  <View style={styles.menuLeft}>
                    <Ionicons name={item.icon as any} size={20} color={colors.foreground} />
                    <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </SpringTouchable>
              );
            })}
          </View>
        </View>
      ))}

      {/* Session & Account Security Action Cards */}
      <View style={styles.actionSectionContainer}>
        <Text style={[styles.actionSectionTitle, { color: colors.textMuted }]}>
          SESSION & ACCOUNT SECURITY
        </Text>

        <View style={styles.actionButtonsCol}>
          {/* Disconnect GPS Session Button */}
          <SpringTouchable
            style={[
              styles.actionBoxBtn,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
              },
            ]}
            onPress={() => setPrivacyModalVisible(true)}
            scaleTo={0.96}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
              <Ionicons name="radio-outline" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: isDark ? '#FBBF24' : '#D97706' }]}>
                DISCONNECT GPS SESSION
              </Text>
              <Text style={[styles.actionBtnSub, { color: colors.textMuted }]}>
                Pause active live circle location broadcast
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </SpringTouchable>

          {/* Logout Account Button */}
          <SpringTouchable
            style={[
              styles.actionBoxBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
              },
            ]}
            onPress={() => setLogoutModalVisible(true)}
            scaleTo={0.96}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.18)' }]}>
              <Ionicons name="power" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: '#EF4444' }]}>
                LOGOUT OF ACCOUNT
              </Text>
              <Text style={[styles.actionBtnSub, { color: colors.textMuted }]}>
                Sign out of Supabase profile session
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </SpringTouchable>
        </View>
      </View>

      {/* Interactive Modals */}
      <EmergencyContactsModal 
        visible={contactsModalVisible} 
        onClose={() => setContactsModalVisible(false)} 
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

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        gatedFeatureName="CircleGuard Plus Executive Features"
      />
    </ScrollView>

    {/* Floating Success/Status Toast Banner Matching Screenshot */}
    {toastMessage && (
      <View style={styles.toastContainer} pointerEvents="none">
        <View style={styles.toastCard}>
          <View style={styles.toastIconCircle}>
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
          </View>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      </View>
    )}
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  content: {
    padding: 20,
    paddingTop: 46,
    paddingBottom: 40,
  },
  topNavRow: {
    marginBottom: 16,
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerCard: {
    alignItems: 'flex-start',
    marginBottom: 24,
    borderRadius: 20,
  },
  avatarRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topRightEditBtn: {
    padding: 6,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D4AF37',
    borderWidth: 1,
    borderColor: '#0D0E12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 19,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  profileDetailsCol: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailItemText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardDivider: {
    width: '100%',
    height: 1,
    marginVertical: 14,
    opacity: 0.6,
  },
  emergencyRowContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  emergencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emergencyHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emergencyHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  emergencyActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyCombinedItem: {
    paddingVertical: 14,
  },
  emergencyLeftCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  emergencySubLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  emergencyActionsCombined: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionPencilBtn: {
    padding: 4,
  },
  actionTrashBtn: {
    padding: 4,
  },
  actionAddPlusBtn: {
    padding: 2,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 85,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#262626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: '92%',
  },
  toastIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  phoneText: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
  },
  badgeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    width: '100%',
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '65%',
  },
  goldBadgeText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewBenefitsBtn: {
    backgroundColor: LUXURY_THEME.colors.accentGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  viewBenefitsBtnText: {
    color: '#1A1A1A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitleHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 4,
    marginBottom: 8,
  },
  menuContainer: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
  },
  actionSectionContainer: {
    gap: 10,
    marginBottom: 20,
  },
  actionSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  actionButtonsCol: {
    gap: 10,
  },
  actionBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionBtnSub: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
