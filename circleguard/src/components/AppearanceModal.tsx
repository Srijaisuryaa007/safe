import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';

interface AppearanceModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AppearanceModal({ visible, onClose }: AppearanceModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { themeMode, setThemeMode, isDark, mapStyle, setMapStyle } = useThemeStore();
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const haptic = await AsyncStorage.getItem('@circleguard_haptics_enabled');
        if (haptic === 'false') setHapticsEnabled(false);

        const contrast = await AsyncStorage.getItem('@circleguard_high_contrast');
        if (contrast === 'true') setHighContrast(true);
      } catch (e) {}
    })();
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
    setThemeMode(mode);
  };

  const handleSelectMapStyle = (style: 'vector' | 'satellite') => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
    setMapStyle(style);
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    try {
      await AsyncStorage.setItem('@circleguard_haptics_enabled', val ? 'true' : 'false');
    } catch (e) {}
  };

  const handleToggleContrast = async (val: boolean) => {
    setHighContrast(val);
    try {
      await AsyncStorage.setItem('@circleguard_high_contrast', val ? 'true' : 'false');
    } catch (e) {}
  };

  if (!visible) return null;

  // Ultra-clean design tokens
  const bgScreen = isDark ? '#000000' : '#F2F2F7';
  const bgCard = isDark ? '#101114' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#E5E5EA';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#64748B' : '#8E8E93';
  const accentColor = isDark ? '#FFFFFF' : '#0F172A';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bgScreen }]}>
        {/* Navigation Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: topInset,
              height: 52 + topInset,
              backgroundColor: bgScreen,
              borderBottomColor: borderColor,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.headerBtn}>
            <Text style={[styles.headerBackArrow, { color: textPrimary }]}>‹</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: textPrimary }]}>Appearance</Text>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.headerBtn}>
            <Text style={[styles.headerDoneText, { color: accentColor }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: 60 }]}
        >
          {/* Theme Mode Selector */}
          <Text style={[styles.sectionHeader, { color: textMuted }]}>INTERFACE THEME</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            {/* Light Mode */}
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectTheme('light')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Light Mode</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Crisp white canvas with clean monochrome accents
                </Text>
              </View>
              {themeMode === 'light' && (
                <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* Dark Mode */}
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectTheme('dark')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Dark Mode</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Deep Obsidian OLED dark mode with high contrast
                </Text>
              </View>
              {themeMode === 'dark' && (
                <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* Match System */}
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectTheme('system')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Match System</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Automatically synchronize with device OS theme
                </Text>
              </View>
              {themeMode === 'system' && (
                <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Map Style Selector */}
          <Text style={[styles.sectionHeader, { color: textMuted }]}>MAP DISPLAY STYLE</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectMapStyle('vector')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Standard Vector</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  High-speed roads, terrain, and building outlines
                </Text>
              </View>
              {mapStyle !== 'satellite' && (
                <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectMapStyle('satellite')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Satellite Hybrid</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Real satellite aerial imagery with labeled streets
                </Text>
              </View>
              {mapStyle === 'satellite' && (
                <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* System Feedback */}
          <Text style={[styles.sectionHeader, { color: textMuted }]}>TOUCH & ACCESSIBILITY</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Haptic Feedback</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Tactile vibrations on check-ins, switches, and buttons
                </Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: isDark ? '#27272A' : '#E5E5EA', true: isDark ? '#52525B' : '#0F172A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>High Contrast Markers</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Bold borders around live member beacons
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={handleToggleContrast}
                trackColor={{ false: isDark ? '#27272A' : '#E5E5EA', true: isDark ? '#52525B' : '#0F172A' }}
                thumbColor="#FFFFFF"
              />
            </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 50,
  },
  headerBackArrow: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  headerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginLeft: 12,
    marginBottom: 8,
  },
  groupedTable: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  radioTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  checkMarkText: {
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
});
