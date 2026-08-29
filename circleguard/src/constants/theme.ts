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
    background: '#0A0B0E', // Deep Obsidian Void
    foreground: '#FFFFFF', // Crisp Pure White
    surface: '#12141C', // Frosted Charcoal Obsidian Glass
    surfaceMuted: '#1A1D27', // Floating Glass Sheet / Muted Surface
    textMuted: '#94A3B8', // Slate 400 — High-Legibility Subtitle
    accentGold: '#F5D061', // Champagne Platinum Gold
    accentGoldLight: 'rgba(245, 208, 97, 0.15)',
    sosRed: '#FF3B30', // Apple HIG Emergency Red
    border: 'rgba(255, 255, 255, 0.08)', // Razor 1px Hairline
    borderDark: '#FFFFFF',
    borderGold: 'rgba(245, 208, 97, 0.35)',
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

export const PLAYFUL_GEOMETRIC_THEME = {
  colors: {
    background: '#FFFDF5', // Warm Cream / Off-White Paper feel
    foreground: '#1E293B', // Slate 800
    surface: '#FFFFFF', // Clean White Cards
    surfaceMuted: '#F1F5F9', // Slate 100
    textMuted: '#64748B', // Slate 500
    accentGold: '#8B5CF6', // Vivid Violet Primary Accent
    accentGoldLight: '#F472B6', // Hot Pink Secondary Pop
    sosRed: '#F472B6', // Hot Pink / Coral Red
    border: '#1E293B', // Slate 800 Chunky 2px Border
    borderDark: '#8B5CF6', // Vivid Violet Border
    borderGold: '#FBBF24', // Amber Yellow Border
  } as ThemeColors,
};

export const BOTANICAL_ORGANIC_THEME = {
  colors: {
    background: '#F9F8F4', // Warm Alabaster / Rice Paper
    foreground: '#2D3A31', // Deep Forest Green
    surface: '#FFFFFF', // Clean White Cards
    surfaceMuted: '#DCCFC2', // Soft Clay / Mushroom
    textMuted: '#8C9A84', // Sage Green Text
    accentGold: '#8C9A84', // Sage Green Primary Accent
    accentGoldLight: '#C27B66', // Terracotta Accent Pop
    sosRed: '#C27B66', // Terracotta Red
    border: '#E6E2DA', // Stone Low-Contrast Border
    borderDark: '#2D3A31', // Deep Forest Green Border
    borderGold: '#8C9A84', // Sage Accent Border
  } as ThemeColors,
};

export const getThemeBorderStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      borderWidth: 1.5,
      borderRadius: 12,
      borderColor: '#E0E0E0',
    };
  }
  if (themeMode === 'botanical_organic') {
    return {
      borderWidth: 1,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 20,
      borderColor: '#E6E2DA',
    };
  }
  if (themeMode === 'playful_geometric') {
    return {
      borderWidth: 2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
      borderBottomLeftRadius: 4,
      borderColor: '#1E293B',
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      borderWidth: 3,
      borderRadius: 0,
      borderColor: '#121212',
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 16,
  };
};

export const getThemeCardStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      borderWidth: 1.5,
      borderRadius: 16,
      borderColor: '#E0E0E0',
      backgroundColor: '#FFFFFF',
      shadowColor: '#111111',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    };
  }
  if (themeMode === 'botanical_organic') {
    return {
      borderWidth: 1,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 20, // Architectural Roman Arch radius
      borderColor: '#E6E2DA',
      backgroundColor: '#FFFFFF',
      shadowColor: '#2D3A31',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    };
  }
  if (themeMode === 'playful_geometric') {
    return {
      borderWidth: 2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
      borderBottomLeftRadius: 4, // Speech-bubble / sticker asymmetric cutout
      borderColor: '#1E293B',
      backgroundColor: '#FFFFFF',
      shadowColor: '#1E293B',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 6,
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      borderWidth: 3,
      borderRadius: 0,
      borderColor: '#121212',
      backgroundColor: '#FFFFFF',
      shadowColor: '#121212',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 6,
    };
  }
  return {
    borderWidth: 1,
    borderRadius: 18,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#12141C',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  };
};

export const getThemeButtonStyles = (themeMode?: string, variant: 'primary' | 'secondary' | 'danger' = 'primary') => {
  if (themeMode === 'brand_green') {
    const bg = variant === 'danger' ? '#E53E3E' : variant === 'secondary' ? '#F5F5F5' : '#3DBE6C';
    const text = variant === 'secondary' ? '#111111' : '#FFFFFF';
    return {
      borderWidth: 0,
      borderRadius: 10,
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
  if (themeMode === 'botanical_organic') {
    const bg = variant === 'danger' ? '#C27B66' : variant === 'secondary' ? '#DCCFC2' : '#2D3A31';
    const text = variant === 'secondary' ? '#2D3A31' : '#FFFFFF';
    return {
      borderWidth: 1,
      borderRadius: 100, // Organic pill shape
      borderColor: '#E6E2DA',
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#2D3A31',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    };
  }
  if (themeMode === 'playful_geometric') {
    const bg = variant === 'danger' ? '#F472B6' : variant === 'secondary' ? '#FBBF24' : '#8B5CF6';
    const text = variant === 'secondary' ? '#1E293B' : '#FFFFFF';
    return {
      borderWidth: 2,
      borderRadius: 100, // Pill candy button
      borderColor: '#1E293B',
      backgroundColor: bg,
      textColor: text,
      shadowColor: '#1E293B',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 5,
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
  if (themeMode === 'botanical_organic') {
    const bg = variant === 'alert' ? '#C27B66' : variant === 'info' ? '#DCCFC2' : '#8C9A84';
    return {
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: '#E6E2DA',
      borderRadius: 100,
      textColor: '#FFFFFF',
      shadowColor: '#2D3A31',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    };
  }
  if (themeMode === 'playful_geometric') {
    const bg = variant === 'alert' ? '#F472B6' : variant === 'info' ? '#FBBF24' : '#34D399';
    return {
      backgroundColor: bg,
      borderWidth: 2,
      borderColor: '#1E293B',
      borderRadius: 100,
      textColor: '#1E293B',
      shadowColor: '#1E293B',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
    };
  }
  if (themeMode === 'bauhaus') {
    const bg = variant === 'alert' ? '#D02020' : variant === 'info' ? '#1040C0' : '#F0C020';
    const text = variant === 'live' ? '#121212' : '#FFFFFF';
    return {
      backgroundColor: bg,
      borderWidth: 2,
      borderColor: '#121212',
      borderRadius: 0,
      textColor: text,
      shadowColor: '#121212',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
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
  if (themeMode === 'botanical_organic') {
    return {
      backgroundColor: '#F9F8F4',
      borderTopWidth: 2,
      borderTopColor: '#E6E2DA',
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      shadowColor: '#2D3A31',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 16,
    };
  }
  if (themeMode === 'playful_geometric') {
    return {
      backgroundColor: '#FFFDF5',
      borderTopWidth: 3,
      borderTopColor: '#1E293B',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      shadowColor: '#1E293B',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 18,
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      backgroundColor: '#FFFFFF',
      borderTopWidth: 4,
      borderTopColor: '#121212',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      shadowColor: '#121212',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 20,
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
    backgroundColor: '#12141C',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 208, 97, 0.35)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 16,
  };
};

export const getThemeFloatingControlStyles = (themeMode?: string) => {
  if (themeMode === 'brand_green') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#E0E0E0',
      borderRadius: 12,
      shadowColor: '#3DBE6C',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    };
  }
  if (themeMode === 'botanical_organic') {
    return {
      backgroundColor: '#F9F8F4',
      borderWidth: 1.5,
      borderColor: '#E6E2DA',
      borderRadius: 22,
      shadowColor: '#2D3A31',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5,
    };
  }
  if (themeMode === 'playful_geometric') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: '#1E293B',
      borderRadius: 14,
      shadowColor: '#1E293B',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 6,
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 3,
      borderColor: '#121212',
      borderRadius: 0,
      shadowColor: '#121212',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 7,
    };
  }
  if (themeMode === 'light') {
    return {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#E4E4E7',
      borderRadius: 22,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
    };
  }
  return {
    backgroundColor: 'rgba(18, 20, 28, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
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
  if (themeMode === 'botanical_organic') {
    return {
      backgroundColor: isSelf ? '#2D3A31' : '#EBE6DE',
      textColor: isSelf ? '#FFFFFF' : '#2D3A31',
      borderWidth: 1,
      borderColor: isSelf ? '#2D3A31' : '#E6E2DA',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomRightRadius: isSelf ? 4 : 20,
      borderBottomLeftRadius: isSelf ? 20 : 4,
    };
  }
  if (themeMode === 'playful_geometric') {
    return {
      backgroundColor: isSelf ? '#8B5CF6' : '#FFFDF5',
      textColor: isSelf ? '#FFFFFF' : '#1E293B',
      borderWidth: 2,
      borderColor: '#1E293B',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: isSelf ? 2 : 18,
      borderBottomLeftRadius: isSelf ? 18 : 2,
      shadowColor: '#1E293B',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 4,
    };
  }
  if (themeMode === 'bauhaus') {
    return {
      backgroundColor: isSelf ? '#1040C0' : '#FFFFFF',
      textColor: isSelf ? '#FFFFFF' : '#121212',
      borderWidth: 2.5,
      borderColor: '#121212',
      borderRadius: 0,
      shadowColor: '#121212',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1.0,
      shadowRadius: 0,
      elevation: 5,
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
    backgroundColor: isSelf ? '#D4AF37' : '#222530',
    textColor: isSelf ? '#0D0E12' : '#F9F8F6',
    borderWidth: 1,
    borderColor: isSelf ? '#D4AF37' : 'rgba(255,255,255,0.1)',
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

