import React, { useRef } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface JellySqueezeButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export default function JellySqueezeButton({ children, onPress, style }: JellySqueezeButtonProps) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    // Squishy Jelly compression: wide scaleX, compressed scaleY
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 0.94,
        useNativeDriver: true,
        speed: 35,
        bounciness: 2,
      }),
      Animated.spring(scaleY, {
        toValue: 0.86,
        useNativeDriver: true,
        speed: 35,
        bounciness: 2,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    // Realistic 3D Jelly bounce back inertia
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleX, {
          toValue: 1.04,
          useNativeDriver: true,
          speed: 25,
          bounciness: 12,
        }),
        Animated.spring(scaleY, {
          toValue: 1.06,
          useNativeDriver: true,
          speed: 25,
          bounciness: 12,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleX, {
          toValue: 1.0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 8,
        }),
        Animated.spring(scaleY, {
          toValue: 1.0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 8,
        }),
      ]),
    ]).start();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
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
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({});
