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

export const MINIMALIST_MONOCHROME_THEME = {
  colors: {
    background: '#FFFFFF', // Pure White
    foreground: '#000000', // Pure Black
    surface: '#FFFFFF', // Pure White surface with 1px black border
    surfaceMuted: '#F5F5F5', // Off-White for subtle backgrounds
    textMuted: '#525252', // Dark Gray for secondary text
    accentGold: '#000000', // Pure Black IS the accent
    accentGoldLight: '#F5F5F5',
    sosRed: '#000000', // Pure Black inverted emphasis
    border: '#000000', // Hairline/Solid 1px Pure Black border
    borderDark: '#000000',
    borderGold: '#000000',
  } as ThemeColors,
};

export const BAUHAUS_THEME = {
  colors: {
    background: '#F0F0F0', // Off-White Canvas
    foreground: '#121212', // Stark Bauhaus Black
    surface: '#FFFFFF', // Clean White Cards with 4px black borders
    surfaceMuted: '#E0E0E0', // Muted Gray
    textMuted: '#525252', // Dark Gray for secondary text
    accentGold: '#F0C020', // Bauhaus Primary Yellow
    accentGoldLight: '#FFF9C4', // Soft Yellow Accent
    sosRed: '#D02020', // Primary Bauhaus Red
    border: '#121212', // Thick 4px Stark Black Border
    borderDark: '#121212',
    borderGold: '#1040C0', // Primary Bauhaus Blue
  } as ThemeColors,
};

export const MAXIMALISM_DOPAMINE_THEME = {
  colors: {
    background: '#0D0D1A', // Deep Cosmic Purple-Black Void
    foreground: '#FFFFFF', // Pure White Maximum Contrast
    surface: '#2D1B4E', // Dark Purple Container
    surfaceMuted: '#1A0E33', // Deep Void Accent Surface
    textMuted: '#00F5D4', // Electric Cyan Text
    accentGold: '#FFE600', // Screaming Yellow
    accentGoldLight: '#FF3AF2', // Hot Pink / Magenta
    sosRed: '#FF6B35', // Electric Orange / Crimson Chaos
    border: '#FF3AF2', // Hot Magenta 4px Border
    borderDark: '#7B2FFF', // Vivid Purple
    borderGold: '#00F5D4', // Electric Cyan Border
  } as ThemeColors,
};

export const getThemeBorderStyles = (themeMode?: string) => {
  if (themeMode === 'maximalism_dopamine') {
    return {
      borderWidth: 4,
      borderRadius: 24,
      borderColor: '#FF3AF2',
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      borderWidth: 3,
      borderRadius: 0,
      borderColor: '#121212',
    };
  }
  if (themeMode === 'minimalist_monochrome') {
    return {
      borderWidth: 1,
      borderRadius: 0,
      borderColor: '#000000',
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 16,
  };
};

export const getThemeCardStyles = (themeMode?: string) => {
  if (themeMode === 'maximalism_dopamine') {
    return {
      borderWidth: 4,
      borderRadius: 24,
      borderColor: '#FF3AF2',
      shadowColor: '#00F5D4',
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.9,
      shadowRadius: 12,
      elevation: 8,
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      borderWidth: 3,
      borderRadius: 0,
      borderColor: '#121212',
      shadowColor: '#121212',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 6,
    };
  }
  if (themeMode === 'minimalist_monochrome') {
    return {
      borderWidth: 1,
      borderRadius: 0,
      borderColor: '#000000',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  };
};

export const getThemeButtonStyles = (themeMode?: string, variant: 'primary' | 'secondary' | 'danger' = 'primary') => {
  if (themeMode === 'maximalism_dopamine') {
    const bg = variant === 'danger' ? '#FF6B35' : variant === 'secondary' ? '#00F5D4' : '#FF3AF2';
    const text = variant === 'secondary' ? '#0D0D1A' : '#FFFFFF';
    return {
      borderWidth: 4,
      borderRadius: 100,
      borderColor: '#FFE600', // Clashing Screaming Yellow Border
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#7B2FFF',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.9,
      shadowRadius: 10,
      elevation: 6,
    };
  }
  if (themeMode === 'bauhaus') {
    const bg = variant === 'danger' ? '#D02020' : variant === 'secondary' ? '#1040C0' : '#F0C020';
    const text = variant === 'primary' ? '#121212' : '#FFFFFF';
    return {
      borderWidth: 3,
      borderRadius: 0,
      borderColor: '#121212',
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#121212',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 5,
    };
  }
  if (themeMode === 'minimalist_monochrome') {
    return {
      borderWidth: 1,
      borderRadius: 0,
      borderColor: '#000000',
      backgroundColor: '#000000',
      textColor: '#FFFFFF',
      shadowOpacity: 0,
      elevation: 0,
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 24,
    borderColor: 'transparent',
    backgroundColor: variant === 'danger' ? '#EF4444' : '#D4AF37',
    textColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  };
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
