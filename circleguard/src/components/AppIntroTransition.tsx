import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SKIP_KEY = '@circleguard_intro_played';
const LOGO_SOURCE = require('../../assets/logo.png');

interface AppIntroTransitionProps {
  onComplete: () => void;
  forcePlay?: boolean;
}

export default function AppIntroTransition({ onComplete, forcePlay = false }: AppIntroTransitionProps) {
  // ─── Phase Shared Values ─────────────────────────────────────────────────────
  
  // Phase 1: Content scale/blur intensity (zoom-out)
  const contentScale   = useSharedValue(1);
  const blurIntensity  = useSharedValue(0);

  // Phase 2: Vortex overlay
  const vortexOpacity  = useSharedValue(0);
  const vortexRotation = useSharedValue(0);
  const desaturation   = useSharedValue(0);

  // Phase 3: Logo reveal
  const logoScale      = useSharedValue(0);
  const logoOpacity    = useSharedValue(0);

  // Phase 4: Snap into main screen
  const snapScale      = useSharedValue(0.88);
  const snapOpacity    = useSharedValue(0);

  // Vortex ring animations
  const ring1Rotation  = useSharedValue(0);
  const ring2Rotation  = useSharedValue(0);
  const ring3Rotation  = useSharedValue(0);

  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const start = () => {
      playIntro();
    };

    if (forcePlay) {
      start();
      return;
    }

    AsyncStorage.getItem(SKIP_KEY).then((val) => {
      if (val === '1') {
        onComplete();
      } else {
        AsyncStorage.setItem(SKIP_KEY, '1');
        start();
      }
    });
  }, []);

  const complete = () => {
    onComplete();
  };

  const playIntro = () => {
    // ── RING SPIN (continuous clockwise spin throughout the full sequence) ──────
    ring1Rotation.value = withTiming(360, { duration: 900, easing: Easing.linear });
    ring2Rotation.value = withDelay(60, withTiming(-360, { duration: 1100, easing: Easing.linear }));
    ring3Rotation.value = withDelay(120, withTiming(720, { duration: 1400, easing: Easing.linear }));

    // ── PHASE 1: Zoom-out blur (0 → 200ms) ────────────────────────────────────
    contentScale.value = withTiming(0.88, { duration: 220, easing: Easing.inOut(Easing.quad) });
    blurIntensity.value = withTiming(1, { duration: 220, easing: Easing.in(Easing.quad) });

    // ── PHASE 2: Vortex spin-in (200ms → 600ms) ───────────────────────────────
    vortexOpacity.value = withDelay(180, withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }));
    vortexRotation.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.inOut(Easing.cubic) }));
    desaturation.value = withDelay(200, withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }));

    // ── PHASE 3: Logo spring-in (480ms → 750ms) ───────────────────────────────
    logoOpacity.value = withDelay(440, withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }));
    logoScale.value = withDelay(440, withSpring(1, {
      damping: 9,
      stiffness: 220,
      mass: 0.8,
    }));

    // ── PHASE 4: Snap zoom into main screen (820ms → 1250ms) ─────────────────
    vortexOpacity.value = withDelay(780, withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }));
    logoOpacity.value = withDelay(820, withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }));

    snapOpacity.value = withDelay(900, withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }));
    snapScale.value = withDelay(900, withSpring(1, {
      damping: 14,
      stiffness: 280,
      mass: 0.7,
    }));

    blurIntensity.value = withDelay(900, withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }));

    // ── COMPLETE (after 1350ms) ───────────────────────────────────────────────
    setTimeout(() => {
      runOnJS(complete)();
    }, 1350);
  };

  // ─── Animated Styles ─────────────────────────────────────────────────────────

  const vortexStyle = useAnimatedStyle(() => {
    const rotate = interpolate(vortexRotation.value, [0, 1], [0, 120], Extrapolation.CLAMP);
    return {
      opacity: vortexOpacity.value,
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring1Rotation.value}deg` }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring2Rotation.value}deg` }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring3Rotation.value}deg` }],
  }));

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const snapScreenStyle = useAnimatedStyle(() => ({
    opacity: snapOpacity.value,
    transform: [{ scale: snapScale.value }],
  }));

  const blurWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
  }));

  // ─── Vortex Layer Colors ──────────────────────────────────────────────────────
  // GTA-signature: near-black + deep-teal cyanish fog + warm amber accent
  const VORTEX_DARK  = '#080B0E';
  const VORTEX_TEAL  = '#003D3D';
  const VORTEX_CYAN  = '#007A7A';
  const VORTEX_AMBER = '#B56A00';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ── PHASE 1 & 4: Blur overlay on top of underlying content ── */}
      <Animated.View style={[StyleSheet.absoluteFill, blurWrapperStyle]}>
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={Platform.OS === 'ios' ? 0 : 0}
          tint="dark"
        />
      </Animated.View>

      {/* ── PHASE 2: GTA Vortex Layer ── */}
      <Animated.View style={[styles.vortexContainer, vortexStyle]}>
        {/* Dark full-screen base */}
        <View style={[styles.vortexBase, { backgroundColor: VORTEX_DARK }]} />

        {/* Spinning ring 1 – outer teal ring */}
        <Animated.View style={[styles.vortexRingWrap, ring1Style]}>
          <View style={[styles.vortexRing, styles.ring1, { borderColor: VORTEX_CYAN }]} />
        </Animated.View>

        {/* Spinning ring 2 – mid amber ring, reverse */}
        <Animated.View style={[styles.vortexRingWrap, ring2Style]}>
          <View style={[styles.vortexRing, styles.ring2, { borderColor: VORTEX_AMBER }]} />
        </Animated.View>

        {/* Spinning ring 3 – inner teal ring, fast */}
        <Animated.View style={[styles.vortexRingWrap, ring3Style]}>
          <View style={[styles.vortexRing, styles.ring3, { borderColor: VORTEX_TEAL }]} />
        </Animated.View>

        {/* Radial gradient simulation using nested rounded views */}
        <View style={styles.vortexGlowOuter} />
        <View style={styles.vortexGlowMid} />
        <View style={styles.vortexGlowInner} />

        {/* Scanline overlay – GTA's signature cinematic film grain look */}
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.scanline,
              {
                top: i * (height / 18),
                opacity: i % 2 === 0 ? 0.04 : 0.02,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* ── PHASE 3: Logo spring reveal at center ── */}
      <Animated.View style={[styles.logoContainer, logoAnimStyle]}>
        <View style={styles.logoGlowRing} />
        <Image
          source={LOGO_SOURCE}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── PHASE 4: Snap-in overlay (very brief flash-in) ── */}
      <Animated.View style={[styles.snapOverlay, snapScreenStyle]}>
        <View style={styles.snapFlash} />
      </Animated.View>
    </View>
  );
}

const RING_BASE = Math.min(width, height);

const styles = StyleSheet.create({
  vortexContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vortexBase: {
    ...StyleSheet.absoluteFill,
  },
  vortexRingWrap: {
    position: 'absolute',
    width: RING_BASE * 2.2,
    height: RING_BASE * 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vortexRing: {
    position: 'absolute',
    borderRadius: RING_BASE,
    borderStyle: 'solid',
  },
  ring1: {
    width: RING_BASE * 2.0,
    height: RING_BASE * 2.0,
    borderWidth: 2,
    opacity: 0.6,
  },
  ring2: {
    width: RING_BASE * 1.5,
    height: RING_BASE * 1.5,
    borderWidth: 1.5,
    opacity: 0.45,
  },
  ring3: {
    width: RING_BASE * 1.0,
    height: RING_BASE * 1.0,
    borderWidth: 1,
    opacity: 0.5,
  },
  vortexGlowOuter: {
    position: 'absolute',
    width: RING_BASE * 1.2,
    height: RING_BASE * 1.2,
    borderRadius: RING_BASE,
    backgroundColor: 'rgba(0, 80, 80, 0.12)',
  },
  vortexGlowMid: {
    position: 'absolute',
    width: RING_BASE * 0.65,
    height: RING_BASE * 0.65,
    borderRadius: RING_BASE,
    backgroundColor: 'rgba(0, 100, 100, 0.18)',
  },
  vortexGlowInner: {
    position: 'absolute',
    width: RING_BASE * 0.28,
    height: RING_BASE * 0.28,
    borderRadius: RING_BASE,
    backgroundColor: 'rgba(180, 100, 0, 0.22)',
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 80, 80, 0.25)',
    shadowColor: '#00DDDD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logoImage: {
    width: 180,
    height: 180,
  },
  snapOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
