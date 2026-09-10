import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND_GREEN_THEME, LIGHT_THEME, DARK_THEME, BILLION_DOLLAR_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

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

const getStorageKey = (userId?: string | null) => userId ? `@circleguard_theme_mode_${userId}` : '@circleguard_theme_mode_default';
const getMapStyleKey = (userId?: string | null) => userId ? `@circleguard_map_style_${userId}` : '@circleguard_map_style_default';

const getThemeConfig = (mode: ThemeMode, sysScheme: ColorSchemeName | null | undefined): { colors: ThemeColors; isDark: boolean } => {
  if (mode === 'billion_dollar') return { colors: BILLION_DOLLAR_THEME.colors, isDark: false };
  if (mode === 'brand_green') return { colors: BRAND_GREEN_THEME.colors, isDark: false };
  if (mode === 'light') return { colors: LIGHT_THEME.colors, isDark: false };
  if (mode === 'dark') return { colors: DARK_THEME.colors, isDark: true };
  const isSysDark = sysScheme === 'dark';
  return { colors: isSysDark ? DARK_THEME.colors : LIGHT_THEME.colors, isDark: isSysDark };
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'billion_dollar',
  isDark: false,
  colors: BILLION_DOLLAR_THEME.colors,
  mapStyle: 'vector',
  currentUserId: null,

  initTheme: async (userId?: string | null) => {
    try {
      const activeUser = userId ?? get().currentUserId;
      const themeKey = getStorageKey(activeUser);
      const mapKey = getMapStyleKey(activeUser);

      const saved = await AsyncStorage.getItem(themeKey);
      const savedMapStyle = await AsyncStorage.getItem(mapKey);
      let mode: ThemeMode = 'billion_dollar';
      const mapStyle: MapStyleType = (savedMapStyle as MapStyleType) || 'vector';
      const config = getThemeConfig('billion_dollar', 'light');

      Object.assign(LUXURY_THEME.colors, config.colors);

      set({
        themeMode: 'billion_dollar',
        isDark: false,
        colors: BILLION_DOLLAR_THEME.colors,
        mapStyle: mapStyle,
        currentUserId: activeUser || null,
      });

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
    } catch (e) {
      console.error('Error initializing theme:', e);
    }
  },

  setThemeMode: async (mode: ThemeMode, userId?: string) => {
    try {
      const activeUser = userId ?? get().currentUserId;
      const themeKey = getStorageKey(activeUser);
      await AsyncStorage.setItem(themeKey, mode);
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
      });
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
    const config = getThemeConfig('billion_dollar', 'light');
    Object.assign(LUXURY_THEME.colors, config.colors);
    set({
      themeMode: 'billion_dollar',
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
