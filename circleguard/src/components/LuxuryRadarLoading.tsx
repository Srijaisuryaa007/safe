import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface LuxuryRadarLoadingProps {
  message?: string;
  subMessage?: string;
  size?: number;
  fullscreen?: boolean;
}

const { width } = Dimensions.get('window');

export default function LuxuryRadarLoading({
  message = 'CALIBRATING LIVE GPS RADAR...',
  subMessage = 'Connecting to high-precision satellite telemetry',
  size = 140,
  fullscreen = false,
}: LuxuryRadarLoadingProps) {
  const { colors, isDark } = useThemeStore();

  // Animation Shared Values
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);
  const rotation = useSharedValue(0);
  const coreScale = useSharedValue(1);
  const textOpacity = useSharedValue(0.4);

  useEffect(() => {
    // Pulse 1
    pulse1.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
      -1,
      false
    );

    // Pulse 2 (Staggered by 800ms)
    setTimeout(() => {
      pulse2.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
        -1,
        false
      );
    }, 800);

    // Pulse 3 (Staggered by 1600ms)
    setTimeout(() => {
      pulse3.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
        -1,
        false
      );
    }, 1600);

    // Radar 360 Rotation
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );

    // Core Breathing
    coreScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.95, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Text Pulse
    textOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const ringStyle1 = useAnimatedStyle(() => ({
    opacity: interpolate(pulse1.value, [0, 0.3, 1], [0.8, 0.4, 0]),
    transform: [{ scale: interpolate(pulse1.value, [0, 1], [0.6, 2.2]) }],
  }));

  const ringStyle2 = useAnimatedStyle(() => ({
    opacity: interpolate(pulse2.value, [0, 0.3, 1], [0.8, 0.4, 0]),
    transform: [{ scale: interpolate(pulse2.value, [0, 1], [0.6, 2.2]) }],
  }));

  const ringStyle3 = useAnimatedStyle(() => ({
    opacity: interpolate(pulse3.value, [0, 0.3, 1], [0.8, 0.4, 0]),
    transform: [{ scale: interpolate(pulse3.value, [0, 1], [0.6, 2.2]) }],
  }));

  const radarSweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const coreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View style={[styles.container, fullscreen && styles.fullscreen, { backgroundColor: colors.background }]}>
      <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
        {/* Expanding Radar Wave 1 */}
        <Animated.View
          style={[
            styles.pulseRing,
            { width: size, height: size, borderColor: '#D4AF37' },
            ringStyle1,
          ]}
        />

        {/* Expanding Radar Wave 2 */}
        <Animated.View
          style={[
            styles.pulseRing,
            { width: size, height: size, borderColor: '#10B981' },
            ringStyle2,
          ]}
        />

        {/* Expanding Radar Wave 3 */}
        <Animated.View
          style={[
            styles.pulseRing,
            { width: size, height: size, borderColor: '#3B82F6' },
            ringStyle3,
          ]}
        />

        {/* 360-Degree Sweep Line */}
        <Animated.View style={[{ width: size * 1.5, height: size * 1.5, position: 'absolute' }, radarSweepStyle]}>
          <Svg width={size * 1.5} height={size * 1.5} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.6" />
                <Stop offset="50%" stopColor="#D4AF37" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d="M 100 100 L 195 100 A 95 95 0 0 0 167 33 Z" fill="url(#sweepGrad)" />
            <Circle cx="100" cy="100" r="95" stroke="rgba(212, 175, 55, 0.2)" strokeWidth="1.5" fill="none" strokeDasharray="4, 4" />
            <Circle cx="100" cy="100" r="60" stroke="rgba(212, 175, 55, 0.2)" strokeWidth="1" fill="none" />
          </Svg>
        </Animated.View>

        {/* Center Glowing Core Badge */}
        <Animated.View style={[styles.centerBadge, { width: size * 0.55, height: size * 0.55, backgroundColor: colors.surface, borderColor: '#D4AF37' }, coreAnimatedStyle]}>
          <View style={styles.innerGlow}>
            <Ionicons name="shield-checkmark" size={size * 0.26} color="#D4AF37" />
          </View>
        </Animated.View>
      </View>

      {/* Luxury Loading Typography & Status Readout */}
      <View style={styles.textWrap}>
        <Animated.Text style={[styles.title, { color: colors.foreground }, textAnimatedStyle]}>
          {message}
        </Animated.Text>
        {subMessage ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {subMessage}
          </Text>
        ) : null}

        {/* Status Indicators Pill */}
        <View style={styles.statusPill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>GPS TELEMETRY ACTIVE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  centerBadge: {
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  innerGlow: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  textWrap: {
    alignItems: 'center',
    marginTop: 18,
    maxWidth: width * 0.85,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.85,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 14,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1.2,
  },
});
