import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface MascotShieldHeaderProps {
  isPasswordFocused?: boolean;
  isSuccess?: boolean;
  onOpenSettings?: () => void;
}

export default function MascotShieldHeader({
  isPasswordFocused = false,
  isSuccess = false,
  onOpenSettings,
}: MascotShieldHeaderProps) {
  // Animated values for speech bubble & ZzZ
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const zzzY = useRef(new Animated.Value(0)).current;
  const zzzOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPasswordFocused || isSuccess) {
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bubbleScale, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPasswordFocused, isSuccess]);

  // Floating ZzZ animation loop
  useEffect(() => {
    if (isPasswordFocused && !isSuccess) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(zzzY, {
              toValue: -20,
              duration: 1600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(zzzOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(zzzOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      zzzY.setValue(0);
      zzzOpacity.setValue(0);
    }
  }, [isPasswordFocused, isSuccess]);

  return (
    <View style={styles.headerContainer}>
      {/* Top Bar with Settings Gear Button */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        {onOpenSettings ? (
          <TouchableOpacity style={styles.settingsBtn} onPress={onOpenSettings} activeOpacity={0.75}>
            <Ionicons name="settings-sharp" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main Mascot & Shield Composition Stack */}
      <View style={styles.compositionBox}>
        {/* Floating Speech Bubble (Top Right of Shield) */}
        <Animated.View
          style={[
            styles.speechBubbleContainer,
            {
              opacity: bubbleOpacity,
              transform: [{ scale: bubbleScale }],
            },
          ]}
        >
          <View style={styles.speechBubblePill}>
            <Text style={styles.speechText}>
              {isSuccess ? 'Okay! 👍' : 'Is that over?'}
            </Text>
            {/* Speech Bubble Tail */}
            <View style={styles.bubbleTail} />
          </View>

          {/* Spark Lines near Mascot Head when Password Focused */}
          {isPasswordFocused && !isSuccess ? (
            <View style={styles.sparkLines}>
              <Text style={styles.sparkText}>\</Text>
              <Text style={styles.sparkText}>|</Text>
              <Text style={styles.sparkText}>/</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Floating ZzZ when password focused */}
        {isPasswordFocused && !isSuccess ? (
          <Animated.View
            style={[
              styles.zzzContainer,
              {
                opacity: zzzOpacity,
                transform: [{ translateY: zzzY }],
              },
            ]}
          >
            <Text style={styles.zzzText}>Z z Z</Text>
          </Animated.View>
        ) : null}

        {/* Layer 1: Peeking 3D Mascot Image (Left Side) */}
        <View style={styles.mascotWrapper}>
          <Image
            source={require('../../assets/mascot_peeking.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
          {/* Eyes Closed Overlay when password field focused */}
          {isPasswordFocused && !isSuccess ? (
            <View style={styles.eyesClosedOverlay}>
              <Text style={styles.closedEyesArc}>^ ^</Text>
            </View>
          ) : null}
        </View>

        {/* Layer 2: 3D Vector Shield Emblem (Centered Front) */}
        <View style={styles.shieldWrapper}>
          <Svg width={140} height={140} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="goldGradHeader" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#F3E5AB" stopOpacity="1" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="shieldBgGradHeader" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#262626" stopOpacity="0.98" />
                <Stop offset="100%" stopColor="#0D0D0D" stopOpacity="0.99" />
              </LinearGradient>
              <LinearGradient id="ringGradHeader" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#D4AF37" stopOpacity="1" />
                <Stop offset="50%" stopColor="#F3E5AB" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0.4" />
              </LinearGradient>
            </Defs>

            {/* Ambient Gold Glow & Outer Ring */}
            <Circle cx="100" cy="100" r="94" fill="rgba(212, 175, 55, 0.08)" />
            <Circle cx="100" cy="100" r="90" stroke="url(#ringGradHeader)" strokeWidth="3" fill="none" />

            {/* Gold Shield Shape */}
            <Path
              d="M 100 38 C 128 38 152 48 152 68 C 152 112 100 152 100 152 C 100 152 48 112 48 68 C 48 48 72 38 100 38 Z"
              fill="url(#shieldBgGradHeader)"
              stroke="url(#goldGradHeader)"
              strokeWidth="3.5"
            />

            {/* Family Members inside Shield */}
            <Circle cx="82" cy="82" r="8.5" fill="#52525B" />
            <Path d="M 68 108 C 68 97 74 92 82 92 C 90 92 96 97 96 108 Z" fill="#3F3F46" />
            <Circle cx="118" cy="82" r="8.5" fill="#52525B" />
            <Path d="M 104 108 C 104 97 110 92 118 92 C 126 92 132 97 132 108 Z" fill="#3F3F46" />
            <Circle cx="100" cy="76" r="11" fill="url(#goldGradHeader)" />
            <Path d="M 83 112 C 83 97 90 90 100 90 C 110 90 117 97 117 112 Z" fill="url(#goldGradHeader)" />

            {/* Gold GPS Pin Drop */}
            <Path
              d="M 100 94 C 87 94 77 104 77 117 C 77 133 100 154 100 154 C 100 154 123 133 123 117 C 123 104 113 94 100 94 Z"
              fill="url(#goldGradHeader)"
              stroke="#0D0D0D"
              strokeWidth="2.5"
            />
            <Circle cx="100" cy="115" r="9" fill="#0D0D0D" />
          </Svg>
        </View>
      </View>

      {/* Typography Brand Title */}
      <View style={styles.brandTitleContainer}>
        <Text style={styles.brandTitleText}>
          CIRCLE<Text style={{ color: '#D4AF37' }}>GUARD</Text>
        </Text>
        <Text style={styles.taglineText}>YOUR CIRCLE. YOUR SAFETY. ALWAYS.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E2C',
    borderWidth: 1,
    borderColor: '#33334A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compositionBox: {
    width: 220,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mascotWrapper: {
    position: 'absolute',
    left: 0,
    top: 5,
    zIndex: 1,
  },
  mascotImage: {
    width: 100,
    height: 130,
  },
  eyesClosedOverlay: {
    position: 'absolute',
    top: 38,
    left: 36,
    backgroundColor: '#1A1829',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  closedEyesArc: {
    color: '#FFE600',
    fontSize: 14,
    fontWeight: '900',
  },
  shieldWrapper: {
    position: 'absolute',
    right: 20,
    top: 0,
    zIndex: 2,
  },
  speechBubbleContainer: {
    position: 'absolute',
    top: -24,
    right: -10,
    zIndex: 10,
  },
  speechBubblePill: {
    backgroundColor: '#12121A',
    borderWidth: 1.5,
    borderColor: '#F0C020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    position: 'relative',
    shadowColor: '#F0C020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  speechText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: 16,
    width: 10,
    height: 10,
    backgroundColor: '#12121A',
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: '#F0C020',
    transform: [{ rotate: '-45deg' }],
  },
  sparkLines: {
    position: 'absolute',
    left: -20,
    top: 10,
    flexDirection: 'row',
    gap: 2,
  },
  sparkText: {
    color: '#F0C020',
    fontSize: 12,
    fontWeight: '900',
  },
  zzzContainer: {
    position: 'absolute',
    right: 25,
    top: -15,
    zIndex: 9,
  },
  zzzText: {
    color: '#F0C020',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandTitleContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  brandTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 4,
  },
  taglineText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.8,
    marginTop: 4,
  },
});
