import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useCountryStore } from '../store/useCountryStore';
import {
  validateAndNormalizePhone,
  COUNTRY_PHONE_RULES,
  DEFAULT_PHONE_RULE,
} from '../lib/phoneValidation';
import { useLuxuryAlert } from './LuxuryAlertModal';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

interface EmergencyContactsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EmergencyContactsModal({ visible, onClose }: EmergencyContactsModalProps) {
  const { profile } = useAuthStore();
  const { country } = useCountryStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
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
      if (Array.isArray(cloudContacts) && cloudContacts.length > 0) {
        setContacts(cloudContacts);
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(cloudContacts));
        await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(cloudContacts));
        return;
      }

      // 2. Check user-scoped AsyncStorage
      const saved = await AsyncStorage.getItem(getStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        setContacts(parsed);
        // Sync to cloud if user is logged in
        if (profile?.id && Array.isArray(parsed) && parsed.length > 0) {
          useAuthStore.getState().setProfile({ ...profile, emergency_contacts: parsed });
          try {
            await supabase.from('profiles').update({ emergency_contacts: parsed }).eq('id', profile.id);
          } catch (e) {}
        }
      } else {
        // 3. Fallback to resilient global AsyncStorage key (persists across logouts)
        const fallbackSaved = await AsyncStorage.getItem('@circleguard_emergency_contacts');
        if (fallbackSaved) {
          const parsedFallback = JSON.parse(fallbackSaved);
          setContacts(parsedFallback);
          if (profile?.id && Array.isArray(parsedFallback) && parsedFallback.length > 0) {
            await AsyncStorage.setItem(getStorageKey(), fallbackSaved);
            useAuthStore.getState().setProfile({ ...profile, emergency_contacts: parsedFallback });
            try {
              await supabase.from('profiles').update({ emergency_contacts: parsedFallback }).eq('id', profile.id);
            } catch (e) {}
          }
        } else {
          setContacts([]);
        }
      }
    } catch (e) {
      console.error('Error loading emergency contacts:', e);
    }
  };

  const handleSaveContact = async () => {
    if (!name.trim()) {
      showAlert({
        title: 'Required Field',
        message: 'Please enter a contact name.',
        type: 'warning',
      });
      return;
    }

    if (!phone.trim()) {
      showAlert({
        title: 'Required Field',
        message: `Please enter a valid mobile number for ${country.name}.`,
        type: 'warning',
      });
      return;
    }

    // 1. Strict country-specific validation
    const validation = validateAndNormalizePhone(phone, country.code);
    if (!validation.isValid) {
      showAlert({
        title: 'Invalid Contact Number',
        message: validation.error || `Please enter a valid phone number for ${country.name}.`,
        type: 'warning',
      });
      return;
    }

    // 2. Proactive deduplication: prevent duplicate contact phone numbers
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
    
    // Save to dual-tier AsyncStorage (user-scoped + global resilient)
    await AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
    await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updated));
    await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: name.trim(), phone: validation.formattedDisplay }));
    await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: name.trim(), phone: validation.formattedDisplay }));

    // Persist to Supabase cloud profile so it survives device changes and logouts
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
  };

  const handleDeleteContact = (id: string) => {
    showConfirm({
      title: 'Delete Contact',
      message: 'Are you sure you want to remove this emergency contact from your priority list?',
      confirmText: 'REMOVE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        const updated = contacts.filter((c) => c.id !== id);
        setContacts(updated);
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(updated));
        await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updated));

        if (profile?.id) {
          useAuthStore.getState().setProfile({ ...profile, emergency_contacts: updated });
          try {
            await supabase.from('profiles').update({ emergency_contacts: updated }).eq('id', profile.id);
          } catch (err) {}
        }
      },
    });
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
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
        await AsyncStorage.setItem(getPrimaryStorageKey(), JSON.stringify({ name: contactName, phone: phoneNumber }));
      }
    } catch (e: any) {
      console.error('Error picking phone contact:', e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={LUXURY_THEME.colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>EMERGENCY DIRECTORY</Text>
            <Text style={styles.title}>Emergency Contacts</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            These trusted contacts will receive direct SMS and call alerts during any emergency SOS trigger.
          </Text>

          {!isAdding ? (
            <View style={{ gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: LUXURY_THEME.colors.accentGold }]}
                onPress={handlePickPhoneContact}
              >
                <Ionicons name="person-add-outline" size={20} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.addBtnText}>SELECT FROM PHONE CONTACTS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addBtn} onPress={() => setIsAdding(true)}>
                <Ionicons name="add" size={20} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.addBtnText}>MANUALLY ENTER CONTACT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>NEW EMERGENCY CONTACT</Text>
              
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Father, Mother, Brother" 
                value={name} 
                onChangeText={setName}
              />

              <Text style={styles.label}>RELATIONSHIP</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relRow}>
                {relationships.map(r => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.relChip, relationship === r && styles.relChipSelected]}
                    onPress={() => setRelationship(r)}
                  >
                    <Text style={[styles.relText, relationship === r && styles.relTextSelected]}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>MOBILE PHONE NUMBER</Text>
              <View
                style={[
                  styles.phoneInputBox,
                  {
                    borderColor: isOverflow
                      ? '#EF4444'
                      : isLengthMatched
                      ? '#10B981'
                      : LUXURY_THEME.colors.border,
                  },
                ]}
              >
                <View style={styles.countryCodeBadge}>
                  <Text style={{ fontSize: 13 }}>{country.flag}</Text>
                  <Text style={styles.countryCodeText}>{phoneRule.dialCode}</Text>
                </View>
                <TextInput 
                  style={styles.phoneInputField} 
                  placeholder={phoneRule.placeholder} 
                  placeholderTextColor={LUXURY_THEME.colors.textMuted}
                  value={phone} 
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                {isLengthMatched ? (
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                ) : isOverflow ? (
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                ) : null}
              </View>

              {/* Country Requirement & Digit Counter */}
              <View style={styles.phoneHintRow}>
                <Text style={styles.phoneRuleHint}>
                  {country.flag} {country.name}: {phoneRule.hint}
                </Text>
                <View
                  style={[
                    styles.lengthBadge,
                    {
                      backgroundColor: isLengthMatched
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isOverflow
                        ? 'rgba(239, 68, 68, 0.15)'
                        : cleanDigits.length > 0
                        ? 'rgba(212, 175, 55, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                      borderColor: isLengthMatched
                        ? '#10B981'
                        : isOverflow
                        ? '#EF4444'
                        : cleanDigits.length > 0
                        ? LUXURY_THEME.colors.accentGold
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
                          ? LUXURY_THEME.colors.accentGold
                          : LUXURY_THEME.colors.textMuted,
                      },
                    ]}
                  >
                    {cleanDigits.length} / {phoneRule.minLen === phoneRule.maxLen ? phoneRule.minLen : `${phoneRule.minLen}-${phoneRule.maxLen}`}
                  </Text>
                </View>
              </View>

              <View style={styles.formActionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdding(false)}>
                  <Text style={styles.cancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveContact}>
                  <Text style={styles.saveText}>SAVE CONTACT</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {contacts.length === 0 && !isAdding ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Ionicons name="people-outline" size={40} color={LUXURY_THEME.colors.textMuted} />
              <Text style={{ color: LUXURY_THEME.colors.foreground, fontSize: 13, fontWeight: '700' }}>NO EMERGENCY CONTACTS SAVED</Text>
              <Text style={{ color: LUXURY_THEME.colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 }}>
                Tap "ADD EMERGENCY CONTACT" above to add family members or guardians to your emergency directory.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {contacts.map(c => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View style={styles.avatarCircle}>
                      <Ionicons name="person" size={20} color={LUXURY_THEME.colors.accentGold} />
                    </View>
                    <View>
                      <Text style={styles.cardName}>{c.name}</Text>
                      <Text style={styles.cardRel}>{c.relationship.toUpperCase()} • {c.phone}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.iconCallBtn} onPress={() => handleCall(c.phone)}>
                      <Ionicons name="call-outline" size={18} color="#10B981" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconDeleteBtn} onPress={() => handleDeleteContact(c.id)}>
                      <Ionicons name="trash-outline" size={18} color={LUXURY_THEME.colors.sosRed} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Official National Emergency Numbers */}
          <View style={{ marginTop: 28, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={{ fontSize: 11, fontWeight: '800', color: LUXURY_THEME.colors.foreground, letterSpacing: 1.2 }}>
                {country.flag} {country.name.toUpperCase()} OFFICIAL HOTLINES
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {country.services.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={styles.card}
                  onPress={() => handleCall(srv.number)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardLeft}>
                    <View style={[styles.avatarCircle, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                      <Ionicons name={(srv.icon || 'call') as any} size={18} color={LUXURY_THEME.colors.accentGold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{srv.name}</Text>
                      <Text style={styles.cardRel}>{srv.description}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.iconCallBtn} onPress={() => handleCall(srv.number)}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#10B981', marginRight: 4 }}>{srv.number}</Text>
                    <Ionicons name="call" size={14} color="#10B981" />
                  </TouchableOpacity>
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
    backgroundColor: LUXURY_THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
  },
  content: {
    padding: 24,
  },
  subtitle: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    marginBottom: 24,
    lineHeight: 18,
  },
  addBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  formBox: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 20,
    borderRadius: 14,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 2,
    marginBottom: 16,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.foreground,
    paddingVertical: 8,
    fontSize: 14,
    color: LUXURY_THEME.colors.foreground,
  },
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: LUXURY_THEME.colors.border,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
  },
  phoneInputField: {
    flex: 1,
    fontSize: 13,
    color: LUXURY_THEME.colors.foreground,
    fontWeight: '600',
  },
  phoneHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 3,
    gap: 6,
  },
  phoneRuleHint: {
    fontSize: 10,
    fontWeight: '500',
    color: LUXURY_THEME.colors.textMuted,
    flex: 1,
  },
  lengthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lengthBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  relRow: {
    gap: 8,
    marginVertical: 6,
  },
  relChip: {
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  relChipSelected: {
    borderColor: LUXURY_THEME.colors.accentGold,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
  },
  relText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1,
  },
  relTextSelected: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: '800',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    backgroundColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 1.5,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  cardRel: {
    fontSize: 10,
    color: LUXURY_THEME.colors.textMuted,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCallBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconDeleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
