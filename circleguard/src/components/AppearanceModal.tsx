import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
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

          <View style={styles.themeOptions}>
            {/* Light Mode Option */}
            <TouchableOpacity 
              style={[
                styles.optionCard, 
                { backgroundColor: colors.surface, borderColor: colors.border },
                themeMode === 'light' && { borderColor: colors.accentGold, borderWidth: 2 }
              ]}
              onPress={() => handleSelectTheme('light')}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.themePreview, styles.lightPreview]}>
                  <Ionicons name="sunny" size={24} color="#1A1A1A" />
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>EDITORIAL LIGHT MODE</Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Warm Alabaster canvas & Rich Charcoal typography</Text>
                </View>
              </View>
              {themeMode === 'light' ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accentGold} />
              ) : null}
            </TouchableOpacity>

            {/* Dark Mode Option */}
            <TouchableOpacity 
              style={[
                styles.optionCard, 
                { backgroundColor: colors.surface, borderColor: colors.border },
                themeMode === 'dark' && { borderColor: colors.accentGold, borderWidth: 2 }
              ]}
              onPress={() => handleSelectTheme('dark')}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.themePreview, styles.darkPreview]}>
                  <Ionicons name="moon" size={24} color="#D4AF37" />
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>BLACK LUXURY DARK MODE</Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Onyx Obsidian Black & Metallic Gold highlights</Text>
                </View>
              </View>
              {themeMode === 'dark' ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accentGold} />
              ) : null}
            </TouchableOpacity>

            {/* System Default Option */}
            <TouchableOpacity 
              style={[
                styles.optionCard, 
                { backgroundColor: colors.surface, borderColor: colors.border },
                themeMode === 'system' && { borderColor: colors.accentGold, borderWidth: 2 }
              ]}
              onPress={() => handleSelectTheme('system')}
              activeOpacity={0.8}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.themePreview, styles.systemPreview]}>
                  <Ionicons name="phone-portrait-outline" size={24} color="#6B7280" />
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>SYSTEM AUTOMATIC</Text>
                  <Text style={[styles.optionDesc, { color: colors.textMuted }]}>Sync dynamically with device OS settings</Text>
                </View>
              </View>
              {themeMode === 'system' ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accentGold} />
              ) : null}
            </TouchableOpacity>
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
