import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export interface OfflineSmsResult {
  sent: boolean;
  smsUrl?: string;
  recipientCount: number;
  latitude: number | null;
  longitude: number | null;
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
   * Trigger offline SMS fallback with live map coordinates link.
   * Can be triggered when network fails or explicitly by SOS.
   */
  async triggerOfflineSmsSos(customMessage?: string): Promise<OfflineSmsResult> {
    try {
      // 1. Get best available coordinates (fresh GPS fix or last known)
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;

      try {
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = fix.coords.latitude;
        lng = fix.coords.longitude;
        accuracy = Math.round(fix.coords.accuracy ?? 15);
      } catch {
        // Fallback to last known position
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            lat = last.coords.latitude;
            lng = last.coords.longitude;
            accuracy = Math.round(last.coords.accuracy ?? 50);
          }
        } catch (_) {}
      }

      // 2. Fetch emergency contact numbers
      const contacts = await this.getCachedEmergencyContacts();
      const phoneNumbers = contacts.map(c => c.phone.replace(/[^\d+]/g, '')).filter(Boolean);

      const userName = useAuthStore.getState().profile?.full_name || 'I';
      const timestamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      // 3. Construct emergency SMS with live Google Maps navigation link
      let locationLink = 'Location unavailable';
      if (lat !== null && lng !== null) {
        locationLink = `https://maps.google.com/?q=${lat},${lng}`;
      }

      const defaultMsg = `EMERGENCY ALERT: ${userName} triggered an SOS distress alert at ${timestamp}. Immediate assistance may be required!\n\nLive GPS Map Link:\n${locationLink}\n(Accuracy: ~${accuracy ?? 25}m)\n\nSent via CircleGuard Offline SMS Fallback`;
      const finalMsg = customMessage ? `${customMessage}\n\n${locationLink}` : defaultMsg;

      // 4. Open native SMS dialer with pre-populated recipients and body
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
        };
      } else {
        // Try without recipients (user selects contact)
        const fallbackUri = `sms:${separator}body=${encodeURIComponent(finalMsg)}`;
        await Linking.openURL(fallbackUri);
        return {
          sent: true,
          smsUrl: fallbackUri,
          recipientCount: 0,
          latitude: lat,
          longitude: lng,
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
