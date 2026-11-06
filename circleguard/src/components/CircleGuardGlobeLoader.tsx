import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';
import {
  REAL_WORLD_LAND_PATH,
  REAL_WORLD_COUNTRIES_PATH,
  REAL_WORLD_HUBS,
  WORLD_TILE_WIDTH,
} from './globe/realWorldVector';

export interface CircleGuardGlobeLoaderProps {
  size?: number;
  loadingLabel?: string;
  subLabel?: string;
  fullscreen?: boolean;
  hideLabels?: boolean;
  showBrandHeader?: boolean;
}

const TELEMETRY_FEED = [
  'ENCRYPTION ACTIVE',
  'SATELLITE SYNC',
  'GRID SECURE',
  'LIVE RADAR',
];

export default function CircleGuardGlobeLoader({
  size = 180,
  loadingLabel = 'SECURING CIRCLE...',
  subLabel,
  fullscreen = false,
  hideLabels = false,
  showBrandHeader = false,
}: CircleGuardGlobeLoaderProps) {
  const { colors, isDark } = useThemeStore();
  const [telemetryIdx, setTelemetryIdx] = useState(0);

  // Theme-adaptive luxury color tokens
  const brandGold = isDark ? '#F59E0B' : '#B45309';
  const shockwaveColor = isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(180, 83, 9, 0.35)';
  const atmosphereBorder = isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(180, 83, 9, 0.18)';
  const sphereBorder = isDark ? 'rgba(245, 158, 11, 0.5)' : 'rgba(15, 23, 42, 0.22)';
  const goldenRimColor = isDark ? '#F59E0B' : '#D97706';
  const labelColor = isDark ? '#FFFFFF' : '#0F172A';
  const badgeBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';
  const badgeBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)';
  const badgeTextColor = isDark ? '#CBD5E1' : '#475569';

  const isCompact = hideLabels || size < 60;
  const r = size / 2;
  const containerSize = isCompact ? size + 8 : size + 40;
  const scale = size / 360;
  const tilePixelWidth = WORLD_TILE_WIDTH * scale;

  // Reanimated Shared Values for instant native 60fps animations
  const entranceOpacity = useSharedValue(0.3);
  const globeTranslateX = useSharedValue(0);
  const orbitalRing1Rotation = useSharedValue(0);
  const orbitalRing2Rotation = useSharedValue(0);
  const shockwavePulse = useSharedValue(0);
  const beaconGlow = useSharedValue(1);
  const shieldAuraPulse = useSharedValue(0.85);
  const labelPulse = useSharedValue(1);

  useEffect(() => {
    // 0. Smooth entrance fade-in
    entranceOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });

    // Subtle breathing pulse for loading label
    labelPulse.value = withRepeat(
      withSequence(
        withTiming(0.82, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 1. Seamless 360° Earth Rotation on UI thread (instant 0ms start)
    globeTranslateX.value = withRepeat(
      withTiming(-tilePixelWidth, { duration: 10000, easing: Easing.linear }),
      -1,
      false
    );

    // 2. Gyroscopic Orbital Shield Rings (Opposing 3D spins)
    orbitalRing1Rotation.value = withRepeat(
      withTiming(360, { duration: 6500, easing: Easing.linear }),
      -1,
      false
    );
    orbitalRing2Rotation.value = withRepeat(
      withTiming(-360, { duration: 9500, easing: Easing.linear }),
      -1,
      false
    );

    // 3. Expanding Defense Shockwave Pulse
    shockwavePulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
      -1,
      false
    );

    // 4. Node Beacons Heartbeat
    beaconGlow.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 5. Shield Atmosphere Aura Breathing
    shieldAuraPulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.88, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Dynamic Telemetry Status Ticker
    const ticker = setInterval(() => {
      setTelemetryIdx((prev) => (prev + 1) % TELEMETRY_FEED.length);
    }, 2800);

    return () => clearInterval(ticker);
  }, [tilePixelWidth]);

  // Animated Styles
  const entranceAnimStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
  }));

  const globeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: globeTranslateX.value }],
  }));

  const orbit1Style = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: '28deg' },
      { rotateX: '65deg' },
      { rotateZ: `${orbitalRing1Rotation.value}deg` },
    ],
  }));

  const orbit2Style = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: '-32deg' },
      { rotateX: '68deg' },
      { rotateZ: `${orbitalRing2Rotation.value}deg` },
    ],
  }));

  const shockwaveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shockwavePulse.value, [0, 0.3, 0.85, 1], [0.85, 0.5, 0.12, 0]),
    transform: [{ scale: interpolate(shockwavePulse.value, [0, 1], [0.92, 1.55]) }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shieldAuraPulse.value }],
    opacity: interpolate(shieldAuraPulse.value, [0.88, 1.12], [0.35, 0.75]),
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    opacity: labelPulse.value,
  }));

  const content = (
    <Animated.View style={[styles.contentContainer, entranceAnimStyle]}>
      {/* Globe & Gyro Housing Frame */}
      <View style={[styles.outerHousing, { width: containerSize, height: containerSize }]}>
        {/* 1. Expanding Golden Shockwave Pulse */}
        <Animated.View
          style={[
            styles.shockwaveRing,
            {
              width: size + 16,
              height: size + 16,
              borderRadius: (size + 16) / 2,
              borderColor: shockwaveColor,
            },
            shockwaveStyle,
          ]}
        />

        {/* 2. Outer Glowing Atmosphere Aura */}
        <Animated.View
          style={[
            styles.atmosphereAura,
            {
              width: size + 10,
              height: size + 10,
              borderRadius: (size + 10) / 2,
              borderColor: atmosphereBorder,
            },
            auraStyle,
          ]}
        />

        {/* 3. Gyroscopic 3D Orbital Satellite Ring 1 (+28° Tilt) */}
        <Animated.View
          style={[
            styles.orbitalTrack,
            {
              width: size + 36,
              height: size + 36,
              borderRadius: (size + 36) / 2,
            },
            orbit1Style,
          ]}
        >
          {/* Orbiting Satellite Node 1 */}
          <View style={styles.satelliteNode} />
        </Animated.View>

        {/* 4. Gyroscopic 3D Orbital Satellite Ring 2 (-32° Tilt) */}
        <Animated.View
          style={[
            styles.orbitalTrack2,
            {
              width: size + 32,
              height: size + 32,
              borderRadius: (size + 32) / 2,
            },
            orbit2Style,
          ]}
        >
          {/* Orbiting Satellite Node 2 */}
          <View style={styles.satelliteNodeEmerald} />
        </Animated.View>

        {/* 5. Central 3D Earth Sphere (Hardware-accelerated layered render) */}
        <View style={[styles.sphereCore, { width: size, height: size, borderRadius: r, borderColor: sphereBorder }]}>
          {/* Layer A: Base Oceanic Sphere */}
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="oceanGrad" cx="35%" cy="30%" r="70%">
                <Stop offset="0%" stopColor="#0F1722" stopOpacity="1" />
                <Stop offset="55%" stopColor="#080D14" stopOpacity="1" />
                <Stop offset="90%" stopColor="#040609" stopOpacity="1" />
                <Stop offset="100%" stopColor="#020305" stopOpacity="1" />
              </RadialGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r} fill="url(#oceanGrad)" />
          </Svg>

          {/* Layer B: GPU-Accelerated Rotating Continents & Landmasses */}
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: tilePixelWidth * 2, height: size }, globeAnimStyle]}>
            <Svg width={tilePixelWidth * 2} height={size} viewBox={`0 0 ${WORLD_TILE_WIDTH * 2} 360`}>
              <Defs>
                <LinearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#15241B" stopOpacity="0.98" />
                  <Stop offset="50%" stopColor="#101D15" stopOpacity="0.99" />
                  <Stop offset="100%" stopColor="#09120D" stopOpacity="1" />
                </LinearGradient>
                <LinearGradient id="countryEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#F5D061" stopOpacity="0.9" />
                  <Stop offset="60%" stopColor="#D4AF37" stopOpacity="0.7" />
                  <Stop offset="100%" stopColor="#A17C15" stopOpacity="0.5" />
                </LinearGradient>
              </Defs>

              {/* Tile 1: Continents & Hubs */}
              <G transform="scale(1, 1)">
                <Path
                  d={REAL_WORLD_LAND_PATH}
                  fill="url(#landGrad)"
                  stroke="#F5D061"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <Path
                  d={REAL_WORLD_COUNTRIES_PATH}
                  fill="none"
                  stroke="url(#countryEdgeGrad)"
                  strokeWidth={0.8}
                  opacity={0.65}
                  strokeLinejoin="round"
                />
                {REAL_WORLD_HUBS.map((hub, i) => (
                  <G key={`t1-hub-${i}`}>
                    <Circle cx={hub.x} cy={hub.y} r={7} fill="rgba(233, 195, 73, 0.2)" />
                    <Circle cx={hub.x} cy={hub.y} r={3.2} fill="#E9C349" />
                    <Circle cx={hub.x} cy={hub.y} r={1.5} fill="#FFFBEB" />
                  </G>
                ))}
              </G>

              {/* Tile 2: Exact Duplicate for 100% seamless 360° wrap */}
              <G transform={`translate(${WORLD_TILE_WIDTH}, 0)`}>
                <Path
                  d={REAL_WORLD_LAND_PATH}
                  fill="url(#landGrad)"
                  stroke="#F5D061"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <Path
                  d={REAL_WORLD_COUNTRIES_PATH}
                  fill="none"
                  stroke="url(#countryEdgeGrad)"
                  strokeWidth={0.8}
                  opacity={0.65}
                  strokeLinejoin="round"
                />
                {REAL_WORLD_HUBS.map((hub, i) => (
                  <G key={`t2-hub-${i}`}>
                    <Circle cx={hub.x} cy={hub.y} r={7} fill="rgba(233, 195, 73, 0.2)" />
                    <Circle cx={hub.x} cy={hub.y} r={3.2} fill="#E9C349" />
                    <Circle cx={hub.x} cy={hub.y} r={1.5} fill="#FFFBEB" />
                  </G>
                ))}
              </G>
            </Svg>
          </Animated.View>

          {/* Layer C: 3D Spherical Volume Shading, Graticules & Specular Gloss Overlay */}
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="specular3D" cx="28%" cy="24%" r="75%">
                <Stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.26" />
                <Stop offset="30%" stopColor="#E9C349" stopOpacity="0.08" />
                <Stop offset="65%" stopColor="#000000" stopOpacity="0.08" />
                <Stop offset="88%" stopColor="#000000" stopOpacity="0.65" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0.92" />
              </RadialGradient>
              <RadialGradient id="coronaRing" cx="50%" cy="50%" r="50%">
                <Stop offset="84%" stopColor="transparent" stopOpacity="0" />
                <Stop offset="94%" stopColor="#E9C349" stopOpacity="0.25" />
                <Stop offset="100%" stopColor="#E9C349" stopOpacity="0.65" />
              </RadialGradient>
            </Defs>

            {/* Graticule Latitude Parallels */}
            <G opacity={0.2} stroke="#E9C349" strokeWidth={0.75} fill="none">
              <Path d={`M ${r * 0.3},${r * 0.35} Q ${r},${r * 0.22} ${size - r * 0.3},${r * 0.35}`} />
              <Path d={`M ${r * 0.1},${r * 0.65} Q ${r},${r * 0.52} ${size - r * 0.1},${r * 0.65}`} />
              <Path d={`M 0,${r} Q ${r},${r * 0.94} ${size},${r}`} strokeWidth={1} opacity={0.3} />
              <Path d={`M ${r * 0.1},${r * 1.35} Q ${r},${r * 1.48} ${size - r * 0.1},${r * 1.35}`} />
              <Path d={`M ${r * 0.3},${r * 1.65} Q ${r},${r * 1.78} ${size - r * 0.3},${r * 1.65}`} />
            </G>

            {/* Specular & Atmospheric Highlights */}
            <Circle cx={r} cy={r} r={r} fill="url(#specular3D)" />
            <Circle cx={r} cy={r} r={r} fill="url(#coronaRing)" />

            {/* Precision Golden Rim */}
            <Circle
              cx={r}
              cy={r}
              r={r - 0.8}
              stroke={goldenRimColor}
              strokeWidth={1.6}
              fill="none"
              opacity={0.9}
            />
          </Svg>
        </View>
      </View>

      {/* Brand & Loading Status Typography */}
      {!hideLabels && (
        <View style={styles.textStack}>
          {/* Optional Brand Badge with Mini Shield */}
          {showBrandHeader && (
            <View style={styles.brandRow}>
              <Ionicons name="shield-checkmark" size={12} color={brandGold} />
              <Text style={[styles.brandTitle, { color: brandGold }]}>CIRCLE GUARD</Text>
            </View>
          )}

          {/* Primary Loading Message */}
          <Animated.Text style={[styles.loadingLabel, { color: labelColor }, labelAnimStyle]}>
            {loadingLabel}
          </Animated.Text>

          {/* Secondary Sublabel or Dynamic Telemetry Badge */}
          <View style={[styles.telemetryBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <View style={styles.pulsingIndicator} />
            <Text style={[styles.telemetryText, { color: badgeTextColor }]}>
              {subLabel || TELEMETRY_FEED[telemetryIdx]}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );

  if (fullscreen) {
    return (
      <View
        style={[
          styles.fullscreenContainer,
          { backgroundColor: isDark ? '#0A0C0F' : 'rgba(10, 12, 15, 0.97)' },
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.inlineContainer, isCompact && { paddingVertical: 0 }]}>
      {content}
    </View>
  );
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
    paddingVertical: 24,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  outerHousing: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Shockwave Pulse
  shockwaveRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(233, 195, 73, 0.65)',
  },
  // Atmosphere Outer Aura
  atmosphereAura: {
    position: 'absolute',
    backgroundColor: 'rgba(233, 195, 73, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(233, 195, 73, 0.25)',
    shadowColor: '#E9C349',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
  },
  // Gyro Orbital Rings
  orbitalTrack: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(233, 195, 73, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitalTrack2: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(110, 229, 145, 0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  satelliteNode: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFBEB',
    shadowColor: '#E9C349',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
    marginTop: -3,
  },
  satelliteNodeEmerald: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F5D061',
    shadowColor: '#E9C349',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: -2.5,
  },
  // Sphere Core
  sphereCore: {
    overflow: 'hidden',
    backgroundColor: '#070B11',
    borderWidth: 1.5,
    borderColor: 'rgba(233, 195, 73, 0.5)',
    shadowColor: '#E9C349',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loadingLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    maxWidth: 280,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 9999,
    borderWidth: 1,
    marginTop: 2,
  },
  pulsingIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  telemetryText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
