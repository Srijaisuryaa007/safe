import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Path,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Rect,
} from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';

interface CircleGuardGlobeLoaderProps {
  size?: number;
  loadingLabel?: string;
  subLabel?: string;
  fullscreen?: boolean;
}

// Authentic Vector World Continent Paths (Repeated seamlessly for 360° spherical rotation)
// Canonical coordinates scaled to 400x200 world canvas projection
const WORLD_CONTINENTS_SVG = `
  M 30,25 C 45,20 70,22 85,35 C 95,45 105,70 90,85 C 80,95 65,90 55,80 C 45,75 35,65 25,45 Z
  M 58,85 C 65,92 78,110 82,130 C 85,150 75,175 68,185 C 62,180 58,160 55,135 C 52,115 54,95 58,85 Z
  M 180,30 C 195,25 210,28 215,40 C 205,50 190,52 180,48 Z
  M 175,55 C 190,50 215,55 225,75 C 230,95 235,130 220,155 C 205,170 190,165 180,140 C 170,115 168,85 175,55 Z
  M 215,30 C 245,25 290,28 320,45 C 330,65 315,85 290,90 C 275,80 250,75 230,65 Z
  M 255,75 C 265,85 272,105 268,118 C 260,115 252,95 255,75 Z
  M 290,120 C 315,115 335,130 330,155 C 315,165 285,155 290,120 Z
  M 315,55 C 322,60 325,75 320,82 C 315,75 314,62 315,55 Z
`;

export default function CircleGuardGlobeLoader({
  size = 180,
  loadingLabel = 'Securing your Circle…',
  subLabel,
  fullscreen = false,
}: CircleGuardGlobeLoaderProps) {
  const { colors, isDark } = useThemeStore();

  const rotationAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);
  const beaconPulse = useSharedValue(1);

  useEffect(() => {
    // 360° Infinite Continuous Rotation
    rotationAnim.value = withRepeat(
      withTiming(-200, { duration: 7500, easing: Easing.linear }),
      -1,
      false
    );

    // Outer Radar Ring Pulse
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
      -1,
      false
    );

    // City Beacons Heartbeat
    beaconPulse.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const globeRotationStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rotationAnim.value }],
  }));

  const radarRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 0.35, 1], [0.85, 0.35, 0]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.92, 1.45]) }],
  }));

  const r = size / 2;

  const content = (
    <View style={styles.contentContainer}>
      {/* Globe Container */}
      <View style={[styles.globeWrapper, { width: size + 24, height: size + 24 }]}>
        {/* Pulsing Outer Golden Radar Ring */}
        <Animated.View
          style={[
            styles.radarRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            radarRingStyle,
          ]}
        />

        {/* 3D Realistic Earth Orb */}
        <View style={[styles.sphereCard, { width: size, height: size, borderRadius: r }]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              {/* Deep Ocean Base Radial Gradient */}
              <RadialGradient id="oceanGrad" cx="35%" cy="30%" r="70%">
                <Stop offset="0%" stopColor="#131B24" stopOpacity="1" />
                <Stop offset="65%" stopColor="#080C10" stopOpacity="1" />
                <Stop offset="100%" stopColor="#030507" stopOpacity="1" />
              </RadialGradient>

              {/* Gold Landmass Fill Gradient */}
              <LinearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#1E2B22" stopOpacity="0.98" />
                <Stop offset="100%" stopColor="#121C16" stopOpacity="0.99" />
              </LinearGradient>

              {/* Spherical 3D Lighting & Specular Highlight */}
              <RadialGradient id="specular3D" cx="30%" cy="25%" r="75%">
                <Stop offset="0%" stopColor="#F3E5AB" stopOpacity="0.22" />
                <Stop offset="45%" stopColor="#D4AF37" stopOpacity="0.05" />
                <Stop offset="75%" stopColor="#000000" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
              </RadialGradient>

              {/* Sphere Clipping Mask */}
              <ClipPath id="sphereClip">
                <Circle cx={r} cy={r} r={r - 1} />
              </ClipPath>
            </Defs>

            {/* 1. Deep Spherical Ocean Base */}
            <Circle cx={r} cy={r} r={r - 1} fill="url(#oceanGrad)" />

            {/* 2. Rotating Continents & Country Dots Group (Clipped to Sphere) */}
            <G clipPath="url(#sphereClip)">
              {/* Graticule Latitude Parallels */}
              <G opacity={0.2} stroke="#A16207" strokeWidth={0.75}>
                <Path d={`M 0,${r * 0.4} Q ${r},${r * 0.3} ${size},${r * 0.4}`} fill="none" />
                <Path d={`M 0,${r * 0.7} Q ${r},${r * 0.65} ${size},${r * 0.7}`} fill="none" />
                <Path d={`M 0,${r} Q ${r},${r} ${size},${r}`} fill="none" />
                <Path d={`M 0,${r * 1.3} Q ${r},${r * 1.35} ${size},${r * 1.3}`} fill="none" />
                <Path d={`M 0,${r * 1.6} Q ${r},${r * 1.7} ${size},${r * 1.6}`} fill="none" />
              </G>

              {/* Rotating Landmass Layer (Seamless 2x Duplication) */}
              <Animated.View style={[{ width: size * 2.5, height: size }, globeRotationStyle]}>
                <Svg width={size * 2.5} height={size} viewBox="0 0 600 200">
                  {/* First World Tile */}
                  <G transform="scale(1, 1)">
                    <Path
                      d={WORLD_CONTINENTS_SVG}
                      fill="url(#landGrad)"
                      stroke="#D4AF37"
                      strokeWidth={1.2}
                      opacity={0.92}
                    />
                    {/* Geographic Country Nodes (India, Europe, Americas, Asia, Australia) */}
                    <Circle cx={60} cy={55} r={2.8} fill="#F59E0B" />
                    <Circle cx={70} cy={135} r={2.8} fill="#F59E0B" />
                    <Circle cx={195} cy={42} r={2.8} fill="#F59E0B" />
                    <Circle cx={205} cy={105} r={2.8} fill="#F59E0B" />
                    <Circle cx={262} cy={95} r={3.2} fill="#FBBF24" />{/* India */}
                    <Circle cx={285} cy={60} r={2.8} fill="#F59E0B" />
                    <Circle cx={318} cy={68} r={2.8} fill="#F59E0B" />{/* Japan */}
                    <Circle cx={310} cy={140} r={2.8} fill="#F59E0B" />{/* Australia */}
                  </G>

                  {/* Second World Tile for Seamless Infinite Loop */}
                  <G transform="translate(300, 0)">
                    <Path
                      d={WORLD_CONTINENTS_SVG}
                      fill="url(#landGrad)"
                      stroke="#D4AF37"
                      strokeWidth={1.2}
                      opacity={0.92}
                    />
                    <Circle cx={60} cy={55} r={2.8} fill="#F59E0B" />
                    <Circle cx={70} cy={135} r={2.8} fill="#F59E0B" />
                    <Circle cx={195} cy={42} r={2.8} fill="#F59E0B" />
                    <Circle cx={205} cy={105} r={2.8} fill="#F59E0B" />
                    <Circle cx={262} cy={95} r={3.2} fill="#FBBF24" />
                    <Circle cx={285} cy={60} r={2.8} fill="#F59E0B" />
                    <Circle cx={318} cy={68} r={2.8} fill="#F59E0B" />
                    <Circle cx={310} cy={140} r={2.8} fill="#F59E0B" />
                  </G>
                </Svg>
              </Animated.View>
            </G>

            {/* 3. 3D Spherical Specular Light & Shadow Overlay */}
            <Circle cx={r} cy={r} r={r - 1} fill="url(#specular3D)" />

            {/* 4. Golden Outer Horizon Ring */}
            <Circle cx={r} cy={r} r={r - 1.2} stroke="#D4AF37" strokeWidth={1.6} fill="none" opacity={0.85} />
          </Svg>
        </View>
      </View>

      {/* Brand & Loading Labels */}
      <View style={styles.textStack}>
        <Text style={styles.brandTitle}>CIRCLE GUARD</Text>
        <Text style={[styles.loadingLabel, { color: colors.textMuted || '#94A3B8' }]}>
          {loadingLabel}
        </Text>
        {subLabel ? (
          <Text style={[styles.subLabel, { color: colors.textMuted || '#64748B' }]}>
            {subLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (fullscreen) {
    return (
      <View style={[styles.fullscreenContainer, { backgroundColor: isDark ? '#0B0D10' : '#111317' }]}>
        {content}
      </View>
    );
  }

  return <View style={styles.inlineContainer}>{content}</View>;
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  globeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
  },
  sphereCard: {
    overflow: 'hidden',
    backgroundColor: '#0B0D10',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  textStack: {
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  loadingLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 2,
  },
});
