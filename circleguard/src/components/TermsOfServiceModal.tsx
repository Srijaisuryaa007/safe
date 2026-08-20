import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface TermsOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TermsOfServiceModal({ visible, onClose }: TermsOfServiceModalProps) {
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
            <Text style={[styles.title, { color: colors.foreground }]}>Terms of Service</Text>
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
              These Terms of Service govern your use of the CircleGuard family safety platform and mobile applications. By accessing or using CircleGuard, you agree to be bound by these Terms.
            </Text>
          </View>

          {/* Section 1 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>1. Agreement to Terms</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            These Terms of Service ("Terms") govern your use of the CircleGuard app and website (the "Service"), operated by CircleGuard Safety Technologies. By creating an account or using the Service, you agree to these Terms. If you don't agree, please don't use the Service.
          </Text>

          {/* Section 2 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>2. Eligibility & Account Security</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            You must be at least 13 years old to create your own account. If you are adding a minor to your circle as a parent or guardian, you are responsible for that minor's use of the Service.
          </Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • You are responsible for keeping your login credentials secure.
          </Text>
          <Text style={[styles.bulletItem, { color: colors.foreground }]}>
            • You are responsible for all safety alerts dispatched from your device.
          </Text>

          {/* Section 3 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>3. Location Sharing & Circle Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            When you join a circle, your location and safety telemetry are visible strictly to authorized members of that private circle. You can leave a circle or enable Ghost Privacy Mode at any time in-app.
          </Text>

          {/* Callout: Accuracy Disclaimer */}
          <View style={[styles.callout, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEE2E2', borderColor: '#EF4444' }]}>
            <Text style={[styles.calloutText, { color: colors.foreground }]}>
              <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>Emergency Disclaimer: </Text>
              Location data depends on device GPS hardware and network connectivity. CircleGuard is an intelligent coordination tool to support family awareness — it is NOT a substitute for official emergency response services (911 / 112). In an emergency, always contact local authorities immediately.
            </Text>
          </View>

          {/* Section 4 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>4. Acceptable Use</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            You agree not to use the Service for stalking, harassment, non-consensual tracking of adults, or unauthorized network access.
          </Text>

          {/* Section 5 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>5. Subscriptions & Premium Features</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            CircleGuard provides core safety tools for all users, alongside optional CircleGuard Plus memberships unlocking extended geofence limits, unlimited travel logs, and executive security reports.
          </Text>

          {/* Section 6 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>6. Limitation of Liability</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            The Service is provided on an "as is" basis without warranties of any kind. CircleGuard is not liable for indirect damages arising from GPS hardware variance or network latency.
          </Text>

          {/* Section 7 */}
          <Text style={[styles.sectionHeading, { color: colors.accentGold }]}>7. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.foreground, marginBottom: 40 }]}>
            Questions regarding these Terms? Contact us at:{'\n'}
            <Text style={{ color: colors.accentGold, fontWeight: '700' }}>support@circleguard.app</Text>
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
});
