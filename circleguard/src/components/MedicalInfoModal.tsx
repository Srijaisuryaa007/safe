import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { useLuxuryAlert } from './LuxuryAlertModal';

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

const getMedicalStorageKey = (userId?: string | null) =>
  userId ? `@circleguard_medical_info_${userId}` : '@circleguard_medical_info_guest';

export default function MedicalInfoModal({ visible, onClose }: MedicalInfoModalProps) {
  const { profile } = useAuthStore();
  const { showAlert } = useLuxuryAlert();

  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [primaryDoctor, setPrimaryDoctor] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  useEffect(() => {
    if (visible) {
      loadMedicalInfo();
    }
  }, [visible, profile?.id]);

  const loadMedicalInfo = async () => {
    setBloodType('O+');
    setAllergies('');
    setConditions('');
    setNotes('');
    setPrimaryDoctor('');
    setIsEditing(false);

    if (!profile?.id) return;

    try {
      const storageKey = getMedicalStorageKey(profile.id);
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        const data: MedicalProfile = JSON.parse(saved);
        setBloodType(data.bloodType || 'O+');
        setAllergies(data.allergies || '');
        setConditions(data.conditions || '');
        setNotes(data.notes || '');
        setPrimaryDoctor(data.primaryDoctor || '');
        return;
      }

      if ((profile as any).medical_info) {
        const data = (profile as any).medical_info;
        setBloodType(data.bloodType || 'O+');
        setAllergies(data.allergies || '');
        setConditions(data.conditions || '');
        setNotes(data.notes || '');
        setPrimaryDoctor(data.primaryDoctor || '');
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Error loading medical info:', e);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) {
      showAlert({
        title: 'Session Expired',
        message: 'Please sign in to save medical information.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const data: MedicalProfile = {
        bloodType,
        allergies: allergies.trim(),
        conditions: conditions.trim(),
        notes: notes.trim(),
        primaryDoctor: primaryDoctor.trim(),
      };

      const storageKey = getMedicalStorageKey(profile.id);
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));

      try {
        await supabase
          .from('profiles')
          .update({ medical_info: data })
          .eq('id', profile.id);

        useAuthStore.getState().setProfile({
          ...profile,
          medical_info: data,
        } as any);
      } catch (dbErr) {
        console.warn('Database sync for medical info deferred:', dbErr);
      }

      showAlert({
        title: 'Saved',
        message: 'Medical profile updated successfully.',
        type: 'success',
      });
      setIsEditing(false);
    } catch (e) {
      showAlert({
        title: 'Error',
        message: 'Failed to save medical information. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#1F2A24" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>EMERGENCY PROTOCOLS</Text>
            <Text style={styles.title}>Medical Information</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            This information is accessible to emergency responders and verified circle members during an active SOS distress signal.
          </Text>

          {/* Blood Group Display Card */}
          <View style={styles.bloodCard}>
            <View style={styles.bloodIconBox}>
              <Ionicons name="medical" size={24} color="#E07A5F" />
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
                {bloodTypes.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.bloodChip, bloodType === b && styles.bloodChipSelected]}
                    onPress={() => setBloodType(b)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.bloodChipText,
                        bloodType === b && styles.bloodChipTextSelected,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>KNOWN ALLERGIES</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Penicillin, Peanuts, Latex"
                placeholderTextColor="#8E9992"
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />

              <Text style={styles.label}>MEDICAL CONDITIONS</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Asthma, Type 1 Diabetes, Hypertension"
                placeholderTextColor="#8E9992"
                value={conditions}
                onChangeText={setConditions}
                multiline
              />

              <Text style={styles.label}>PRIMARY DOCTOR / CLINIC</Text>
              <TextInput
                style={styles.input}
                placeholder="Dr. Smith • (555) 019-2831"
                placeholderTextColor="#8E9992"
                value={primaryDoctor}
                onChangeText={setPrimaryDoctor}
              />

              <Text style={styles.label}>EMERGENCY NOTES</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                placeholder="Important instructions for first responders..."
                placeholderTextColor="#8E9992"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditing(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveText}>SAVE MEDICAL CARD</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.displayCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#E07A5F" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>KNOWN ALLERGIES</Text>
                  <Text style={styles.infoValue}>{allergies || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="fitness-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>MEDICAL CONDITIONS</Text>
                  <Text style={styles.infoValue}>{conditions || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="person-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>PRIMARY DOCTOR</Text>
                  <Text style={styles.infoValue}>{primaryDoctor || 'Not specified'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="document-text-outline" size={18} color="#5C665F" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={styles.infoLabel}>EMERGENCY NOTES</Text>
                  <Text style={styles.infoValue}>{notes || 'No extra notes provided'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={17} color="#2E7D5B" />
                <Text style={styles.editText}>EDIT MEDICAL CARD</Text>
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
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E07A5F',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C665F',
    lineHeight: 19,
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  bloodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3EB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFD7C7',
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  bloodIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodTextInfo: {
    flex: 1,
  },
  bloodLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E07A5F',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  bloodValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2A24',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  displayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 18,
    gap: 16,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F7F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.5,
    marginBottom: 3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2A24',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  editBtn: {
    flexDirection: 'row',
    height: 46,
    backgroundColor: '#E8F5EE',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#C6E7D5',
  },
  editText: {
    color: '#2E7D5B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 18,
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.5,
    marginTop: 4,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    backgroundColor: '#FAF9F6',
  },
  bloodChipSelected: {
    backgroundColor: '#2E7D5B',
    borderColor: '#2E7D5B',
  },
  bloodChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  bloodChipTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C665F',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  saveBtn: {
    flex: 1.5,
    height: 46,
    backgroundColor: '#2E7D5B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
