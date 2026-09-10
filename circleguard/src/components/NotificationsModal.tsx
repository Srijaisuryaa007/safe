import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { useCountryStore } from '../store/useCountryStore';
import {
  validateAndNormalizePhone,
  checkDuplicatePhoneNumber,
  detectCountryFromPhone,
} from '../lib/phoneValidation';
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
        title: 'Invalid Phone Number',
        message: 'Please enter a valid emergency mobile number.',
        type: 'warning',
      });
      return;
    }

    const detected = detectCountryFromPhone(phone, countryCode || 'IN');
    const validation = validateAndNormalizePhone(phone, detected);
    if (!validation.isValid) {
      showAlert({
        title: 'Invalid Phone Number',
        message: validation.error || `Please enter a valid phone number for ${country.name}.`,
        type: 'warning',
      });
      return;
    }

    setSavingPhone(true);
    try {
      const dupCheck = await checkDuplicatePhoneNumber(validation.e164, profile.id);
      if (dupCheck.isDuplicate) {
        showAlert({
          title: 'Phone Already Registered',
          message:
            dupCheck.error ||
            'This phone number is already registered to another account. Every member must have a unique phone number.',
          type: 'error',
        });
        setSavingPhone(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ phone: validation.e164 })
        .eq('id', profile.id);

      if (error) {
        if (
          error.message &&
          (error.message.includes('unique constraint') || error.message.includes('profiles_phone_key'))
        ) {
          showAlert({
            title: 'Phone Already Registered',
            message: `The phone number ${validation.formattedDisplay} is already registered to another account.`,
            type: 'error',
          });
          return;
        }
        throw error;
      }

      setProfile({ ...profile, phone: validation.e164 });
      setPhone(validation.formattedDisplay);
      showAlert({
        title: 'Phone Number Updated',
        message: `Registered phone number verified and updated to ${validation.formattedDisplay} for emergency calls.`,
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#1F2A24" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>CHANNELS & DISPATCH</Text>
            <Text style={styles.title}>Notifications & Alerts</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Configure verified phone numbers for circle dispatch and choose which family safety alerts you receive.
          </Text>

          {/* Section: Emergency Broadcast Phone */}
          <Text style={styles.sectionTitle}>EMERGENCY BROADCAST PHONE</Text>
          <View style={styles.phoneCard}>
            <View style={styles.phoneInputRow}>
              <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="call" size={17} color="#2E7D5B" />
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter mobile number"
                placeholderTextColor="#8E9992"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={styles.savePhoneBtn}
                onPress={handleUpdatePhone}
                disabled={savingPhone}
                activeOpacity={0.8}
              >
                {savingPhone ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.savePhoneText}>UPDATE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Priority Alert Preferences */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>PRIORITY ALERT PREFERENCES</Text>

          <View style={styles.cardGroup}>
            {/* SOS Emergency Broadcast */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="warning-outline" size={18} color="#DC2626" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>SOS Distress Broadcasts</Text>
                  <Text style={styles.rowDesc}>Immediate high-priority alert when a member hits SOS</Text>
                </View>
              </View>
              <Switch
                value={sosNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOS, val, setSosNotif)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Geofence Perimeter Notifications */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="location-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Geofence Place Alerts</Text>
                  <Text style={styles.rowDesc}>Arrival and departure chimes for designated safe places</Text>
                </View>
              </View>
              <Switch
                value={geofenceNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_GEOFENCE, val, setGeofenceNotif)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Low Battery Alerts */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="battery-dead-outline" size={18} color="#E07A5F" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Low Battery Warnings</Text>
                  <Text style={styles.rowDesc}>Notify when a member's phone battery drops below 15%</Text>
                </View>
              </View>
              <Switch
                value={batteryNotif}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_BATTERY, val, setBatteryNotif)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Loud Alarm Sound Tones */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#F0EFEA' }]}>
                  <Ionicons name="volume-high-outline" size={18} color="#1F2A24" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Siren Sound Tones</Text>
                  <Text style={styles.rowDesc}>Override Silent/Do-Not-Disturb for critical SOS alarms</Text>
                </View>
              </View>
              <Switch
                value={soundAlerts}
                onValueChange={(val) => toggleSetting(KEYS.NOTIF_SOUND, val, setSoundAlerts)}
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
  phoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  savePhoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2E7D5B',
  },
  savePhoneText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  rowDesc: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    lineHeight: 15,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EFEA',
    marginLeft: 62,
  },
});
