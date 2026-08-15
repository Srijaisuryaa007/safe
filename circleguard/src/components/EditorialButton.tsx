import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { getThemeButtonStyles } from '../constants/theme';

interface EditorialButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
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
  const { themeMode, colors } = useThemeStore();
  const isLink = variant === 'link';

  const themeBtn = getThemeButtonStyles(themeMode, isLink ? 'secondary' : variant);

  const baseStyle: ViewStyle = {
    height: isLink ? undefined : 48,
    borderRadius: isLink ? 0 : themeBtn.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isLink ? 0 : 28,
    borderWidth: isLink ? 0 : themeBtn.borderWidth,
    borderColor: themeBtn.borderColor,
    backgroundColor: isLink ? 'transparent' : themeBtn.backgroundColor,
    shadowColor: themeBtn.shadowColor,
    shadowOffset: themeBtn.shadowOffset,
    shadowOpacity: themeBtn.shadowOpacity,
    shadowRadius: themeBtn.shadowRadius,
    elevation: themeBtn.elevation,
  };

  const baseTextStyle: TextStyle = {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: isLink ? colors.foreground : themeBtn.textColor,
    textDecorationLine: isLink ? 'underline' : 'none',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[baseStyle, style]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={isLink ? colors.foreground : themeBtn.textColor} />
      ) : (
        <Text style={[baseTextStyle, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
