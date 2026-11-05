import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCountryStore, SUPPORTED_COUNTRIES } from '../store/useCountryStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  validateAndNormalizePhone,
  detectCountryFromPhone,
  extractNationalDigits,
  COUNTRY_PHONE_RULES,
  DEFAULT_PHONE_RULE,
} from '../lib/phoneValidation';
import { useLuxuryAlert } from './LuxuryAlertModal';
import { getSafeTopInset } from '../utils/safeArea';
import {
  EmergencyMedicalService,
  getContactsStorageKey,
  getPrimaryContactStorageKey,
  generateContactUUID,
} from '../services/EmergencyMedicalService';
import { pickAndResolveContact } from '../utils/contactPickerHelper';
import CountrySelectorModal from './CountrySelectorModal';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  sort_order?: number;
}

interface EmergencyContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onContactsUpdated?: () => void;
  initialPrimaryContact?: { name: string; phone: string } | null;
}

export default function EmergencyContactsModal({
  visible,
  onClose,
  onContactsUpdated,
  initialPrimaryContact,
}: EmergencyContactsModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { profile, user, session } = useAuthStore();
  const currentUserId = profile?.id || user?.id || session?.user?.id || useAuthStore.getState().user?.id;
  const { country } = useCountryStore();
  const { colors, isDark } = useThemeStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    if (initialPrimaryContact && initialPrimaryContact.phone) {
      return [{
        id: 'primary-init',
        name: initialPrimaryContact.name || 'Emergency Contact',
        phone: initialPrimaryContact.phone,
        relationship: 'Primary Contact',
        sort_order: 0,
      }];
    }
    return [];
  });
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(initialPrimaryContact?.phone || null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPendingSync, setIsPendingSync] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Father');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(country?.code || 'IN');
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  const relationships = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Doctor', 'Other'];

  useEffect(() => {
    if (country?.code) {
      setPhoneCountryCode(country.code);
    }
  }, [country?.code]);

  const selectedCountry = SUPPORTED_COUNTRIES[phoneCountryCode] || country;
  const phoneRule = COUNTRY_PHONE_RULES[phoneCountryCode] || {
    ...DEFAULT_PHONE_RULE,
    dialCode: selectedCountry?.dialCode || country?.dialCode || '+1',
  };
  const cleanDigits = phone.replace(/\D/g, '');
  const isLengthMatched = phoneRule.minLen === phoneRule.maxLen
    ? cleanDigits.length === phoneRule.minLen
    : cleanDigits.length >= phoneRule.minLen && cleanDigits.length <= phoneRule.maxLen;
  const isOverflow = cleanDigits.length > phoneRule.maxLen;

  useEffect(() => {
    if (visible) {
      if (initialPrimaryContact && initialPrimaryContact.phone && contacts.length === 0) {
        setContacts([{
          id: 'primary-init',
          name: initialPrimaryContact.name || 'Emergency Contact',
          phone: initialPrimaryContact.phone,
          relationship: 'Primary Contact',
          sort_order: 0,
        }]);
        setPrimaryPhone(initialPrimaryContact.phone);
      }
      loadContacts();
    }
  }, [visible, currentUserId, initialPrimaryContact]);

  const loadContacts = async () => {
    const effectiveUserId = currentUserId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id;
    if (!effectiveUserId) return;
    try {
      const res = await EmergencyMedicalService.fetchEmergencyContacts(effectiveUserId);
      let loaded: EmergencyContact[] = (res.data || []).map((c: any, idx: number) => ({
        id: c.id || generateContactUUID(),
        name: c.name || 'Emergency Contact',
        phone: c.phone || '',
        relationship: c.relationship || 'Emergency Contact',
        sort_order: c.sort_order ?? idx,
      }));

      // Check primary contact storage keys to guarantee the contact visible on ProfileScreen is NEVER missing
      if (loaded.length === 0) {
        const primaryKeys = [
          getPrimaryContactStorageKey(effectiveUserId),
          `@circleguard_primary_emergency_contact_${effectiveUserId}`,
          '@circleguard_primary_emergency_contact',
          `@circleguard_primary_contact_${effectiveUserId}`,
        ];
        let primaryParsed: { name: string; phone: string } | null = initialPrimaryContact || null;
        for (const pk of primaryKeys) {
          if (primaryParsed) break;
          try {
            const raw = await AsyncStorage.getItem(pk);
            if (raw) {
              const p = JSON.parse(raw);
              if (p && p.phone) {
                primaryParsed = p;
                break;
              }
            }
          } catch (_) {}
        }

        // If contacts list is empty, but we have a primary contact (which shows outside on ProfileScreen)
        if (primaryParsed && primaryParsed.phone) {
          const fallbackContact: EmergencyContact = {
            id: generateContactUUID(),
            name: primaryParsed.name || 'Emergency Contact',
            phone: primaryParsed.phone,
            relationship: 'Primary Contact',
            sort_order: 0,
          };
          loaded = [fallbackContact];
          // Persist to contacts storage so it remains permanently synced
          await AsyncStorage.setItem(getContactsStorageKey(effectiveUserId), JSON.stringify(loaded)).catch(() => {});
          await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(loaded)).catch(() => {});
          useAuthStore.getState().updateProfileFields({ emergency_contacts: loaded });
        }
      }

      // CRITICAL: If loaded is STILL empty, but contacts state already has items (e.g. just added), DO NOT WIPE THEM OUT!
      setContacts((prev) => {
        if (loaded.length === 0 && prev.length > 0) {
          AsyncStorage.setItem(getContactsStorageKey(effectiveUserId), JSON.stringify(prev)).catch(() => {});
          AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(prev)).catch(() => {});
          useAuthStore.getState().updateProfileFields({ emergency_contacts: prev });
          return prev;
        }
        return loaded;
      });

      setIsPendingSync(Boolean(res.pendingSync));

      if (loaded.length > 0) {
        setPrimaryPhone(prev => prev || loaded[0].phone);
      }
    } catch (e) {
      console.error('[EmergencyContactsModal] Error loading emergency contacts:', e);
    }
  };

  const handlePhoneInputChange = (text: string) => {
    // If user pasted or typed full international number with + or spaces
    if (text.startsWith('+') || text.includes(' ')) {
      const detected = detectCountryFromPhone(text, phoneCountryCode);
      if (detected !== phoneCountryCode) {
        setPhoneCountryCode(detected);
      }
      const national = extractNationalDigits(text, detected);
      setPhone(national);
      return;
    }

    const currentRule = COUNTRY_PHONE_RULES[phoneCountryCode] || DEFAULT_PHONE_RULE;
    let digits = text.replace(/[^\d]/g, '');
    if (currentRule.stripTrunkZero && digits.startsWith('0') && digits.length > currentRule.minLen) {
      digits = digits.replace(/^0+/, '');
    }
    setPhone(digits);
  };

  const handleSaveContact = async () => {
    if (!name.trim()) {
      showAlert({
        title: 'Name Required',
        message: 'Please enter the contact name.',
        type: 'warning',
      });
      return;
    }

    if (!phone.trim()) {
      showAlert({
        title: 'Phone Number Required',
        message: 'Please enter a mobile phone number.',
        type: 'warning',
      });
      return;
    }

    const validation = validateAndNormalizePhone(phone, phoneCountryCode);
    if (!validation.isValid) {
      showAlert({
        title: 'Invalid Contact Number',
        message: validation.error || `Please enter a valid phone number for ${selectedCountry.name}.`,
        type: 'warning',
      });
      return;
    }

    // Deduplication check
    const nationalDigits = validation.nationalDigits;
    const e164Digits = validation.e164.replace(/\D/g, '');
    const alreadyExists = contacts.some(
      (c) =>
        c.phone.replace(/\D/g, '') === nationalDigits ||
        c.phone.replace(/\D/g, '') === e164Digits ||
        c.phone === validation.e164 ||
        c.phone === validation.formattedDisplay
    );
    if (alreadyExists) {
      showAlert({
        title: 'Duplicate Contact',
        message: `A contact with phone number ${validation.formattedDisplay} is already in your emergency contacts list.`,
        type: 'warning',
      });
      return;
    }

    if (!currentUserId) {
      showAlert({
        title: 'Sign In Required',
        message: 'Please sign in to add emergency contacts.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);
    const newContactItem: EmergencyContact = {
      id: generateContactUUID(),
      name: name.trim(),
      phone: validation.formattedDisplay,
      relationship,
      sort_order: contacts.length,
    };

    // Optimistically update list so user sees it instantly
    setContacts((prev) => {
      const cleanDigits = newContactItem.phone.replace(/\D/g, '');
      const filtered = prev.filter(c => c.phone.replace(/\D/g, '') !== cleanDigits);
      return [newContactItem, ...filtered];
    });

    try {
      const res = await EmergencyMedicalService.addEmergencyContact(currentUserId, newContactItem);

      if (res.success || res.pendingSync || (res.data && !res.error)) {
        setName('');
        setPhone('');
        setRelationship('Father');
        setIsAdding(false);
        await loadContacts();
        onContactsUpdated?.();

        showAlert({
          title: res.success ? 'Contact Saved' : 'Saved Offline',
          message: res.success
            ? `${name.trim()} (${validation.formattedDisplay}) has been saved to your emergency directory.`
            : `${name.trim()} saved offline and will sync once network is restored.`,
          type: 'success',
        });
      } else {
        // Keep form input intact on failure
        showAlert({
          title: 'Unable to Save Contact',
          message: res.error || 'Failed to save contact to database. Your input was preserved.',
          type: 'error',
        });
      }
    } catch (err: any) {
      showAlert({
        title: 'Save Failed',
        message: err?.message || 'Something went wrong while saving.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async (c: EmergencyContact) => {
    setPrimaryPhone(c.phone);
    if (currentUserId) {
      await AsyncStorage.setItem(getPrimaryContactStorageKey(currentUserId), JSON.stringify({ name: c.name, phone: c.phone }));
    }
    onContactsUpdated?.();
    showAlert({
      title: 'Primary Contact Set',
      message: `${c.name} is now your primary emergency responder.`,
      type: 'success',
    });
  };

  const handleDeleteContact = (id: string) => {
    const contactToDelete = contacts.find((c) => c.id === id);
    showConfirm({
      title: 'Remove Contact',
      message: `Are you sure you want to remove ${contactToDelete?.name || 'this contact'} from your emergency directory?`,
      confirmText: 'REMOVE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        if (!currentUserId) return;
        const res = await EmergencyMedicalService.deleteEmergencyContact(currentUserId, id);
        if (res.success || res.pendingSync) {
          // If removed contact was primary, clean up primary key
          if (contactToDelete && primaryPhone === contactToDelete.phone) {
            setPrimaryPhone(null);
            await AsyncStorage.removeItem(getPrimaryContactStorageKey(currentUserId));
          }
          await loadContacts();
          onContactsUpdated?.();
        } else {
          showAlert({
            title: 'Delete Failed',
            message: res.error || 'Could not remove contact from database.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleCall = (phoneNumber: string) => {
    const dialDigits = phoneNumber.replace(/[^\d+*#]/g, '');
    Linking.openURL(`tel:${dialDigits}`).catch((err) => {
      console.warn('[EmergencyContactsModal] Call error:', err);
    });
  };

  const handlePickPhoneContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Contacts Access Needed',
          message: 'To choose an emergency contact directly from your address book, please enable contacts access in your device settings.',
          type: 'info',
        });
        return;
      }

      const res = await pickAndResolveContact(phoneCountryCode || country.code || 'IN');
      if (res.cancelled) return;

      const picked = res.contact;
      if (!picked) return;

      // If contact has no phone numbers found in address book
      if (!picked.hasPhone || picked.phoneNumbers.length === 0) {
        setName(picked.name);
        setPhone('');
        setIsAdding(true);
        showAlert({
          title: 'Phone Number Needed',
          message: `${picked.name} was selected, but no phone number was found in your device contacts. Please type their mobile number below to save.`,
          type: 'info',
        });
        return;
      }

      const finalPhone = picked.formattedPhone || picked.rawPhoneNumber || '';
      const detectedCode = picked.detectedCountry || phoneCountryCode;

      // Deduplication check
      const rawDigits = finalPhone.replace(/\D/g, '');
      const alreadyExists = contacts.some(
        (c) => c.phone.replace(/\D/g, '') === rawDigits
      );
      if (alreadyExists) {
        showAlert({
          title: 'Contact Already Added',
          message: `${picked.name} (${finalPhone}) is already saved in your emergency contacts list.`,
          type: 'info',
        });
        return;
      }

      if (!currentUserId) {
        showAlert({
          title: 'Sign In Required',
          message: 'Please sign in to add emergency contacts.',
          type: 'warning',
        });
        return;
      }

      // Optimistic update: show contact in the list IMMEDIATELY!
      const tempId = generateContactUUID();
      const newContactItem: EmergencyContact = {
        id: tempId,
        name: picked.name,
        phone: finalPhone,
        relationship: 'Emergency Contact',
        sort_order: contacts.length,
      };

      setContacts((prev) => {
        const cleanDigits = finalPhone.replace(/\D/g, '');
        const filtered = prev.filter(c => c.phone.replace(/\D/g, '') !== cleanDigits);
        return [newContactItem, ...filtered];
      });

      const saveRes = await EmergencyMedicalService.addEmergencyContact(currentUserId, newContactItem);
      await loadContacts();
      onContactsUpdated?.();

      if (saveRes.success || saveRes.pendingSync || (saveRes.data && !saveRes.error)) {
        showAlert({
          title: 'Emergency Contact Added',
          message: `${picked.name} (${finalPhone}) has been added to your emergency directory.`,
          type: 'success',
        });
      } else {
        showAlert({
          title: 'Saved Locally',
          message: saveRes.error || 'Contact saved locally and will sync once network is available.',
          type: 'info',
        });
      }
    } catch (e: any) {
      console.error('Error picking phone contact:', e);
      const rawMsg = (e?.message || '').toLowerCase();
      const isStorageIssue =
        rawMsg.includes('disk') ||
        rawMsg.includes('sqlite') ||
        rawMsg.includes('full') ||
        rawMsg.includes('storage') ||
        rawMsg.includes('code 13') ||
        rawMsg.includes('enospc');

      showAlert({
        title: isStorageIssue ? 'Device Storage Is Low' : 'Unable to Access Contacts',
        message: isStorageIssue
          ? 'Your phone is currently low on storage space, so we could not open your address book. You can easily type their name and phone number below.'
          : 'We could not open your address book right now. You can easily type their name and phone number below.',
        type: 'info',
        tag: isStorageIssue ? '• STORAGE NOTICE' : '• CONTACTS NOTICE',
        buttonText: 'Type Manually',
        onPress: () => setIsAdding(true),
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FAF9F6' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Clean Header Bar */}
        <View style={[styles.header, { paddingTop: topInset + 6, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F26' : '#F1F5F9' }]} activeOpacity={0.7}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <View style={styles.headerBadge}>
              <View style={styles.headerDot} />
              <Text style={styles.overline}>EMERGENCY DIRECTORY</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Emergency Contacts</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtle Dispatch Info Card */}
          <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9', borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0' }]}>
            <Text style={[styles.infoBannerText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
              These trusted contacts are immediately dispatched with your live GPS location during any SOS alert.
            </Text>
          </View>

          {isPendingSync && (
            <View style={[styles.pendingSyncBanner, { backgroundColor: isDark ? '#2E2211' : '#FEF3C7', borderColor: isDark ? '#78350F' : '#FDE68A' }]}>
              <Text style={[styles.pendingSyncBannerText, { color: isDark ? '#F59E0B' : '#B45309' }]}>
                Offline contacts saved — changes will sync once connection is restored
              </Text>
            </View>
          )}

          {/* Clean Add Contact Action Cards */}
          {!isAdding ? (
            <View style={styles.addActionsRow}>
              <TouchableOpacity
                style={styles.primaryActionCard}
                onPress={handlePickPhoneContact}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryCardTitle} numberOfLines={1}>Import Contact</Text>
                  <Text style={styles.primaryCardSub} numberOfLines={1}>From phone address book</Text>
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setIsAdding(true)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.secondaryCardTitle, { color: colors.foreground }]} numberOfLines={1}>Add Manually</Text>
                  <Text style={styles.secondaryCardSub} numberOfLines={1}>Enter name & phone</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '700' }}>›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Modern Manual Add Form Card */
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.formHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formTitle, { color: colors.foreground }]}>New Emergency Contact</Text>
                  <Text style={styles.formSubtitle}>Enter name, relationship & phone</Text>
                </View>
                <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.formCloseBtn}>
                  <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: isDark ? '#1C1F26' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0', color: colors.foreground }]}
                placeholder="e.g. Mom, Dad, John Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>RELATIONSHIP</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relChipsRow}
              >
                {relationships.map((r) => {
                  const isSelected = relationship === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.relChip,
                        { backgroundColor: isDark ? '#1C1F26' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' },
                        isSelected && styles.relChipActive
                      ]}
                      onPress={() => setRelationship(r)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.relChipText, isSelected && styles.relChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>MOBILE PHONE NUMBER</Text>
              <View
                style={[
                  styles.phoneInputBox,
                  { backgroundColor: isDark ? '#1C1F26' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' },
                  isLengthMatched && styles.phoneInputSuccess,
                  isOverflow && styles.phoneInputError,
                ]}
              >
                <TouchableOpacity
                  style={[styles.countryCodeBadge, { borderRightColor: isDark ? '#333742' : '#E2E8F0' }]}
                  onPress={() => setCountryModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.countryCodeText, { color: colors.foreground }]}>
                    {selectedCountry.code} {phoneRule.dialCode}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 2 }}>▾</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.phoneInputField, { color: colors.foreground }]}
                  placeholder={phoneRule.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={handlePhoneInputChange}
                  keyboardType="phone-pad"
                />
                {isLengthMatched ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#34D399' : '#059669', marginRight: 4 }}>✓</Text>
                ) : isOverflow ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', marginRight: 4 }}>!</Text>
                ) : null}
              </View>

              {/* Digit Counter & Requirement Hint */}
              <View style={styles.phoneHintRow}>
                <Text style={styles.phoneRuleHint}>
                  {selectedCountry.name}: {phoneRule.hint}
                </Text>
                <View
                  style={[
                    styles.lengthBadge,
                    { backgroundColor: isDark ? '#1C1F26' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' },
                    isLengthMatched && { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#ECFDF5', borderColor: isDark ? '#059669' : '#A7F3D0' },
                    isOverflow && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  ]}
                >
                  <Text
                    style={[
                      styles.lengthBadgeText,
                      isLengthMatched && { color: isDark ? '#34D399' : '#059669' },
                      isOverflow && { color: '#DC2626' },
                    ]}
                  >
                    {cleanDigits.length} / {phoneRule.minLen === phoneRule.maxLen ? phoneRule.minLen : `${phoneRule.minLen}-${phoneRule.maxLen}`}
                  </Text>
                </View>
              </View>

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: isDark ? '#262930' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' }]}
                  onPress={() => setIsAdding(false)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                  onPress={handleSaveContact}
                  activeOpacity={0.85}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Contact</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Contacts List Header */}
          <View style={styles.listSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={[styles.listSectionTitle, { color: colors.foreground }]}>Saved Contacts</Text>
              <View style={styles.contactsCountBadge}>
                <Text style={styles.contactsCountText}>{contacts.length}</Text>
              </View>
            </View>
            {contacts.length > 1 && (
              <Text style={styles.primaryHintText}>Tap Make Primary to prioritize</Text>
            )}
          </View>

          {contacts.length === 0 && !isAdding ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Emergency Contacts Added</Text>
              <Text style={styles.emptySub}>
                Add trusted family members or guardians so they can be alerted immediately with your location when SOS is activated.
              </Text>
            </View>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((c) => {
                const isPrimary = primaryPhone === c.phone || (contacts.length === 1 && !primaryPhone);
                const initial = (c.name || 'C').charAt(0).toUpperCase();

                return (
                  <View
                    key={c.id || `contact-${c.phone}-${c.name}`}
                    style={[
                      styles.contactCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isPrimary && styles.contactCardPrimary,
                    ]}
                  >
                    {/* Left: Avatar Circle */}
                    <View style={[styles.avatarCircle, isPrimary && styles.avatarCirclePrimary]}>
                      <Text style={[styles.avatarInitial, isPrimary && styles.avatarInitialPrimary]}>
                        {initial}
                      </Text>
                    </View>

                    {/* Middle: Clean Hierarchy Info */}
                    <View style={styles.cardInfoContainer}>
                      {/* Name & Primary Tag */}
                      <View style={styles.cardNameRow}>
                        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="tail">
                          {c.name || 'Emergency Contact'}
                        </Text>
                        {isPrimary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>

                      {/* Relationship Pill */}
                      <View style={styles.relBadgeRow}>
                        <View style={[styles.relBadge, { backgroundColor: isDark ? '#262930' : '#F1F5F9' }]}>
                          <Text style={styles.relBadgeText}>
                            {(c.relationship || 'Emergency Contact').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Phone Number */}
                      <View style={styles.phoneDisplayRow}>
                        <Text style={{ fontSize: 11, marginRight: 4, color: isDark ? '#38BDF8' : '#0284C7' }}>📞</Text>
                        <Text style={[styles.cardPhone, { color: isDark ? '#E2E8F0' : '#1E293B' }]} numberOfLines={1} ellipsizeMode="tail">
                          {c.phone}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Dedicated Action Buttons */}
                    <View style={styles.cardActions}>
                      {!isPrimary && (
                        <TouchableOpacity
                          style={[styles.actionTextBtn, { backgroundColor: isDark ? '#262930' : '#F1F5F9' }]}
                          onPress={() => handleSetPrimary(c)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.actionBtnLabel, { color: colors.textMuted }]}>Primary</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.actionTextBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
                        onPress={() => handleCall(c.phone)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actionBtnLabel, { color: colors.foreground, fontWeight: '700' }]}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionTextBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }]}
                        onPress={() => handleDeleteContact(c.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.actionBtnLabel, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Official National Emergency Numbers Section */}
          <View style={styles.hotlinesContainer}>
            <View style={styles.hotlinesHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hotlinesTitle, { color: colors.foreground }]}>
                  {country.name.toUpperCase()} EMERGENCY HOTLINES
                </Text>
                <Text style={styles.hotlinesSub}>National toll-free dispatch services</Text>
              </View>
            </View>

            <View style={styles.hotlinesList}>
              {country.services.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[styles.hotlineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleCall(srv.number)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.hotlineName, { color: colors.foreground }]} numberOfLines={1}>{srv.name}</Text>
                    <Text style={styles.hotlineDesc} numberOfLines={1}>
                      {srv.description}
                    </Text>
                  </View>

                  <View style={styles.hotlineDialBtn}>
                    <Text style={styles.hotlineNumberText}>{srv.number}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Modal Country Selector for emergency contact manual phone input */}
        <CountrySelectorModal
          visible={countryModalVisible}
          onClose={() => setCountryModalVisible(false)}
          onSelectCountry={(c) => {
            setPhoneCountryCode(c.code);
            setCountryModalVisible(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A',
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoBannerText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
  addActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  primaryActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 52,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCardTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  primaryCardSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10.5,
    fontWeight: '500',
  },
  secondaryActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  secondaryIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  secondaryCardSub: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '500',
  },
  formCard: {
    borderWidth: 1.5,
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  formIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  formSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  formCloseBtn: {
    padding: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  inputField: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontWeight: '600',
  },
  relChipsRow: {
    gap: 7,
    paddingVertical: 3,
  },
  relChip: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  relChipActive: {
    borderColor: '#0F172A',
    backgroundColor: '#0F172A',
  },
  relChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  relChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  phoneInputSuccess: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  phoneInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  phoneInputField: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  phoneHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 6,
  },
  phoneRuleHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    flex: 1,
  },
  lengthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  lengthBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1.5,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.4,
    height: 42,
    backgroundColor: '#0F172A',
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  contactsCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  contactsCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  primaryHintText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  emptyIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  contactsList: {
    gap: 10,
    marginBottom: 24,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  contactCardPrimary: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: '#0F172A',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCirclePrimary: {
    backgroundColor: '#0F172A',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  avatarInitialPrimary: {
    color: '#FFFFFF',
  },
  cardInfoContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  primaryBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  relBadgeRow: {
    flexDirection: 'row',
    marginTop: 2.5,
  },
  relBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  relBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  phoneDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3.5,
  },
  cardPhone: {
    fontSize: 12,
    color: '#5C665F',
    fontWeight: '600',
    flexShrink: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTextBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  hotlinesContainer: {
    marginTop: 4,
  },
  hotlinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  hotlineFlagBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlinesTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hotlinesSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 0.5,
  },
  hotlinesList: {
    gap: 8,
  },
  hotlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    gap: 10,
  },
  hotlineIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  hotlineDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  hotlineDialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  hotlineNumberText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  pendingSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pendingSyncBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});

