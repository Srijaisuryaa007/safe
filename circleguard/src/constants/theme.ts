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

export const BRAND_GREEN_THEME = {
  colors: {
    background: '#FFFFFF', // Pure Clean White
    foreground: '#111111', // Deep Crisp Black
    surface: '#FFFFFF',
    surfaceMuted: '#F5F5F5', // Soft Container Grey
    textMuted: '#666666', // Subtle Charcoal Muted
    accentGold: '#3DBE6C', // Primary Brand Green
    accentGoldLight: '#E8F8EE', // Light Green Tint
    sosRed: '#E53E3E', // Crisp Red
    border: '#E0E0E0', // 1.5px Clean Border
    borderDark: '#111111',
    borderGold: '#F5A623', // Warm Amber Accent
  } as ThemeColors,
};

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
    background: '#0D0E12', // Obsidian Pure Dark
    foreground: '#FFFFFF', // Primary White Label
    surface: '#1C1D24', // Luxury Surface Background
    surfaceMuted: '#282A36', // Elevated Card Background
    textMuted: '#9CA3AF', // Cool Muted Slate
    accentGold: '#D4AF37', // Metallic Gold
    accentGoldLight: 'rgba(212, 175, 55, 0.15)',
    sosRed: '#EF4444', // Emergency Crimson
    border: 'rgba(255, 255, 255, 0.10)', // Subtle Hairline Divider
    borderDark: '#FFFFFF',
    borderGold: '#D4AF37',
  } as ThemeColors,
};

export const getThemeBorderStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      borderWidth: 1.5,
      borderRadius: 14,
      borderColor: '#E0E0E0',
    };
  }
  if (themeMode === 'light') {
    return {
      borderWidth: 1,
      borderRadius: 16,
      borderColor: 'rgba(26, 26, 26, 0.12)',
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  };
};

export const getThemeCardStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      borderWidth: 1.5,
      borderRadius: 16,
      borderColor: '#E0E0E0',
      backgroundColor: '#FFFFFF',
      shadowColor: '#3DBE6C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    };
  }
  if (themeMode === 'light') {
    return {
      borderWidth: 1,
      borderRadius: 16,
      borderColor: 'rgba(26, 26, 26, 0.10)',
      backgroundColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1C1D24',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  };
};

export const getThemeButtonStyles = (themeMode?: string, variant: 'primary' | 'secondary' | 'danger' = 'primary') => {
  if (themeMode === 'brand_green') {
    const bg = variant === 'danger' ? '#E53E3E' : variant === 'secondary' ? '#F5F5F5' : '#3DBE6C';
    const text = variant === 'secondary' ? '#111111' : '#FFFFFF';
    return {
      borderWidth: 0,
      borderRadius: 12,
      borderColor: 'transparent',
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#3DBE6C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: variant === 'primary' ? 0.2 : 0,
      shadowRadius: 8,
      elevation: 3,
    };
  }
  if (themeMode === 'light') {
    const bg = variant === 'danger' ? '#DC2626' : variant === 'secondary' ? '#EBE5DE' : '#1A1A1A';
    const text = variant === 'secondary' ? '#1A1A1A' : '#FFFFFF';
    return {
      borderWidth: 1,
      borderRadius: 14,
      borderColor: variant === 'secondary' ? 'rgba(26, 26, 26, 0.12)' : 'transparent',
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 14,
    borderColor: 'transparent',
    backgroundColor: variant === 'danger' ? '#EF4444' : variant === 'secondary' ? '#282A36' : '#D4AF37',
    textColor: variant === 'primary' ? '#0D0E12' : '#FFFFFF',
    shadowColor: variant === 'primary' ? '#D4AF37' : '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  };
};

export const getThemeBadgeStyles = (themeMode?: string, variant: 'live' | 'alert' | 'info' = 'live') => {
  if (themeMode === 'brand_green') {
    const bg = variant === 'alert' ? '#FEF2F2' : variant === 'info' ? '#FFFBEB' : '#E8F8EE';
    const border = variant === 'alert' ? '#E53E3E' : variant === 'info' ? '#F5A623' : '#3DBE6C';
    const text = variant === 'alert' ? '#E53E3E' : variant === 'info' ? '#D97706' : '#3DBE6C';
    return {
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 8,
      textColor: text,
    };
  }
  if (themeMode === 'light') {
    const bg = variant === 'alert' ? '#FEF2F2' : variant === 'info' ? '#FFFBEB' : '#F4F4F5';
    const border = variant === 'alert' ? '#DC2626' : variant === 'info' ? '#F59E0B' : '#1A1A1A';
    const text = variant === 'alert' ? '#DC2626' : variant === 'info' ? '#B45309' : '#1A1A1A';
    return {
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 10,
      textColor: text,
    };
  }
  return {
    backgroundColor: variant === 'alert' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: variant === 'alert' ? '#EF4444' : '#D4AF37',
    borderRadius: 12,
    textColor: variant === 'alert' ? '#EF4444' : '#D4AF37',
  };
};

export const getThemeSheetStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      backgroundColor: '#FFFFFF',
      borderTopWidth: 2,
      borderTopColor: '#3DBE6C',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: '#3DBE6C',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 14,
      elevation: 16,
    };
  }
  if (themeMode === 'light') {
    return {
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1.5,
      borderTopColor: '#E4E4E7',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 14,
    };
  }
  return {
    backgroundColor: '#1C1D24',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
  };
};

export const getThemeFloatingControlStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#E0E0E0',
      borderRadius: 14,
      shadowColor: '#3DBE6C',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    };
  }
  if (themeMode === 'light') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: 'rgba(26, 26, 26, 0.12)',
      borderRadius: 16,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
    };
  }
  return {
    backgroundColor: '#1C1D24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  };
};

export const getThemeChatBubbleStyles = (themeMode?: string, isSelf: boolean = false) => {
  if (themeMode === 'brand_green') {
    return {
      backgroundColor: isSelf ? '#3DBE6C' : '#F5F5F5',
      textColor: isSelf ? '#FFFFFF' : '#111111',
      borderWidth: 1,
      borderColor: isSelf ? '#3DBE6C' : '#E0E0E0',
      borderRadius: 16,
      borderBottomRightRadius: isSelf ? 2 : 16,
      borderBottomLeftRadius: isSelf ? 16 : 2,
    };
  }
  if (themeMode === 'light') {
    return {
      backgroundColor: isSelf ? '#18181B' : '#F4F4F5',
      textColor: isSelf ? '#FFFFFF' : '#18181B',
      borderWidth: 1,
      borderColor: isSelf ? '#18181B' : '#E4E4E7',
      borderRadius: 16,
      borderBottomRightRadius: isSelf ? 4 : 16,
      borderBottomLeftRadius: isSelf ? 16 : 4,
    };
  }
  return {
    backgroundColor: isSelf ? '#D4AF37' : '#282A36',
    textColor: isSelf ? '#0D0E12' : '#F9F8F6',
    borderWidth: 1,
    borderColor: isSelf ? '#D4AF37' : 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderBottomRightRadius: isSelf ? 4 : 16,
    borderBottomLeftRadius: isSelf ? 16 : 4,
  };
};

// Global Typography System & Responsive Hierarchy Scale Tokens
export const TYPOGRAPHY_SCALE = {
  fontSize: {
    micro: 9,
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 22,
    '3xl': 28,
    display: 34,
  },
  lineHeight: {
    micro: 12,
    xs: 14,
    sm: 17,
    md: 20,
    lg: 23,
    xl: 25,
    '2xl': 28,
    '3xl': 34,
    display: 40,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1.2,
    uppercaseTag: 1.8,
    display: 2.5,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
};

export const typographyStyles = {
  overline: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.xs,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.heavy,
    letterSpacing: TYPOGRAPHY_SCALE.letterSpacing.uppercaseTag,
    textTransform: 'uppercase' as const,
  },
  displayHeadline: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.display,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.heavy,
    letterSpacing: TYPOGRAPHY_SCALE.letterSpacing.tight,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight.display,
  },
  titleHeader: {
    fontSize: TYPOGRAPHY_SCALE.fontSize['2xl'],
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.bold,
    letterSpacing: TYPOGRAPHY_SCALE.letterSpacing.tight,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight['2xl'],
  },
  cardTitle: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.lg,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.semibold,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight.lg,
  },
  subtitle: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.sm,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.regular,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight.sm,
    opacity: 0.7,
  },
  body: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.md,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.regular,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight.md,
  },
  badgeText: {
    fontSize: TYPOGRAPHY_SCALE.fontSize.xs,
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.heavy,
    letterSpacing: TYPOGRAPHY_SCALE.letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  metricNumber: {
    fontSize: TYPOGRAPHY_SCALE.fontSize['3xl'],
    fontWeight: TYPOGRAPHY_SCALE.fontWeight.black,
    lineHeight: TYPOGRAPHY_SCALE.lineHeight['3xl'],
  },
};

// Global reactive theme instance
export const LUXURY_THEME = {
  colors: { ...DARK_THEME.colors },
  typography: {
    fontFamilySerif: 'serif',
    fontFamilySans: 'sans-serif',
    letterSpacingWide: 2.5,
    letterSpacingNormal: 0,
    scale: TYPOGRAPHY_SCALE,
    styles: typographyStyles,
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
