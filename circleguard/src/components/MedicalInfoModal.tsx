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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
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
  const { colors, isDark } = useThemeStore();
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={true} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#FAF9F6' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Clean Header */}
        <View style={[styles.header, { paddingTop: topInset + 6, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={isEditing ? () => setIsEditing(false) : onClose}
            style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F26' : '#F1F5F9' }]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>EMERGENCY PROTOCOLS</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Medical Information</Text>
          </View>
          {isEditing && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.headerSaveBtn, isSaving && { opacity: 0.6 }]}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.headerSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* In-Modal Feedback Banner */}
        {feedback && (
          <Animated.View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: feedback.type === 'success' ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9') : (isDark ? '#450A0A' : '#FEE2E2'),
                borderColor: feedback.type === 'success' ? (isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1') : '#EF4444',
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
            <Text style={[styles.feedbackBadge, { color: feedback.type === 'success' ? (isDark ? '#FFFFFF' : '#0F172A') : '#EF4444' }]}>
              {feedback.type === 'success' ? '✓' : '!'}
            </Text>
            <Text
              style={[
                styles.feedbackText,
                { color: feedback.type === 'success' ? (isDark ? '#E2E8F0' : '#0F172A') : (isDark ? '#FCA5A5' : '#B91C1C') },
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
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            This information is accessible to emergency responders and verified circle members during an active SOS distress signal.
          </Text>

          {/* Blood Type Hero Card */}
          <View style={[styles.bloodCard, { backgroundColor: isDark ? '#1C1F26' : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.bloodTextInfo}>
              <Text style={styles.bloodLabel}>BLOOD TYPE</Text>
              <Text style={[styles.bloodValue, { color: colors.foreground }]}>{bloodType || 'O+'}</Text>
            </View>
            <View style={[styles.bloodTypePill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
              <Text style={[styles.bloodTypePillText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>CRITICAL VITAL</Text>
            </View>
          </View>

          {isEditing ? (
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>SELECT BLOOD TYPE</Text>
              <View style={styles.bloodGrid}>
                {bloodTypes.map((b) => {
                  const isSelected = bloodType === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      style={[
                        styles.bloodChip,
                        {
                          backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                          borderColor: isDark ? '#333742' : '#E2E8F0',
                        },
                        isSelected && { backgroundColor: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? '#FFFFFF' : '#0F172A' },
                      ]}
                      onPress={() => setBloodType(b)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.bloodChipText,
                          { color: colors.foreground },
                          isSelected && { color: '#FFFFFF', fontWeight: '800' },
                        ]}
                      >
                        {b}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>KNOWN ALLERGIES</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                    borderColor: isDark ? '#333742' : '#E2E8F0',
                    color: colors.foreground,
                  },
                ]}
                placeholder="e.g. Penicillin, Peanuts, Latex"
                placeholderTextColor={colors.textMuted}
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MEDICAL CONDITIONS</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                    borderColor: isDark ? '#333742' : '#E2E8F0',
                    color: colors.foreground,
                  },
                ]}
                placeholder="e.g. Asthma, Type 1 Diabetes, Hypertension"
                placeholderTextColor={colors.textMuted}
                value={conditions}
                onChangeText={setConditions}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>CURRENT MEDICATIONS</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                    borderColor: isDark ? '#333742' : '#E2E8F0',
                    color: colors.foreground,
                  },
                ]}
                placeholder="e.g. Insulin, Albuterol inhaler, Aspirin 81mg"
                placeholderTextColor={colors.textMuted}
                value={medications}
                onChangeText={setMedications}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PRIMARY DOCTOR / CLINIC</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                    borderColor: isDark ? '#333742' : '#E2E8F0',
                    color: colors.foreground,
                  },
                ]}
                placeholder="Dr. Smith • (555) 019-2831"
                placeholderTextColor={colors.textMuted}
                value={primaryDoctor}
                onChangeText={setPrimaryDoctor}
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>EMERGENCY INSTRUCTIONS</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    minHeight: 80,
                    backgroundColor: isDark ? '#1C1F26' : '#F8FAFC',
                    borderColor: isDark ? '#333742' : '#E2E8F0',
                    color: colors.foreground,
                  },
                ]}
                placeholder="Crucial notes for emergency medical responders..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: isDark ? '#262930' : '#F8FAFC',
                      borderColor: isDark ? '#333742' : '#E2E8F0',
                    },
                  ]}
                  onPress={() => setIsEditing(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Profile</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {isPendingSync && (
                <View style={[styles.pendingSyncBadge, { backgroundColor: isDark ? '#2E2211' : '#FEF3C7', borderColor: isDark ? '#78350F' : '#FDE68A' }]}>
                  <Text style={[styles.pendingSyncText, { color: isDark ? '#F59E0B' : '#B45309' }]}>
                    Offline changes saved — will sync when connected
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>KNOWN ALLERGIES</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{allergies || 'None recorded'}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>MEDICAL CONDITIONS</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{conditions || 'None recorded'}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>CURRENT MEDICATIONS</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{medications || 'None recorded'}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>PRIMARY DOCTOR</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{primaryDoctor || 'Not specified'}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>EMERGENCY NOTES</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{notes || 'No extra notes provided'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: isDark ? '#1C1F26' : '#F1F5F9' }]}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.editBtnText, { color: colors.foreground }]}>Edit Medical Card</Text>
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
  headerSaveBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },
  bloodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  bloodTextInfo: {
    flex: 1,
  },
  bloodLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  bloodValue: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  bloodTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bloodTypePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  infoRow: {},
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  editBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  editBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  bloodChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '600',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: -4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackBadge: {
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  pendingSyncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  pendingSyncText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
