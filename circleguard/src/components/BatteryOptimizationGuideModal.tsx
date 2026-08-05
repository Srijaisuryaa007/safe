import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function BatteryOptimizationGuideModal({ visible, onClose }: Props) {
  const { colors } = useThemeStore();

  if (Platform.OS !== 'android') return null;

  const handleOpenSettings = () => {
    Linking.openSettings();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="battery-dead" size={28} color="#F59E0B" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Unrestricted Location Tracking</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              To prevent Android manufacturers (Xiaomi, Samsung, Huawei, OnePlus) from closing location sharing when your app is minimized or phone is locked:
            </Text>
          </View>

          <View style={styles.stepsList}>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={[styles.stepText, { color: colors.foreground }]}>Tap <Text style={{ fontWeight: 'bold' }}>"Open App Info"</Text> below.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={[styles.stepText, { color: colors.foreground }]}>Select <Text style={{ fontWeight: 'bold' }}>"Battery"</Text> or <Text style={{ fontWeight: 'bold' }}>"Battery Usage"</Text>.</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={[styles.stepText, { color: colors.foreground }]}>Change mode to <Text style={{ color: '#10B981', fontWeight: 'bold' }}>"Unrestricted / Don't Optimize"</Text>.</Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>DISMISS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentGold }]} onPress={handleOpenSettings}>
              <Ionicons name="settings-outline" size={18} color="#1A1A1A" />
              <Text style={styles.actionBtnText}>OPEN SETTINGS</Text>
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
    borderWidth: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  stepsList: {
    gap: 12,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  actionBtn: {
    flex: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
