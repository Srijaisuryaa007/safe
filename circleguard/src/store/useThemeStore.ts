import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND_GREEN_THEME, LIGHT_THEME, DARK_THEME, BILLION_DOLLAR_THEME, INSPO_FLAGSHIP_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

export type ThemeMode = 'dark' | 'light' | 'brand_green' | 'billion_dollar' | 'system';
export type MapStyleType = 'vector' | 'satellite' | 'dark' | 'terrain';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  mapStyle: MapStyleType;
  currentUserId?: string | null;
  setThemeMode: (mode: ThemeMode, userId?: string) => Promise<void>;
  setMapStyle: (style: MapStyleType, userId?: string) => Promise<void>;
  initTheme: (userId?: string | null) => Promise<void>;
  resetThemeToDefault: () => void;
}

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

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'light',
  isDark: false,
  colors: BILLION_DOLLAR_THEME.colors,
  mapStyle: 'vector',
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
      let mode: ThemeMode = (saved as ThemeMode) || 'light';
      if (mode === 'billion_dollar' || (mode as any) === 'inspo_flagship') {
        mode = 'light';
      }

      const mapStyle: MapStyleType = (savedMapStyle as MapStyleType) || 'vector';
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      if (typeof Appearance.setColorScheme === 'function') {
        try {
          (Appearance.setColorScheme as any)(mode === 'system' ? null : (mode === 'dark' ? 'dark' : 'light'));
        } catch (_) {}
      }

      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
        mapStyle: mapStyle,
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

      // Update native appearance scheme
      if (typeof Appearance.setColorScheme === 'function') {
        try {
          (Appearance.setColorScheme as any)(mode === 'system' ? null : (mode === 'dark' ? 'dark' : 'light'));
        } catch (_) {}
      }

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

  resetThemeToDefault: () => {
    const config = getThemeConfig('light', 'light');
    Object.assign(LUXURY_THEME.colors, config.colors);
    set({
      themeMode: 'light',
      isDark: false,
      colors: BILLION_DOLLAR_THEME.colors,
      mapStyle: 'vector',
      currentUserId: null,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useThemeStore = useThemeStore;
}

