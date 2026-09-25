import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { Ionicons } from '@expo/vector-icons';
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
  const [gpsRate, setGpsRate] = useState<'high' | 'saver'>('high');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrastRadar, setHighContrastRadar] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rate = await AsyncStorage.getItem('@circleguard_gps_sync_rate');
        if (rate === 'saver') setGpsRate('saver');

        const haptic = await AsyncStorage.getItem('@circleguard_haptics_enabled');
        if (haptic === 'false') setHapticsEnabled(false);

        const contrast = await AsyncStorage.getItem('@circleguard_high_contrast');
        if (contrast === 'false') setHighContrastRadar(false);
      } catch (e) {}
    })();
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleToggleGpsRate = async (rate: 'high' | 'saver') => {
    setGpsRate(rate);
    try {
      await AsyncStorage.setItem('@circleguard_gps_sync_rate', rate);
    } catch (e) {}
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    try {
      await AsyncStorage.setItem('@circleguard_haptics_enabled', val ? 'true' : 'false');
    } catch (e) {}
  };

  const handleToggleContrast = async (val: boolean) => {
    setHighContrastRadar(val);
    try {
      await AsyncStorage.setItem('@circleguard_high_contrast', val ? 'true' : 'false');
    } catch (e) {}
  };

  if (!visible) return null;

  const surfaceBg = isDark ? '#0F1411' : '#FAF9F6';
  const headerBg = isDark ? 'rgba(20, 26, 23, 0.96)' : 'rgba(250, 249, 246, 0.96)';
  const cardBg = isDark ? '#1A231F' : '#FFFFFF';
  const cardBorder = isDark ? '#283730' : '#EDEBE6';
  const textPrimary = isDark ? '#FFFFFF' : '#151C27';
  const textSecondary = isDark ? '#CAD5CE' : '#5C665F';
  const accentColor = isDark ? '#3ADFAB' : '#2E7D5B';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: surfaceBg }]}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: topInset,
              height: 58 + topInset,
              backgroundColor: headerBg,
              borderBottomColor: cardBorder,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: isDark ? '#1C2621' : '#ECEAE4' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color={textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.overline, { color: accentColor }]}>PREFERENCES</Text>
            <Text style={[styles.title, { color: textPrimary }]}>Appearance & Theme</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 30 },
          ]}
        >
          {/* Active Flagship Architecture Banner */}
          <View
            style={[
              styles.heroBanner,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.heroBadgeRow}>
              <View style={[styles.livePulseDot, { backgroundColor: accentColor }]} />
              <Text style={[styles.heroBadgeText, { color: accentColor }]}>
                ACTIVE FLAGSHIP ARCHITECTURE
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: textPrimary }]}>
              CircleGuard Luxury Safety Architecture
            </Text>
            <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
              Engineered with clean ergonomics: Pine Emerald, Terracotta Peach, warm cream canvas, and rounded glassmorphism.
            </Text>

            <View style={[styles.activePillRow, { backgroundColor: isDark ? '#23352B' : '#E8F5EE' }]}>
              <Ionicons name="checkmark-circle" size={16} color={accentColor} />
              <Text style={[styles.activePillText, { color: accentColor }]}>
                {isDark ? 'ACTIVE: DARK UI MODE' : 'ACTIVE: LIGHT UI MODE'}
              </Text>
            </View>
          </View>

          {/* Theme Mode Selector Cards */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>
            SELECT INTERFACE THEME
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Light UI Mode */}
            <TouchableOpacity
              style={[
                styles.styleOptionRow,
                themeMode === 'light' && {
                  backgroundColor: isDark ? '#23352B' : '#E8F5EE',
                },
              ]}
              onPress={() => handleSelectTheme('light')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="sunny" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.styleTitle, { color: textPrimary }]}>Light UI Mode</Text>
                    {themeMode === 'light' && (
                      <View style={[styles.activeTag, { backgroundColor: isDark ? '#3ADFAB' : '#2E7D5B' }]}>
                        <Text style={[styles.activeTagText, isDark && { color: '#002116' }]}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.styleSub, { color: textSecondary }]}>
                    Clean alabaster canvas, crisp white surfaces, and botanical emerald accents
                  </Text>
                </View>
              </View>
              <Ionicons
                name={themeMode === 'light' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={themeMode === 'light' ? (isDark ? '#3ADFAB' : '#2E7D5B') : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
              />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: isDark ? '#283730' : '#F0EFEA' }]} />

            {/* Dark UI Mode */}
            <TouchableOpacity
              style={[
                styles.styleOptionRow,
                themeMode === 'dark' && {
                  backgroundColor: isDark ? '#23352B' : '#E8F5EE',
                },
              ]}
              onPress={() => handleSelectTheme('dark')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: isDark ? '#26342D' : '#1E2023' }]}>
                  <Ionicons name="moon" size={20} color={isDark ? '#3ADFAB' : '#A7D7C5'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.styleTitle, { color: textPrimary }]}>Dark UI Mode</Text>
                    {themeMode === 'dark' && (
                      <View style={[styles.activeTag, { backgroundColor: isDark ? '#3ADFAB' : '#2E7D5B' }]}>
                        <Text style={[styles.activeTagText, isDark && { color: '#002116' }]}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.styleSub, { color: textSecondary }]}>
                    Classic dark surface, high-contrast labels, and gentle night-time contrast
                  </Text>
                </View>
              </View>
              <Ionicons
                name={themeMode === 'dark' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={themeMode === 'dark' ? (isDark ? '#3ADFAB' : '#2E7D5B') : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
              />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: isDark ? '#283730' : '#F0EFEA' }]} />

            {/* Match System */}
            <TouchableOpacity
              style={[
                styles.styleOptionRow,
                themeMode === 'system' && {
                  backgroundColor: isDark ? '#23352B' : '#E8F5EE',
                },
              ]}
              onPress={() => handleSelectTheme('system')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: isDark ? '#26342D' : '#F3F4F6' }]}>
                  <Ionicons name="phone-portrait-outline" size={20} color={isDark ? '#3ADFAB' : '#4B5563'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.styleTitle, { color: textPrimary }]}>Match System</Text>
                    {themeMode === 'system' && (
                      <View style={[styles.activeTag, { backgroundColor: isDark ? '#3ADFAB' : '#2E7D5B' }]}>
                        <Text style={[styles.activeTagText, isDark && { color: '#002116' }]}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.styleSub, { color: textSecondary }]}>
                    Automatically matches your device OS dark or light appearance schedule
                  </Text>
                </View>
              </View>
              <Ionicons
                name={themeMode === 'system' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={themeMode === 'system' ? (isDark ? '#3ADFAB' : '#2E7D5B') : isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'}
              />
            </TouchableOpacity>
          </View>

          {/* Color Palette & Safety Tokens */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>
            COLOR PALETTE & SAFETY TOKENS
          </Text>
          <View style={styles.paletteGrid}>
            <View style={[styles.paletteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.colorBlock, { backgroundColor: '#2E7D5B' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              </View>
              <Text style={[styles.colorName, { color: textPrimary }]}>Pine Emerald</Text>
              <Text style={styles.colorHex}>#2E7D5B</Text>
              <Text style={[styles.colorUsage, { color: textSecondary }]}>
                Live GPS telemetry & safe geofences
              </Text>
            </View>

            <View style={[styles.paletteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.colorBlock, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="warning" size={18} color="#FFFFFF" />
              </View>
              <Text style={[styles.colorName, { color: textPrimary }]}>Emergency Red</Text>
              <Text style={styles.colorHex}>#DC2626</Text>
              <Text style={[styles.colorUsage, { color: textSecondary }]}>
                High priority SOS distress signals
              </Text>
            </View>

            <View style={[styles.paletteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.colorBlock, { backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: accentColor }]}>
                <Ionicons name="cube" size={18} color={accentColor} />
              </View>
              <Text style={[styles.colorName, { color: textPrimary }]}>Warm Alabaster</Text>
              <Text style={styles.colorHex}>#FAF9F6</Text>
              <Text style={[styles.colorUsage, { color: textSecondary }]}>
                Sunlight-optimized clean canvas
              </Text>
            </View>

            <View style={[styles.paletteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.colorBlock, { backgroundColor: '#E07A5F' }]}>
                <Ionicons name="flash" size={18} color="#FFFFFF" />
              </View>
              <Text style={[styles.colorName, { color: textPrimary }]}>Terracotta Peach</Text>
              <Text style={styles.colorHex}>#E07A5F</Text>
              <Text style={[styles.colorUsage, { color: textSecondary }]}>
                Quick action hub & safety hotlines
              </Text>
            </View>
          </View>

          {/* Map Engine Layer */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>MAP ENGINE LAYER</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.styleOptionRow,
                mapStyle === 'vector' && {
                  backgroundColor: isDark ? '#23352B' : '#E8F5EE',
                },
              ]}
              onPress={() => setMapStyle('vector')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: isDark ? '#26342D' : '#E8F5EE' }]}>
                  <Ionicons name="map" size={18} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.styleTitle, { color: textPrimary }]}>
                    Standard Vector Street Map
                  </Text>
                  <Text style={[styles.styleSub, { color: textSecondary }]}>
                    Clean street grid with sharp roads, buildings, and places
                  </Text>
                </View>
              </View>
              {mapStyle === 'vector' && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: isDark ? '#283730' : '#F0EFEA' }]} />

            <TouchableOpacity
              style={[
                styles.styleOptionRow,
                mapStyle === 'satellite' && {
                  backgroundColor: isDark ? '#23352B' : '#E8F5EE',
                },
              ]}
              onPress={() => setMapStyle('satellite')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: isDark ? '#26342D' : '#FFF3EB' }]}>
                  <Ionicons name="earth" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.styleTitle, { color: textPrimary }]}>
                    High-Resolution Satellite Imagery
                  </Text>
                  <Text style={[styles.styleSub, { color: textSecondary }]}>
                    Real aerial photography and geographic terrain contours
                  </Text>
                </View>
              </View>
              {mapStyle === 'satellite' && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
            </TouchableOpacity>
          </View>

          {/* Section: Telemetry & Performance */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>TELEMETRY & SENSORS</Text>
          <View style={[styles.settingsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: isDark ? '#26342D' : '#E8F5EE' }]}>
                  <Ionicons name="speedometer-outline" size={18} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: textPrimary }]}>
                    High-Frequency GPS Polling
                  </Text>
                  <Text style={[styles.toggleSub, { color: textSecondary }]}>
                    Faster real-time position updates when family members are traveling
                  </Text>
                </View>
              </View>
              <Switch
                value={gpsRate === 'high'}
                onValueChange={(val) => handleToggleGpsRate(val ? 'high' : 'saver')}
                trackColor={{ false: isDark ? '#33463C' : '#D1D5DB', true: accentColor }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? '#283730' : '#F0EFEA' }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: isDark ? '#26342D' : '#FFF3EB' }]}>
                  <Ionicons name="finger-print-outline" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: textPrimary }]}>
                    Tactile Haptic Feedback
                  </Text>
                  <Text style={[styles.toggleSub, { color: textSecondary }]}>
                    Vibration confirmations on SOS trigger, check-ins, and button presses
                  </Text>
                </View>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: isDark ? '#33463C' : '#D1D5DB', true: accentColor }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? '#283730' : '#F0EFEA' }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: isDark ? '#26342D' : '#E8F5EE' }]}>
                  <Ionicons name="contrast-outline" size={18} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: textPrimary }]}>
                    High-Contrast Perimeter Rings
                  </Text>
                  <Text style={[styles.toggleSub, { color: textSecondary }]}>
                    Boosts geofence border visibility in direct outdoor sunlight
                  </Text>
                </View>
              </View>
              <Switch
                value={highContrastRadar}
                onValueChange={handleToggleContrast}
                trackColor={{ false: isDark ? '#33463C' : '#D1D5DB', true: accentColor }}
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  heroBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  heroSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  activePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    marginTop: 4,
  },
  activePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 10,
    marginLeft: 4,
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  styleOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  styleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  styleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  styleSub: {
    fontSize: 11.5,
    lineHeight: 15.5,
    marginTop: 2,
  },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  colorBlock: {
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorHex: {
    fontSize: 10.5,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  colorUsage: {
    fontSize: 11,
    lineHeight: 14.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  toggleIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
});
