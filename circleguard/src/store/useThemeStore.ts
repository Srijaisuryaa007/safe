import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND_GREEN_THEME, LIGHT_THEME, DARK_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

export type ThemeMode = 'dark' | 'light' | 'brand_green' | 'system';
export type MapStyleType = 'vector' | 'satellite' | 'dark' | 'terrain';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  mapStyle: MapStyleType;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setMapStyle: (style: MapStyleType) => Promise<void>;
  initTheme: () => Promise<void>;
}

const STORAGE_KEY = '@circleguard_theme_mode';
const MAP_STYLE_KEY = '@circleguard_map_style';

const getThemeConfig = (mode: ThemeMode, sysScheme: ColorSchemeName | null | undefined): { colors: ThemeColors; isDark: boolean } => {
  if (mode === 'brand_green') return { colors: BRAND_GREEN_THEME.colors, isDark: false };
  if (mode === 'light') return { colors: LIGHT_THEME.colors, isDark: false };
  if (mode === 'dark') return { colors: DARK_THEME.colors, isDark: true };
  const isSysDark = sysScheme === 'dark';
  return { colors: isSysDark ? DARK_THEME.colors : LIGHT_THEME.colors, isDark: isSysDark };
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'dark',
  isDark: true,
  colors: DARK_THEME.colors,
  mapStyle: 'vector',

  initTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const savedMapStyle = await AsyncStorage.getItem(MAP_STYLE_KEY);
      let mode: ThemeMode = (saved as ThemeMode) || 'dark';
      if (mode !== 'dark' && mode !== 'light' && mode !== 'brand_green' && mode !== 'system') {
        mode = 'dark';
        await AsyncStorage.setItem(STORAGE_KEY, 'dark');
      }
      const mapStyle: MapStyleType = (savedMapStyle as MapStyleType) || 'vector';
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
        mapStyle: mapStyle,
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

  setThemeMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
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

  setMapStyle: async (style: MapStyleType) => {
    try {
      await AsyncStorage.setItem(MAP_STYLE_KEY, style);
      set({ mapStyle: style });
    } catch (e) {
      console.error('Error saving map style:', e);
    }
  },
}));
