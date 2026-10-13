import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCountryStore } from '../store/useCountryStore';
import { DeadReckoningEngine } from './DeadReckoningEngine';

export interface OfflineSmsResult {
  sent: boolean;
  smsUrl?: string;
  recipientCount: number;
  latitude: number | null;
  longitude: number | null;
  isDeadReckoning?: boolean;
  error?: string;
}

const EMERGENCY_CONTACTS_CACHE_KEY = '@circleguard_cached_emergency_contacts';

class OfflineSmsSosService {
  /**
   * Cache emergency contact phone numbers locally so they remain accessible
   * even when cellular data or WiFi is completely down.
   */
  async cacheEmergencyContacts(contacts: Array<{ name: string; phone: string }>): Promise<void> {
    try {
      await AsyncStorage.setItem(EMERGENCY_CONTACTS_CACHE_KEY, JSON.stringify(contacts));
    } catch (_) {}
  }

  /**
   * Retrieve cached emergency contacts.
   */
  async getCachedEmergencyContacts(): Promise<Array<{ name: string; phone: string }>> {
    try {
      const raw = await AsyncStorage.getItem(EMERGENCY_CONTACTS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    // Fallback: try fetching from supabase if online
    try {
      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        const { data } = await supabase.from('emergency_contacts').select('name, phone').eq('user_id', uid);
        if (data && data.length > 0) {
          await this.cacheEmergencyContacts(data);
          return data;
        }
      }
    } catch (_) {}

    return [];
  }

  /**
   * Get country-specific emergency hotline based on user's active regional store
   */
  getCountryEmergencyHotlines(): { police: string; ambulance: string; general: string } {
    try {
      const state = useCountryStore.getState();
      const countryCode = state.countryCode || state.country?.code || 'IN';
      const primaryEmergency = state.country?.primaryEmergency || '112';
      switch (countryCode.toUpperCase()) {
        case 'US':
        case 'CA':
          return { police: '911', ambulance: '911', general: '911' };
        case 'GB':
          return { police: '999', ambulance: '999', general: primaryEmergency };
        case 'AU':
          return { police: '000', ambulance: '000', general: primaryEmergency };
        case 'JP':
          return { police: '110', ambulance: '119', general: primaryEmergency };
        case 'IN':
          return { police: '100', ambulance: '108', general: primaryEmergency };
        default:
          return { police: primaryEmergency, ambulance: primaryEmergency, general: primaryEmergency };
      }
    } catch {
      return { police: '112', ambulance: '112', general: '112' };
    }
  }

  /**
   * Trigger offline SMS fallback with live map coordinates link.
   * Can be triggered when network fails or explicitly by SOS.
   */
  async triggerOfflineSmsSos(customMessage?: string): Promise<OfflineSmsResult> {
    try {
      // 1. Get best available coordinates (fresh GPS fix, last known, or dead reckoning)
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;
      let isDeadReckoning = false;
      let locationNote = '';

      try {
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = fix.coords.latitude;
        lng = fix.coords.longitude;
        accuracy = Math.round(fix.coords.accuracy ?? 15);
        DeadReckoningEngine.updateGpsFix(lat, lng, (fix.coords.speed || 0) * 3.6, fix.coords.heading || 0, accuracy);
      } catch {
        // Fallback A: Try last known position
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            lat = last.coords.latitude;
            lng = last.coords.longitude;
            accuracy = Math.round(last.coords.accuracy ?? 50);
          }
        } catch (_) {}

        // Fallback B: If coordinates are unavailable (e.g. in road tunnel, dense canopy, or underground garage),
        // use DeadReckoningEngine to project position
        if (lat === null || lng === null) {
          const projected = DeadReckoningEngine.projectPosition();
          if (projected) {
            lat = projected.latitude;
            lng = projected.longitude;
            accuracy = projected.accuracyMeters;
            isDeadReckoning = true;
            locationNote = ' [Est. Tunnel / Indoor Dead Reckoning]';
          }
        }
      }

      // 2. Fetch battery level
      let batteryStr = '';
      try {
        const batteryLvl = await Battery.getBatteryLevelAsync();
        if (batteryLvl >= 0) {
          batteryStr = ` • Battery: ${Math.round(batteryLvl * 100)}%`;
        }
      } catch (_) {}

      // 3. Fetch emergency contact numbers
      const contacts = await this.getCachedEmergencyContacts();
      const phoneNumbers = contacts.map(c => c.phone.replace(/[^\d+]/g, '')).filter(Boolean);

      const userName = useAuthStore.getState().profile?.full_name || 'Circle Member';
      const timestamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const hotlines = this.getCountryEmergencyHotlines();

      // 4. Construct emergency SMS with live Google Maps navigation link
      let locationLink = 'Location unavailable';
      if (lat !== null && lng !== null) {
        locationLink = `https://maps.google.com/?q=${lat},${lng}`;
      }

      const defaultMsg = `EMERGENCY SOS: ${userName} triggered a distress alert at ${timestamp}${batteryStr}.${locationNote}\n\nLive GPS Map Link:\n${locationLink}\n(Accuracy: ~${accuracy ?? 25}m)\nLocal Dispatch Hotline: ${hotlines.general}\n\nSent via CircleGuard Offline Emergency Protocol`;
      const finalMsg = customMessage ? `${customMessage}\n\n${locationLink}` : defaultMsg;

      // 5. Open native SMS dialer with pre-populated recipients and body
      const separator = Platform.OS === 'ios' ? '&' : '?';
      const recipientsStr = phoneNumbers.join(Platform.OS === 'ios' ? ',' : ';');
      const smsUri = `sms:${recipientsStr}${separator}body=${encodeURIComponent(finalMsg)}`;

      const canOpen = await Linking.canOpenURL(smsUri);
      if (canOpen) {
        await Linking.openURL(smsUri);
        return {
          sent: true,
          smsUrl: smsUri,
          recipientCount: phoneNumbers.length,
          latitude: lat,
          longitude: lng,
          isDeadReckoning,
        };
      } else {
        // Fallback without pre-populated recipient list
        const fallbackUri = `sms:${separator}body=${encodeURIComponent(finalMsg)}`;
        await Linking.openURL(fallbackUri);
        return {
          sent: true,
          smsUrl: fallbackUri,
          recipientCount: 0,
          latitude: lat,
          longitude: lng,
          isDeadReckoning,
        };
      }
    } catch (err: any) {
      console.warn('[OfflineSmsSos] Failed to launch SMS dialer:', err);
      return {
        sent: false,
        recipientCount: 0,
        latitude: null,
        longitude: null,
        error: err.message,
      };
    }
  }
}

export const offlineSmsSosService = new OfflineSmsSosService();
