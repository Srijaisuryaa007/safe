import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_WORLD_COUNTRIES } from '../constants/countriesData';

export interface EmergencyServiceItem {
  id: string;
  name: string;
  number: string;
  category: 'police' | 'medical' | 'fire' | 'universal' | 'women' | 'child' | 'special';
  icon: string;
  description: string;
}

export interface CountryInfo {
  code: string; // ISO 2-letter
  name: string;
  flag: string;
  dialCode: string;
  primaryEmergency: string;
  primaryLabel: string;
  services: EmergencyServiceItem[];
}

export const SUPPORTED_COUNTRIES: Record<string, CountryInfo> = ALL_WORLD_COUNTRIES;

const STORAGE_KEY = '@circleguard_selected_country_code';

interface CountryState {
  countryCode: string;
  country: CountryInfo;
  isAutoDetected: boolean;
  setCountryCode: (code: string, isManual?: boolean) => Promise<void>;
  initCountry: () => Promise<void>;
  autoDetectFromCoordinates: (lat: number, lng: number) => Promise<void>;
}

const MANUAL_OVERRIDE_KEY = '@circleguard_country_manual_override';

export const useCountryStore = create<CountryState>((set, get) => ({
  countryCode: 'US',
  country: SUPPORTED_COUNTRIES.US || SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0],
  isAutoDetected: true,
  setCountryCode: async (code: string, isManual: boolean = true) => {
    const upper = (code || '').toUpperCase().trim();
    const selected = SUPPORTED_COUNTRIES[upper] || SUPPORTED_COUNTRIES.US || Object.values(SUPPORTED_COUNTRIES)[0];
    set({
      countryCode: selected.code,
      country: selected,
      isAutoDetected: !isManual,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, selected.code);
      if (isManual) {
        await AsyncStorage.setItem(MANUAL_OVERRIDE_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(MANUAL_OVERRIDE_KEY);
      }
    } catch (e) {}
  },
  initCountry: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const isManual = await AsyncStorage.getItem(MANUAL_OVERRIDE_KEY);

      if (stored && SUPPORTED_COUNTRIES[stored]) {
        const c = SUPPORTED_COUNTRIES[stored];
        set({ countryCode: c.code, country: c, isAutoDetected: isManual !== 'true' });
        return;
      }

      // Infer default country from runtime timezone
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('Asia/Colombo')) {
          const c = SUPPORTED_COUNTRIES.IN;
          if (c) { set({ countryCode: 'IN', country: c, isAutoDetected: true }); return; }
        } else if (tz.includes('London') || tz.includes('Europe/London')) {
          const c = SUPPORTED_COUNTRIES.GB;
          if (c) { set({ countryCode: 'GB', country: c, isAutoDetected: true }); return; }
        } else if (tz.includes('Bangkok') || tz.includes('Indochina')) {
          const c = SUPPORTED_COUNTRIES.TH;
          if (c) { set({ countryCode: 'TH', country: c, isAutoDetected: true }); return; }
        } else if (tz.includes('Saigon') || tz.includes('Ho_Chi_Minh')) {
          const c = SUPPORTED_COUNTRIES.VN;
          if (c) { set({ countryCode: 'VN', country: c, isAutoDetected: true }); return; }
        }
      } catch (_) {}

      const fallback = SUPPORTED_COUNTRIES.US || SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0];
      set({ countryCode: fallback.code, country: fallback, isAutoDetected: true });
    } catch (e) {
      const fallback = SUPPORTED_COUNTRIES.US || SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0];
      set({ countryCode: fallback.code, country: fallback, isAutoDetected: true });
    }
  },
  autoDetectFromCoordinates: async (lat: number, lng: number) => {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    try {
      const manual = await AsyncStorage.getItem(MANUAL_OVERRIDE_KEY);
      if (manual === 'true') {
        // User intentionally picked a specific country in settings; don't override
        return;
      }

      const Location = require('expo-location');
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => null);
      if (Array.isArray(results) && results.length > 0 && results[0].isoCountryCode) {
        const iso = results[0].isoCountryCode.toUpperCase();
        if (SUPPORTED_COUNTRIES[iso] && get().countryCode !== iso) {
          const c = SUPPORTED_COUNTRIES[iso];
          set({ countryCode: c.code, country: c, isAutoDetected: true });
          await AsyncStorage.setItem(STORAGE_KEY, c.code);
        }
      }
    } catch (_) {}
  },
}));
