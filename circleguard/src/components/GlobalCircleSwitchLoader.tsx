import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Platform, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import CircleGuardGlobeLoader from './CircleGuardGlobeLoader';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';

export default function GlobalCircleSwitchLoader() {
  const { isSwitchingCircle, switchingTargetName, switchingStepText } = useCircleStore();
  const { isDark } = useThemeStore();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSwitchingCircle) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isSwitchingCircle]);

  if (!isSwitchingCircle) return null;

  return (
    <Modal
      visible={isSwitchingCircle}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(7, 9, 13, 0.94)' : 'rgba(248, 250, 252, 0.94)' },
            ]}
          />
        )}

        <Animated.View
          style={[styles.cardContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
        >
          <CircleGuardGlobeLoader
            size={160}
            loadingLabel={switchingTargetName ? `SWITCHING TO ${switchingTargetName.toUpperCase()}...` : 'SWITCHING SAFETY CIRCLE...'}
            subLabel={switchingStepText || 'Synchronizing members & live telemetry'}
            fullscreen={false}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cardContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
  },
});
