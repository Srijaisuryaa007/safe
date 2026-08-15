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
    // Scene 1: Initial Glowing Particle (0ms)
    initialParticleOpacity.value = withTiming(1, { duration: 400 });
    initialParticleScale.value = withTiming(1, { duration: 400 });

    // Scene 2: Particle Orbit & Golden Circle Draw (400ms)
    ringDrawOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    ringOrbitRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );

    // Scene 3: Gold Shield & Staggered Family Silhouettes (1000ms)
    shieldOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));
    shieldScale.value = withDelay(1000, withSpring(1, { damping: 14, stiffness: 85 }));

    familyCenterOpacity.value = withDelay(1300, withTiming(1, { duration: 400 }));
    familySideOpacity.value = withDelay(1450, withTiming(1, { duration: 400 }));

    // Scene 4: Location Pin Drop with Spring Bounce & Concentric Ripples (1700ms)
    pinOpacity.value = withDelay(1700, withTiming(1, { duration: 300 }));
    pinDropY.value = withDelay(1700, withSpring(0, { damping: 11, stiffness: 110 }));

    ripple1R.value = withDelay(
      1900,
      withRepeat(
        withTiming(50, { duration: 2500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    ripple1Opacity.value = withDelay(
      1900,
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
      2500,
      withRepeat(
        withTiming(50, { duration: 2500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
    ripple2Opacity.value = withDelay(
      2500,
      withRepeat(
        withSequence(
          withTiming(0.75, { duration: 350 }),
          withTiming(0, { duration: 2150 })
        ),
        -1,
        false
      )
    );

    // Scene 5: Floating Particles (2200ms)
    particleFloatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Scene 6: Typography Fade Upward (2600ms)
    textOpacity.value = withDelay(2600, withTiming(1, { duration: 600 }));
    textY.value = withDelay(
      2600,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );

    // Scene 7: Hold for 1 sec, then Scale Down & Seamless Zoom Transition into App (3600ms)
    containerScale.value = withDelay(
      3600,
      withTiming(0.92, { duration: 600, easing: Easing.inOut(Easing.cubic) })
    );
    containerOpacity.value = withDelay(
      3600,
      withTiming(0, { duration: 600, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (onFinish) {
          runOnJS(onFinish)();
        }
      })
    );

    // Hard fallback timer (4.2 seconds max) to guarantee splash screen never hangs
    const fallbackTimer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      }
    }, 4200);

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

  const ringProps = useAnimatedProps(() => ({
    opacity: ringDrawOpacity.value,
  }));

  const shieldProps = useAnimatedProps(() => ({
    opacity: shieldOpacity.value,
    transform: [{ scale: shieldScale.value }],
  }));

  const sidePeopleProps = useAnimatedProps(() => ({
    opacity: familySideOpacity.value,
  }));

  const centerPersonProps = useAnimatedProps(() => ({
    opacity: familyCenterOpacity.value,
  }));

  const pinProps = useAnimatedProps(() => ({
    opacity: pinOpacity.value,
    transform: [{ translateY: pinDropY.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const animatedRipple1Props = useAnimatedProps(() => ({
    rx: ripple1R.value,
    ry: ripple1R.value * 0.35,
    strokeOpacity: ripple1Opacity.value,
  }));

  const animatedRipple2Props = useAnimatedProps(() => ({
    rx: ripple2R.value,
    ry: ripple2R.value * 0.35,
    strokeOpacity: ripple2Opacity.value,
  }));

  return (
    <View style={styles.screenBg}>
      <Animated.View style={[styles.centerWrapper, mainContainerStyle]}>
        {/* 220x220 Vector Logo Canvas */}
        <View style={{ width: logoSize, height: logoSize, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
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

            {/* 1. Perfect Pure Circular Soft Ambient Glow (cx=100, cy=100) */}
            <Circle
              cx="100"
              cy="100"
              r="94"
              fill="url(#bgHaloGrad)"
            />

            {/* 2. Perfect Outer Circle Ring (Centered at cx=100, cy=100) */}
            <AnimatedG animatedProps={ringProps}>
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="url(#ringGrad)"
                strokeWidth="2.5"
                fill="none"
              />
            </AnimatedG>

            {/* 3. Concentric Radar Ripples at Shield Base (cy=155) */}
            <G cx="100" cy="155">
              <AnimatedEllipse
                cx="100"
                cy="155"
                stroke="#D4AF37"
                strokeWidth="2"
                fill="none"
                animatedProps={animatedRipple1Props}
              />
              <AnimatedEllipse
                cx="100"
                cy="155"
                stroke="#D4AF37"
                strokeWidth="2"
                fill="none"
                animatedProps={animatedRipple2Props}
              />
            </G>

            {/* 4. Gold Shield */}
            <AnimatedG animatedProps={shieldProps} originX={100} originY={95}>
              <Path
                d="M 100 38 C 128 38 152 48 152 68 C 152 112 100 152 100 152 C 100 152 48 112 48 68 C 48 48 72 38 100 38 Z"
                fill="url(#shieldBgGrad)"
                stroke="url(#goldGrad)"
                strokeWidth="3.5"
              />

              {/* 5. Family Members inside Shield */}
              <AnimatedG animatedProps={sidePeopleProps}>
                <Circle cx="82" cy="82" r="8.5" fill="#52525B" />
                <Path d="M 68 108 C 68 97 74 92 82 92 C 90 92 96 97 96 108 Z" fill="#3F3F46" />
              </AnimatedG>

              <AnimatedG animatedProps={sidePeopleProps}>
                <Circle cx="118" cy="82" r="8.5" fill="#52525B" />
                <Path d="M 104 108 C 104 97 110 92 118 92 C 126 92 132 97 132 108 Z" fill="#3F3F46" />
              </AnimatedG>

              <AnimatedG animatedProps={centerPersonProps}>
                <Circle cx="100" cy="76" r="11" fill="url(#goldGrad)" />
                <Path d="M 83 112 C 83 97 90 90 100 90 C 110 90 117 97 117 112 Z" fill="url(#goldGrad)" />
              </AnimatedG>
            </AnimatedG>

            {/* 6. GPS Location Pin Drop */}
            <AnimatedG animatedProps={pinProps} originX={100} originY={122}>
              <Path
                d="M 100 94 C 87 94 77 104 77 117 C 77 133 100 154 100 154 C 100 154 123 133 123 117 C 123 104 113 94 100 94 Z"
                fill="url(#goldGrad)"
                stroke="#0D0D0D"
                strokeWidth="2.5"
              />
              <Circle cx="100" cy="115" r="9" fill="#0D0D0D" />
            </AnimatedG>
          </Svg>
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
