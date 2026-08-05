export interface ThemeColors {
  background: string;
  foreground: string;
  surface: string;
  surfaceMuted: string;
  textMuted: string;
  accentGold: string;
  accentGoldLight: string;
  sosRed: string;
  border: string;
  borderDark: string;
  borderGold: string;
}

export const LIGHT_THEME = {
  colors: {
    background: '#F9F8F6', // Warm Alabaster
    foreground: '#1A1A1A', // Rich Charcoal
    surface: '#FFFFFF',
    surfaceMuted: '#EBE5DE', // Pale Taupe
    textMuted: '#6C6863', // Warm Grey
    accentGold: '#D4AF37', // Metallic Gold
    accentGoldLight: '#FEF3C7',
    sosRed: '#DC2626', // Deep Luxury Crimson
    border: 'rgba(26, 26, 26, 0.12)',
    borderDark: '#1A1A1A',
    borderGold: '#D4AF37',
  } as ThemeColors,
};

export const DARK_THEME = {
  colors: {
    background: '#0D0E12', // Obsidian Onyx Black
    foreground: '#F9F8F6', // Light Alabaster Text
    surface: '#16181F', // Deep Charcoal Surface
    surfaceMuted: '#222530', // Muted Dark Surface
    textMuted: '#9CA3AF', // Cool Metallic Grey Text
    accentGold: '#D4AF37', // Metallic Gold
    accentGoldLight: '#3A2E07',
    sosRed: '#EF4444', // Crimson Red
    border: 'rgba(255, 255, 255, 0.12)',
    borderDark: '#FFFFFF',
    borderGold: '#D4AF37',
  } as ThemeColors,
};

export const GRAY_THEME = {
  colors: {
    background: '#1C1D22', // Luxury Charcoal Slate Gray
    foreground: '#F3F4F6', // Off-White Text
    surface: '#262830', // Elevated Slate Gray Surface
    surfaceMuted: '#333644', // Darker Slate Surface
    textMuted: '#9CA3AF', // Metallic Grey
    accentGold: '#D4AF37', // Gold Accent
    accentGoldLight: '#2D2712',
    sosRed: '#EF4444',
    border: 'rgba(255, 255, 255, 0.15)',
    borderDark: '#F3F4F6',
    borderGold: '#D4AF37',
  } as ThemeColors,
};

// Global reactive theme instance
export const LUXURY_THEME = {
  colors: { ...LIGHT_THEME.colors },
  typography: {
    fontFamilySerif: 'serif',
    fontFamilySans: 'sans-serif',
    letterSpacingWide: 2.5,
    letterSpacingNormal: 0,
  },
  radii: {
    sharp: 0,
  },
  shadows: {
    subtle: {
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    goldLift: {
      shadowColor: '#D4AF37',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    sosLift: {
      shadowColor: '#DC2626',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 8,
    },
  },
};
