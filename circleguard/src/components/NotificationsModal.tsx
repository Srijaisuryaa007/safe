import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

import { useLuxuryAlert } from './LuxuryAlertModal';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const KEYS = {
  NOTIF_SOS: '@circleguard_notif_sos',
  NOTIF_GEOFENCE: '@circleguard_notif_geofence',
  NOTIF_BATTERY: '@circleguard_notif_battery',
  NOTIF_SOUND: '@circleguard_notif_sound',
};

export default function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { colors } = useThemeStore();
  const { profile, setProfile } = useAuthStore();
  const { showAlert } = useLuxuryAlert();

  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  const [sosNotif, setSosNotif] = useState(true);
  const [geofenceNotif, setGeofenceNotif] = useState(true);
  const [batteryNotif, setBatteryNotif] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  useEffect(() => {
    if (visible) {
      setPhone(profile?.phone || '');
      loadSettings();
    }
  }, [visible, profile?.phone]);

  const loadSettings = async () => {
    try {
      const sos = await AsyncStorage.getItem(KEYS.NOTIF_SOS);
      const geo = await AsyncStorage.getItem(KEYS.NOTIF_GEOFENCE);
      const bat = await AsyncStorage.getItem(KEYS.NOTIF_BATTERY);
      const snd = await AsyncStorage.getItem(KEYS.NOTIF_SOUND);

      if (sos !== null) setSosNotif(sos === 'true');
      if (geo !== null) setGeofenceNotif(geo === 'true');
      if (bat !== null) setBatteryNotif(bat === 'true');
      if (snd !== null) setSoundAlerts(snd === 'true');
    } catch (e) {
      console.error('Error loading notification settings:', e);
    }
  };

  const toggleSetting = async (key: string, val: boolean, setter: (v: boolean) => void) => {
    try {
      setter(val);
      await AsyncStorage.setItem(key, String(val));
    } catch (e) {
      console.error('Error saving notification setting:', e);
    }
  };

  const handleUpdatePhone = async () => {
    if (!profile) return;
    if (!phone.trim()) {
      showAlert({
        title: 'INVALID PHONE NUMBER',
        message: 'Please enter a valid emergency phone number.',
        type: 'warning',
      });
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, phone: phone.trim() });
      showAlert({
        title: 'PHONE NUMBER UPDATED',
        message: 'Your registered phone number has been updated for SMS & emergency calls.',
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'UPDATE ERROR',
        message: err.message || 'Failed to update phone number.',
        type: 'error',
      });
    } finally {
      setSavingPhone(false);
    }
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
            <Text style={[styles.overline, { color: colors.accentGold }]}>ALERT PROTOCOLS</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Phone & Notifications</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Configure your emergency call channel & push alert dispatch settings.
          </Text>

          {/* Section: Registered Emergency Phone Number */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>REGISTERED PHONE NUMBER</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.phoneInputRow}>
              <Ionicons name="call-outline" size={20} color={colors.accentGold} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.phoneInput, { color: colors.foreground }]}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <TouchableOpacity
                style={[styles.savePhoneBtn, { backgroundColor: colors.accentGold }]}
                onPress={handleUpdatePhone}
                disabled={savingPhone}
              >
                {savingPhone ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.savePhoneText}>SAVE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Push Notification Controls */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>PUSH ALERT DISPATCH</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* SOS Alerts */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.sosRed} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Emergency SOS Push Alerts</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Instant priority push alert when a circle member triggers SOS
                  </Text>
                </View>
              </View>
              <Switch
                value={sosNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOS, val, setSosNotif)}
                trackColor={{ false: colors.border, true: colors.sosRed }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Geofence Entry/Exit Alerts */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="navigate-outline" size={22} color={colors.accentGold} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Geofence Arrival & Departure</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Alerts when members enter or leave Home, School, or Work
                  </Text>
                </View>
              </View>
              <Switch
                value={geofenceNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_GEOFENCE, val, setGeofenceNotif)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Low Battery Warning */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="battery-dead-outline" size={22} color="#F59E0B" />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Low Battery Warnings</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Notify when a member's phone battery drops below 15%
                  </Text>
                </View>
              </View>
              <Switch
                value={batteryNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_BATTERY, val, setBatteryNotif)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Loud Alarm Sound Tones */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="volume-high-outline" size={22} color={colors.foreground} />
                <View style={styles.textWrapper}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Siren Sound Tones</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Override Silent/Do-Not-Disturb for critical SOS alarms
                  </Text>
                </View>
              </View>
              <Switch
                value={soundAlerts}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOUND, val, setSoundAlerts)}
                trackColor={{ false: colors.border, true: colors.accentGold }}
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
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  savePhoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
  },
  savePhoneText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
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
});
