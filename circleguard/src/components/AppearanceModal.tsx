import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';

interface AppearanceModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AppearanceModal({ visible, onClose }: AppearanceModalProps) {
  const { mapStyle, setMapStyle } = useThemeStore();
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color="#1F2A24" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>DESIGN SYSTEM & PREFERENCES</Text>
            <Text style={styles.title}>Appearance & Theme</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Permanent UI Hero Banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.heroBadgeText}>ACTIVE FLAGSHIP INTERFACE</Text>
            </View>
            <Text style={styles.heroTitle}>Billion Dollar UI Architecture</Text>
            <Text style={styles.heroSubtitle}>
              CircleGuard is engineered with clean ergonomics: Pine Emerald, Terracotta Peach, warm cream canvas, and rounded glassmorphism.
            </Text>

            <View style={styles.activePillRow}>
              <Ionicons name="checkmark-circle" size={16} color="#2E7D5B" />
              <Text style={styles.activePillText}>LOCKED AS PRIMARY INTERFACE</Text>
            </View>
          </View>

          {/* Design System Token Cards */}
          <Text style={styles.sectionHeader}>Color Palette & Safety Tokens</Text>
          <View style={styles.paletteGrid}>
            <View style={styles.paletteCard}>
              <View style={[styles.colorBlock, { backgroundColor: '#2E7D5B' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.colorName}>Pine Emerald</Text>
              <Text style={styles.colorHex}>#2E7D5B</Text>
              <Text style={styles.colorUsage}>Live GPS telemetry & safe geofences</Text>
            </View>

            <View style={styles.paletteCard}>
              <View style={[styles.colorBlock, { backgroundColor: '#E07A5F' }]}>
                <Ionicons name="flash" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.colorName}>Terracotta Peach</Text>
              <Text style={styles.colorHex}>#E07A5F</Text>
              <Text style={styles.colorUsage}>Quick action hub & safety hotlines</Text>
            </View>

            <View style={styles.paletteCard}>
              <View style={[styles.colorBlock, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="warning" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.colorName}>Distress Red</Text>
              <Text style={styles.colorHex}>#DC2626</Text>
              <Text style={styles.colorUsage}>High priority SOS distress signals</Text>
            </View>

            <View style={styles.paletteCard}>
              <View style={[styles.colorBlock, { backgroundColor: '#FAF9F6', borderColor: '#2E7D5B', borderWidth: 1.5 }]}>
                <Ionicons name="sunny" size={18} color="#2E7D5B" />
              </View>
              <Text style={styles.colorName}>Warm Alabaster</Text>
              <Text style={styles.colorHex}>#FAF9F6</Text>
              <Text style={styles.colorUsage}>Sunlight-optimized clean canvas</Text>
            </View>
          </View>

          {/* Map Layer Preferences */}
          <Text style={styles.sectionHeader}>Map Engine Layer</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={[styles.styleOptionRow, mapStyle === 'vector' && styles.styleOptionActive]}
              onPress={() => setMapStyle('vector')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="map" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.styleTitle}>Standard Vector Street Map</Text>
                  <Text style={styles.styleSub}>High clarity street grid with distinct landmarks</Text>
                </View>
              </View>
              {mapStyle === 'vector' && (
                <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.styleOptionRow, mapStyle === 'satellite' && styles.styleOptionActive]}
              onPress={() => setMapStyle('satellite')}
              activeOpacity={0.8}
            >
              <View style={styles.styleLeft}>
                <View style={[styles.styleIconBox, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="earth" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.styleTitle}>High-Resolution Satellite Imagery</Text>
                  <Text style={styles.styleSub}>Real aerial topography and photographic terrain</Text>
                </View>
              </View>
              {mapStyle === 'satellite' && (
                <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />
              )}
            </TouchableOpacity>
          </View>

          {/* Telemetry & Performance Preferences */}
          <Text style={styles.sectionHeader}>Telemetry & Performance</Text>
          <View style={styles.settingsCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="speedometer-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Real-Time GPS Polling (3s)</Text>
                  <Text style={styles.toggleSub}>Instant radar refresh for moving family members</Text>
                </View>
              </View>
              <Switch
                value={gpsRate === 'high'}
                onValueChange={(val) => handleToggleGpsRate(val ? 'high' : 'saver')}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="shield-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>3D Dome Geofence Highlight</Text>
                  <Text style={styles.toggleSub}>Render safe zone domes and boundary rings</Text>
                </View>
              </View>
              <Switch
                value={highContrastRadar}
                onValueChange={handleToggleContrast}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIconSquircle, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Haptic Touch Feedback</Text>
                  <Text style={styles.toggleSub}>Tactile vibration on geofence & SOS actions</Text>
                </View>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
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
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  heroBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2E7D5B',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2A24',
    marginBottom: 6,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#5C665F',
    lineHeight: 18,
    marginBottom: 14,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  activePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7FBF8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C6E7D5',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  paletteCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  colorBlock: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  colorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  colorHex: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E9992',
    marginTop: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  colorUsage: {
    fontSize: 10,
    color: '#5C665F',
    marginTop: 4,
    lineHeight: 14,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  styleOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  styleOptionActive: {
    backgroundColor: '#F7FBF8',
  },
  styleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  styleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  styleSub: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
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
    paddingRight: 10,
  },
  toggleIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  toggleSub: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EFEA',
    marginLeft: 62,
  },
});
