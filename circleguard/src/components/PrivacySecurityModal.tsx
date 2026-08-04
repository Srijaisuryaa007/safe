import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

interface PrivacySecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

const KEYS = {
  GHOST_MODE: '@circleguard_ghost_mode',
  HIDE_ONLINE: '@circleguard_hide_online',
  APP_LOCK: '@circleguard_app_lock',
  SHAKE_SOS: '@circleguard_shake_sos',
};

export default function PrivacySecurityModal({ visible, onClose }: PrivacySecurityModalProps) {
  const { colors } = useThemeStore();
  const { profile } = useAuthStore();

  const [ghostMode, setGhostMode] = useState(false);
  const [hideOnline, setHideOnline] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [shakeSos, setShakeSos] = useState(true);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      const g = await AsyncStorage.getItem(KEYS.GHOST_MODE);
      const h = await AsyncStorage.getItem(KEYS.HIDE_ONLINE);
      const l = await AsyncStorage.getItem(KEYS.APP_LOCK);
      const s = await AsyncStorage.getItem(KEYS.SHAKE_SOS);

      if (g !== null) setGhostMode(g === 'true');
      if (h !== null) setHideOnline(h === 'true');
      if (l !== null) setAppLock(l === 'true');
      if (s !== null) setShakeSos(s === 'true');
    } catch (e) {
      console.error('Error loading privacy settings:', e);
    }
  };

  const toggleSetting = async (key: string, val: boolean, setter: (v: boolean) => void) => {
    try {
      setter(val);
      await AsyncStorage.setItem(key, String(val));
    } catch (e) {
      console.error('Error saving setting:', e);
    }
  };

  const handlePurgeLocationHistory = async () => {
    if (!profile) return;

    Alert.alert(
      'Purge Location History',
      'This will permanently delete all your recorded GPS location trails from the cloud database. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setPurging(true);
            try {
              const { error } = await supabase
                .from('locations')
                .delete()
                .eq('user_id', profile.id);

              if (error) throw error;
              Alert.alert('Privacy Purge Complete', 'Your location history trail has been wiped from the database.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to purge location history.');
            } finally {
              setPurging(false);
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
            <Text style={[styles.overline, { color: colors.accentGold }]}>SECURITY SUITE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Privacy & Security</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Manage how your location, online presence, and security encryption protocols function.
          </Text>

          {/* Section: Location & Presence Privacy */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>LOCATION & PRESENCE</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Ghost Mode Toggle */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="eye-off-outline" size={22} color={colors.accentGold} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Ghost Privacy Mode</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Fuzzes your GPS to an approximate ~500m radius for circle members
                  </Text>
                </View>
              </View>
              <Switch
                value={ghostMode}
                onValueChange={(val) => toggleSetting(KEYS.GHOST_MODE, val, setGhostMode)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Hide Online Status Toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="radio-outline" size={22} color={colors.foreground} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Hide Online Presence</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Conceal active dot & timestamp from circle members
                  </Text>
                </View>
              </View>
              <Switch
                value={hideOnline}
                onValueChange={(val) => toggleSetting(KEYS.HIDE_ONLINE, val, setHideOnline)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section: App Protection & Emergency Trigger */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>DEVICE SECURITY</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Biometric App Lock */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="finger-print-outline" size={22} color={colors.accentGold} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Biometric App Lock</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Require FaceID / TouchID to unlock CircleGuard on launch
                  </Text>
                </View>
              </View>
              <Switch
                value={appLock}
                onValueChange={(val) => toggleSetting(KEYS.APP_LOCK, val, setAppLock)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Shake SOS Trigger */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.sosRed} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Shake Phone for SOS</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Vigorously shaking device instantly dispatches distress signal
                  </Text>
                </View>
              </View>
              <Switch
                value={shakeSos}
                onValueChange={(val) => toggleSetting(KEYS.SHAKE_SOS, val, setShakeSos)}
                trackColor={{ false: colors.border, true: colors.sosRed }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section: Data Management */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>DATA PURGING</Text>

          <TouchableOpacity
            style={[styles.purgeBtn, { backgroundColor: colors.surface, borderColor: colors.sosRed }]}
            onPress={handlePurgeLocationHistory}
            disabled={purging}
            activeOpacity={0.8}
          >
            {purging ? (
              <ActivityIndicator size="small" color={colors.sosRed} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.sosRed} />
                <Text style={[styles.purgeBtnText, { color: colors.sosRed }]}>WIPE LOCATION TRAIL HISTORY</Text>
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
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 12,
  },
  textWrapper: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  purgeBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
