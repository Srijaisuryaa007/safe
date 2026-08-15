import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type LogoStatusMode = 'safe' | 'traveling' | 'sos';

interface AnimatedCircleGuardLogoProps {
  size?: number;
  statusMode?: LogoStatusMode;
  showText?: boolean;
}

export default function AnimatedCircleGuardLogo({
  size = 180,
  statusMode = 'safe',
  showText = true,
}: AnimatedCircleGuardLogoProps) {
  // Shared Values
  const shieldScale = useSharedValue(1);
  const shieldOpacity = useSharedValue(1);
  const centerPersonOpacity = useSharedValue(1);
  const sidePeopleOpacity = useSharedValue(1);
  const pinDropY = useSharedValue(0);
  const pinOpacity = useSharedValue(1);

  const ripple1R = useSharedValue(5);
  const ripple1Opacity = useSharedValue(0);
  const ripple2R = useSharedValue(5);
  const ripple2Opacity = useSharedValue(0);

  const glowPulse = useSharedValue(0.85);

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
    ripple1R.value = withRepeat(
      withTiming(45, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    ripple1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 300 }),
        withTiming(0, { duration: 2100 })
      ),
      -1,
      false
    );

    ripple2R.value = withRepeat(
      withTiming(45, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    ripple2Opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 300 }),
        withTiming(0, { duration: 2100 })
      ),
      -1,
      false
    );

    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.85, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [statusMode]);

  const shieldStyle = useAnimatedStyle(() => ({
    opacity: shieldOpacity.value,
    transform: [{ scale: shieldScale.value }],
  }));

  const sidePeopleStyle = useAnimatedStyle(() => ({
    opacity: sidePeopleOpacity.value,
  }));

  const centerPersonStyle = useAnimatedStyle(() => ({
    opacity: centerPersonOpacity.value,
  }));

  const pinStyle = useAnimatedStyle(() => ({
    opacity: pinOpacity.value,
    transform: [{ translateY: pinDropY.value }],
  }));

  return (
    <View style={styles.outerContainer}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Base Outer Glow and Ring Layer */}
        <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="bgHaloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.primary} stopOpacity="0.16" />
              <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="0.02" />
            </LinearGradient>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={themeColors.primary} stopOpacity="1" />
              <Stop offset="50%" stopColor={themeColors.secondary} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={themeColors.primary} stopOpacity="0.4" />
            </LinearGradient>
          </Defs>
          <Circle cx="100" cy="100" r="94" fill="url(#bgHaloGrad)" />
          <Circle cx="100" cy="100" r="90" stroke="url(#ringGrad)" strokeWidth="2.5" fill="none" />
        </Svg>

        {/* Animated Shield Layer */}
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, shieldStyle]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
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
        </Animated.View>

        {/* Animated Pin Drop Layer */}
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, pinStyle]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
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
        </Animated.View>
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
