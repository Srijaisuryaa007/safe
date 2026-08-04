import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';

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
  const { colors } = useThemeStore();

  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [syncRate, setSyncRate] = useState<'balanced' | 'high' | 'saver'>('balanced');
  const [mapStyle, setMapStyle] = useState<'vector' | 'satellite'>('vector');
  const [clearing, setClearing] = useState(false);

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
  };

  const handleSelectMapStyle = async (newStyle: 'vector' | 'satellite') => {
    setMapStyle(newStyle);
    await AsyncStorage.setItem(KEYS.MAP_STYLE, newStyle);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Local Cache',
      'This will clear temporary map tiles and cached user sessions. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              // Preserve main auth & theme keys, remove temporary items
              const keys = await AsyncStorage.getAllKeys();
              const itemsToRemove = keys.filter(k => k.startsWith('@circleguard_cache_'));
              await AsyncStorage.multiRemove(itemsToRemove);
              Alert.alert('Cache Cleared', 'Local storage cache has been optimized.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear cache.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.overline, { color: colors.accentGold }]}>SYSTEM ENGINE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>App Settings</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Customize map rendering preferences, distance metrics & background GPS sync rates.
          </Text>

          {/* Section: Distance Metric Units */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>DISTANCE METRICS</Text>
          <View style={[styles.optionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.optionBtn,
                unit === 'km' && { backgroundColor: colors.accentGold }
              ]}
              onPress={() => handleSelectUnit('km')}
            >
              <Text style={[styles.optionText, { color: unit === 'km' ? '#1A1A1A' : colors.foreground }]}>
                KILOMETERS (KM)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionBtn,
                unit === 'mi' && { backgroundColor: colors.accentGold }
              ]}
              onPress={() => handleSelectUnit('mi')}
            >
              <Text style={[styles.optionText, { color: unit === 'mi' ? '#1A1A1A' : colors.foreground }]}>
                MILES (MI)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: GPS Sync Rate */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>GPS SYNC FREQUENCY</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'high' && { borderColor: colors.accentGold, borderWidth: 2 }]}
              onPress={() => handleSelectSyncRate('high')}
            >
              <View style={styles.syncLeft}>
                <Ionicons name="flash-outline" size={20} color={colors.accentGold} />
                <View>
                  <Text style={[styles.syncTitle, { color: colors.foreground }]}>Realtime GPS (5s)</Text>
                  <Text style={[styles.syncDesc, { color: colors.textMuted }]}>Maximum tracking accuracy during navigation</Text>
                </View>
              </View>
              {syncRate === 'high' && <Ionicons name="checkmark-circle" size={20} color={colors.accentGold} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'balanced' && { borderColor: colors.accentGold, borderWidth: 2 }]}
              onPress={() => handleSelectSyncRate('balanced')}
            >
              <View style={styles.syncLeft}>
                <Ionicons name="leaf-outline" size={20} color="#10B981" />
                <View>
                  <Text style={[styles.syncTitle, { color: colors.foreground }]}>Balanced Efficiency (15s)</Text>
                  <Text style={[styles.syncDesc, { color: colors.textMuted }]}>Optimal battery & continuous tracking balance</Text>
                </View>
              </View>
              {syncRate === 'balanced' && <Ionicons name="checkmark-circle" size={20} color={colors.accentGold} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncRow, syncRate === 'saver' && { borderColor: colors.accentGold, borderWidth: 2 }]}
              onPress={() => handleSelectSyncRate('saver')}
            >
              <View style={styles.syncLeft}>
                <Ionicons name="battery-charging-outline" size={20} color="#F59E0B" />
                <View>
                  <Text style={[styles.syncTitle, { color: colors.foreground }]}>Battery Saver (60s)</Text>
                  <Text style={[styles.syncDesc, { color: colors.textMuted }]}>Ultra low battery mode for long trips</Text>
                </View>
              </View>
              {syncRate === 'saver' && <Ionicons name="checkmark-circle" size={20} color={colors.accentGold} />}
            </TouchableOpacity>
          </View>

          {/* Section: Storage & Maintenance */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>STORAGE MAINTENANCE</Text>

          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleClearCache}
            disabled={clearing}
            activeOpacity={0.8}
          >
            {clearing ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color={colors.foreground} />
                <Text style={[styles.clearBtnText, { color: colors.foreground }]}>OPTIMIZE LOCAL CACHE</Text>
              </>
            )}
          </TouchableOpacity>
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
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  card: {
    borderWidth: 1,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  syncTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  syncDesc: {
    fontSize: 11,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
