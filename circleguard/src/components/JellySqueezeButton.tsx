import React, { useRef } from 'react';
import { Animated, TouchableOpacity, ViewStyle } from 'react-native';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface JellySqueezeButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export default function JellySqueezeButton({ children, onPress, style }: JellySqueezeButtonProps) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 0.94,
        useNativeDriver: false,
        speed: 35,
        bounciness: 2,
      }),
      Animated.spring(scaleY, {
        toValue: 0.86,
        useNativeDriver: false,
        speed: 35,
        bounciness: 2,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleX, {
          toValue: 1.04,
          useNativeDriver: false,
          speed: 25,
          bounciness: 12,
        }),
        Animated.spring(scaleY, {
          toValue: 1.06,
          useNativeDriver: false,
          speed: 25,
          bounciness: 12,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleX, {
          toValue: 1.0,
          useNativeDriver: false,
          speed: 20,
          bounciness: 8,
        }),
        Animated.spring(scaleY, {
          toValue: 1.0,
          useNativeDriver: false,
          speed: 20,
          bounciness: 8,
        }),
      ]),
    ]).start();
  };

  return (
    <AnimatedTouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        style,
        {
          transform: [
            { scaleX: scaleX },
            { scaleY: scaleY },
          ],
        },
      ]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
