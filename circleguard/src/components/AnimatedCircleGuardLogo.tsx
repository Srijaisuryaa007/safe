import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export type LogoStatusMode = 'safe' | 'traveling' | 'sos';

interface AnimatedCircleGuardLogoProps {
  size?: number;
  statusMode?: LogoStatusMode;
  showText?: boolean;
  isLoading?: boolean;
  isRevolving?: boolean;
}

export default function AnimatedCircleGuardLogo({
  size = 180,
  statusMode = 'safe',
  showText = true,
  isLoading = false,
  isRevolving = true,
}: AnimatedCircleGuardLogoProps) {
  // Use standard core React Native Animated API for rock-solid stability
  const spinValue = useRef(new Animated.Value(0)).current;
  const shieldScale = useRef(new Animated.Value(1)).current;
  const pinDropY = useRef(new Animated.Value(0)).current;

  const getThemeColors = () => {
    switch (statusMode) {
      case 'sos':
        return { primary: '#EF4444', secondary: '#F87171', dark: '#450A0A' };
      case 'traveling':
        return { primary: '#F59E0B', secondary: '#FBBF24', dark: '#451A03' };
      default:
        return { primary: '#D4AF37', secondary: '#F3E5AB', dark: '#1C1917' };
    }
  };

  const themeColors = getThemeColors();

  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (isRevolving) {
      spinValue.setValue(0);
      loopAnim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: isLoading ? 750 : 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnim.start();
    } else {
      spinValue.setValue(0);
    }

    return () => {
      if (loopAnim) {
        loopAnim.stop();
      }
    };
  }, [isLoading, isRevolving]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.outerContainer}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Base Static Halo Background */}
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bgHaloGradStatic" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.primary} stopOpacity="0.14" />
              <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>
          <Circle cx="100" cy="100" r="95" fill="url(#bgHaloGradStatic)" />
        </Svg>

        {/* 3D Revolving Ring Layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="ringGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={themeColors.primary} stopOpacity="1" />
                <Stop offset="30%" stopColor={themeColors.secondary} stopOpacity="1" />
                <Stop offset="70%" stopColor={themeColors.primary} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={themeColors.secondary} stopOpacity="0.9" />
              </LinearGradient>
            </Defs>
            <Circle cx="100" cy="100" r="90" stroke="url(#ringGrad3D)" strokeWidth="3.5" fill="none" />
            <Circle cx="100" cy="10" r="5" fill={themeColors.primary} />
            <Circle cx="100" cy="10" r="2.5" fill="#FFFFFF" />
            <Circle cx="190" cy="100" r="4.5" fill={themeColors.secondary} />
            <Circle cx="100" cy="190" r="5" fill={themeColors.primary} />
            <Circle cx="100" cy="190" r="2.5" fill="#FFFFFF" />
            <Circle cx="10" cy="100" r="4.5" fill={themeColors.secondary} />
          </Svg>
        </Animated.View>

        {/* Shield Layer & Family Silhouettes */}
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.secondary} stopOpacity="1" />
              <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="shieldBgGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#262626" stopOpacity="0.98" />
              <Stop offset="100%" stopColor="#0A0A0A" stopOpacity="0.99" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 100 38 C 128 38 152 48 152 68 C 152 112 100 152 100 152 C 100 152 48 112 48 68 C 48 48 72 38 100 38 Z"
            fill="url(#shieldBgGrad2)"
            stroke="url(#goldGrad2)"
            strokeWidth="3.5"
          />
          <Circle cx="82" cy="82" r="8.5" fill="#52525B" />
          <Path d="M 68 108 C 68 97 74 92 82 92 C 90 92 96 97 96 108 Z" fill="#3F3F46" />
          <Circle cx="118" cy="82" r="8.5" fill="#52525B" />
          <Path d="M 104 108 C 104 97 110 92 118 92 C 126 92 132 97 132 108 Z" fill="#3F3F46" />
          <Circle cx="100" cy="76" r="11" fill="url(#goldGrad2)" />
          <Path d="M 83 112 C 83 97 90 90 100 90 C 110 90 117 97 117 112 Z" fill="url(#goldGrad2)" />
        </Svg>

        {/* Pin Drop Layer */}
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="goldGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.secondary} stopOpacity="1" />
              <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 100 94 C 87 94 77 104 77 117 C 77 133 100 154 100 154 C 100 154 123 133 123 117 C 123 104 113 94 100 94 Z"
            fill="url(#goldGrad3)"
            stroke="#1C1917"
            strokeWidth="2.5"
          />
          <Circle cx="100" cy="115" r="9" fill="#1C1917" />
        </Svg>
      </View>

      {/* Brand Typography */}
      {showText ? (
        <View style={styles.textContainer}>
          <Text style={styles.brandTitle}>
            CIRCLE<Text style={{ color: themeColors.primary }}>GUARD</Text>
          </Text>
          <Text style={styles.tagline}>YOUR CIRCLE. YOUR SAFETY. ALWAYS.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 1.8,
    marginTop: 3,
  },
});
