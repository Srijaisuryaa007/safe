import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME } from '../constants/theme';

interface EditorialHeadlineProps extends TextProps {
  level?: 1 | 2 | 3 | 4;
}

export const EditorialHeadline: React.FC<EditorialHeadlineProps> = ({
  level = 1,
  style,
  children,
  ...props
}) => {
  const { colors } = useThemeStore();
  const typography = LUXURY_THEME.typography;

  const getFontSize = () => {
    switch (level) {
      case 1: return 48; // Massive hero
      case 2: return 36; // Section
      case 3: return 24; // Subsection
      case 4: return 18; // Small title
      default: return 48;
    }
  };

  const getLineHeight = () => {
    switch (level) {
      case 1: return 52;
      case 2: return 40;
      case 3: return 28;
      case 4: return 24;
      default: return 52;
    }
  };

  return (
    <Text
      style={[
        {
          fontFamily: typography.fontFamilySerif,
          fontSize: getFontSize(),
          lineHeight: getLineHeight(),
          color: colors.foreground,
          letterSpacing: 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
