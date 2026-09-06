import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';

interface AppearanceModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AppearanceModal({ visible, onClose }: AppearanceModalProps) {
  const { themeMode, colors, setThemeMode } = useThemeStore();

  const handleSelectTheme = async (mode: ThemeMode) => {
    try {
      await setThemeMode(mode);
    } catch (e) {
      console.error('Error saving theme mode:', e);
    }
  };

  if (!visible) return null;

  const themes = [
    {
      mode: 'dark' as ThemeMode,
      title: 'ONYX LUXURY DARK',
      designTag: 'SIGNATURE THEME',
      subtitle:
        'Deep Obsidian Black • Metallic Gold Highlights • High-contrast emergency safety visibility for night & low-light environments.',
      iconName: 'moon-outline' as const,
      cardStyle: {
        backgroundColor: '#1C1D24',
        borderColor: '#D4AF37',
        borderWidth: 1.5,
        borderRadius: 16,
        textColor: '#FFFFFF',
        subtitleColor: '#9CA3AF',
        badgeBg: '#D4AF37',
        badgeText: '#0D0E12',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 5,
      },
      palette: ['#0D0E12', '#1C1D24', '#D4AF37', '#EF4444'],
    },
    {
      mode: 'light' as ThemeMode,
      title: 'EDITORIAL CLEAN LIGHT',
      designTag: 'DAYLIGHT CLARITY',
      subtitle:
        'Warm Alabaster Canvas • Crisp Charcoal Typography • Clean minimal borders optimized for bright sunlight & outdoor readability.',
      iconName: 'sunny-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(26, 26, 26, 0.15)',
        borderWidth: 1,
        borderRadius: 16,
        textColor: '#1A1A1A',
        subtitleColor: '#6C6863',
        badgeBg: '#1A1A1A',
        badgeText: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      },
      palette: ['#F9F8F6', '#FFFFFF', '#1A1A1A', '#D4AF37'],
    },
    {
      mode: 'brand_green' as ThemeMode,
      title: 'BRAND EMERALD & AMBER',
      designTag: 'MODERN ACTIVE',
      subtitle:
        'Vibrant Emerald Green (#3DBE6C) • Warm Amber (#F5A623) • High-energy, crisp mobile interface designed for active tracking.',
      iconName: 'sparkles-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#3DBE6C',
        borderWidth: 2,
        borderRadius: 16,
        textColor: '#111111',
        subtitleColor: '#666666',
        badgeBg: '#3DBE6C',
        badgeText: '#FFFFFF',
        shadowColor: '#3DBE6C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
      },
      palette: ['#3DBE6C', '#F5A623', '#111111', '#F5F5F5'],
    },
    {
      mode: 'system' as ThemeMode,
      title: 'SYSTEM DYNAMIC AUTO',
      designTag: 'AUTO SYNC',
      subtitle:
        'Automatically syncs dark and light appearances based on your device system settings and scheduled sunset schedule.',
      iconName: 'phone-portrait-outline' as const,
      cardStyle: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 16,
        textColor: colors.foreground,
        subtitleColor: colors.textMuted,
        badgeBg: colors.border,
        badgeText: colors.foreground,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
      palette: [colors.background, colors.surface, colors.accentGold, colors.textMuted],
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Navigation Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.overline, { color: colors.accentGold }]}>VISUAL PREFERENCES</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Appearance Mode</Text>
          </View>
        </View>

        {/* Scrollable Visual Theme Options */}
        <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select your preferred visual style to instantly transform the entire app's contrast, color palette, and safety controls.
          </Text>

          <View style={styles.themeCardsContainer}>
            {themes.map((t) => {
              const isActive = themeMode === t.mode;
              const cs = t.cardStyle;

              return (
                <TouchableOpacity
                  key={t.mode}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: cs.backgroundColor,
                      borderColor: isActive ? (t.mode === 'brand_green' ? '#3DBE6C' : '#D4AF37') : cs.borderColor,
                      borderWidth: isActive ? 2.5 : cs.borderWidth,
                      borderRadius: cs.borderRadius,
                      shadowColor: cs.shadowColor,
                      shadowOffset: cs.shadowOffset,
                      shadowOpacity: cs.shadowOpacity,
                      shadowRadius: cs.shadowRadius,
                      elevation: cs.elevation,
                    },
                  ]}
                  activeOpacity={0.88}
                  onPress={() => handleSelectTheme(t.mode)}
                >
                  {/* Card Header Row */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.titleWithIcon}>
                      <View style={[styles.iconBox, { backgroundColor: cs.badgeBg }]}>
                        <Ionicons name={t.iconName} size={16} color={cs.badgeText} />
                      </View>
                      <View>
                        <Text style={[styles.designTag, { color: cs.subtitleColor }]}>{t.designTag}</Text>
                        <Text style={[styles.cardTitle, { color: cs.textColor }]}>{t.title}</Text>
                      </View>
                    </View>

                    {/* Active Pill Badge or Selection Circle */}
                    {isActive ? (
                      <View style={[styles.activePill, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="checkmark-sharp" size={13} color="#FFFFFF" />
                        <Text style={[styles.activePillText, { color: '#FFFFFF' }]}>APPLIED</Text>
                      </View>
                    ) : (
                      <View style={[styles.radioCircle, { borderColor: cs.borderColor }]}>
                        <View style={styles.radioInner} />
                      </View>
                    )}
                  </View>

                  {/* Card Description */}
                  <Text style={[styles.cardSubtitle, { color: cs.subtitleColor }]}>{t.subtitle}</Text>

                  {/* Palette Color Swatches */}
                  {t.palette ? (
                    <View style={styles.paletteRow}>
                      {t.palette.map((color, i) => (
                        <View key={i} style={[styles.paletteDot, { backgroundColor: color }]} />
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 20,
  },
  themeCardsContainer: {
    gap: 16,
  },
  themeCard: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  designTag: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  cardSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 6,
  },
  paletteDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
