import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface RadarPulseBeaconProps {
  size?: number;
  color?: string;
  isPulsing?: boolean;
  children?: React.ReactNode;
}

/**
 * RadarPulseBeacon - Apple Find My precision location ripple indicator
 * 
 * Provides smooth, 60fps hardware-accelerated concentric waves radiating outward
 * from a member's avatar to signify live GPS connectivity.
 */
export default function RadarPulseBeacon({
  size = 48,
  color = '#30D158',
  isPulsing = true,
  children,
}: RadarPulseBeaconProps) {
  const wave1Scale = useSharedValue(1);
  const wave1Opacity = useSharedValue(0.6);

  const wave2Scale = useSharedValue(1);
  const wave2Opacity = useSharedValue(0.6);

  useEffect(() => {
    if (!isPulsing) {
      wave1Scale.value = 1;
      wave1Opacity.value = 0;
      wave2Scale.value = 1;
      wave2Opacity.value = 0;
      return;
    }

    // Wave 1
    wave1Scale.value = withRepeat(
      withTiming(1.6, { duration: 2200, easing: Easing.bezier(0.2, 0, 0.4, 1) }),
      -1,
      false
    );
    wave1Opacity.value = withRepeat(
      withTiming(0, { duration: 2200, easing: Easing.bezier(0.2, 0, 0.4, 1) }),
      -1,
      false
    );

    // Wave 2 with 1100ms phase offset
    wave2Scale.value = withDelay(
      1100,
      withRepeat(
        withTiming(1.6, { duration: 2200, easing: Easing.bezier(0.2, 0, 0.4, 1) }),
        -1,
        false
      )
    );
    wave2Opacity.value = withDelay(
      1100,
      withRepeat(
        withTiming(0, { duration: 2200, easing: Easing.bezier(0.2, 0, 0.4, 1) }),
        -1,
        false
      )
    );
  }, [isPulsing]);

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave1Scale.value }],
    opacity: wave1Opacity.value,
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scale: wave2Scale.value }],
    opacity: wave2Opacity.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {isPulsing && (
        <>
          <Animated.View
            style={[
              styles.waveRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
              },
              wave1Style,
            ]}
          />
          <Animated.View
            style={[
              styles.waveRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
              },
              wave2Style,
            ]}
          />
        </>
      )}
      <View style={styles.contentWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  waveRing: {
    position: 'absolute',
  },
  contentWrap: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
