import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME } from '../constants/theme';

interface EditorialInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const EditorialInput: React.FC<EditorialInputProps> = ({
  label,
  error,
  containerStyle,
  ...props
}) => {
  const { colors } = useThemeStore();
  const typography = LUXURY_THEME.typography;

  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={[{ marginBottom: 24 }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontFamily: typography.fontFamilySans,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 2,
            color: colors.textMuted,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            height: 48,
            borderBottomWidth: isFocused ? 4 : 2,
            borderBottomColor: colors.foreground,
            color: colors.foreground,
            fontSize: 16,
            paddingVertical: 8,
            paddingHorizontal: 0, // Underline input style
          },
          props.style,
        ]}
      />
      {error && (
        <Text
          style={{
            color: colors.sosRed,
            fontSize: 12,
            marginTop: 6,
            fontFamily: typography.fontFamilySans,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
};
