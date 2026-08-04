import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_THEME, DARK_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initTheme: () => Promise<void>;
}

const STORAGE_KEY = '@circleguard_theme_mode';

const getIsDark = (mode: ThemeMode, sysScheme: ColorSchemeName | null | undefined): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return sysScheme === 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'light',
  isDark: false,
  colors: LIGHT_THEME.colors,

  initTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const mode: ThemeMode = (saved as ThemeMode) || 'system';
      const sysScheme = Appearance.getColorScheme();
      const dark = getIsDark(mode, sysScheme);
      const activeColors = dark ? DARK_THEME.colors : LIGHT_THEME.colors;

      Object.assign(LUXURY_THEME.colors, activeColors);

      set({
        themeMode: mode,
        isDark: dark,
        colors: activeColors,
      });

      // Listen for system OS dark/light mode changes when system mode is selected
      Appearance.addChangeListener(({ colorScheme }) => {
        const currentMode = get().themeMode;
        if (currentMode === 'system') {
          const isSysDark = colorScheme === 'dark';
          const newColors = isSysDark ? DARK_THEME.colors : LIGHT_THEME.colors;
          Object.assign(LUXURY_THEME.colors, newColors);
          set({
            isDark: isSysDark,
            colors: newColors,
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
      const dark = getIsDark(mode, sysScheme);
      const activeColors = dark ? DARK_THEME.colors : LIGHT_THEME.colors;

      Object.assign(LUXURY_THEME.colors, activeColors);

      set({
        themeMode: mode,
        isDark: dark,
        colors: activeColors,
      });
    } catch (e) {
      console.error('Error setting theme mode:', e);
    }
  },
}));
