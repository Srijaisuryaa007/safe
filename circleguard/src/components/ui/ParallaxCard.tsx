import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
  Vibration,
} from 'react-native';
import { Gyroscope } from 'expo-sensors';

export interface ParallaxCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  depthMultiplier?: number;
  maxTiltAngle?: number;
  enableGlare?: boolean;
  enableIdleFloat?: boolean;
  enableGyroscope?: boolean;
  onPress?: () => void;
  renderBackgroundLayer?: (animated: {
    shiftX: Animated.AnimatedInterpolation<string | number>;
    shiftY: Animated.AnimatedInterpolation<string | number>;
  }) => React.ReactNode;
  renderForegroundLayer?: (animated: {
    shiftX: Animated.AnimatedInterpolation<string | number>;
    shiftY: Animated.AnimatedInterpolation<string | number>;
  }) => React.ReactNode;
}

/**
 * ParallaxCard - React Bits Pro Parallax Card component adapted natively for React Native & Expo Mobile.
 * 
 * Supports:
 * - Multi-layer depth parallax (Background, Middle content, Foreground high-relief elements)
 * - 3D Perspective Tilt Rotation (rotateX, rotateY, scale lift)
 * - Immediate Touch & Drag Tilt Tracking with tactile haptic response
 * - Physical Device Gyroscope Tilt Tracking (tilt phone -> shifts card in 3D)
 * - Ambient 3D floating rotation wave (visibly alive even when idle)
 * - Dynamic Specular Glare/Reflection sweep
 * - Desktop Mouse hover tracking on web
 */
export const ParallaxCard: React.FC<ParallaxCardProps> = ({
  children,
  style,
  contentContainerStyle,
  depthMultiplier = 1.0,
  maxTiltAngle = 14,
  enableGlare = true,
  enableIdleFloat = true,
  enableGyroscope = true,
  onPress,
  renderBackgroundLayer,
  renderForegroundLayer,
}) => {
  // Animated values for normalized tilt (-1 to 1)
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const idleAnim = useRef(new Animated.Value(0)).current;

  // Track if user is actively touching
  const isInteractingRef = useRef(false);
  const touchStartTimeRef = useRef(0);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  // Track card layout for touch & web mouse calculations
  const cardLayoutRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 280,
    height: 180,
  });

  // Ambient floating idle wave: subtle 3D breathing rotation & translation
  useEffect(() => {
    if (!enableIdleFloat) return;

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleAnim, {
          toValue: 1,
          duration: 3400,
          useNativeDriver: true,
        }),
        Animated.timing(idleAnim, {
          toValue: -1,
          duration: 3400,
          useNativeDriver: true,
        }),
        Animated.timing(idleAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    return () => floatLoop.stop();
  }, [enableIdleFloat]);

  // Physical Gyroscope Sensor (tilting mobile phone shifts parallax cards)
  useEffect(() => {
    if (!enableGyroscope || Platform.OS === 'web') return;

    let subscription: any = null;
    let isSubscribed = true;

    (async () => {
      try {
        const available = await Gyroscope.isAvailableAsync();
        if (!available || !isSubscribed) return;

        Gyroscope.setUpdateInterval(60);
        subscription = Gyroscope.addListener(({ x, y }) => {
          if (isInteractingRef.current) return; // Don't fight active finger touches

          // Gentle low-pass dampening for natural feel
          const targetX = Math.max(-1, Math.min(1, (y * 0.45) * depthMultiplier));
          const targetY = Math.max(-1, Math.min(1, (-x * 0.45) * depthMultiplier));

          Animated.parallel([
            Animated.timing(panX, {
              toValue: targetX,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(panY, {
              toValue: targetY,
              duration: 80,
              useNativeDriver: true,
            }),
          ]).start();
        });
      } catch (_) {}
    })();

    return () => {
      isSubscribed = false;
      if (subscription) {
        try { subscription.remove(); } catch (_) {}
      }
    };
  }, [enableGyroscope, depthMultiplier]);

  // Spring release to rest
  const snapToCenter = () => {
    isInteractingRef.current = false;
    Animated.parallel([
      Animated.spring(panX, {
        toValue: 0,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.spring(panY, {
        toValue: 0,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Direct Touch Tracking for Mobile
  const handleTouchStart = (e: GestureResponderEvent) => {
    isInteractingRef.current = true;
    touchStartTimeRef.current = Date.now();
    const { locationX, locationY } = e.nativeEvent;
    touchStartPosRef.current = { x: locationX, y: locationY };

    const { width, height } = cardLayoutRef.current;
    if (width > 0 && height > 0) {
      const normX = ((locationX / width) * 2 - 1) * depthMultiplier;
      const normY = ((locationY / height) * 2 - 1) * depthMultiplier;

      Animated.parallel([
        Animated.spring(panX, {
          toValue: Math.max(-1, Math.min(1, normX)),
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.spring(panY, {
          toValue: Math.max(-1, Math.min(1, normY)),
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.035,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!isInteractingRef.current) return;
    const { locationX, locationY } = e.nativeEvent;
    const { width, height } = cardLayoutRef.current;
    if (width > 0 && height > 0) {
      const normX = ((locationX / width) * 2 - 1) * depthMultiplier;
      const normY = ((locationY / height) * 2 - 1) * depthMultiplier;

      panX.setValue(Math.max(-1, Math.min(1, normX)));
      panY.setValue(Math.max(-1, Math.min(1, normY)));
    }
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    const timeDelta = Date.now() - touchStartTimeRef.current;
    const { locationX, locationY } = e.nativeEvent;
    const moveDist = Math.hypot(
      locationX - touchStartPosRef.current.x,
      locationY - touchStartPosRef.current.y
    );

    snapToCenter();

    // If it was a quick tap (< 350ms and moved < 15px), trigger onPress
    if (timeDelta < 350 && moveDist < 15 && onPress) {
      if (Platform.OS !== 'web') {
        try { Vibration.vibrate(10); } catch (_) {}
      }
      onPress();
    }
  };

  // Web mouse cursor event handlers for desktop
  const webMouseHandlers =
    Platform.OS === 'web'
      ? {
          onMouseMove: (e: any) => {
            const rect = e.currentTarget?.getBoundingClientRect?.();
            if (!rect) return;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const normX = ((mouseX / rect.width) * 2 - 1) * depthMultiplier;
            const normY = ((mouseY / rect.height) * 2 - 1) * depthMultiplier;

            Animated.parallel([
              Animated.spring(panX, {
                toValue: Math.max(-1, Math.min(1, normX)),
                friction: 8,
                tension: 60,
                useNativeDriver: true,
              }),
              Animated.spring(panY, {
                toValue: Math.max(-1, Math.min(1, normY)),
                friction: 8,
                tension: 60,
                useNativeDriver: true,
              }),
              Animated.spring(scale, {
                toValue: 1.035,
                friction: 8,
                tension: 60,
                useNativeDriver: true,
              }),
            ]).start();
          },
          onMouseLeave: () => {
            snapToCenter();
          },
        }
      : {};

  // Ambient wave rotations
  const ambientRotateX = idleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-2.5deg', '0deg', '2.5deg'],
  });

  const ambientRotateY = idleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['2.5deg', '0deg', '-2.5deg'],
  });

  const ambientTranslateY = idleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-4, 0, 4],
  });

  // Interpolate 3D rotations from pan
  const rotateY = panX.interpolate({
    inputRange: [-1, 1],
    outputRange: [`${-maxTiltAngle}deg`, `${maxTiltAngle}deg`],
  });

  const rotateX = panY.interpolate({
    inputRange: [-1, 1],
    outputRange: [`${maxTiltAngle}deg`, `${-maxTiltAngle}deg`],
  });

  // Layer 0: Background Deep Shift (moves slightly opposite for depth illusion)
  const bgShiftX = panX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-12 * depthMultiplier, 12 * depthMultiplier],
  });
  const bgShiftY = panY.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10 * depthMultiplier, 10 * depthMultiplier],
  });

  // Layer 1: Midground Content Shift
  const midShiftX = panX.interpolate({
    inputRange: [-1, 1],
    outputRange: [6 * depthMultiplier, -6 * depthMultiplier],
  });
  const midShiftY = panY.interpolate({
    inputRange: [-1, 1],
    outputRange: [5 * depthMultiplier, -5 * depthMultiplier],
  });

  // Layer 2: Foreground Extreme Lift (Avatars, floating badges, buttons)
  const fgShiftX = panX.interpolate({
    inputRange: [-1, 1],
    outputRange: [16 * depthMultiplier, -16 * depthMultiplier],
  });
  const fgShiftY = panY.interpolate({
    inputRange: [-1, 1],
    outputRange: [14 * depthMultiplier, -14 * depthMultiplier],
  });

  // Specular Glare translation (sweeps across card)
  const glareTranslateX = panX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-140, 140],
  });
  const glareOpacity = panX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.26, 0.08, 0.26],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          transform: [
            { perspective: 900 },
            { rotateX },
            { rotateY },
            { translateY: ambientTranslateY },
            { scale },
          ],
        },
      ]}
      onLayout={(e) => {
        cardLayoutRef.current = e.nativeEvent.layout;
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={snapToCenter}
      {...(webMouseHandlers as any)}
    >
      {/* Layer 0: Deep Background (Holographic grids, radar lines, aura) */}
      {renderBackgroundLayer && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.layerBackground,
            {
              transform: [{ translateX: bgShiftX }, { translateY: bgShiftY }],
            },
          ]}
        >
          {renderBackgroundLayer({ shiftX: bgShiftX, shiftY: bgShiftY })}
        </Animated.View>
      )}

      {/* Layer 1: Midground Core Content */}
      <Animated.View
        style={[
          styles.layerContent,
          contentContainerStyle,
          {
            transform: [{ translateX: midShiftX }, { translateY: midShiftY }],
          },
        ]}
      >
        {children}
      </Animated.View>

      {/* Layer 2: Foreground High-Relief Float */}
      {renderForegroundLayer && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            styles.layerForeground,
            {
              transform: [{ translateX: fgShiftX }, { translateY: fgShiftY }],
            },
          ]}
        >
          {renderForegroundLayer({ shiftX: fgShiftX, shiftY: fgShiftY })}
        </Animated.View>
      )}

      {/* Layer 3: Dynamic Specular Glare / Glass Sheen Overlay */}
      {enableGlare && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.specularGlare,
            {
              opacity: glareOpacity,
              transform: [
                { translateX: glareTranslateX },
                { rotate: '32deg' },
              ],
            },
          ]}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
  },
  layerBackground: {
    zIndex: 0,
  },
  layerContent: {
    zIndex: 1,
    position: 'relative',
  },
  layerForeground: {
    zIndex: 2,
  },
  specularGlare: {
    position: 'absolute',
    top: -150,
    bottom: -150,
    width: 100,
    backgroundColor: '#FFFFFF',
    opacity: 0.15,
    zIndex: 3,
  },
});

export default ParallaxCard;
