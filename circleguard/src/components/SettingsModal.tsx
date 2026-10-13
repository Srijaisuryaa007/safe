import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { startBatteryOptimizedBackgroundLocation } from '../services/LocationBackgroundService';
import { useLuxuryAlert } from './LuxuryAlertModal';
import BatteryOptimizationGuideModal from './BatteryOptimizationGuideModal';

import { useThemeStore } from '../store/useThemeStore';
import { StorageRecoveryService } from '../services/StorageRecoveryService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const KEYS = {
  DISTANCE_UNIT: '@circleguard_distance_unit',
  GPS_SYNC_RATE: '@circleguard_gps_sync_rate',
  MAP_STYLE: '@circleguard_map_style',
  DRIVING_SENSITIVITY: '@circleguard_driving_sensitivity',
};

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const { showAlert, showConfirm } = useLuxuryAlert();
  const profile = useAuthStore((s) => s.profile);
  const { isSeniorSimpleMode, setSeniorSimpleMode } = useThemeStore();

  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [syncRate, setSyncRate] = useState<'balanced' | 'high' | 'saver'>('balanced');
  const [mapStyle, setMapStyle] = useState<'vector' | 'satellite'>('vector');
  const [drivingSensitivity, setDrivingSensitivity] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [clearing, setClearing] = useState(false);
  const [batteryGuideVisible, setBatteryGuideVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      const u = await AsyncStorage.getItem(KEYS.DISTANCE_UNIT);
      const s = await AsyncStorage.getItem(KEYS.GPS_SYNC_RATE);
      const m = await AsyncStorage.getItem(KEYS.MAP_STYLE);
      const ds = await AsyncStorage.getItem(KEYS.DRIVING_SENSITIVITY);
      const seniorSaved = await AsyncStorage.getItem('@circleguard_senior_simple_mode');

      if (u) setUnit(u as 'km' | 'mi');
      if (s) setSyncRate(s as 'balanced' | 'high' | 'saver');
      if (m) setMapStyle(m as 'vector' | 'satellite');
      if (ds) setDrivingSensitivity(ds as 'low' | 'balanced' | 'high');
      if (seniorSaved !== null) {
        useThemeStore.getState().setSeniorSimpleMode(seniorSaved === 'true');
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const handleSelectUnit = async (newUnit: 'km' | 'mi') => {
    setUnit(newUnit);
    await AsyncStorage.setItem(KEYS.DISTANCE_UNIT, newUnit);
  };

  const handleSelectDrivingSensitivity = async (sens: 'low' | 'balanced' | 'high') => {
    setDrivingSensitivity(sens);
    await AsyncStorage.setItem(KEYS.DRIVING_SENSITIVITY, sens);
  };

  const handleToggleSeniorMode = async () => {
    const nextVal = !isSeniorSimpleMode;
    await setSeniorSimpleMode(nextVal);
    showAlert({
      title: nextVal ? 'Senior Easy Mode Active' : 'Standard Mode Restored',
      message: nextVal
        ? 'High-contrast large touch targets, simplified safety controls, and 8-second false-alarm buffer are now active.'
        : 'Standard display layout and 5-second SOS countdown restored.',
      type: 'success',
      buttonText: 'DONE',
    });
  };

  const handleSelectSyncRate = async (newRate: 'balanced' | 'high' | 'saver') => {
    setSyncRate(newRate);
    await AsyncStorage.setItem(KEYS.GPS_SYNC_RATE, newRate);
    const uid = profile?.id;
    if (uid) {
      try {
        await supabase.from('profiles').update({ gps_frequency: newRate }).eq('id', uid);
        useAuthStore.getState().updateProfileFields({ gps_frequency: newRate });
      } catch (_) {}
    }
    await startBatteryOptimizedBackgroundLocation();
  };

  const handleClearCache = async () => {
    showConfirm({
      title: 'Clear Local Cache',
      message:
        'This will purge temporary tile buffers and optimize memory performance. Saved account keys and circle memberships remain safe.',
      confirmText: 'PURGE CACHE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        setClearing(true);
        try {
          await StorageRecoveryService.pruneTransientCacheAsync();
          showAlert({
            title: 'Cache Optimized',
            message: 'Local tile and telemetry buffers have been successfully cleared.',
            type: 'success',
            buttonText: 'DONE',
          });
        } catch (err: any) {
          showAlert({
            title: 'Cache Error',
            message: err.message || 'Failed to clear cache.',
            type: 'error',
          });
        } finally {
          setClearing(false);
        }
      },
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={true}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#1F2A24" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>SYSTEM PREFERENCES</Text>
            <Text style={styles.title}>App Settings</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Customize map distance metrics, background telemetry sync rates, and local memory caches.
          </Text>

          {/* Section: Distance Metric Units */}
          <Text style={styles.sectionTitle}>DISTANCE METRICS</Text>
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, unit === 'km' && styles.segmentBtnActive]}
              onPress={() => handleSelectUnit('km')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentBtnText, unit === 'km' && styles.segmentBtnTextActive]}>
                Kilometers (km)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, unit === 'mi' && styles.segmentBtnActive]}
              onPress={() => handleSelectUnit('mi')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentBtnText, unit === 'mi' && styles.segmentBtnTextActive]}>
                Miles (mi)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: GPS Sync Rate */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>GPS SYNC FREQUENCY</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'high' && styles.syncRowActive]}
              onPress={() => handleSelectSyncRate('high')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="flash-outline" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Realtime GPS (5s)</Text>
                  <Text style={styles.syncDesc}>Maximum tracking accuracy during movement</Text>
                </View>
              </View>
              {syncRate === 'high' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'balanced' && styles.syncRowActive]}
              onPress={() => handleSelectSyncRate('balanced')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="leaf-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Balanced Efficiency (15s)</Text>
                  <Text style={styles.syncDesc}>Optimal battery and reliable location tracking</Text>
                </View>
              </View>
              {syncRate === 'balanced' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'saver' && styles.syncRowActive]}
              onPress={() => handleSelectSyncRate('saver')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#F0EFEA' }]}>
                  <Ionicons name="battery-charging-outline" size={18} color="#1F2A24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Battery Saver (30s)</Text>
                  <Text style={styles.syncDesc}>Conserves battery with optimized 30s background location sync</Text>
                </View>
              </View>
              {syncRate === 'saver' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>
          </View>

          {/* Section: Senior & Accessibility Easy Mode */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>ACCESSIBILITY & EASY MODE</Text>
          <TouchableOpacity
            style={[styles.actionCardBtn, isSeniorSimpleMode && { borderColor: '#2E7D5B', borderWidth: 1.5, backgroundColor: '#F0FAF4' }]}
            onPress={handleToggleSeniorMode}
            activeOpacity={0.8}
          >
            <View style={[styles.iconSquircle, { backgroundColor: isSeniorSimpleMode ? '#E8F5EE' : '#F0EFEA' }]}>
              <Ionicons name="accessibility-outline" size={20} color={isSeniorSimpleMode ? '#2E7D5B' : '#1F2A24'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.actionCardTitle}>Senior Easy Mode</Text>
                {isSeniorSimpleMode && (
                  <View style={{ backgroundColor: '#2E7D5B', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionCardDesc}>
                Extra-large high-contrast buttons, larger text scaling, and simplified safety dashboard.
              </Text>
            </View>
            <Switch
              value={isSeniorSimpleMode}
              onValueChange={handleToggleSeniorMode}
              trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Section: Driving Telematics Sensitivity */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>DRIVING SENSOR CALIBRATION</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity
              style={[styles.syncRow, drivingSensitivity === 'low' && styles.syncRowActive]}
              onPress={() => handleSelectDrivingSensitivity('low')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="car-outline" size={18} color="#E07A5F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Cup Holder & Fleet Mode (Low)</Text>
                  <Text style={styles.syncDesc}>Anti-vibration filter. Eliminates false braking penalties caused by bumps and rattles</Text>
                </View>
              </View>
              {drivingSensitivity === 'low' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.syncRow, drivingSensitivity === 'balanced' && styles.syncRowActive]}
              onPress={() => handleSelectDrivingSensitivity('balanced')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="speedometer-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Balanced Standard</Text>
                  <Text style={styles.syncDesc}>Recommended for everyday commutes and standard vehicle mounts</Text>
                </View>
              </View>
              {drivingSensitivity === 'balanced' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.syncRow, drivingSensitivity === 'high' && styles.syncRowActive]}
              onPress={() => handleSelectDrivingSensitivity('high')}
              activeOpacity={0.8}
            >
              <View style={styles.syncLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#F0EFEA' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#1F2A24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>Strict Driver Training (High)</Text>
                  <Text style={styles.syncDesc}>High-sensitivity alerts for new teen drivers and student pilots</Text>
                </View>
              </View>
              {drivingSensitivity === 'high' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
            </TouchableOpacity>
          </View>

          {/* Section: Background Reliability */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>BACKGROUND RELIABILITY</Text>
          <TouchableOpacity
            style={styles.actionCardBtn}
            onPress={() => setBatteryGuideVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconSquircle, { backgroundColor: '#FFF3EB' }]}>
              <Ionicons name="battery-dead-outline" size={18} color="#E07A5F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionCardTitle}>Unrestricted Background GPS</Text>
              <Text style={styles.actionCardDesc}>Step-by-step setup to bypass OS power limits</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          {/* Section: Storage Maintenance */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>STORAGE & CACHE</Text>
          <TouchableOpacity
            style={styles.actionCardBtn}
            onPress={handleClearCache}
            disabled={clearing}
            activeOpacity={0.8}
          >
            <View style={[styles.iconSquircle, { backgroundColor: '#F0EFEA' }]}>
              {clearing ? (
                <ActivityIndicator size="small" color="#1F2A24" />
              ) : (
                <Ionicons name="refresh-outline" size={18} color="#1F2A24" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionCardTitle}>Optimize Local Cache</Text>
              <Text style={styles.actionCardDesc}>Flush cached map tiles and telemetry memory</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>
        </ScrollView>

        <BatteryOptimizationGuideModal
          visible={batteryGuideVisible}
          onClose={() => setBatteryGuideVisible(false)}
        />
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
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C665F',
    lineHeight: 19,
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.6,
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0EFEA',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C665F',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  segmentBtnTextActive: {
    color: '#1F2A24',
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  syncRowActive: {
    backgroundColor: '#F7FBF8',
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  syncDesc: {
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
  actionCardBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  actionCardDesc: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
