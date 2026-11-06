import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';
import { BUILDING_ROOM_STEPS, BuildingStep } from './buildingRoom/buildingSvgs';

export interface BuildingRoomLoaderModalProps {
  visible: boolean;
  circleName?: string;
  trackingMode?: 'continuous' | 'privacy';
  size?: number;
}

function transformSvgForTheme(rawSvg: string, isDark: boolean): string {
  if (isDark) {
    return rawSvg
      // Outlines -> crisp white
      .replace(/stroke="#050505"|stroke="#070707"/g, 'stroke="#F8FAFC"')
      // Secondary divider strokes -> subtle amber gold glow
      .replace(/stroke="#d7d6d6"|stroke="#a8a8a8"|stroke="#b9b9b9"/g, 'stroke="rgba(245, 158, 11, 0.45)"')
      // White body fills -> deep luxury slate
      .replace(/fill="#ffffff"/g, 'fill="#1E2023"')
      // Black small fills -> crisp white
      .replace(/fill="#050505"|fill="#070707"/g, 'fill="#F8FAFC"')
      // Grays / shading -> luxury amber gold tint
      .replace(/fill="#(b[0-9a-f]{5}|c[0-9a-f]{5}|d[0-9a-f]{5}|e[0-9a-f]{5}|a[0-9a-f]{5}|999999|484848)"/gi, 'fill="rgba(245, 158, 11, 0.22)"');
  } else {
    return rawSvg
      // Outlines -> deep slate ink
      .replace(/stroke="#050505"|stroke="#070707"/g, 'stroke="#0F172A"')
      // Secondary divider strokes -> muted slate
      .replace(/stroke="#d7d6d6"|stroke="#a8a8a8"|stroke="#b9b9b9"/g, 'stroke="#94A3B8"')
      // White body fills -> clean white
      .replace(/fill="#ffffff"/g, 'fill="#FFFFFF"')
      // Black small fills -> deep slate
      .replace(/fill="#050505"|fill="#070707"/g, 'fill="#0F172A"')
      // Grays / shading -> soft slate tint
      .replace(/fill="#(b[0-9a-f]{5}|c[0-9a-f]{5}|d[0-9a-f]{5}|e[0-9a-f]{5}|a[0-9a-f]{5}|999999|484848)"/gi, 'fill="#E2E8F0"');
  }
}

export default function BuildingRoomLoaderModal({
  visible,
  size = 58,
}: BuildingRoomLoaderModalProps) {
  const { isDark } = useThemeStore();
  const [stepIndex, setStepIndex] = useState(0);

  // Pure, smooth crossfade opacity (strictly no jumping scale, no bouncing)
  const iconOpacity = useSharedValue(1);

  const totalSteps = BUILDING_ROOM_STEPS.length;
  const currentStep: BuildingStep = BUILDING_ROOM_STEPS[stepIndex % totalSteps] || BUILDING_ROOM_STEPS[0];

  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      iconOpacity.value = 1;
      return;
    }

    setStepIndex(0);
    iconOpacity.value = 1;

    // Switch icon every 1000ms (1 second) with a calm, seamless crossfade
    const timer = setInterval(() => {
      iconOpacity.value = withTiming(0.2, { duration: 180, easing: Easing.out(Easing.ease) }, (finished) => {
        if (finished) {
          iconOpacity.value = withTiming(1, { duration: 260, easing: Easing.in(Easing.ease) });
        }
      });
      setStepIndex((prev) => (prev + 1) % totalSteps);
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, totalSteps]);

  // Memoize themed SVG content
  const themedSvg = useMemo(() => {
    return transformSvgForTheme(currentStep.rawSvg, isDark);
  }, [currentStep.rawSvg, isDark]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent={true}>
      <View style={styles.modalOverlay}>
        {/* Frosted Glassmorphism Backdrop Blur */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 35 : 24}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(7, 10, 15, 0.62)'
                : 'rgba(15, 23, 42, 0.28)',
            },
          ]}
        />

        {/* Floating Luxury Glass HUD Pod */}
        <View
          style={[
            styles.hudPod,
            {
              backgroundColor: isDark ? 'rgba(18, 24, 35, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
            },
          ]}
        >
          {/* Architectural Vector Icon cycling every 1s */}
          <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
            <SvgXml xml={themedSvg} width={size} height={size} />
          </Animated.View>

          {/* Clean Micro Caption */}
          <Text
            style={[
              styles.captionText,
              { color: isDark ? '#CBD5E1' : '#334155' },
            ]}
          >
            Building room...
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  hudPod: {
    width: 132,
    height: 124,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 12,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
