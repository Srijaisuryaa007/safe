import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';

interface OrbitalGoldenLogoBadgeProps {
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export default function OrbitalGoldenLogoBadge({
  size = 36,
  onPress,
  accessibilityLabel = 'CircleGuard Logo',
  testID = 'header-app-logo-btn',
}: OrbitalGoldenLogoBadgeProps) {
  const { isDark } = useThemeStore();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopAnim = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 7000, // Smooth, elegant continuous orbital rotation
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loopAnim.start();

    return () => {
      loopAnim.stop();
    };
  }, [spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const content = (
    <View
      style={[
        styles.rootContainer,
        { width: size, height: size },
      ]}
    >
      {/* 1. Base Circular Disc (Concentric & Bordered) */}
      <View
        style={[
          styles.baseDisc,
          { width: size, height: size, borderRadius: size / 2 },
          isDark ? styles.discDark : styles.discLight,
        ]}
      />

      {/* 2. Subtle Golden Ambient Glow */}
      <View
        style={[
          styles.ambientGlow,
          { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
          isDark ? styles.glowDark : styles.glowLight,
        ]}
      />

      {/* 3. Main Central Emblem (Stationary Shield + People + Pin Emblem) */}
      <View
        style={[
          styles.emblemContainer,
          { width: size * 0.72, height: size * 0.72 },
        ]}
      >
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="goldShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FDE68A" />
              <Stop offset="50%" stopColor="#D4AF37" />
              <Stop offset="100%" stopColor="#B48218" />
            </LinearGradient>
            <LinearGradient id="shieldDarkBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={isDark ? '#262626' : '#2A2926'} />
              <Stop offset="100%" stopColor={isDark ? '#121212' : '#141311'} />
            </LinearGradient>
          </Defs>

          {/* Shield Outer Silhouette */}
          <Path
            d="M 50 14 C 66 14 80 20 80 34 C 80 62 50 86 50 86 C 50 86 20 62 20 34 C 20 20 34 14 50 14 Z"
            fill="url(#shieldDarkBg)"
            stroke="url(#goldShieldGrad)"
            strokeWidth="3.2"
          />

          {/* Left Person Silhouette */}
          <Circle cx="38" cy="42" r="5" fill="#71717A" />
          <Path d="M 28 58 C 28 51 32 48 38 48 C 44 48 48 51 48 58 Z" fill="#52525B" />

          {/* Right Person Silhouette */}
          <Circle cx="62" cy="42" r="5" fill="#71717A" />
          <Path d="M 52 58 C 52 51 56 48 62 48 C 68 48 72 51 72 58 Z" fill="#52525B" />

          {/* Center Leader (Golden) */}
          <Circle cx="50" cy="38" r="6.5" fill="url(#goldShieldGrad)" />
          <Path d="M 38 60 C 38 51 43 47 50 47 C 57 47 62 51 62 60 Z" fill="url(#goldShieldGrad)" />

          {/* Location Pin Base */}
          <Path
            d="M 50 50 C 42 50 36 56 36 64 C 36 74 50 84 50 84 C 50 84 64 74 64 64 C 64 56 58 50 50 50 Z"
            fill="url(#goldShieldGrad)"
            stroke="#1C1917"
            strokeWidth="1.8"
          />
          <Circle cx="50" cy="64" r="5.5" fill="#1C1917" />
        </Svg>
      </View>

      {/* 4. Perfectly Centered 3D Orbiting Golden Ring with Continuous Spin */}
      <Animated.View
        style={[
          styles.orbitingRingContainer,
          {
            width: size,
            height: size,
            transform: [{ rotate: spinInterpolate }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="goldenOrbit3D" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FDE68A" stopOpacity="1" />
              <Stop offset="25%" stopColor="#D4AF37" stopOpacity="0.95" />
              <Stop offset="50%" stopColor="#B48218" stopOpacity="0.35" />
              <Stop offset="75%" stopColor="#D4AF37" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#FFFBEB" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* 3D Orbiting Golden Ring */}
          <Circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#goldenOrbit3D)"
            strokeWidth="2.8"
            fill="none"
          />

          {/* Orbiting Satellite Gleam Spheres */}
          <Circle cx="50" cy="6" r="3.2" fill="#FDE68A" />
          <Circle cx="50" cy="6" r="1.6" fill="#FFFFFF" />

          <Circle cx="94" cy="50" r="2.6" fill="#D4AF37" />

          <Circle cx="50" cy="94" r="3.2" fill="#FDE68A" />
          <Circle cx="50" cy="94" r="1.6" fill="#FFFFFF" />

          <Circle cx="6" cy="50" r="2.6" fill="#D4AF37" />
        </Svg>
      </Animated.View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={styles.touchableWrapper}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  touchableWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  baseDisc: {
    position: 'absolute',
    borderWidth: 1,
  },
  discLight: {
    backgroundColor: '#FAF8F5',
    borderColor: 'rgba(212, 175, 55, 0.35)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  discDark: {
    backgroundColor: '#161917',
    borderColor: 'rgba(212, 175, 55, 0.45)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  ambientGlow: {
    position: 'absolute',
  },
  glowLight: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  glowDark: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  emblemContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  orbitingRingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
});
