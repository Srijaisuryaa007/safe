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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCountryStore } from '../store/useCountryStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  validateAndNormalizePhone,
  COUNTRY_PHONE_RULES,
  DEFAULT_PHONE_RULE,
} from '../lib/phoneValidation';
import { useLuxuryAlert } from './LuxuryAlertModal';
import { getSafeTopInset } from '../utils/safeArea';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

interface EmergencyContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onContactsUpdated?: () => void;
}

export default function EmergencyContactsModal({ visible, onClose, onContactsUpdated }: EmergencyContactsModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { profile } = useAuthStore();
  const { country } = useCountryStore();
  const { colors, isDark } = useThemeStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Father');
  const [phone, setPhone] = useState('');

  const relationships = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Doctor', 'Other'];

  const phoneRule = COUNTRY_PHONE_RULES[country.code] || {
    ...DEFAULT_PHONE_RULE,
    dialCode: country.dialCode || '+1',
  };
  const cleanDigits = phone.replace(/\D/g, '');
  const isLengthMatched = phoneRule.minLen === phoneRule.maxLen
    ? cleanDigits.length === phoneRule.minLen
    : cleanDigits.length >= phoneRule.minLen && cleanDigits.length <= phoneRule.maxLen;
  const isOverflow = cleanDigits.length > phoneRule.maxLen;

  const getStorageKey = () => profile?.id ? `@circleguard_emergency_contacts_${profile.id}` : '@circleguard_emergency_contacts';
  const getPrimaryStorageKey = () => profile?.id ? `@circleguard_primary_emergency_contact_${profile.id}` : '@circleguard_primary_emergency_contact';

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible, profile?.id]);

  const loadContacts = async () => {
    try {
      // 1. Check if profile already has cloud-persisted emergency contacts
      const cloudContacts = (profile as any)?.emergency_contacts;
      let loaded: EmergencyContact[] = [];

      if (Array.isArray(cloudContacts) && cloudContacts.length > 0) {
        loaded = cloudContacts;
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(cloudContacts));
        await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(cloudContacts));
      } else {
        // 2. Check user-scoped AsyncStorage
        const saved = await AsyncStorage.getItem(getStorageKey());
        if (saved) {
          const parsed = JSON.parse(saved);
          loaded = parsed;
          if (profile?.id && Array.isArray(parsed) && parsed.length > 0) {
            useAuthStore.getState().setProfile({ ...profile, emergency_contacts: parsed });
            try {
              await supabase.from('profiles').update({ emergency_contacts: parsed }).eq('id', profile.id);
            } catch (e) {}
          }
        } else {
          // 3. Fallback to resilient global AsyncStorage key
          const fallbackSaved = await AsyncStorage.getItem('@circleguard_emergency_contacts');
          if (fallbackSaved) {
            const parsedFallback = JSON.parse(fallbackSaved);
            loaded = parsedFallback;
            if (profile?.id && Array.isArray(parsedFallback) && parsedFallback.length > 0) {
              await AsyncStorage.setItem(getStorageKey(), fallbackSaved);
              useAuthStore.getState().setProfile({ ...profile, emergency_contacts: parsedFallback });
              try {
                await supabase.from('profiles').update({ emergency_contacts: parsedFallback }).eq('id', profile.id);
              } catch (e) {}
            }
          }
        }
      }

      setContacts(loaded);

      // Load primary contact phone
      const primarySaved = await AsyncStorage.getItem(getPrimaryStorageKey());
      if (primarySaved) {
        try {
          const parsed = JSON.parse(primarySaved);
          setPrimaryPhone(parsed.phone);
        } catch (e) {}
      } else if (loaded.length > 0) {
        setPrimaryPhone(loaded[0].phone);
      }
    } catch (e) {
      console.error('Error loading emergency contacts:', e);
    }
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

    const validation = validateAndNormalizePhone(phone, country.code);
    if (!validation.isValid) {
      showAlert({
        title: 'Invalid Contact Number',
        message: validation.error || `Please enter a valid phone number for ${country.name}.`,
        type: 'warning',
      });
      return;
    }

    // Deduplication check
    const alreadyExists = contacts.some(
      (c) =>
        c.phone.replace(/\D/g, '') === validation.nationalDigits ||
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

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: name.trim(),
      relationship,
      phone: validation.formattedDisplay,
    };

    const updated = [...contacts, newContact];
    setContacts(updated);

    // Save to dual-tier AsyncStorage
    await AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
    await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updated));

    if (!primaryPhone || contacts.length === 0) {
      setPrimaryPhone(validation.formattedDisplay);
      await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: name.trim(), phone: validation.formattedDisplay }));
      await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: name.trim(), phone: validation.formattedDisplay }));
    }

    // Persist to Supabase cloud profile
    if (profile?.id) {
      useAuthStore.getState().setProfile({ ...profile, emergency_contacts: updated });
      try {
        await supabase.from('profiles').update({ emergency_contacts: updated }).eq('id', profile.id);
      } catch (err) {
        console.warn('Failed saving emergency contacts to cloud profile:', err);
      }
    }

    setName('');
    setPhone('');
    setRelationship('Father');
    setIsAdding(false);
    onContactsUpdated?.();

    showAlert({
      title: 'Contact Saved',
      message: `${newContact.name} has been added to your emergency directory.`,
      type: 'success',
    });
  };

  const handleSetPrimary = async (c: EmergencyContact) => {
    setPrimaryPhone(c.phone);
    await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: c.name, phone: c.phone }));
    await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: c.name, phone: c.phone }));
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
        const updated = contacts.filter((c) => c.id !== id);
        setContacts(updated);
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
        await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updated));

        // If removed contact was primary, fall back to next contact or null
        if (contactToDelete && primaryPhone === contactToDelete.phone) {
          const next = updated[0];
          if (next) {
            setPrimaryPhone(next.phone);
            await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: next.name, phone: next.phone }));
            await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: next.name, phone: next.phone }));
          } else {
            setPrimaryPhone(null);
            await AsyncStorage.removeItem(getPrimaryStorageKey());
            await AsyncStorage.removeItem('@circleguard_primary_emergency_contact');
          }
        }

        if (profile?.id) {
          useAuthStore.getState().setProfile({ ...profile, emergency_contacts: updated });
          try {
            await supabase.from('profiles').update({ emergency_contacts: updated }).eq('id', profile.id);
          } catch (err) {}
        }

        onContactsUpdated?.();
      },
    });
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handlePickPhoneContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Denied',
          message: 'Contacts permission is required to import an emergency contact from your address book.',
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
            message: `${contactName} does not have a registered phone number.`,
            type: 'info',
          });
          return;
        }

        const newContact: EmergencyContact = {
          id: Date.now().toString(),
          name: contactName,
          relationship: 'Emergency Contact',
          phone: phoneNumber,
        };

        const updated = [...contacts, newContact];
        setContacts(updated);
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
        await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updated));

        if (!primaryPhone || contacts.length === 0) {
          setPrimaryPhone(phoneNumber);
          await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: contactName, phone: phoneNumber }));
          await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: contactName, phone: phoneNumber }));
        }

        if (profile?.id) {
          useAuthStore.getState().setProfile({ ...profile, emergency_contacts: updated });
          try {
            await supabase.from('profiles').update({ emergency_contacts: updated }).eq('id', profile.id);
          } catch (err) {}
        }

        onContactsUpdated?.();
      }
    } catch (e: any) {
      console.error('Error picking phone contact:', e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FAF9F6' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Clean Header Bar */}
        <View style={[styles.header, { paddingTop: topInset + 6, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#262930' : '#F1F5F9' }]} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={colors.foreground} />
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
          {/* Subtle Sage Dispatch Info Card */}
          <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(46,125,91,0.15)' : '#E8F5EE', borderColor: isDark ? 'rgba(46,125,91,0.3)' : '#C6E7D6' }]}>
            <View style={[styles.infoIconBox, { backgroundColor: colors.surface }]}>
              <Ionicons name="shield-checkmark" size={19} color="#2E7D5B" />
            </View>
            <Text style={[styles.infoBannerText, { color: isDark ? '#A7F3D0' : '#1B4D3E' }]}>
              These trusted contacts are immediately dispatched with your live GPS location during any SOS alert.
            </Text>
          </View>

          {/* Clean Add Contact Action Cards */}
          {!isAdding ? (
            <View style={styles.addActionsRow}>
              <TouchableOpacity
                style={styles.primaryActionCard}
                onPress={handlePickPhoneContact}
                activeOpacity={0.85}
              >
                <View style={styles.primaryIconCircle}>
                  <Ionicons name="person-add" size={16} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryCardTitle} numberOfLines={1}>Import Contact</Text>
                  <Text style={styles.primaryCardSub} numberOfLines={1}>From address book</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setIsAdding(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: isDark ? '#262930' : '#F1F5F9' }]}>
                  <Ionicons name="create-outline" size={16} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.secondaryCardTitle, { color: colors.foreground }]} numberOfLines={1}>Add Manually</Text>
                  <Text style={styles.secondaryCardSub} numberOfLines={1}>Enter details</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Modern Manual Add Form Card */
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.formHeader}>
                <View style={styles.formIconBox}>
                  <Ionicons name="person-add" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formTitle, { color: colors.foreground }]}>New Emergency Contact</Text>
                  <Text style={styles.formSubtitle}>Enter name, relationship & phone</Text>
                </View>
                <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.formCloseBtn}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
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
                <View style={[styles.countryCodeBadge, { borderRightColor: isDark ? '#333742' : '#E2E8F0' }]}>
                  <Text style={{ fontSize: 16 }}>{country.flag}</Text>
                  <Text style={[styles.countryCodeText, { color: colors.foreground }]}>{phoneRule.dialCode}</Text>
                </View>
                <TextInput
                  style={[styles.phoneInputField, { color: colors.foreground }]}
                  placeholder={phoneRule.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                {isLengthMatched ? (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                ) : isOverflow ? (
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                ) : null}
              </View>

              {/* Digit Counter & Requirement Hint */}
              <View style={styles.phoneHintRow}>
                <Text style={styles.phoneRuleHint}>
                  {country.flag} {country.name}: {phoneRule.hint}
                </Text>
                <View
                  style={[
                    styles.lengthBadge,
                    { backgroundColor: isDark ? '#1C1F26' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' },
                    isLengthMatched && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                    isOverflow && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  ]}
                >
                  <Text
                    style={[
                      styles.lengthBadgeText,
                      isLengthMatched && { color: '#059669' },
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
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveContact}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Contact</Text>
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
              <Text style={styles.primaryHintText}>Tap ★ to set primary</Text>
            )}
          </View>

          {contacts.length === 0 && !isAdding ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="people-outline" size={28} color="#2E7D5B" />
              </View>
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
                    key={c.id}
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

                    {/* Middle: Clean Hierarchy Info (No Overlap) */}
                    <View style={styles.cardInfoContainer}>
                      {/* Name & Primary Star Tag */}
                      <View style={styles.cardNameRow}>
                        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="tail">
                          {c.name}
                        </Text>
                        {isPrimary && (
                          <View style={styles.primaryBadge}>
                            <Ionicons name="star" size={9} color="#B45309" />
                            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>

                      {/* Relationship Pill */}
                      <View style={styles.relBadgeRow}>
                        <View style={[styles.relBadge, { backgroundColor: isDark ? '#262930' : '#F1F5F9' }]}>
                          <Text style={styles.relBadgeText}>
                            {c.relationship.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Phone Number on its own clean row */}
                      <View style={styles.phoneDisplayRow}>
                        <Ionicons name="call-outline" size={11} color="#5C665F" style={{ marginRight: 4 }} />
                        <Text style={styles.cardPhone} numberOfLines={1} ellipsizeMode="tail">
                          {c.phone}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Dedicated Action Buttons */}
                    <View style={styles.cardActions}>
                      {!isPrimary && (
                        <TouchableOpacity
                          style={[styles.starActionBtn, { backgroundColor: isDark ? '#262930' : '#F8FAFC', borderColor: isDark ? '#333742' : '#E2E8F0' }]}
                          onPress={() => handleSetPrimary(c)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="star-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.callActionBtn}
                        onPress={() => handleCall(c.phone)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call" size={15} color="#2E7D5B" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteActionBtn}
                        onPress={() => handleDeleteContact(c.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
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
              <View style={[styles.hotlineFlagBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 14 }}>{country.flag}</Text>
              </View>
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
                  <View style={styles.hotlineIconBox}>
                    <Ionicons name={(srv.icon || 'call') as any} size={17} color="#2E7D5B" />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.hotlineName, { color: colors.foreground }]} numberOfLines={1}>{srv.name}</Text>
                    <Text style={styles.hotlineDesc} numberOfLines={1}>
                      {srv.description}
                    </Text>
                  </View>

                  <View style={styles.hotlineDialBtn}>
                    <Text style={styles.hotlineNumberText}>{srv.number}</Text>
                    <Ionicons name="call" size={12} color="#2E7D5B" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: '#2E7D5B',
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
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
    backgroundColor: '#2E7D5B',
    borderRadius: 14,
    paddingHorizontal: 12,
    shadowColor: '#2E7D5B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
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
    backgroundColor: '#E8F5EE',
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
    borderColor: '#2E7D5B',
    backgroundColor: '#2E7D5B',
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
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
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
    backgroundColor: '#2E7D5B',
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
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  contactsCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D5B',
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
    backgroundColor: '#E8F5EE',
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
    borderColor: '#C6E7D5',
    backgroundColor: '#F7FCF9',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D5B',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCirclePrimary: {
    backgroundColor: '#2E7D5B',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2E7D5B',
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
    gap: 7,
  },
  starActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  callActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#C6E7D5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#E8F5EE',
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
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#C6E7D6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  hotlineNumberText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2E7D5B',
  },
});
