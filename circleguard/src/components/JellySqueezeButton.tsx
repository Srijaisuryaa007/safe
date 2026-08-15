import React, { useRef } from 'react';
import { Animated, TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface JellySqueezeButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  glowColor?: string;
}

export default function JellySqueezeButton({ children, onPress, style, glowColor = '#EF4444' }: JellySqueezeButtonProps) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleX, {
        toValue: 0.92,
        useNativeDriver: false,
        speed: 40,
        bounciness: 2,
      }),
      Animated.spring(scaleY, {
        toValue: 0.84,
        useNativeDriver: false,
        speed: 40,
        bounciness: 2,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleX, {
          toValue: 1.05,
          useNativeDriver: false,
          speed: 25,
          bounciness: 14,
        }),
        Animated.spring(scaleY, {
          toValue: 1.07,
          useNativeDriver: false,
          speed: 25,
          bounciness: 14,
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
        styles.defaultJellyBase,
        {
          shadowColor: glowColor,
        },
        style,
        {
          transform: [
            { scaleX: scaleX },
            { scaleY: scaleY },
          ],
        },
      ]}
    >
      {/* 3D Glossy Glass Reflection Highlight */}
      <View style={styles.glassHighlightStripe} />
      
      {/* Button Inner Content */}
      <View style={styles.contentWrap}>
        {children}
      </View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  defaultJellyBase: {
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  glassHighlightStripe: {
    position: 'absolute',
    top: 2,
    left: 20,
    right: 20,
    height: 14,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 1,
  },
  contentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
  },
});
