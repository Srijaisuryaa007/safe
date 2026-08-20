import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Ellipse,
  G,
  Text as SvgText,
  Rect,
} from 'react-native-svg';

interface AnimatedMascotProps {
  focusedField?: 'email' | 'password' | null;
  showPassword?: boolean;
  status?: 'idle' | 'success' | 'error';
  children?: React.ReactNode;
}

export const AnimatedMascot: React.FC<AnimatedMascotProps> = ({
  focusedField = null,
  showPassword = false,
  status = 'idle',
  children,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0.3 });
  const [isIdle, setIsIdle] = useState(false);

  // Animation values for popping out from behind logo
  const leftX = useRef(new Animated.Value(0)).current;
  const leftY = useRef(new Animated.Value(0)).current;
  const leftScale = useRef(new Animated.Value(0.5)).current;
  const leftOpacity = useRef(new Animated.Value(0)).current;

  const rightX = useRef(new Animated.Value(0)).current;
  const rightY = useRef(new Animated.Value(0)).current;
  const rightScale = useRef(new Animated.Value(0.5)).current;
  const rightOpacity = useRef(new Animated.Value(0)).current;

  // Breathing loop animation
  const breatheAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let idleTimeout: any;

    if (!focusedField && status === 'idle') {
      idleTimeout = setTimeout(() => {
        setIsIdle(true);
      }, 5000);
    } else {
      setIsIdle(false);
    }

    return () => clearTimeout(idleTimeout);
  }, [focusedField, status]);

  // Adjust pupil direction when user focuses fields
  useEffect(() => {
    if (focusedField === 'email') {
      setMousePos({ x: 0, y: 0.8 });
    } else if (focusedField === 'password') {
      setMousePos({ x: 0, y: 0.9 });
    } else {
      setMousePos({ x: 0, y: 0.2 });
    }
  }, [focusedField]);

  let mascotState = 'hidden';
  if (status === 'success') {
    mascotState = 'success';
  } else if (status === 'error') {
    mascotState = 'error';
  } else if (focusedField === 'email') {
    mascotState = 'watching';
  } else if (focusedField === 'password') {
    mascotState = showPassword ? 'peeking' : 'eyes-closed';
  } else if (isIdle) {
    mascotState = 'sleeping';
  }

  // Spring animation when mascotState changes (Hides behind logo -> Pops out)
  useEffect(() => {
    // Default Peeking state: Characters peek from side of logo while holding edge of logo badge
    let targetLeftX = -46;
    let targetLeftY = 4;
    let targetLeftScale = 0.76;
    let targetLeftOpacity = 0.9;

    let targetRightX = 46;
    let targetRightY = 4;
    let targetRightScale = 0.76;
    let targetRightOpacity = 0.9;

    if (mascotState === 'success') {
      targetLeftX = -78; targetLeftY = -2; targetLeftScale = 0.86; targetLeftOpacity = 1;
      targetRightX = 78; targetRightY = -2; targetRightScale = 0.86; targetRightOpacity = 1;
    } else if (mascotState === 'error') {
      targetLeftX = -78; targetLeftY = 4; targetLeftScale = 0.86; targetLeftOpacity = 1;
      targetRightX = 78; targetRightY = 4; targetRightScale = 0.86; targetRightOpacity = 1;
    } else if (mascotState === 'watching') {
      targetLeftX = -78; targetLeftY = 2; targetLeftScale = 0.86; targetLeftOpacity = 1;
      targetRightX = 78; targetRightY = 2; targetRightScale = 0.86; targetRightOpacity = 1;
    } else if (mascotState === 'eyes-closed' || mascotState === 'peeking') {
      targetLeftX = -68; targetLeftY = 6; targetLeftScale = 0.86; targetLeftOpacity = 1;
      targetRightX = 68; targetRightY = 6; targetRightScale = 0.86; targetRightOpacity = 1;
    } else if (mascotState === 'sleeping') {
      targetLeftX = -68; targetLeftY = 6; targetLeftScale = 0.86; targetLeftOpacity = 1;
      targetRightX = 46; targetRightY = 4; targetRightScale = 0.76; targetRightOpacity = 0.9;
    }

    Animated.parallel([
      Animated.spring(leftX, { toValue: targetLeftX, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.spring(leftY, { toValue: targetLeftY, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.spring(leftScale, { toValue: targetLeftScale, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(leftOpacity, { toValue: targetLeftOpacity, duration: 300, useNativeDriver: true }),

      Animated.spring(rightX, { toValue: targetRightX, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.spring(rightY, { toValue: targetRightY, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.spring(rightScale, { toValue: targetRightScale, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(rightOpacity, { toValue: targetRightOpacity, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [mascotState]);

  const breatheScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const breatheTranslateY = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const getPupilOffset = (maxOffset = 5) => {
    return {
      x: mousePos.x * maxOffset,
      y: mousePos.y * maxOffset,
    };
  };

  const pupilOff = getPupilOffset(6);

  return (
    <View style={styles.container}>
      <View style={styles.anchor}>

        {/* LEFT MASCOT CHARACTER (Body & Head behind logo - zIndex 10) */}
        <Animated.View
          style={[
            styles.mascotWrapper,
            {
              opacity: leftOpacity,
              transform: [
                { translateX: leftX },
                { translateY: leftY },
                { scale: Animated.multiply(leftScale, breatheScale) },
                { translateY: breatheTranslateY },
              ],
            },
          ]}
        >
          <Svg viewBox="0 0 100 100" style={styles.svg}>
            <Defs>
              <RadialGradient id="faceGradLeft" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                <Stop offset="0%" stopColor="#ffe4d6" />
                <Stop offset="80%" stopColor="#ffc7a7" />
                <Stop offset="100%" stopColor="#e5a882" />
              </RadialGradient>
              <LinearGradient id="helmetGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#2c2f40" />
                <Stop offset="50%" stopColor="#1a1c29" />
                <Stop offset="100%" stopColor="#0d0e15" />
              </LinearGradient>
            </Defs>

            {/* Helmet */}
            <Path d="M 10 30 C 10 10, 80 10, 90 40 C 95 60, 80 90, 50 90 C 20 90, 10 70, 10 30 Z" fill="url(#helmetGradLeft)" />
            {/* Face */}
            <Circle cx="55" cy="55" r="28" fill="url(#faceGradLeft)" />
            {/* Visor */}
            <Path d="M 32 30 C 40 15, 80 20, 85 45 C 80 30, 45 25, 32 30 Z" fill="#13151f" />

            {/* Sleeping Zzz */}
            {mascotState === 'sleeping' && (
              <G>
                <SvgText x="50" y="20" fill="#F59E0B" fontSize="12" fontWeight="bold">z</SvgText>
                <SvgText x="58" y="14" fill="#F59E0B" fontSize="10" fontWeight="bold">Z</SvgText>
              </G>
            )}

            {/* Eye Expressions */}
            {mascotState === 'success' && (
              <G>
                <Path d="M 40 55 Q 45 47 50 55" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 64 55 Q 69 47 74 55" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 54 62 Q 57 66 60 62" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {mascotState === 'error' && (
              <G>
                <Path d="M 42 49 L 48 55 M 48 49 L 42 55" fill="none" stroke="#2a1a10" strokeWidth="2.5" strokeLinecap="round" />
                <Path d="M 66 49 L 72 55 M 72 49 L 66 55" fill="none" stroke="#2a1a10" strokeWidth="2.5" strokeLinecap="round" />
                <Path d="M 54 66 Q 57 62 60 66" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {(mascotState === 'eyes-closed' || mascotState === 'sleeping') && (
              <G>
                <Path d="M 38 54 Q 45 60 52 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 64 54 Q 71 60 78 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 54 66 Q 57 68 60 66" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {mascotState === 'peeking' && (
              <G>
                <Path d="M 38 54 Q 45 60 52 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <G transform={`translate(${pupilOff.x}, ${pupilOff.y})`}>
                  <Ellipse cx="71" cy="53" rx="7.5" ry="11" fill="#1a1a1a" />
                  <Circle cx="69" cy="48" r="3.5" fill="#ffffff" />
                  <Circle cx="73" cy="57" r="1.5" fill="#ffffff" />
                </G>
                <Path d="M 65 39 Q 71 36 77 42" fill="none" stroke="#2a1a10" strokeWidth="2.5" strokeLinecap="round" />
                <Path d="M 52 65 Q 57 66 61 62" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {mascotState === 'watching' && (
              <G>
                <G transform={`translate(${pupilOff.x}, ${pupilOff.y})`}>
                  <Ellipse cx="45" cy="53" rx="7" ry="10" fill="#1a1a1a" />
                  <Circle cx="43" cy="49" r="3" fill="#ffffff" />
                  <Circle cx="47" cy="57" r="1.5" fill="#ffffff" />
                </G>
                <G transform={`translate(${pupilOff.x}, ${pupilOff.y})`}>
                  <Ellipse cx="69" cy="53" rx="7" ry="10" fill="#1a1a1a" />
                  <Circle cx="67" cy="49" r="3" fill="#ffffff" />
                  <Circle cx="71" cy="57" r="1.5" fill="#ffffff" />
                </G>
                <Path d="M 55 65 Q 57 67 59 65" fill="none" stroke="#8a5a44" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {/* Blush */}
            <Circle cx="36" cy="62" r="4" fill="#ff7b7b" opacity={0.4} />
            <Circle cx="78" cy="62" r="4" fill="#ff7b7b" opacity={0.4} />
          </Svg>
        </Animated.View>

        {/* RIGHT MASCOT CHARACTER (Body & Head behind logo - zIndex 10) */}
        <Animated.View
          style={[
            styles.mascotWrapper,
            {
              opacity: rightOpacity,
              transform: [
                { translateX: rightX },
                { translateY: rightY },
                { scale: Animated.multiply(rightScale, breatheScale) },
                { translateY: breatheTranslateY },
              ],
            },
          ]}
        >
          <Svg viewBox="0 0 100 100" style={styles.svg}>
            <Defs>
              <LinearGradient id="stealthHelmetRight" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#5b21b6" />
                <Stop offset="50%" stopColor="#3b0764" />
                <Stop offset="100%" stopColor="#1e0a3b" />
              </LinearGradient>
            </Defs>

            {/* Helmet */}
            <Path d="M 90 30 C 90 10, 20 10, 10 40 C 5 60, 20 90, 50 90 C 80 90, 90 70, 90 30 Z" fill="url(#stealthHelmetRight)" />
            {/* Face */}
            <Circle cx="45" cy="55" r="28" fill="url(#faceGradLeft)" />
            {/* Visor */}
            <Path d="M 68 30 C 60 15, 20 20, 15 45 C 20 30, 55 25, 68 30 Z" fill="#1e1b4b" />

            {/* Eye Expressions */}
            {mascotState === 'success' && (
              <G>
                <Path d="M 29 55 Q 34 47 39 55" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 51 55 Q 56 47 61 55" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 41 62 Q 44 66 47 62" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {mascotState === 'error' && (
              <G>
                <Path d="M 31 49 L 37 55 M 37 49 L 31 55" fill="none" stroke="#2a1a10" strokeWidth="2.5" strokeLinecap="round" />
                <Path d="M 53 49 L 59 55 M 59 49 L 53 55" fill="none" stroke="#2a1a10" strokeWidth="2.5" strokeLinecap="round" />
                <Path d="M 41 66 Q 44 62 47 66" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {(mascotState === 'eyes-closed' || mascotState === 'sleeping') && (
              <G>
                <Path d="M 27 54 Q 34 60 41 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 49 54 Q 56 60 63 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 41 66 Q 44 68 47 66" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {mascotState === 'peeking' && (
              <G>
                <Path d="M 27 54 Q 34 60 41 54" fill="none" stroke="#2a1a10" strokeWidth="3" strokeLinecap="round" />
                <Path d="M 45 65 Q 49 66 53 62" fill="none" stroke="#a36e52" strokeWidth="1.5" strokeLinecap="round" />

                {/* Peeking Camera Lens */}
                <G transform="translate(45, 43)">
                  <Rect x="0" y="0" width="30" height="20" rx="3" fill="#3f3f46" stroke="#18181b" strokeWidth="1.5" />
                  <Circle cx="15" cy="10" r="7" fill="#09090b" />
                  <G transform={`translate(${pupilOff.x * 0.3}, ${pupilOff.y * 0.3})`}>
                    <Circle cx="15" cy="10" r="5" fill="#22d3ee" opacity={0.5} />
                    <Circle cx="13" cy="8" r="2" fill="#ffffff" opacity={0.8} />
                  </G>
                  <Rect x="2" y="-3" width="8" height="4" rx="1" fill="#ef4444" />
                  <Circle cx="22" cy="4" r="2.5" fill="#fef08a" />
                </G>
              </G>
            )}

            {mascotState === 'watching' && (
              <G>
                <G transform={`translate(${pupilOff.x}, ${pupilOff.y})`}>
                  <Ellipse cx="34" cy="53" rx="7" ry="10" fill="#1a1a1a" />
                  <Circle cx="32" cy="49" r="3" fill="#ffffff" />
                </G>
                <G transform={`translate(${pupilOff.x}, ${pupilOff.y})`}>
                  <Ellipse cx="56" cy="53" rx="7" ry="10" fill="#1a1a1a" />
                  <Circle cx="54" cy="49" r="3" fill="#ffffff" />
                </G>
                <Path d="M 41 65 Q 44 67 47 65" fill="none" stroke="#8a5a44" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            )}

            {/* Blush */}
            <Circle cx="28" cy="62" r="4" fill="#ff7b7b" opacity={0.4} />
            <Circle cx="62" cy="62" r="4" fill="#ff7b7b" opacity={0.4} />
          </Svg>
        </Animated.View>

        {/* CENTER LOGO SLOT (Foreground zIndex 20 so character bodies stay behind it) */}
        <View style={styles.centerSlot}>{children}</View>

        {/* LEFT HAND (Holding Left Edge of Logo - zIndex 30) */}
        <Animated.View
          style={[
            styles.handWrapper,
            {
              left: 2,
              opacity: leftOpacity,
              transform: [
                { translateX: Animated.multiply(leftX, 0.4) },
                { translateY: Animated.add(leftY, 14) },
                { scale: leftScale },
              ],
            },
          ]}
        >
          <Svg width={26} height={34} viewBox="0 0 26 34">
            <G>
              <Path d="M 4 6 C 14 4, 24 10, 22 18 C 20 26, 10 24, 4 20 Z" fill="#ffc7a7" stroke="#8a5a44" strokeWidth="1.8" />
              <Path d="M 2 16 C 12 14, 22 20, 20 28 C 18 34, 8 32, 2 26 Z" fill="#e5a882" stroke="#8a5a44" strokeWidth="1.8" />
            </G>
          </Svg>
        </Animated.View>

        {/* RIGHT HAND (Holding Right Edge of Logo - zIndex 30) */}
        <Animated.View
          style={[
            styles.handWrapper,
            {
              right: 2,
              opacity: rightOpacity,
              transform: [
                { translateX: Animated.multiply(rightX, 0.4) },
                { translateY: Animated.add(rightY, 14) },
                { scale: rightScale },
              ],
            },
          ]}
        >
          <Svg width={26} height={34} viewBox="0 0 26 34">
            <G>
              <Path d="M 22 6 C 12 4, 2 10, 4 18 C 6 26, 16 24, 22 20 Z" fill="#ffc7a7" stroke="#8a5a44" strokeWidth="1.8" />
              <Path d="M 24 16 C 14 14, 4 20, 6 28 C 8 34, 18 32, 24 26 Z" fill="#e5a882" stroke="#8a5a44" strokeWidth="1.8" />
            </G>
          </Svg>
        </Animated.View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 160,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 10,
  },
  anchor: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mascotWrapper: {
    position: 'absolute',
    width: 104,
    height: 104,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  handWrapper: {
    position: 'absolute',
    width: 26,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  centerSlot: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
});
