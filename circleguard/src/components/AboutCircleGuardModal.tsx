import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLuxuryAlert } from './LuxuryAlertModal';

interface AboutCircleGuardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutCircleGuardModal({
  visible,
  onClose,
}: AboutCircleGuardModalProps) {
  const { showAlert } = useLuxuryAlert();

  if (!visible) return null;

  const handleCopyInfo = async () => {
    const infoText = `CircleGuard Safety Architecture v1.2.0\nEncryption: AES-256 Military Grade\nEngine: React Native • Supabase Realtime • Leaflet 1.9.4\nStatus: Systems Operational`;
    await Clipboard.setStringAsync(infoText);
    showAlert({
      title: 'Copied to Clipboard',
      message: 'CircleGuard system build specifications and cryptographic architecture details copied to clipboard.',
      type: 'success',
      buttonText: 'DONE',
    });
  };

  const featureCards = [
    {
      icon: 'navigate-circle-outline' as const,
      title: '24/7 Live GPS Synchronization',
      desc: 'Sub-second real-time location streaming with intelligent battery-saving motion detection.',
      color: '#2E7D5B',
      bg: '#E8F5EE',
    },
    {
      icon: 'alert-circle-outline' as const,
      title: '0ms Realtime Emergency SOS',
      desc: 'Instant zero-delay emergency alerts dispatched to circle members with siren alarms.',
      color: '#DC2626',
      bg: '#FEE2E2',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Geofence Safe Place Perimeter',
      desc: 'Automated 3D dome boundary enter/exit notifications for home, school, and workplace.',
      color: '#E07A5F',
      bg: '#FFF3EB',
    },
    {
      icon: 'lock-closed-outline' as const,
      title: 'AES-256 End-to-End Encryption',
      desc: 'Vault-level encryption protecting member locations, emergency contacts, and trip histories.',
      color: '#2E7D5B',
      bg: '#E8F5EE',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>FAMILY SAFETY ARCHITECTURE</Text>
              <Text style={styles.title}>About CircleGuard</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#1F2A24" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* App Brand Identity Card */}
            <View style={styles.brandCard}>
              <View style={styles.brandLogoCircle}>
                <Ionicons name="shield-checkmark" size={32} color="#2E7D5B" />
              </View>
              <Text style={styles.brandName}>
                Circle<Text style={{ color: '#2E7D5B' }}>Guard</Text>
              </Text>
              <Text style={styles.brandEdition}>FLAGSHIP EDITION • v1.2.0</Text>
              <Text style={styles.brandTagline}>
                "Your Circle. Your Safety. Always."
              </Text>
            </View>

            {/* Core Features Grid */}
            <Text style={styles.sectionTitle}>CORE ARCHITECTURE</Text>

            <View style={styles.featureList}>
              {featureCards.map((feat, idx) => (
                <View key={idx} style={styles.featureCard}>
                  <View style={[styles.featureIconBox, { backgroundColor: feat.bg }]}>
                    <Ionicons name={feat.icon} size={20} color={feat.color} />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>{feat.title}</Text>
                    <Text style={styles.featureDesc}>{feat.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Technical Build Specs Box */}
            <View style={styles.techSpecsCard}>
              <View style={styles.specRow}>
                <Text style={styles.specKey}>BUILD VERSION</Text>
                <Text style={styles.specVal}>v1.2.0 (Release 2026)</Text>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.specRow}>
                <Text style={styles.specKey}>REALTIME ENGINE</Text>
                <Text style={[styles.specVal, { color: '#2E7D5B' }]}>Supabase Realtime • Leaflet GPS</Text>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.specRow}>
                <Text style={styles.specKey}>PRIVACY PROTOCOL</Text>
                <Text style={[styles.specVal, { color: '#2E7D5B' }]}>Ghost Mode & Disconnect Support</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyInfo}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={15} color="#2E7D5B" />
                <Text style={styles.copyBtnText}>COPY BUILD SPECS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeModalBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FAF9F6',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 22,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#F0EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 24,
  },
  brandCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    backgroundColor: '#FFFFFF',
  },
  brandLogoCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2A24',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  brandEdition: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5C665F',
    letterSpacing: 0.6,
    marginTop: 2,
    marginBottom: 6,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  brandTagline: {
    fontSize: 12,
    color: '#5C665F',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.6,
    marginTop: 6,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  featureList: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 12,
    gap: 12,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  featureDesc: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    lineHeight: 15,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  techSpecsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 14,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  specKey: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  specDivider: {
    height: 1,
    backgroundColor: '#F0EFEA',
    marginVertical: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  copyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C6E7D5',
    backgroundColor: '#E8F5EE',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  closeModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2E7D5B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
