import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
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
  iconColor = '#2E7D5B',
  overview,
  bullets = [],
  tip,
}: FeatureInfoModalProps) {
  const { colors, isDark } = useThemeStore();

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
              backgroundColor: isDark ? '#141A17' : '#FFFFFF',
              borderColor: isDark ? '#23312A' : '#EDEBE6',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(46, 125, 91, 0.18)' : '#E8F5EE' }]}>
              <Ionicons name={iconName} size={22} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: isDark ? '#F5FAF7' : '#1F2A24' }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: isDark ? '#9EACA3' : '#64748B' }]}>{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1C2621' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={18} color={isDark ? '#9EACA3' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Overview Paragraph */}
            <Text style={[styles.overviewText, { color: isDark ? '#D1DDD6' : '#334155' }]}>
              {overview}
            </Text>

            {/* Bullets List */}
            {bullets && bullets.length > 0 ? (
              <View style={styles.bulletsContainer}>
                {bullets.map((b, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.bulletItem,
                      {
                        backgroundColor: isDark ? '#1A231F' : '#F8FAFC',
                        borderColor: isDark ? '#26342D' : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={[styles.bulletIconWrap, { backgroundColor: isDark ? 'rgba(74, 222, 128, 0.12)' : '#F0FDF4' }]}>
                      <Ionicons name={b.icon} size={16} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bulletTitle, { color: isDark ? '#F5FAF7' : '#1F2A24' }]}>
                        {b.title}
                      </Text>
                      <Text style={[styles.bulletDesc, { color: isDark ? '#9EACA3' : '#64748B' }]}>
                        {b.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Helpful Tip Box */}
            {tip ? (
              <View
                style={[
                  styles.tipBox,
                  {
                    backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : '#FEF9C3',
                    borderColor: isDark ? 'rgba(212, 175, 55, 0.28)' : '#FDE047',
                  },
                ]}
              >
                <Ionicons name="bulb-outline" size={16} color="#D97706" style={{ marginTop: 1 }} />
                <Text style={[styles.tipText, { color: isDark ? '#FDE68A' : '#854D0E' }]}>
                  {tip}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.gotItButton, { backgroundColor: '#4ADE80' }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.gotItText}>Got It</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
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
  content: {
    marginVertical: 16,
  },
  overviewText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  bulletsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bulletIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bulletDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  gotItButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  gotItText: {
    color: '#0F291E',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
