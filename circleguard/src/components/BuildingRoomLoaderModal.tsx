import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';
import { BUILDING_ROOM_STEPS, BuildingStep } from './buildingRoom/buildingSvgs';

export interface BuildingRoomLoaderModalProps {
  visible: boolean;
  circleName?: string;
  trackingMode?: 'continuous' | 'privacy';
}

function transformSvgForTheme(rawSvg: string, isDark: boolean): string {
  if (isDark) {
    return rawSvg
      // Outlines -> crisp white
      .replace(/stroke="#050505"|stroke="#070707"/g, 'stroke="#F8FAFC"')
      // Secondary divider strokes -> amber gold glow
      .replace(/stroke="#d7d6d6"|stroke="#a8a8a8"|stroke="#b9b9b9"/g, 'stroke="rgba(245, 158, 11, 0.55)"')
      // White body fills -> deep luxury slate
      .replace(/fill="#ffffff"/g, 'fill="#1E2023"')
      // Black small fills -> crisp white
      .replace(/fill="#050505"|fill="#070707"/g, 'fill="#F8FAFC"')
      // Grays / shading -> luxury amber gold tint
      .replace(/fill="#(b[0-9a-f]{5}|c[0-9a-f]{5}|d[0-9a-f]{5}|e[0-9a-f]{5}|a[0-9a-f]{5}|999999|484848)"/gi, 'fill="rgba(245, 158, 11, 0.28)"');
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
  circleName = 'New Circle',
  trackingMode = 'continuous',
}: BuildingRoomLoaderModalProps) {
  const { colors, isDark } = useThemeStore();
  const [stepIndex, setStepIndex] = useState(0);

  // Animations
  const iconOpacity = useSharedValue(1);
  const iconScale = useSharedValue(1);
  const auraPulse = useSharedValue(1);
  const progressBarWidth = useSharedValue(0);

  const totalSteps = BUILDING_ROOM_STEPS.length;
  const currentStep: BuildingStep = BUILDING_ROOM_STEPS[stepIndex % totalSteps] || BUILDING_ROOM_STEPS[0];

  // Reset & start 1-second interval loop when visible
  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      progressBarWidth.value = 0;
      return;
    }

    setStepIndex(0);
    progressBarWidth.value = withTiming(1, { duration: 12000, easing: Easing.linear });

    // Breathing halo aura
    auraPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Switch icon every 1000ms (1 second) as requested!
    const timer = setInterval(() => {
      // Step transition animation
      iconOpacity.value = 0.25;
      iconScale.value = 0.88;

      setStepIndex((prev) => (prev + 1) % totalSteps);

      iconOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      iconScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.5)) });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, totalSteps]);

  // Memoize themed SVG content
  const themedSvg = useMemo(() => {
    return transformSvgForTheme(currentStep.rawSvg, isDark);
  }, [currentStep.rawSvg, isDark]);

  // Animated styles
  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const animatedAuraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraPulse.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(12, progressBarWidth.value * 100))}%`,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent={true}>
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: isDark ? 'rgba(7, 10, 15, 0.94)' : 'rgba(15, 23, 42, 0.75)' },
        ]}
      >
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? '#11151C' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            },
          ]}
        >
          {/* Header Status Pill */}
          <View style={styles.topHeader}>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A' }]}>
              <View style={styles.pulseDot} />
              <Text style={[styles.statusBadgeText, { color: isDark ? '#F59E0B' : '#B45309' }]}>
                BUILDING CIRCLE ROOM
              </Text>
            </View>

            <Text style={[styles.circleNameTitle, { color: colors.foreground }]} numberOfLines={1}>
              {circleName}
            </Text>
            <Text style={[styles.circleSubText, { color: colors.textMuted }]}>
              {trackingMode === 'continuous' ? 'Continuous 24/7 Safety Vault' : 'Privacy-First Safety Space'}
            </Text>
          </View>

          {/* Architectural SVG Stage */}
          <View style={styles.stageWrapper}>
            {/* Outer Breathing Aura */}
            <Animated.View
              style={[
                styles.auraRing,
                {
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(15, 23, 42, 0.08)',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.04)' : '#F8FAFC',
                },
                animatedAuraStyle,
              ]}
            />

            {/* Stage Frame */}
            <View
              style={[
                styles.stageFrame,
                {
                  backgroundColor: isDark ? '#181E27' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#CBD5E1',
                },
              ]}
            >
              <Animated.View style={[styles.svgWrapper, animatedIconStyle]}>
                <SvgXml xml={themedSvg} width={135} height={135} />
              </Animated.View>
            </View>
          </View>

          {/* Step Progress & Descriptions */}
          <View style={styles.stepInfoContainer}>
            <View style={styles.stepMetaRow}>
              <View style={[styles.stepCountPill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9', borderColor: colors.border }]}>
                <Text style={[styles.stepCountText, { color: colors.textMuted }]}>
                  STEP {((stepIndex % totalSteps) + 1)} OF {totalSteps}
                </Text>
              </View>
              <View style={styles.liveClockRow}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.liveClockText, { color: colors.textMuted }]}>1s cycle</Text>
              </View>
            </View>

            <Text style={[styles.stepTitle, { color: colors.foreground }]} numberOfLines={1}>
              {currentStep.title}
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {currentStep.description}
            </Text>

            {/* Smooth Progress Track */}
            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { backgroundColor: isDark ? '#F59E0B' : '#0F172A' },
                  animatedProgressStyle,
                ]}
              />
            </View>
          </View>

          {/* Bottom Security Telemetry Tag */}
          <View style={[styles.bottomTelemetry, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
            <Ionicons name="shield-checkmark" size={13} color="#10B981" />
            <Text style={[styles.bottomTelemetryText, { color: colors.textMuted }]}>
              End-to-End Encryption & Perimeter Safe
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 40, 360);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: CARD_WIDTH,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  topHeader: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  circleNameTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  circleSubText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  stageWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 6,
  },
  auraRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
  },
  stageFrame: {
    width: 154,
    height: 154,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  svgWrapper: {
    width: 135,
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInfoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  stepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  stepCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stepCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liveClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveClockText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  stepDesc: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    minHeight: 32,
    paddingHorizontal: 8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  bottomTelemetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  bottomTelemetryText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
