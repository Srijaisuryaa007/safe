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
  Vibration,
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
  const { isDark, isSeniorSimpleMode, setSeniorSimpleMode } = useThemeStore();

  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [syncRate, setSyncRate] = useState<'balanced' | 'high' | 'saver'>('balanced');
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
      const ds = await AsyncStorage.getItem(KEYS.DRIVING_SENSITIVITY);
      const seniorSaved = await AsyncStorage.getItem('@circleguard_senior_simple_mode');

      if (u) setUnit(u as 'km' | 'mi');
      if (s) setSyncRate(s as 'balanced' | 'high' | 'saver');
      if (ds) setDrivingSensitivity(ds as 'low' | 'balanced' | 'high');
      if (seniorSaved !== null) {
        useThemeStore.getState().setSeniorSimpleMode(seniorSaved === 'true');
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const handleSelectUnit = async (newUnit: 'km' | 'mi') => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
    setUnit(newUnit);
    await AsyncStorage.setItem(KEYS.DISTANCE_UNIT, newUnit);
  };

  const handleSelectDrivingSensitivity = async (sens: 'low' | 'balanced' | 'high') => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
    setDrivingSensitivity(sens);
    await AsyncStorage.setItem(KEYS.DRIVING_SENSITIVITY, sens);
  };

  const handleToggleSeniorMode = async () => {
    const nextVal = !isSeniorSimpleMode;
    await setSeniorSimpleMode(nextVal);
    showAlert({
      title: nextVal ? 'Senior Mode On' : 'Standard Mode Restored',
      message: nextVal
        ? 'Simplified safety controls and high-contrast touch targets are now active.'
        : 'Standard display layout restored.',
      type: 'success',
      buttonText: 'Done',
    });
  };

  const handleSelectSyncRate = async (newRate: 'balanced' | 'high' | 'saver') => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
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
      title: 'Clear Cache',
      message: 'This will purge local map tiles and temporary memory. Saved circles and account data remain intact.',
      confirmText: 'Clear Cache',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setClearing(true);
        try {
          await StorageRecoveryService.pruneTransientCacheAsync();
          showAlert({
            title: 'Cache Cleared',
            message: 'Local tile and temporary buffers have been purged.',
            type: 'success',
            buttonText: 'Done',
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

  // Theme colors
  const bgScreen = isDark ? '#000000' : '#F2F2F7';
  const bgCard = isDark ? '#101114' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#E5E5EA';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? '#94A3B8' : '#8E8E93';
  const accentColor = isDark ? '#30D158' : '#007AFF';
  const segmentActiveBg = isDark ? '#26282E' : '#FFFFFF';
  const segmentInactiveBg = isDark ? '#16171B' : '#E5E5EA';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={true}>
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
          <View style={{ width: 60 }} />
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Settings</Text>
          <TouchableOpacity
            style={styles.headerDoneBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.headerDoneText, { color: accentColor }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Units of Measure */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>UNITS</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor, padding: 10 }]}>
            <View style={[styles.segmentedWrap, { backgroundColor: segmentInactiveBg }]}>
              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  unit === 'km' && [styles.segmentItemActive, { backgroundColor: segmentActiveBg }],
                ]}
                onPress={() => handleSelectUnit('km')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: unit === 'km' ? textPrimary : textSecondary },
                    unit === 'km' && { fontWeight: '600' },
                  ]}
                >
                  Kilometers (km)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  unit === 'mi' && [styles.segmentItemActive, { backgroundColor: segmentActiveBg }],
                ]}
                onPress={() => handleSelectUnit('mi')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: unit === 'mi' ? textPrimary : textSecondary },
                    unit === 'mi' && { fontWeight: '600' },
                  ]}
                >
                  Miles (mi)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 2: GPS Sync Frequency */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>LOCATION REFRESH RATE</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectSyncRate('high')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Real-Time GPS (5s)</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  High accuracy tracking during movement
                </Text>
              </View>
              {syncRate === 'high' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectSyncRate('balanced')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Balanced (15s)</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Recommended balance of accuracy & battery
                </Text>
              </View>
              {syncRate === 'balanced' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectSyncRate('saver')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Battery Saver (30s)</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Conserves device power with 30s intervals
                </Text>
              </View>
              {syncRate === 'saver' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>
          </View>

          {/* Section 3: Accessibility */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>ACCESSIBILITY</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Senior Easy Mode</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Larger touch targets and simplified safety layout
                </Text>
              </View>
              <Switch
                value={isSeniorSimpleMode}
                onValueChange={handleToggleSeniorMode}
                trackColor={{ false: isDark ? '#27272A' : '#E5E5EA', true: accentColor }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section 4: Driving Detection */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>DRIVING SENSOR CALIBRATION</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectDrivingSensitivity('balanced')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Standard</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Calibrated for everyday commutes
                </Text>
              </View>
              {drivingSensitivity === 'balanced' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectDrivingSensitivity('low')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Low Sensitivity</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Anti-vibration filter for cup holders & rough roads
                </Text>
              </View>
              {drivingSensitivity === 'low' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => handleSelectDrivingSensitivity('high')}
              activeOpacity={0.65}
            >
              <View style={styles.radioTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>High Sensitivity</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Strict detection for new or teen drivers
                </Text>
              </View>
              {drivingSensitivity === 'high' && <Text style={[styles.checkMarkText, { color: accentColor }]}>✓</Text>}
            </TouchableOpacity>
          </View>

          {/* Section 5: Battery Reliability */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>BATTERY & BACKGROUND</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setBatteryGuideVisible(true)}
              activeOpacity={0.65}
            >
              <View style={styles.actionTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Background Battery Optimization</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Ensure persistent background location permissions
                </Text>
              </View>
              <Text style={[styles.chevronArrow, { color: isDark ? '#475569' : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Section 6: Cache Maintenance */}
          <Text style={[styles.sectionHeader, { color: textSecondary }]}>STORAGE</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleClearCache}
              disabled={clearing}
              activeOpacity={0.65}
            >
              <View style={styles.actionTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Clear Cache</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Purge offline map tiles and temporary cache
                </Text>
              </View>
              {clearing ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Text style={[styles.chevronArrow, { color: isDark ? '#475569' : '#9CA3AF' }]}>›</Text>
              )}
            </TouchableOpacity>
          </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  headerDoneBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  headerDoneText: {
    fontSize: 17,
    fontWeight: '600',
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
    marginBottom: 6,
  },
  groupedTable: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  segmentItemActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  radioTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionTextWrap: {
    flex: 1,
    paddingRight: 8,
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
  checkMarkText: {
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 8,
  },
  chevronArrow: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 18,
  },
});
