import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const { colors, isDark } = useThemeStore();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.overline, { color: colors.accentGold }]}>LEGAL & COMPLIANCE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Privacy Policy</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Brand Header */}
          <View style={styles.brandRow}>
            <View style={[styles.dot, { borderColor: colors.accentGold }]}>
              <View style={[styles.dotInner, { backgroundColor: colors.accentGold }]} />
            </View>
            <Text style={[styles.brandText, { color: colors.foreground }]}>CIRCLEGUARD</Text>
          </View>

          <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
            Last updated: <Text style={{ color: colors.accentGold, fontWeight: '700' }}>August 20, 2026</Text>
          </Text>

          <View style={[styles.callout, { backgroundColor: isDark ? 'rgba(212, 175, 55, 0.08)' : '#FEF9C3', borderColor: colors.accentGold }]}>
            <Text style={[styles.calloutText, { color: colors.foreground }]}>
              CircleGuard is dedicated to family safety, real-time geofence alerting, and emergency coordination. We hold your location data and privacy with bank-grade confidentiality and strict member-controlled permissions.
            </Text>
          </View>

          {/* Section 1 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>1. Who We Are</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            CircleGuard ("we," "us," "our") provides an app that helps families and trusted circles stay connected and safe. This policy explains what information we collect, how we use it, and the choices you have. This policy applies to the CircleGuard mobile application and backend services (together, the "Service"), operated by CircleGuard Safety Technologies.
          </Text>

          {/* Section 2 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>2. Information We Collect</Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • <Text style={styles.bulletBold}>Account Information:</Text> Name, email address, and profile photo provided when signing in.
          </Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • <Text style={styles.bulletBold}>Location Information:</Text> With your permission, your device's real-time or periodic GPS location to display positions to circle members and power geofence alarms.
          </Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • <Text style={styles.bulletBold}>Circle & Family Data:</Text> Private circle groups, member roles, emergency contacts, and safe place zones.
          </Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • <Text style={styles.bulletBold}>Device & Telemetry Data:</Text> Battery levels, device types, and network health for reliable emergency dispatches.
          </Text>

          {/* Section 3 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>3. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            We use your data solely to deliver core life-safety features: displaying member locations, triggering geofence entry/exit alerts, sending emergency SOS notifications, and maintaining service uptime.
          </Text>
          <Text style={[styles.paragraph, { color: colors.foreground, fontWeight: '700', marginTop: 6 }]}>
            We do NOT sell or monetize your location data or personal info to advertisers or third parties.
          </Text>

          {/* Section 4 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>4. Who We Share Information With</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            Your location and status are shared exclusively with the members of private circles you have accepted and joined. Infrastructure providers (such as Supabase cloud database) process data under strict encryption and contractual confidentiality.
          </Text>

          {/* Section 5 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>5. Children & Family Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            All circles are invite-only and managed by Circle Leaders. Parents and guardians retain full control over membership, location sharing, and emergency protocols.
          </Text>

          {/* Section 6 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>6. Your Choices & Controls</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            You can enable Ghost Privacy Mode or Hide Online Presence anytime in Privacy & Security settings, wipe your entire GPS location trail with one tap, or delete your account at any time.
          </Text>

          {/* Section 7 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>7. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.foreground, marginBottom: 40 }]}>
            For any privacy inquiries or data requests, contact us at:{'\n'}
            <Text style={{ color: colors.accentGold, fontWeight: '700' }}>privacy@circleguard.app</Text>
          </Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderRadius: 8,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 16,
  },
  callout: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  calloutText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletItem: {
    fontSize: 13.5,
    lineHeight: 22,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletBold: {
    fontWeight: '700',
  },
});
