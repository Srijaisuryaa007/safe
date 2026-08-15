import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_THEME, DARK_THEME, GRAY_THEME, MINIMALIST_MONOCHROME_THEME, ThemeColors, LUXURY_THEME } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'gray' | 'minimalist_monochrome' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initTheme: () => Promise<void>;
}

const STORAGE_KEY = '@circleguard_theme_mode';

const getThemeConfig = (mode: ThemeMode, sysScheme: ColorSchemeName | null | undefined): { colors: ThemeColors; isDark: boolean } => {
  if (mode === 'minimalist_monochrome') return { colors: MINIMALIST_MONOCHROME_THEME.colors, isDark: false };
  if (mode === 'dark') return { colors: DARK_THEME.colors, isDark: true };
  if (mode === 'gray') return { colors: GRAY_THEME.colors, isDark: true };
  if (mode === 'light') return { colors: LIGHT_THEME.colors, isDark: false };
  const isSysDark = sysScheme === 'dark';
  return { colors: isSysDark ? DARK_THEME.colors : LIGHT_THEME.colors, isDark: isSysDark };
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'gray',
  isDark: true,
  colors: GRAY_THEME.colors,

  initTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const mode: ThemeMode = (saved as ThemeMode) || 'gray';
      const sysScheme = Appearance.getColorScheme();
      const config = getThemeConfig(mode, sysScheme);

      Object.assign(LUXURY_THEME.colors, config.colors);

      set({
        themeMode: mode,
        isDark: config.isDark,
        colors: config.colors,
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
}));
