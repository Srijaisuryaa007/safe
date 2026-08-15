import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';
import AnimatedListDropdown from './AnimatedListDropdown';

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

  const themeOptions = [
    {
      id: 'minimalist_monochrome',
      title: 'MINIMALIST MONOCHROME (DESIGN #1)',
      subtitle: 'Pure Black & White, Sharp 0px Edges, Serif Editorial Weight',
      iconName: 'contrast-outline' as const,
      badge: themeMode === 'minimalist_monochrome' ? 'ACTIVE' : undefined,
      mode: 'minimalist_monochrome' as ThemeMode,
    },
    {
      id: 'bauhaus',
      title: 'BAUHAUS CONSTRUCTIVIST (DESIGN #2)',
      subtitle: 'Geometric Primaries (Red/Blue/Yellow), 4px Thick Black Borders',
      iconName: 'shapes-outline' as const,
      badge: themeMode === 'bauhaus' ? 'ACTIVE' : undefined,
      mode: 'bauhaus' as ThemeMode,
    },
    {
      id: 'light',
      title: 'EDITORIAL LIGHT MODE',
      subtitle: 'Warm Alabaster canvas & Rich Charcoal typography',
      iconName: 'sunny-outline' as const,
      badge: themeMode === 'light' ? 'ACTIVE' : undefined,
      mode: 'light' as ThemeMode,
    },
    {
      id: 'dark',
      title: 'BLACK LUXURY DARK MODE',
      subtitle: 'Onyx Obsidian Black & Metallic Gold highlights',
      iconName: 'moon-outline' as const,
      badge: themeMode === 'dark' ? 'ACTIVE' : undefined,
      mode: 'dark' as ThemeMode,
    },
    {
      id: 'system',
      title: 'SYSTEM AUTOMATIC',
      subtitle: 'Sync dynamically with device OS settings',
      iconName: 'phone-portrait-outline' as const,
      badge: themeMode === 'system' ? 'ACTIVE' : undefined,
      mode: 'system' as ThemeMode,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.overline, { color: colors.accentGold }]}>VISUAL PREFERENCES</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Appearance Mode</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Choose your preferred visual aesthetic for CircleGuard. Changes apply immediately across all screens.
          </Text>

          <View style={{ marginBottom: 20 }}>
            <AnimatedListDropdown
              items={themeOptions}
              selectedIndex={themeOptions.findIndex((o) => o.mode === themeMode)}
              onItemSelect={(item) => handleSelectTheme((item as any).mode)}
            />
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
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 18,
  },
  themeOptions: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 18,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  optionTextBox: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  themePreview: {
    width: 46,
    height: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightPreview: {
    backgroundColor: '#F9F8F6',
    borderColor: 'rgba(26, 26, 26, 0.2)',
  },
  darkPreview: {
    backgroundColor: '#0D0E12',
    borderColor: '#D4AF37',
  },
  systemPreview: {
    backgroundColor: '#374151',
    borderColor: '#6B7280',
  },
});
