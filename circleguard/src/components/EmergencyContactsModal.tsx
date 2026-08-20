import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { LUXURY_THEME } from '../constants/theme';

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

const STORAGE_KEY = '@circleguard_emergency_contacts';

export default function EmergencyContactsModal({ visible, onClose }: EmergencyContactsModalProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Father');
  const [phone, setPhone] = useState('');

  const relationships = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Doctor', 'Other'];

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setContacts(JSON.parse(saved));
      } else {
        setContacts([]);
      }
    } catch (e) {
      console.error('Error loading emergency contacts:', e);
    }
  };

  const handleSaveContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter both a name and a phone number.');
      return;
    }

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: name.trim(),
      relationship,
      phone: phone.trim(),
    };

    const updated = [...contacts, newContact];
    setContacts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setName('');
    setPhone('');
    setRelationship('Father');
    setIsAdding(false);
  };

  const handleDeleteContact = (id: string) => {
    Alert.alert('Delete Contact', 'Remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          const updated = contacts.filter(c => c.id !== id);
          setContacts(updated);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } 
      }
    ]);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handlePickPhoneContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Contacts permission is required to choose an emergency contact from your phone.');
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
          Alert.alert('No Phone Number', `${contactName} does not have a phone number.`);
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
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify({ name: contactName, phone: phoneNumber }));
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

              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput 
                style={styles.input} 
                placeholder="+1 (555) 000-0000" 
                value={phone} 
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

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
