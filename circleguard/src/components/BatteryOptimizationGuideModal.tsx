import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { oemBatteryOptimizationService } from '../services/OemBatteryOptimizationService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function BatteryOptimizationGuideModal({ visible, onClose }: Props) {
  const { colors, isDark } = useThemeStore();

  if (Platform.OS !== 'android') return null;

  const guide = oemBatteryOptimizationService.getGuideForDevice();

  const handleOpenSettings = async () => {
    await oemBatteryOptimizationService.openSettings();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? '#111318' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={[styles.optionBBadge, isDark && styles.optionBBadgeDark]}>
                <Ionicons name="shield-checkmark" size={13} color={isDark ? '#38BDF8' : '#0284C7'} />
                <Text style={[styles.optionBBadgeText, isDark && { color: '#38BDF8' }]}>
                  OPTION B • 24/7 CONTINUOUS TRACKING
                </Text>
              </View>
            </View>
            <View style={styles.iconCircle}>
              <Ionicons name="battery-charging" size={28} color="#10B981" />
            </View>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {guide.title}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              To ensure Android never pauses tracking while driving or moving, set CircleGuard's battery usage to <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>"Unrestricted" (Don't optimize)</Text>:
            </Text>
          </View>

          {/* Exact Settings Path Box */}
          <View style={[styles.pathBox, isDark && styles.pathBoxDark]}>
            <Text style={[styles.pathLabel, isDark && { color: '#94A3B8' }]}>EXACT ANDROID SETTING PATH:</Text>
            <Text style={[styles.pathText, isDark && { color: '#34D399' }]}>
              Settings ➔ Apps ➔ CircleGuard ➔ Battery ➔ Unrestricted (Don't optimize)
            </Text>
          </View>

          <View style={styles.stepsList}>
            {guide.steps.map((step, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={[styles.stepNumCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
                  <Text style={[styles.stepNum, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {idx + 1}
                  </Text>
                </View>
                <Text style={[styles.stepText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  {step.replace(/^\d+\.\s*/, '')}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                DISMISS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={17} color={isDark ? '#0F172A' : '#FFFFFF'} />
              <Text style={[styles.actionBtnText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>OPEN APP SETTINGS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeRow: {
    marginBottom: 10,
  },
  optionBBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  optionBBadgeDark: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  optionBBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.6,
  },
  pathBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  pathBoxDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pathLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  pathText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 6,
  },
  stepsList: {
    gap: 10,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
