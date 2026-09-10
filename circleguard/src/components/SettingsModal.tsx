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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBatteryOptimizedBackgroundLocation } from '../services/LocationBackgroundService';
import { useLuxuryAlert } from './LuxuryAlertModal';
import BatteryOptimizationGuideModal from './BatteryOptimizationGuideModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const KEYS = {
  DISTANCE_UNIT: '@circleguard_distance_unit',
  GPS_SYNC_RATE: '@circleguard_gps_sync_rate',
  MAP_STYLE: '@circleguard_map_style',
};

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { showAlert, showConfirm } = useLuxuryAlert();

  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [syncRate, setSyncRate] = useState<'balanced' | 'high' | 'saver'>('balanced');
  const [mapStyle, setMapStyle] = useState<'vector' | 'satellite'>('vector');
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

      if (u) setUnit(u as 'km' | 'mi');
      if (s) setSyncRate(s as 'balanced' | 'high' | 'saver');
      if (m) setMapStyle(m as 'vector' | 'satellite');
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const handleSelectUnit = async (newUnit: 'km' | 'mi') => {
    setUnit(newUnit);
    await AsyncStorage.setItem(KEYS.DISTANCE_UNIT, newUnit);
  };

  const handleSelectSyncRate = async (newRate: 'balanced' | 'high' | 'saver') => {
    setSyncRate(newRate);
    await AsyncStorage.setItem(KEYS.GPS_SYNC_RATE, newRate);
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
          const keys = await AsyncStorage.getAllKeys();
          const itemsToRemove = keys.filter((k) => k.startsWith('@circleguard_cache_'));
          if (itemsToRemove.length > 0) {
            await AsyncStorage.multiRemove(itemsToRemove);
          }
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
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
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
                  <Text style={styles.syncTitle}>Battery Saver (60s)</Text>
                  <Text style={styles.syncDesc}>Conserves battery on long trips</Text>
                </View>
              </View>
              {syncRate === 'saver' && <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />}
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
