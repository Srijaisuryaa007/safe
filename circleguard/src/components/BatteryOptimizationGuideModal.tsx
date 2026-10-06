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
              backgroundColor: isDark ? '#141C17' : '#FFFFFF',
              borderColor: isDark ? 'rgba(58, 223, 171, 0.25)' : '#D1EAE0',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="battery-dead" size={28} color="#F59E0B" />
            </View>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111814' }]}>
              {guide.title}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
              {guide.manufacturer} aggressively limits background apps. Follow these steps so your family circle receives reliable live location:
            </Text>
          </View>

          <View style={styles.stepsList}>
            {guide.steps.map((step, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={[styles.stepNumCircle, { backgroundColor: isDark ? '#1D2E25' : '#E3F5EC' }]}>
                  <Text style={[styles.stepNum, { color: isDark ? '#3ADFAB' : '#006C4F' }]}>
                    {idx + 1}
                  </Text>
                </View>
                <Text style={[styles.stepText, { color: isDark ? '#CAD8D0' : '#2D3748' }]}>
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
                { backgroundColor: isDark ? '#3ADFAB' : '#006C4F' },
              ]}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={17} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>OPEN APP SETTINGS</Text>
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
    marginBottom: 16,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
