import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { dpdpConsentService } from '../services/DpdpConsentService';

interface ProminentLocationDisclosureModalProps {
  visible: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

/**
 * Google Play Policy Mandated Prominent Disclosure Modal.
 * Must be presented to the user BEFORE requesting ACCESS_BACKGROUND_LOCATION
 * or calling requestBackgroundPermissionsAsync.
 */
export default function ProminentLocationDisclosureModal({
  visible,
  onAgree,
  onCancel,
}: ProminentLocationDisclosureModalProps) {
  const { isDark } = useThemeStore();
  const insets = useSafeAreaInsets();

  const handleAccept = async () => {
    // Record explicit legal consent under India DPDP Act 2023 & GDPR
    await dpdpConsentService.grantConsent(
      'background_location',
      'Continuous background location tracking for family circle safety radar, safe zone arrival/departure geofencing, crash detection, and SOS dispatch.'
    );
    onAgree();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? '#141C17' : '#FFFFFF',
              borderColor: isDark ? 'rgba(58, 223, 171, 0.28)' : '#D1EAE0',
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Header Badge */}
          <View style={styles.badgeWrap}>
            <View
              style={[
                styles.iconSquircle,
                { backgroundColor: isDark ? 'rgba(58, 223, 171, 0.16)' : '#E0F5EB' },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={28}
                color={isDark ? '#3ADFAB' : '#006C4F'}
              />
            </View>
          </View>

          <Text style={[styles.mainTitle, { color: isDark ? '#FFFFFF' : '#111814' }]}>
            Background Location Disclosure
          </Text>

          <Text style={[styles.subtitle, { color: isDark ? '#8A9E92' : '#5A6E63' }]}>
            How CircleGuard uses your location to keep your family protected
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Pillar 1: What is collected */}
            <View
              style={[
                styles.featureCard,
                {
                  backgroundColor: isDark ? '#18241D' : '#F6FAF7',
                  borderColor: isDark ? '#26372E' : '#E2ECE6',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="navigate-circle" size={20} color={isDark ? '#3ADFAB' : '#059669'} />
                <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                  What Data is Collected?
                </Text>
              </View>
              <Text style={[styles.cardBody, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                CircleGuard collects <Text style={styles.boldText}>precise location coordinates (GPS)</Text>, 
                motion speed, and heading data even when the application is closed or not in active use.
              </Text>
            </View>

            {/* Pillar 2: Why it is collected */}
            <View
              style={[
                styles.featureCard,
                {
                  backgroundColor: isDark ? '#18241D' : '#F6FAF7',
                  borderColor: isDark ? '#26372E' : '#E2ECE6',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="alert-circle" size={20} color="#F5A623" />
                <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                  Why is Background Access Needed?
                </Text>
              </View>
              <Text style={[styles.cardBody, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                Background location enables the following core safety features:
              </Text>
              <View style={styles.bulletList}>
                <Text style={[styles.bulletItem, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                  • <Text style={styles.boldText}>Safe Zone Alerts:</Text> Automatically notify loved ones when you safely arrive at or depart from home, school, or work.
                </Text>
                <Text style={[styles.bulletItem, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                  • <Text style={styles.boldText}>Emergency SOS:</Text> Dispatch your exact live coordinate link to trusted circle contacts if you trigger SOS or distress shakes.
                </Text>
                <Text style={[styles.bulletItem, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                  • <Text style={styles.boldText}>Drive Safety & Crash Detection:</Text> Detect sudden deceleration and monitor speed for family peace of mind.
                </Text>
              </View>
            </View>

            {/* Pillar 3: Data Retention & Compliance */}
            <View
              style={[
                styles.featureCard,
                {
                  backgroundColor: isDark ? '#18241D' : '#F6FAF7',
                  borderColor: isDark ? '#26372E' : '#E2ECE6',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="time" size={20} color="#00D2FF" />
                <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                  30-Day Retention & Privacy Rights
                </Text>
              </View>
              <Text style={[styles.cardBody, { color: isDark ? '#CAD8D0' : '#475C50' }]}>
                Under our strict retention policy, location breadcrumbs older than <Text style={styles.boldText}>30 days are automatically and permanently purged</Text>. 
                You can pause sharing, enable Ghost Mode, or use "Delete My Data" at any time under India DPDP Act and GDPR regulations.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Not Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.agreeButton,
                { backgroundColor: isDark ? '#3ADFAB' : '#006C4F' },
              ]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={17} color="#FFFFFF" />
              <Text style={styles.agreeButtonText}>Agree & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 26,
    borderWidth: 1.5,
    paddingTop: 22,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  badgeWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  iconSquircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 10,
    lineHeight: 17,
  },
  scrollArea: {
    maxHeight: 320,
    marginBottom: 16,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  featureCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '700',
  },
  bulletList: {
    marginTop: 4,
    gap: 4,
  },
  bulletItem: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  agreeButton: {
    flex: 1.6,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#3ADFAB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  agreeButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
