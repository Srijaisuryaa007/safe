import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME } from '../constants/theme';

interface EditorialButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
}

export const EditorialButton: React.FC<EditorialButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  loading = false,
}) => {
  const { colors } = useThemeStore();
  const typography = LUXURY_THEME.typography;

  const isPrimary = variant === 'primary';
  const isLink = variant === 'link';

  const baseStyle: ViewStyle = {
    height: isLink ? undefined : 48,
    borderRadius: 0, // Sharp corners
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isLink ? 0 : 32,
    borderWidth: isLink ? 0 : 1,
    borderColor: isPrimary ? colors.foreground : colors.foreground,
    backgroundColor: isLink ? 'transparent' : isPrimary ? colors.foreground : 'transparent',
  };

  const baseTextStyle: TextStyle = {
    fontFamily: typography.fontFamilySansMedium,
    fontSize: 12,
    letterSpacing: typography.letterSpacingWide || 3,
    textTransform: 'uppercase',
    color: isLink ? colors.foreground : isPrimary ? colors.background : colors.foreground,
    textDecorationLine: isLink ? 'underline' : 'none',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[baseStyle, style]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.background : colors.foreground} />
      ) : (
        <Text style={[baseTextStyle, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
