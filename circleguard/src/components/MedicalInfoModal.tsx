import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LUXURY_THEME } from '../constants/theme';

export interface MedicalProfile {
  bloodType: string;
  allergies: string;
  conditions: string;
  notes: string;
  primaryDoctor: string;
}

interface MedicalInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

const STORAGE_KEY = '@circleguard_medical_info';

export default function MedicalInfoModal({ visible, onClose }: MedicalInfoModalProps) {
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [primaryDoctor, setPrimaryDoctor] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  useEffect(() => {
    if (visible) {
      loadMedicalInfo();
    }
  }, [visible]);

  const loadMedicalInfo = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: MedicalProfile = JSON.parse(saved);
        setBloodType(data.bloodType || 'O+');
        setAllergies(data.allergies || '');
        setConditions(data.conditions || '');
        setNotes(data.notes || '');
        setPrimaryDoctor(data.primaryDoctor || '');
      }
    } catch (e) {
      console.error('Error loading medical info:', e);
    }
  };

  const handleSave = async () => {
    try {
      const data: MedicalProfile = {
        bloodType,
        allergies: allergies.trim(),
        conditions: conditions.trim(),
        notes: notes.trim(),
        primaryDoctor: primaryDoctor.trim(),
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      Alert.alert('Saved', 'Medical profile updated successfully.');
      setIsEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save medical information.');
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
            <Text style={styles.overline}>CRITICAL MEDICAL CARD</Text>
            <Text style={styles.title}>Medical Information</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            This information is accessible to emergency responders and verified circle members during an active SOS call.
          </Text>

          {/* Blood Group Display / Picker */}
          <View style={styles.bloodCard}>
            <View style={styles.bloodIconBox}>
              <Ionicons name="medical" size={28} color={LUXURY_THEME.colors.sosRed} />
            </View>
            <View style={styles.bloodTextInfo}>
              <Text style={styles.bloodLabel}>BLOOD GROUP</Text>
              <Text style={styles.bloodValue}>{bloodType}</Text>
            </View>
          </View>

          {isEditing ? (
            <View style={styles.form}>
              <Text style={styles.label}>SELECT BLOOD TYPE</Text>
              <View style={styles.bloodGrid}>
                {bloodTypes.map(b => (
                  <TouchableOpacity 
                    key={b} 
                    style={[styles.bloodChip, bloodType === b && styles.bloodChipSelected]}
                    onPress={() => setBloodType(b)}
                  >
                    <Text style={[styles.bloodChipText, bloodType === b && styles.bloodChipTextSelected]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>KNOWN ALLERGIES</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Penicillin, Peanuts, Latex"
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />

              <Text style={styles.label}>MEDICAL CONDITIONS</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Asthma, Type 1 Diabetes, Hypertension"
                value={conditions}
                onChangeText={setConditions}
                multiline
              />

              <Text style={styles.label}>PRIMARY DOCTOR / CLINIC</Text>
              <TextInput
                style={styles.input}
                placeholder="Dr. Smith • (555) 019-2831"
                value={primaryDoctor}
                onChangeText={setPrimaryDoctor}
              />

              <Text style={styles.label}>EMERGENCY NOTES</Text>
              <TextInput
                style={styles.input}
                placeholder="Important instructions for first responders..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveText}>SAVE MEDICAL CARD</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.displayCard}>
              <View style={styles.infoRow}>
                <Ionicons name="alert-circle-outline" size={20} color={LUXURY_THEME.colors.foreground} />
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>KNOWN ALLERGIES</Text>
                  <Text style={styles.infoValue}>{allergies || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="fitness-outline" size={20} color={LUXURY_THEME.colors.foreground} />
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>MEDICAL CONDITIONS</Text>
                  <Text style={styles.infoValue}>{conditions || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color={LUXURY_THEME.colors.foreground} />
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>PRIMARY DOCTOR</Text>
                  <Text style={styles.infoValue}>{primaryDoctor || 'Not specified'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={20} color={LUXURY_THEME.colors.foreground} />
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>EMERGENCY NOTES</Text>
                  <Text style={styles.infoValue}>{notes || 'No extra notes provided'}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
                <Ionicons name="create-outline" size={18} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.editText}>EDIT MEDICAL INFO</Text>
              </TouchableOpacity>
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
    color: LUXURY_THEME.colors.sosRed,
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
  bloodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: LUXURY_THEME.colors.sosRed,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    borderRadius: 14,
    gap: 16,
    marginBottom: 24,
  },
  bloodIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodTextInfo: {
    flex: 1,
  },
  bloodLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  bloodValue: {
    fontSize: 28,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  bloodChip: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
  },
  bloodChipSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  bloodChipText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
  },
  bloodChipTextSelected: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: '800',
  },
  input: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: LUXURY_THEME.colors.foreground,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
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
    height: 48,
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
  displayCard: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: LUXURY_THEME.colors.foreground,
    fontWeight: '500',
  },
  editBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  editText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
