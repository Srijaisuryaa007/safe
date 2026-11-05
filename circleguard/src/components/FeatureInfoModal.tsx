import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export interface FeatureInfoBullet {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

export interface FeatureInfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  overview: string;
  bullets?: FeatureInfoBullet[];
  tip?: string;
}

export default function FeatureInfoModal({
  visible,
  onClose,
  title,
  subtitle,
  iconName = 'information-circle',
  iconColor,
  overview,
  bullets = [],
  tip,
}: FeatureInfoModalProps) {
  const { isDark } = useThemeStore();

  const brandIconColor = isDark ? '#FFFFFF' : '#0F172A';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#111317' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
              <Ionicons name={iconName} size={22} color={brandIconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.tagPill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
                <Text style={[styles.tagText, { color: isDark ? '#94A3B8' : '#64748B' }]}>FEATURE GUIDE</Text>
              </View>
              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
              accessibilityLabel="Close info dialog"
            >
              <Ionicons name="close" size={18} color={isDark ? '#E2E8F0' : '#475569'} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content with indicator and generous bottom padding so nothing is ever clipped */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Clear Overview Hero Card */}
            <View
              style={[
                styles.overviewCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.overviewHeader}>
                <Ionicons name="sparkles-outline" size={15} color={isDark ? '#FFFFFF' : '#0F172A'} />
                <Text style={[styles.overviewBadgeText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>HOW IT WORKS</Text>
              </View>
              <Text style={[styles.overviewText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                {overview}
              </Text>
            </View>

            {/* Bullets List formatted as Clear Process Steps */}
            {bullets && bullets.length > 0 ? (
              <View style={styles.bulletsContainer}>
                {bullets.map((b, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.bulletItem,
                      {
                        backgroundColor: isDark ? '#181C24' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.stepIndicatorCol}>
                      <View style={[styles.bulletIconWrap, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
                        <Ionicons name={b.icon} size={17} color={brandIconColor} />
                      </View>
                      <Text style={[styles.stepNumber, { color: isDark ? '#64748B' : '#94A3B8' }]}>
                        0{idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, paddingTop: 2 }}>
                      <Text style={[styles.bulletTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {b.title}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: isDark ? '#94A3B8' : '#475569' }]}>
                        {b.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Helpful Pro-Tip Box (Clean Monochrome Slate, no gold) */}
            {tip ? (
              <View
                style={[
                  styles.tipBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
                  },
                ]}
              >
                <View style={[styles.tipIconWrap, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0' }]}>
                  <Ionicons name="bulb-outline" size={16} color={brandIconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tipHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    RECOMMENDED SETUP
                  </Text>
                  <Text style={[styles.tipText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                    {tip}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Button - Firmly anchored at bottom, guaranteed high contrast and accessible */}
          <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
            <TouchableOpacity
              style={[styles.gotItButton, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityLabel="Got it, dismiss dialog"
            >
              <Text style={[styles.gotItText, { color: isDark ? '#000000' : '#FFFFFF' }]}>Got It</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
    marginVertical: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
    gap: 14,
  },
  overviewCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  overviewBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  overviewText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  bulletsContainer: {
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    gap: 4,
  },
  bulletIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bulletTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  bulletDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  gotItButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gotItText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

