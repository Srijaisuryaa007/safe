import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'sos' | 'place';
  onClose: () => void;
}

/**
 * Strips out any informal emoji characters to maintain a clean, ultra-professional UI.
 */
function cleanText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, '')
    .trim();
}

export default function AlertModal({ visible, title, message, type, onClose }: AlertModalProps) {
  const { colors, isDark } = useThemeStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && type === 'sos') {
      Vibration.vibrate([500, 500, 500, 500], true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      Vibration.cancel();
    }

    return () => {
      Vibration.cancel();
      pulseAnim.stopAnimation();
    };
  }, [visible, type]);

  if (!visible) return null;

  const isSOS = type === 'sos';
  const cleanTitle = cleanText(title) || (isSOS ? 'DISTRESS SIGNAL DETECTED' : 'SAFETY BOUNDARY NOTICE');
  const cleanMsg = cleanText(message);

  const primaryColor = isSOS ? '#EF4444' : '#3B82F6';
  const accentBorder = isSOS ? '#DC2626' : '#D4AF37';

  return (
    <Modal transparent={true} visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { backgroundColor: '#12131A', borderColor: accentBorder, transform: [{ scale: pulseAnim }] }]}>
          {/* Top Gold/Red Status Accent Bar */}
          <View style={[styles.topAccentBar, { backgroundColor: accentBorder }]} />

          {/* Clean Vector Icon Container */}
          <View style={[styles.iconBadge, { backgroundColor: isSOS ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons
              name={isSOS ? 'shield-sharp' : 'bookmark-sharp'}
              size={32}
              color={primaryColor}
            />
          </View>

          {/* Professional Header & Overline */}
          <Text style={[styles.overline, { color: isSOS ? '#F87171' : '#93C5FD' }]}>
            {isSOS ? 'CRITICAL SECURITY ALERT' : 'GEOFENCE MONITORING'}
          </Text>

          <Text style={styles.titleText}>
            {cleanTitle}
          </Text>

          <Text style={styles.messageText}>
            {cleanMsg}
          </Text>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isSOS ? '#DC2626' : '#D4AF37' }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: isSOS ? '#FFFFFF' : '#0D0E12' }]}>
              {isSOS ? 'ACKNOWLEDGE DISTRESS SIGNAL' : 'DISMISS NOTICE'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 8, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 26,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
    paddingHorizontal: 6,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
});
