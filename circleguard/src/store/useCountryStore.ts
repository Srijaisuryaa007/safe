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
  setCountryCode: (code: string) => Promise<void>;
  initCountry: () => Promise<void>;
}

export const useCountryStore = create<CountryState>((set, get) => ({
  countryCode: 'IN',
  country: SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0],
  setCountryCode: async (code: string) => {
    const selected = SUPPORTED_COUNTRIES[code] || SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0];
    set({
      countryCode: selected.code,
      country: selected,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, selected.code);
    } catch (e) {}
  },
  initCountry: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_COUNTRIES[stored]) {
        const c = SUPPORTED_COUNTRIES[stored];
        set({ countryCode: c.code, country: c });
      } else {
        const fallback = SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0];
        set({ countryCode: fallback.code, country: fallback });
      }
    } catch (e) {
      const fallback = SUPPORTED_COUNTRIES.IN || Object.values(SUPPORTED_COUNTRIES)[0];
      set({ countryCode: fallback.code, country: fallback });
    }
  },
}));
