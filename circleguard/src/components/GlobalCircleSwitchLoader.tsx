import React from 'react';
import { View, StyleSheet, Modal, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import CircleGuardGlobeLoader from './CircleGuardGlobeLoader';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';

export default function GlobalCircleSwitchLoader() {
  const { isSwitchingCircle, switchingTargetName, switchingStepText } = useCircleStore();
  const { isDark } = useThemeStore();

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

        <MotiView
          from={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            damping: 18,
            stiffness: 140,
          }}
          style={styles.cardContainer}
        >
          <CircleGuardGlobeLoader
            size={160}
            loadingLabel={switchingTargetName ? `SWITCHING TO ${switchingTargetName.toUpperCase()}...` : 'SWITCHING SAFETY CIRCLE...'}
            subLabel={switchingStepText || 'Synchronizing members & live telemetry'}
            fullscreen={false}
          />
        </MotiView>
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
