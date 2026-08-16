import React, { useRef } from 'react';
import { Animated, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface SpringTouchableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  glowColor?: string;
  activeOpacity?: number;
  disabled?: boolean;
}

export default function SpringTouchable({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.95,
  glowColor,
  activeOpacity = 0.9,
  disabled = false,
}: SpringTouchableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 35,
        bounciness: 4,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 10,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <AnimatedTouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={activeOpacity}
      disabled={disabled}
      style={[
        style,
        {
          transform: [{ scale }],
        },
      ]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
