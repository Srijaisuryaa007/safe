import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { useLuxuryAlert } from './LuxuryAlertModal';

import { EmergencyMedicalService } from '../services/EmergencyMedicalService';

export interface MedicalProfile {
  bloodType: string;
  allergies: string;
  conditions: string;
  medications?: string;
  notes: string;
  primaryDoctor?: string;
}

interface MedicalInfoModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (data: MedicalProfile) => void;
}

export default function MedicalInfoModal({ visible, onClose, onSaved }: MedicalInfoModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const { profile, session } = useAuthStore();
  const { isDark } = useThemeStore();
  const { showAlert } = useLuxuryAlert();

  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [notes, setNotes] = useState('');
  const [primaryDoctor, setPrimaryDoctor] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const feedbackTimeoutRef = useRef<any>(null);

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

  const showInModalFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback({ message, type });
    Animated.spring(feedbackAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    feedbackTimeoutRef.current = setTimeout(() => {
      Animated.timing(feedbackAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setFeedback(null));
    }, 3500);
  };

  useEffect(() => {
    if (visible) {
      setFeedback(null);
      loadMedicalInfo();
    }
  }, [visible, profile?.id]);

  const loadMedicalInfo = async () => {
    const effectiveId = profile?.id || session?.user?.id || useAuthStore.getState().user?.id;
    if (!effectiveId) return;

    setIsLoading(true);
    try {
      const res = await EmergencyMedicalService.fetchMedicalInfo(effectiveId);
      if (res.data) {
        setBloodType(res.data.blood_type || 'O+');
        setAllergies(res.data.allergies || '');
        setConditions(res.data.conditions || '');
        setMedications(res.data.medications || '');
        setNotes(res.data.notes || '');
        if ((res.data as any).primary_doctor || (res.data as any).primaryDoctor) {
          setPrimaryDoctor((res.data as any).primary_doctor || (res.data as any).primaryDoctor || '');
        }
        setIsPendingSync(Boolean(res.pendingSync));
      }
    } catch (e) {
      console.error('[MedicalInfoModal] Error loading medical info:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const effectiveId = profile?.id || session?.user?.id || useAuthStore.getState().user?.id;
    if (!effectiveId) {
      showInModalFeedback('User profile not available. Please sign in again.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Assemble full medical note with primary doctor if specified
      const combinedNotes = primaryDoctor.trim() && !notes.includes(primaryDoctor.trim())
        ? (notes.trim() ? `${notes.trim()}\nDoctor: ${primaryDoctor.trim()}` : `Doctor: ${primaryDoctor.trim()}`)
        : notes.trim();

      const result = await EmergencyMedicalService.saveMedicalInfo(effectiveId, {
        blood_type: bloodType || 'O+',
        allergies: allergies.trim(),
        conditions: conditions.trim(),
        medications: medications.trim(),
        notes: combinedNotes,
      });

      if (result.success) {
        setIsPendingSync(false);
        setIsEditing(false);
        showInModalFeedback('Medical profile saved successfully!');
        if (onSaved) {
          onSaved({
            bloodType,
            allergies,
            conditions,
            medications,
            notes: combinedNotes,
            primaryDoctor,
          });
        }
      } else if (result.pendingSync) {
        setIsPendingSync(true);
        setIsEditing(false);
        showInModalFeedback('Saved offline. Changes will sync once network reconnects.');
        if (onSaved) {
          onSaved({
            bloodType,
            allergies,
            conditions,
            medications,
            notes: combinedNotes,
            primaryDoctor,
          });
        }
      } else {
        // Keep inputs in form - never discard user input on failure!
        showInModalFeedback(result.error || 'Failed to save medical card. Please try again.', 'error');
      }
    } catch (e: any) {
      console.error('[MedicalInfoModal] Failed to save medical info:', e);
      showInModalFeedback(e?.message || 'Failed to save medical card. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  const bgColor = isDark ? '#0F1411' : '#FAF9F6';
  const headerBg = isDark ? '#141A17' : '#FFFFFF';
  const headerBorder = isDark ? '#212C26' : '#ECEAE4';
  const cardBg = isDark ? '#1A231F' : '#FFFFFF';
  const cardBorder = isDark ? '#283730' : '#ECEAE4';
  const textColor = isDark ? '#FFFFFF' : '#1F2A24';
  const subtextColor = isDark ? '#9EACA3' : '#5C665F';
  const inputBg = isDark ? '#141A17' : '#FAF9F6';
  const inputBorder = isDark ? '#2D3A32' : '#ECEAE4';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={true}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topInset + 8, backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, isDark && { backgroundColor: '#1C2621' }]}
            activeOpacity={0.8}
            accessibilityLabel="Close medical info"
          >
            <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#1F2A24'} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>EMERGENCY PROTOCOLS</Text>
            <Text style={[styles.title, { color: textColor }]}>Medical Information</Text>
          </View>
        </View>

        {/* In-Modal Feedback Banner */}
        {feedback && (
          <Animated.View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: feedback.type === 'success' ? (isDark ? '#1A3326' : '#E8F5EE') : (isDark ? '#3D1B1B' : '#FEE2E2'),
                borderColor: feedback.type === 'success' ? '#2E7D5B' : '#EF4444',
                opacity: feedbackAnim,
                transform: [
                  {
                    translateY: feedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons
              name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={feedback.type === 'success' ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.feedbackText,
                { color: feedback.type === 'success' ? (isDark ? '#3ADFAB' : '#064E3B') : (isDark ? '#FCA5A5' : '#B91C1C') },
              ]}
            >
              {feedback.message}
            </Text>
          </Animated.View>
        )}

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: subtextColor }]}>
            This information is accessible to emergency responders and verified circle members during an active SOS distress signal.
          </Text>

          {/* Blood Group Display Card */}
          <View style={[styles.bloodCard, isDark && { backgroundColor: '#2B1E19', borderColor: '#452A20' }]}>
            <View style={[styles.bloodIconBox, isDark && { backgroundColor: '#1A231F' }]}>
              <Ionicons name="medical" size={24} color="#E07A5F" />
            </View>
            <View style={styles.bloodTextInfo}>
              <Text style={styles.bloodLabel}>BLOOD GROUP</Text>
              <Text style={[styles.bloodValue, { color: textColor }]}>{bloodType || 'O+'}</Text>
            </View>
          </View>

          {isEditing ? (
            <View style={[styles.form, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.label, { color: subtextColor }]}>SELECT BLOOD TYPE</Text>
              <View style={styles.bloodGrid}>
                {bloodTypes.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.bloodChip,
                      isDark && { backgroundColor: '#141A17', borderColor: '#2D3A32' },
                      bloodType === b && styles.bloodChipSelected,
                    ]}
                    onPress={() => setBloodType(b)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.bloodChipText,
                        { color: textColor },
                        bloodType === b && styles.bloodChipTextSelected,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: subtextColor }]}>KNOWN ALLERGIES</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                placeholder="e.g. Penicillin, Peanuts, Latex"
                placeholderTextColor={isDark ? '#6B7E72' : '#8E9992'}
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />

              <Text style={[styles.label, { color: subtextColor }]}>MEDICAL CONDITIONS</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                placeholder="e.g. Asthma, Type 1 Diabetes, Hypertension"
                placeholderTextColor={isDark ? '#6B7E72' : '#8E9992'}
                value={conditions}
                onChangeText={setConditions}
                multiline
              />

              <Text style={[styles.label, { color: subtextColor }]}>CURRENT MEDICATIONS</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                placeholder="e.g. Insulin, Albuterol inhaler, Aspirin 81mg"
                placeholderTextColor={isDark ? '#6B7E72' : '#8E9992'}
                value={medications}
                onChangeText={setMedications}
                multiline
              />

              <Text style={[styles.label, { color: subtextColor }]}>PRIMARY DOCTOR / CLINIC</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                placeholder="Dr. Smith • (555) 019-2831"
                placeholderTextColor={isDark ? '#6B7E72' : '#8E9992'}
                value={primaryDoctor}
                onChangeText={setPrimaryDoctor}
              />

              <Text style={[styles.label, { color: subtextColor }]}>EMERGENCY NOTES</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                placeholder="Important instructions for first responders..."
                placeholderTextColor={isDark ? '#6B7E72' : '#8E9992'}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, isDark && { backgroundColor: '#1C2621', borderColor: '#2E3D35' }]}
                  onPress={() => setIsEditing(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelText, isDark && { color: '#CAD5CE' }]}>CANCEL</Text>
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
            <View style={[styles.displayCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {isPendingSync && (
                <View style={[styles.pendingSyncBadge, { backgroundColor: isDark ? '#2E2211' : '#FEF3C7', borderColor: isDark ? '#78350F' : '#FDE68A' }]}>
                  <Ionicons name="cloud-offline-outline" size={15} color={isDark ? '#F59E0B' : '#B45309'} />
                  <Text style={[styles.pendingSyncText, { color: isDark ? '#F59E0B' : '#B45309' }]}>
                    Offline changes saved — will sync when connected
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, isDark && { backgroundColor: '#2B1E19' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#E07A5F" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={[styles.infoLabel, { color: subtextColor }]}>KNOWN ALLERGIES</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{allergies || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, isDark && { backgroundColor: '#1A2820' }]}>
                  <Ionicons name="fitness-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={[styles.infoLabel, { color: subtextColor }]}>MEDICAL CONDITIONS</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{conditions || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, isDark && { backgroundColor: '#1A2820' }]}>
                  <Ionicons name="medkit-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={[styles.infoLabel, { color: subtextColor }]}>CURRENT MEDICATIONS</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{medications || 'None recorded'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, isDark && { backgroundColor: '#1A2820' }]}>
                  <Ionicons name="person-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={[styles.infoLabel, { color: subtextColor }]}>PRIMARY DOCTOR</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{primaryDoctor || 'Not specified'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={[styles.infoIconBox, isDark && { backgroundColor: '#1F2A24' }]}>
                  <Ionicons name="document-text-outline" size={18} color={isDark ? '#8A9E92' : '#5C665F'} />
                </View>
                <View style={styles.infoTextWrapper}>
                  <Text style={[styles.infoLabel, { color: subtextColor }]}>EMERGENCY NOTES</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{notes || 'No extra notes provided'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.editBtn, isDark && { backgroundColor: '#1C2E24', borderColor: '#2E5943' }]}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={17} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                <Text style={[styles.editText, isDark && { color: '#3ADFAB' }]}>EDIT MEDICAL CARD</Text>
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
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: -4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  pendingSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  pendingSyncText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});

