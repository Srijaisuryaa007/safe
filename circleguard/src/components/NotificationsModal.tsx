import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useCountryStore } from '../store/useCountryStore';
import { useLuxuryAlert } from './LuxuryAlertModal';
import {
  validateAndNormalizePhone,
  detectCountryFromPhone,
} from '../lib/phoneValidation';

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
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const { isDark } = useThemeStore();
  const { profile, setProfile } = useAuthStore();
  const { country, countryCode } = useCountryStore();
  const { showAlert } = useLuxuryAlert();

  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  const [sosNotif, setSosNotif] = useState(true);
  const [geofenceNotif, setGeofenceNotif] = useState(true);
  const [batteryNotif, setBatteryNotif] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  useEffect(() => {
    if (visible) {
      loadSettings();
      if (profile?.phone) {
        setPhone(profile.phone);
      }
    }
  }, [visible, profile]);

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
        title: 'Phone Number Required',
        message: 'Please enter a valid mobile number.',
        type: 'warning',
      });
      return;
    }

    const detected = detectCountryFromPhone(phone, countryCode || 'IN');
    const validation = validateAndNormalizePhone(phone, detected);
    if (!validation.isValid) {
      showAlert({
        title: 'Invalid Number',
        message: validation.error || `Please enter a valid phone number for ${country.name}.`,
        type: 'warning',
      });
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: validation.e164 })
        .eq('id', profile.id);

      if (error) {
        if (error.code === '23505' || error.message.includes('unique constraint')) {
          showAlert({
            title: 'Number in Use',
            message: 'This mobile number is already registered to another account.',
            type: 'error',
          });
          return;
        }
        throw error;
      }

      setProfile({ ...profile, phone: validation.e164 });
      setPhone(validation.formattedDisplay);
      showAlert({
        title: 'Number Updated',
        message: `Registered phone number updated to ${validation.formattedDisplay}.`,
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Update Error',
        message: err.message || 'Failed to update phone number.',
        type: 'error',
      });
    } finally {
      setSavingPhone(false);
    }
  };

  if (!visible) return null;

  // Design tokens
  const bgScreen = isDark ? '#000000' : '#F2F2F7';
  const bgCard = isDark ? '#101114' : '#FFFFFF';
  const bgInput = isDark ? '#181A20' : '#F6F8FA';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#E5E5EA';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#64748B' : '#8E8E93';
  const accentColor = isDark ? '#FFFFFF' : '#0F172A';
  const switchTrack = { false: isDark ? '#27272A' : '#E5E5EA', true: isDark ? '#52525B' : '#0F172A' };

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
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.headerBtn}>
            <Text style={[styles.headerBackArrow, { color: textPrimary }]}>‹</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: textPrimary }]}>Notifications</Text>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.headerBtn}>
            <Text style={[styles.headerDoneText, { color: accentColor }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Emergency Phone Section */}
          <Text style={[styles.sectionHeader, { color: textMuted }]}>EMERGENCY MOBILE NUMBER</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor, padding: 14 }]}>
            <View style={styles.phoneInputRow}>
              <TextInput
                style={[styles.phoneInput, { backgroundColor: bgInput, borderColor, color: textPrimary }]}
                placeholder="Enter mobile number"
                placeholderTextColor={textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.savePhoneBtn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
                onPress={handleUpdatePhone}
                disabled={savingPhone}
                activeOpacity={0.8}
              >
                {savingPhone ? (
                  <ActivityIndicator size="small" color={isDark ? '#0F172A' : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.savePhoneText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.phoneNote, { color: textSecondary }]}>
              Used for priority circle dispatch and instant SMS alerts.
            </Text>
          </View>

          {/* Alert Preferences */}
          <Text style={[styles.sectionHeader, { color: textMuted }]}>ALERT PREFERENCES</Text>
          <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
            {/* SOS Alerts */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>SOS Distress Broadcasts</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Immediate priority alert when a circle member triggers SOS
                </Text>
              </View>
              <Switch
                value={sosNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOS, val, setSosNotif)}
                trackColor={switchTrack}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* Geofence Alerts */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Safe Zone Place Alerts</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Arrival and departure alerts for designated safe places
                </Text>
              </View>
              <Switch
                value={geofenceNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_GEOFENCE, val, setGeofenceNotif)}
                trackColor={switchTrack}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* Battery Alerts */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Low Battery Warnings</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Alerts when a family member's phone battery drops below 15%
                </Text>
              </View>
              <Switch
                value={batteryNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_BATTERY, val, setBatteryNotif)}
                trackColor={switchTrack}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* Siren Alerts */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Emergency Siren Tones</Text>
                <Text style={[styles.rowSubtitle, { color: textSecondary }]}>
                  Audible alarm tone for critical SOS broadcasts
                </Text>
              </View>
              <Switch
                value={soundAlerts}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOUND, val, setSoundAlerts)}
                trackColor={switchTrack}
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
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phoneInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  savePhoneBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePhoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  phoneNote: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
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
