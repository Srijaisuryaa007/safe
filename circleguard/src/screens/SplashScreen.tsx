import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Animation Shared Values
  const initialParticleOpacity = useSharedValue(0);
  const initialParticleScale = useSharedValue(0.2);

  const ringDrawOpacity = useSharedValue(0);
  const ringOrbitRotation = useSharedValue(0);

  const shieldScale = useSharedValue(0.75);
  const shieldOpacity = useSharedValue(0);

  const familyCenterOpacity = useSharedValue(0);
  const familySideOpacity = useSharedValue(0);

  const pinDropY = useSharedValue(-50);
  const pinOpacity = useSharedValue(0);

  const ripple1R = useSharedValue(4);
  const ripple1Opacity = useSharedValue(0);
  const ripple2R = useSharedValue(4);
  const ripple2Opacity = useSharedValue(0);

  const textY = useSharedValue(20);
  const textOpacity = useSharedValue(0);

  const particleFloatY = useSharedValue(0);

  const containerScale = useSharedValue(1);
  const containerOpacity = useSharedValue(1);

  const logoSize = 220;

  useEffect(() => {
    // Scene 1: Simultaneous Outer Circle & Gold Shield Logo Landing (0ms Together!)
    initialParticleOpacity.value = withTiming(1, { duration: 350 });
    initialParticleScale.value = withTiming(1, { duration: 350 });

    // Both Outer Circle Ring and Inner Shield Logo emerge AT THE EXACT SAME TIME!
    ringDrawOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    shieldOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    shieldScale.value = withSpring(1, { damping: 14, stiffness: 90 });

    ringOrbitRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );

    // Scene 2: Family Silhouettes inside Shield (250ms & 380ms)
    familyCenterOpacity.value = withDelay(250, withTiming(1, { duration: 350 }));
    familySideOpacity.value = withDelay(380, withTiming(1, { duration: 350 }));

    // Scene 3: Location Pin Drop with Spring Bounce & Concentric Ripples (600ms)
    pinOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
    pinDropY.value = withDelay(600, withSpring(0, { damping: 11, stiffness: 110 }));

    ripple1R.value = withDelay(
      800,
      withRepeat(
        withTiming(50, { duration: 2500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    ripple1Opacity.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(0.75, { duration: 350 }),
          withTiming(0, { duration: 2150 })
        ),
        -1,
        false
      )
    );

    ripple2R.value = withDelay(
      1400,
      withRepeat(
        withTiming(50, { duration: 2500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    ripple2Opacity.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(0.75, { duration: 350 }),
          withTiming(0, { duration: 2150 })
        ),
        -1,
        false
      )
    );

    // Scene 4: Floating Particles
    particleFloatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Scene 5: Brand Typography Fade Upward (900ms)
    textOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    textY.value = withDelay(
      900,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Scene 6: Seamless Zoom Scale & Fade Out Transition into App (2600ms)
    containerScale.value = withDelay(
      2600,
      withTiming(0.94, { duration: 500, easing: Easing.inOut(Easing.cubic) })
    );
    containerOpacity.value = withDelay(
      2600,
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (onFinish) {
          runOnJS(onFinish)();
        }
      })
    );

    // Fallback timer (3.2 seconds max) to guarantee splash screen never hangs
    const fallbackTimer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, 3200);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Animated Styles
  const mainContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const initialParticleStyle = useAnimatedStyle(() => ({
    opacity: initialParticleOpacity.value,
    transform: [{ scale: initialParticleScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringDrawOpacity.value,
  }));

  const shieldStyle = useAnimatedStyle(() => ({
    opacity: shieldOpacity.value,
    transform: [{ scale: shieldScale.value }],
  }));

  const sidePeopleStyle = useAnimatedStyle(() => ({
    opacity: familySideOpacity.value,
  }));

  const centerPersonStyle = useAnimatedStyle(() => ({
    opacity: familyCenterOpacity.value,
  }));

  const pinStyle = useAnimatedStyle(() => ({
    opacity: pinOpacity.value,
    transform: [{ translateY: pinDropY.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <View style={styles.screenBg}>
      <Animated.View style={[styles.centerWrapper, mainContainerStyle]}>
        {/* 220x220 Vector Logo Canvas */}
        <View style={{ width: logoSize, height: logoSize, alignItems: 'center', justifyContent: 'center' }}>
          {/* Base Static Halo */}
          <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id="bgHaloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#F3E5AB" stopOpacity="1" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="shieldBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#262626" stopOpacity="0.98" />
                <Stop offset="100%" stopColor="#0D0D0D" stopOpacity="0.99" />
              </LinearGradient>
              <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#D4AF37" stopOpacity="1" />
                <Stop offset="70%" stopColor="#F3E5AB" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
              </LinearGradient>
            </Defs>
            <Circle cx="100" cy="100" r="94" fill="url(#bgHaloGrad)" />
          </Svg>

          {/* Animated Ring Layer */}
          <Animated.View style={[{ position: 'absolute', width: logoSize, height: logoSize }, ringStyle]}>
            <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="ringGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#D4AF37" stopOpacity="1" />
                  <Stop offset="70%" stopColor="#F3E5AB" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
                </LinearGradient>
              </Defs>
              <Circle cx="100" cy="100" r="90" stroke="url(#ringGrad2)" strokeWidth="2.5" fill="none" />
            </Svg>
          </Animated.View>

          {/* Animated Shield & Family Layer */}
          <Animated.View style={[{ position: 'absolute', width: logoSize, height: logoSize }, shieldStyle]}>
            <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#F3E5AB" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
                </LinearGradient>
                <LinearGradient id="shieldBgGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#262626" stopOpacity="0.98" />
                  <Stop offset="100%" stopColor="#0D0D0D" stopOpacity="0.99" />
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
          <Animated.View style={[{ position: 'absolute', width: logoSize, height: logoSize }, pinStyle]}>
            <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="goldGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#F3E5AB" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Path
                d="M 100 94 C 87 94 77 104 77 117 C 77 133 100 154 100 154 C 100 154 123 133 123 117 C 123 104 113 94 100 94 Z"
                fill="url(#goldGrad3)"
                stroke="#0D0D0D"
                strokeWidth="2.5"
              />
              <Circle cx="100" cy="115" r="9" fill="#0D0D0D" />
            </Svg>
          </Animated.View>
        </View>

        {/* Brand Typography (Scene 6) */}
        <Animated.View style={[styles.textWrapper, textStyle]}>
          <Text style={styles.brandTitle}>
            Circle<Text style={{ color: '#D4AF37' }}>Guard</Text>
          </Text>

          <Text style={styles.tagline}>
            YOUR CIRCLE. YOUR SAFETY. ALWAYS.
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowAura: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 30,
  },
  textWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A3A3A3',
    letterSpacing: 3,
    marginTop: 8,
  },
});
