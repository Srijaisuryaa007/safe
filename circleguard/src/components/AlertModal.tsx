import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

const SANS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'sos' | 'place' | 'info';
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

function cleanText(str: string): string {
  if (!str) return '';
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu,
      ''
    )
    .trim();
}

export default function AlertModal({
  visible,
  title,
  message,
  type,
  onClose,
  onAction,
  actionLabel,
}: AlertModalProps) {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isSOS = type === 'sos' && (title.includes('SOS') || title.includes('DISTRESS') || title.includes('CRITICAL'));
  const isExitBreach = title.includes('EXIT') || title.includes('BREACH') || title.includes('Depart') || message.includes('exited') || message.includes('departed');
  const isEntry = title.includes('ENTRY') || title.includes('ARRIV') || title.includes('Arriv') || message.includes('entered') || message.includes('re-entered') || message.includes('arrived');

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web' && (isSOS || isExitBreach)) {
        Vibration.vibrate(isSOS ? [300, 200, 300] : [150, 100, 150]);
      }

      slideAnim.setValue(300);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isSOS, isExitBreach]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  // Authentic Status Configuration
  let themeColor = isDark ? '#FFFFFF' : '#0F172A';
  let badgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
  let iconName: any = 'shield-checkmark-outline';
  let statusBadgeLabel = 'SAFE ZONE ALERT';

  if (isSOS) {
    themeColor = '#EF4444';
    badgeBg = isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2';
    iconName = 'alert-circle';
    statusBadgeLabel = 'CRITICAL EMERGENCY DISTRESS';
  } else if (isExitBreach) {
    themeColor = '#D97706';
    badgeBg = isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
    iconName = 'navigate-outline';
    statusBadgeLabel = 'SAFE ZONE DEPARTURE';
  } else if (isEntry) {
    themeColor = isDark ? '#FFFFFF' : '#0F172A';
    badgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
    iconName = 'location-outline';
    statusBadgeLabel = 'SAFE ZONE ARRIVAL';
  }

  const cleanTitle = cleanText(title) || (isExitBreach ? 'Safe Zone Departure' : isEntry ? 'Safe Zone Arrival' : 'Emergency Notice');
  const cleanMsg = cleanText(message);

  return (
    <Modal transparent={true} visible={visible} animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleDismiss} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetCard,
            {
              backgroundColor: isDark ? '#11141A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {/* Pill Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1' }]} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.iconSquircle, { backgroundColor: badgeBg }]}>
              <Ionicons name={iconName} size={24} color={themeColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusPill, { backgroundColor: badgeBg }]}>
                <View style={[styles.statusDot, { backgroundColor: themeColor }]} />
                <Text style={[styles.statusPillText, { color: themeColor }]}>
                  {statusBadgeLabel}
                </Text>
              </View>
              <Text style={[styles.titleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={2}>
                {cleanTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={[styles.closeCircleBtn, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Ionicons name="close" size={17} color={isDark ? '#FFFFFF' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Details Card */}
          <View
            style={[
              styles.messageBox,
              isSOS
                ? {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FECACA',
                  }
                : {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isSOS
                  ? { color: isDark ? '#FCA5A5' : '#991B1B' }
                  : { color: isDark ? '#CBD5E1' : '#475569' },
              ]}
            >
              {cleanMsg}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            {onAction && (
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  {
                    backgroundColor: isSOS ? '#DC2626' : (isDark ? '#FFFFFF' : '#0F172A'),
                  },
                ]}
                onPress={onAction}
                activeOpacity={0.84}
              >
                <Ionicons name="map-outline" size={18} color={isSOS ? '#FFFFFF' : (isDark ? '#000000' : '#FFFFFF')} />
                <Text style={[styles.primaryActionBtnText, !isSOS && { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  {actionLabel || 'VIEW LIVE ON MAP'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryActionBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {isSOS ? 'ACKNOWLEDGE DISTRESS SIGNAL' : onAction ? 'DISMISS' : 'GOT IT'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 999999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    fontFamily: SANS_FONT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  messageText: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  primaryActionBtn: {
    width: '100%',
    height: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  secondaryActionBtn: {
    width: '100%',
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
