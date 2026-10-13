import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageRecoveryService } from '../services/StorageRecoveryService';
import { BRAND_GREEN_THEME, LIGHT_THEME, DARK_THEME, BILLION_DOLLAR_THEME, INSPO_FLAGSHIP_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

export type ThemeMode = 'dark' | 'light' | 'brand_green' | 'billion_dollar' | 'system';
export type MapStyleType = 'vector' | 'satellite' | 'dark' | 'terrain';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  mapStyle: MapStyleType;
  isSeniorSimpleMode: boolean;
  currentUserId?: string | null;
  setThemeMode: (mode: ThemeMode, userId?: string) => Promise<void>;
  setMapStyle: (style: MapStyleType, userId?: string) => Promise<void>;
  setSeniorSimpleMode: (enabled: boolean) => Promise<void>;
  initTheme: (userId?: string | null) => Promise<void>;
  resetThemeToDefault: () => void;
}

const SENIOR_MODE_KEY = '@circleguard_senior_simple_mode';

const GLOBAL_THEME_KEY = '@circleguard_theme_mode_global';
const getStorageKey = (userId?: string | null) => userId ? `@circleguard_theme_mode_${userId}` : GLOBAL_THEME_KEY;
const getMapStyleKey = (userId?: string | null) => userId ? `@circleguard_map_style_${userId}` : '@circleguard_map_style_default';

let appearanceListenerSubscribed = false;

const getThemeConfig = (mode: ThemeMode, sysScheme?: ColorSchemeName | null): { colors: ThemeColors; isDark: boolean } => {
  if (mode === 'dark') return { colors: DARK_THEME.colors, isDark: true };
  if (mode === 'light' || mode === 'billion_dollar') return { colors: BILLION_DOLLAR_THEME.colors, isDark: false };
  if (mode === 'brand_green') return { colors: BRAND_GREEN_THEME.colors, isDark: false };
  const effectiveScheme = sysScheme || Appearance.getColorScheme();
  const isSysDark = effectiveScheme === 'dark';
  return { colors: isSysDark ? DARK_THEME.colors : BILLION_DOLLAR_THEME.colors, isDark: isSysDark };
};

const applyNativeColorScheme = (mode: ThemeMode) => {
  if (typeof Appearance.setColorScheme === 'function') {
    try {
      if (mode === 'system') {
        // Modern React Native (RN 0.82+) TurboModules require 'auto' or 'unspecified'.
        // Passing null causes a fatal TurboModule TypeError / NullPointerException crash.
        (Appearance.setColorScheme as any)('auto');
      } else if (mode === 'dark') {
        (Appearance.setColorScheme as any)('dark');
      } else {
        (Appearance.setColorScheme as any)('light');
      }
    } catch (_) {
      try {
        if (mode === 'system') {
          (Appearance.setColorScheme as any)('unspecified');
        }
      } catch (__) {}
    }
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'light',
  isDark: false,
  colors: BILLION_DOLLAR_THEME.colors,
  mapStyle: 'vector',
  isSeniorSimpleMode: false,
  currentUserId: null,

  initTheme: async (userId?: string | null) => {
    try {
      const activeUser = userId ?? get().currentUserId;
      const themeKey = getStorageKey(activeUser);
      const mapKey = getMapStyleKey(activeUser);

      // Try user key first, fallback to global key
      let saved = await AsyncStorage.getItem(themeKey);
      if (!saved) {
        saved = await AsyncStorage.getItem(GLOBAL_THEME_KEY);
      }
      const savedMapStyle = await AsyncStorage.getItem(mapKey);
      const savedSenior = await AsyncStorage.getItem(SENIOR_MODE_KEY);
      let mode: ThemeMode = (saved as ThemeMode) || 'light';
      if (mode === 'billion_dollar' || (mode as any) === 'inspo_flagship') {
        mode = 'light';
      }

      const mapStyle: MapStyleType = (savedMapStyle as MapStyleType) || 'vector';
      const isSenior = savedSenior === 'true';
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      applyNativeColorScheme(mode);

      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
        mapStyle: mapStyle,
        isSeniorSimpleMode: isSenior,
        currentUserId: activeUser || null,
      });

      if (!appearanceListenerSubscribed) {
        appearanceListenerSubscribed = true;
        Appearance.addChangeListener(({ colorScheme }) => {
          const currentMode = get().themeMode;
          if (currentMode === 'system') {
            const newConfig = getThemeConfig('system', colorScheme);
            Object.assign(LUXURY_THEME.colors, newConfig.colors);
            set({
              isDark: newConfig.isDark,
              colors: newConfig.colors,
            });
          }
        });
      }
    } catch (e) {
      console.error('Error initializing theme:', e);
    }
  },

  setThemeMode: async (mode: ThemeMode, userId?: string) => {
    try {
      const activeUser = userId ?? get().currentUserId;
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      // Instant optimistic UI update
      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
      });

      // Update native appearance scheme safely without crashing TurboModule
      applyNativeColorScheme(mode);

      // Persist to both specific user and global storage
      const themeKey = getStorageKey(activeUser);
      await Promise.all([
        AsyncStorage.setItem(themeKey, mode).catch(() => {}),
        AsyncStorage.setItem(GLOBAL_THEME_KEY, mode).catch(() => {}),
      ]);
    } catch (e) {
      console.error('Error setting theme mode:', e);
    }
  },

  setMapStyle: async (style: MapStyleType, userId?: string) => {
    try {
      const activeUser = userId ?? get().currentUserId;
      const mapKey = getMapStyleKey(activeUser);
      await AsyncStorage.setItem(mapKey, style);
      set({ mapStyle: style });
    } catch (e) {
      console.error('Error saving map style:', e);
    }
  },

  setSeniorSimpleMode: async (enabled: boolean) => {
    try {
      set({ isSeniorSimpleMode: enabled });
      await StorageRecoveryService.safeSetItem(SENIOR_MODE_KEY, enabled ? 'true' : 'false').catch(() => {});
    } catch (e) {
      console.error('Error saving senior simple mode:', e);
    }
  },

  resetThemeToDefault: () => {
    const config = getThemeConfig('light', 'light');
    Object.assign(LUXURY_THEME.colors, config.colors);
    set({
      themeMode: 'light',
      isDark: false,
      colors: BILLION_DOLLAR_THEME.colors,
      mapStyle: 'vector',
      isSeniorSimpleMode: false,
      currentUserId: null,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useThemeStore = useThemeStore;
}

