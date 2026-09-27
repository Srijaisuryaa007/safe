import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Use core React Native Animated API (100% crash-proof on all Android devices)
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const pinDropY = useRef(new Animated.Value(-30)).current;
  const pinOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(15)).current;

  const logoSize = 220;

  useEffect(() => {
    // Continuous ring rotation
    const rotationLoop = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotationLoop.start();

    // Sequence of luxury animations
    Animated.parallel([
      // Logo emerge
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      // Pin drop
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(pinOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(pinDropY, {
            toValue: 0,
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Brand text fade-in
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Smooth exit transition at 2.4s
    const exitTimer = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        rotationLoop.stop();
        if (onFinish) {
          onFinish();
        }
      });
    }, 2400);

    // Guaranteed safety timeout (3.0s max)
    const fallbackTimer = setTimeout(() => {
      rotationLoop.stop();
      if (onFinish) {
        onFinish();
      }
    }, 3000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(fallbackTimer);
      rotationLoop.stop();
    };
  }, []);

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.screenBg}>
      <Animated.View style={[styles.centerWrapper, { opacity: containerOpacity }]}>
        {/* 220x220 Vector Logo Canvas */}
        <Animated.View
          style={{
            width: logoSize,
            height: logoSize,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          {/* Base Halo & Gradients */}
          <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
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

          {/* Rotating Ring Layer */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] },
            ]}
          >
            <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
              <Circle cx="100" cy="100" r="90" stroke="url(#ringGrad)" strokeWidth="2.5" fill="none" />
            </Svg>
          </Animated.View>

          {/* Static Gold Shield & Family Silhouettes */}
          <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
            <Path
              d="M 100 38 C 128 38 152 48 152 68 C 152 112 100 152 100 152 C 100 152 48 112 48 68 C 48 48 72 38 100 38 Z"
              fill="url(#shieldBgGrad)"
              stroke="url(#goldGrad)"
              strokeWidth="3.5"
            />
            {/* Left family silhouette */}
            <Circle cx="82" cy="82" r="8.5" fill="#52525B" />
            <Path d="M 68 108 C 68 97 74 92 82 92 C 90 92 96 97 96 108 Z" fill="#3F3F46" />
            {/* Right family silhouette */}
            <Circle cx="118" cy="82" r="8.5" fill="#52525B" />
            <Path d="M 104 108 C 104 97 110 92 118 92 C 126 92 132 97 132 108 Z" fill="#3F3F46" />
            {/* Center prominent member */}
            <Circle cx="100" cy="76" r="11" fill="url(#goldGrad)" />
            <Path d="M 83 112 C 83 97 90 90 100 90 C 110 90 117 97 117 112 Z" fill="url(#goldGrad)" />
          </Svg>

          {/* Animated Pin Drop */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pinOpacity,
                transform: [{ translateY: pinDropY }],
              },
            ]}
          >
            <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200">
              <Path
                d="M 100 94 C 87 94 77 104 77 117 C 77 133 100 154 100 154 C 100 154 123 133 123 117 C 123 104 113 94 100 94 Z"
                fill="url(#goldGrad)"
                stroke="#0D0D0D"
                strokeWidth="2.5"
              />
              <Circle cx="100" cy="115" r="9" fill="#0D0D0D" />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* Brand Typography */}
        <Animated.View
          style={[
            styles.textWrapper,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>
            Circle<Text style={{ color: '#D4AF37' }}>Guard</Text>
          </Text>

          <Text style={styles.tagline}>YOUR CIRCLE. YOUR SAFETY. ALWAYS.</Text>
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
  textWrapper: {
    alignItems: 'center',
    marginTop: 28,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(212, 175, 55, 0.85)',
    letterSpacing: 2.2,
    marginTop: 8,
  },
});
