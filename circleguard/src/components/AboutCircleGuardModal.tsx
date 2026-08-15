import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useThemeStore } from '../store/useThemeStore';

interface AboutCircleGuardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutCircleGuardModal({
  visible,
  onClose,
}: AboutCircleGuardModalProps) {
  const { colors } = useThemeStore();

  if (!visible) return null;

  const handleCopyInfo = async () => {
    const infoText = `CircleGuard Safety Architecture v1.0.0 (Build 2026.8.15)\nEncryption: AES-256 Military Grade\nEngine: React Native • Supabase Realtime • Leaflet 1.9.4\nStatus: Systems Operational`;
    await Clipboard.setStringAsync(infoText);
    Alert.alert('Copied 📋', 'CircleGuard system build information copied to clipboard.');
  };

  const featureCards = [
    {
      icon: 'navigate-circle-outline' as const,
      title: '24/7 Live GPS Synchronization',
      desc: 'Sub-second real-time location streaming with intelligent battery-saving motion detection.',
      color: '#10B981',
    },
    {
      icon: 'alert-circle-outline' as const,
      title: '0ms Realtime Emergency SOS',
      desc: 'Instant 0-delay emergency alerts dispatched to all circle members with high-priority siren alarms.',
      color: '#EF4444',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Geofence Safe Place Perimeter',
      desc: 'Automated boundary enter/exit notifications for home, school, workplace, and custom safe zones.',
      color: '#F59E0B',
    },
    {
      icon: 'ribbon-outline' as const,
      title: 'Circle Hierarchy & Rank System',
      desc: 'Executive Founder, Co-Leader, Safety Guardian, and Member rank permission hierarchy.',
      color: '#A855F7',
    },
    {
      icon: 'lock-closed-outline' as const,
      title: 'AES-256 Military Grade Security',
      desc: 'End-to-end encrypted family vault protecting member locations, contacts, and trip histories.',
      color: '#D4AF37',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.overline, { color: colors.accentGold }]}>FAMILY SAFETY ARCHITECTURE</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>About CircleGuard</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* App Brand Identity Card */}
            <View style={[styles.brandCard, { backgroundColor: colors.background, borderColor: colors.accentGold }]}>
              <View style={[styles.brandLogoCircle, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: colors.accentGold }]}>
                <Ionicons name="shield-half-sharp" size={36} color={colors.accentGold} />
              </View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>
                Circle<Text style={{ color: colors.accentGold }}>Guard</Text>
              </Text>
              <Text style={[styles.brandEdition, { color: colors.accentGold }]}>LUXURY EDITORIAL EDITION • v1.0.0</Text>
              <Text style={[styles.brandTagline, { color: colors.textMuted }]}>
                "Your Circle. Your Safety. Always."
              </Text>
            </View>

            {/* Core Features Grid */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>CORE SAFETY SYSTEM ARCHITECTURE</Text>
            
            <View style={styles.featureList}>
              {featureCards.map((feat, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[styles.featureIconBox, { backgroundColor: `${feat.color}15`, borderColor: feat.color }]}>
                    <Ionicons name={feat.icon} size={20} color={feat.color} />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={[styles.featureTitle, { color: colors.foreground }]}>{feat.title}</Text>
                    <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{feat.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Technical Build Specs Box */}
            <View style={[styles.techSpecsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.specRow}>
                <Text style={[styles.specKey, { color: colors.textMuted }]}>BUILD VERSION</Text>
                <Text style={[styles.specVal, { color: colors.foreground }]}>v1.0.0 (Release Build 2026)</Text>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.specRow}>
                <Text style={[styles.specKey, { color: colors.textMuted }]}>REALTIME ENGINE</Text>
                <Text style={[styles.specVal, { color: colors.accentGold }]}>Supabase Realtime • Leaflet GPS</Text>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.specRow}>
                <Text style={[styles.specKey, { color: colors.textMuted }]}>PRIVACY PROTOCOL</Text>
                <Text style={[styles.specVal, { color: '#10B981' }]}>Ghost Mode & Disconnect Support</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.copyBtn, { borderColor: colors.accentGold, backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}
                onPress={handleCopyInfo}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={16} color={colors.accentGold} />
                <Text style={[styles.copyBtnText, { color: colors.accentGold }]}>COPY BUILD SPECS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: colors.accentGold }]}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 24,
  },
  brandCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  brandLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  brandEdition: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  featureList: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  techSpecsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  specKey: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  specVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  specDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  copyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
