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
      mode: 'minimalist_monochrome' as ThemeMode,
      title: 'MINIMALIST MONOCHROME',
      designTag: 'DESIGN #1',
      subtitle: 'Pure Black & White • Sharp 0px Edges • High-Fashion Serif Typography',
      iconName: 'contrast-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        borderWidth: 1,
        borderRadius: 0,
        textColor: '#000000',
        subtitleColor: '#555555',
        badgeBg: '#000000',
        badgeText: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
    },
    {
      mode: 'bauhaus' as ThemeMode,
      title: 'BAUHAUS CONSTRUCTIVIST',
      designTag: 'DESIGN #2',
      subtitle: '1920s Modernism • Geometric Red/Blue/Yellow Color Blocks • 4px Hard Black Shadow',
      iconName: 'shapes-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#121212',
        borderWidth: 3,
        borderRadius: 0,
        textColor: '#121212',
        subtitleColor: '#444444',
        badgeBg: '#F0C020',
        badgeText: '#121212',
        shadowColor: '#121212',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 1.0,
        shadowRadius: 0,
        elevation: 6,
      },
      palette: ['#D02020', '#1040C0', '#F0C020'],
    },
    {
      mode: 'maximalism_dopamine' as ThemeMode,
      title: 'MAXIMALISM / DOPAMINE',
      designTag: 'DESIGN #3',
      subtitle: 'Y2K Cosmic Void • Clashing Cyan/Magenta/Yellow • 4px Neon Glow Borders',
      iconName: 'sparkles-outline' as const,
      cardStyle: {
        backgroundColor: '#0D0D1A',
        borderColor: '#FF3AF2',
        borderWidth: 4,
        borderRadius: 20,
        textColor: '#FFFFFF',
        subtitleColor: '#00F5D4',
        badgeBg: '#FFE600',
        badgeText: '#0D0D1A',
        shadowColor: '#00F5D4',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.9,
        shadowRadius: 14,
        elevation: 8,
      },
      palette: ['#FF3AF2', '#00F5D4', '#FFE600'],
    },
    {
      mode: 'playful_geometric' as ThemeMode,
      title: 'PLAYFUL GEOMETRIC',
      designTag: 'DESIGN #4',
      subtitle: 'Memphis 80s Pop • Warm Cream Paper • Speech-Bubble Sticker Corners & Pop Shadows',
      iconName: 'color-palette-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFDF5',
        borderColor: '#1E293B',
        borderWidth: 2,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomLeftRadius: 4, // Speech bubble cutout
        textColor: '#1E293B',
        subtitleColor: '#64748B',
        badgeBg: '#8B5CF6',
        badgeText: '#FFFFFF',
        shadowColor: '#1E293B',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 1.0,
        shadowRadius: 0,
        elevation: 6,
      },
      palette: ['#8B5CF6', '#F472B6', '#FBBF24'],
    },
    {
      mode: 'botanical_organic' as ThemeMode,
      title: 'BOTANICAL / ORGANIC SERIF',
      designTag: 'DESIGN #5',
      subtitle: 'Digital Ode to Nature • Warm Alabaster Rice Paper • Deep Forest Green & Roman Arch Radii',
      iconName: 'leaf-outline' as const,
      cardStyle: {
        backgroundColor: '#F9F8F4',
        borderColor: '#E6E2DA',
        borderWidth: 1.5,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 16, // Architectural Roman Arch shape
        textColor: '#2D3A31',
        subtitleColor: '#8C9A84',
        badgeBg: '#2D3A31',
        badgeText: '#F9F8F4',
        shadowColor: '#2D3A31',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
      },
      palette: ['#2D3A31', '#8C9A84', '#DCCFC2', '#C27B66'],
    },
    {
      mode: 'vaporwave_outrun' as ThemeMode,
      title: 'VAPORWAVE / OUTRUN',
      designTag: 'DESIGN #6',
      subtitle: '1980s Retro-Futurism • Deep Void Purple #090014 • Hot Magenta & Electric Cyan Neon Glows',
      iconName: 'hardware-chip-outline' as const,
      cardStyle: {
        backgroundColor: '#090014',
        borderColor: '#FF00FF',
        borderWidth: 2,
        borderTopColor: '#00FFFF',
        borderTopWidth: 3,
        borderRadius: 0, // Sharp 0px angular corners
        textColor: '#E0E0E0',
        subtitleColor: '#00FFFF',
        badgeBg: '#FF00FF',
        badgeText: '#090014',
        shadowColor: '#FF00FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 16,
        elevation: 8,
      },
      palette: ['#FF00FF', '#00FFFF', '#FF9900', '#090014'],
    },
    {
      mode: 'light' as ThemeMode,
      title: 'EDITORIAL LIGHT MODE',
      designTag: 'CLASSIC LIGHT',
      subtitle: 'Warm Alabaster canvas & Rich Charcoal typography',
      iconName: 'sunny-outline' as const,
      cardStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E4E4E7',
        borderWidth: 1,
        borderRadius: 16,
        textColor: '#18181B',
        subtitleColor: '#71717A',
        badgeBg: '#18181B',
        badgeText: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      },
    },
    {
      mode: 'dark' as ThemeMode,
      title: 'BLACK LUXURY DARK MODE',
      designTag: 'CLASSIC DARK',
      subtitle: 'Onyx Obsidian Black & Metallic Gold highlights',
      iconName: 'moon-outline' as const,
      cardStyle: {
        backgroundColor: '#121212',
        borderColor: '#D4AF37',
        borderWidth: 1.5,
        borderRadius: 16,
        textColor: '#FFFFFF',
        subtitleColor: '#D4AF37',
        badgeBg: '#D4AF37',
        badgeText: '#121212',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 5,
      },
    },
    {
      mode: 'system' as ThemeMode,
      title: 'SYSTEM AUTOMATIC',
      designTag: 'AUTO SYNC',
      subtitle: 'Sync dynamically with device OS settings',
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
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Tap any design theme to instantly transform the entire app's visual architecture, borders, shadows, and color palette.
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
                      borderColor: isActive ? (t.mode === 'maximalism_dopamine' ? '#FFE600' : cs.borderColor) : cs.borderColor,
                      borderWidth: isActive ? Math.max(cs.borderWidth, 3) : cs.borderWidth,
                      borderRadius: (cs as any).borderRadius !== undefined ? (cs as any).borderRadius : 16,
                      borderTopLeftRadius: (cs as any).borderTopLeftRadius,
                      borderTopRightRadius: (cs as any).borderTopRightRadius,
                      borderBottomRightRadius: (cs as any).borderBottomRightRadius,
                      borderBottomLeftRadius: (cs as any).borderBottomLeftRadius,
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
                      <View style={[styles.activePill, { backgroundColor: t.mode === 'maximalism_dopamine' ? '#FFE600' : '#10B981' }]}>
                        <Ionicons name="checkmark-sharp" size={13} color={t.mode === 'maximalism_dopamine' ? '#0D0D1A' : '#FFFFFF'} />
                        <Text style={[styles.activePillText, { color: t.mode === 'maximalism_dopamine' ? '#0D0D1A' : '#FFFFFF' }]}>
                          APPLIED
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.radioCircle, { borderColor: cs.borderColor }]}>
                        <View style={styles.radioInner} />
                      </View>
                    )}
                  </View>

                  {/* Card Description */}
                  <Text style={[styles.cardSubtitle, { color: cs.subtitleColor }]}>
                    {t.subtitle}
                  </Text>

                  {/* Palette Color Swatches (if available) */}
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
    paddingBottom: 100, // Generous padding so items never get cut off at the bottom!
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  themeCardsContainer: {
    gap: 16,
  },
  themeCard: {
    padding: 18,
    position: 'relative',
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
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  designTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  paletteDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
