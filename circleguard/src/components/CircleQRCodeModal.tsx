import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useThemeStore } from '../store/useThemeStore';
import { Circle } from '../store/useCircleStore';

interface CircleQRCodeModalProps {
  visible: boolean;
  circle: Circle | null;
  onClose: () => void;
}

export default function CircleQRCodeModal({ visible, circle, onClose }: CircleQRCodeModalProps) {
  const { colors, isDark } = useThemeStore();
  const [svgError, setSvgError] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              onClose();
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, translateY]
  );

  if (!circle) return null;

  const inviteCode = (circle.invite_code || '').trim().toUpperCase();
  const qrPayload = `circleguard://join/${inviteCode}`;
  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(qrPayload)}&bgcolor=FFFFFF&color=0F172A&margin=2`;

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('Code Copied', `Circle code "${inviteCode}" copied to clipboard.`);
    } catch (e) {
      // ignore
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my private circle "${circle.name}" on CircleGuard using invite code: ${inviteCode}\n\nDownload CircleGuard to connect safely: https://circleguard.app/join/${inviteCode}`,
        title: `Join ${circle.name} on CircleGuard`,
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
              transform: [
                {
                  translateY: translateY.interpolate({
                    inputRange: [-50, 0, 600],
                    outputRange: [0, 0, 600],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {/* Top Interactive Drag-to-Dismiss / Tap-to-Close Handle */}
          <TouchableOpacity
            style={styles.handleContainer}
            onPress={onClose}
            activeOpacity={0.7}
            {...panResponder.panHandlers}
            accessibilityLabel="Drag down or tap to close circle QR code"
          >
            <View style={[styles.handleBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)' }]} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconOrb, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
                <Ionicons name="qr-code" size={18} color={isDark ? '#38BDF8' : '#0F172A'} />
              </View>
              <View>
                <Text style={[styles.overline, { color: isDark ? '#94A3B8' : '#64748B' }]}>PRIVATE ENCRYPTION KEY</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>{circle.name}</Text>
              </View>
            </View>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrCard}>
              {!svgError && qrPayload ? (
                <QRCode
                  value={qrPayload}
                  size={180}
                  color="#0F172A"
                  backgroundColor="#FFFFFF"
                  quietZone={8}
                  onError={() => setSvgError(true)}
                />
              ) : (
                <Image
                  source={{ uri: fallbackQrUrl }}
                  style={{ width: 180, height: 180, borderRadius: 8 }}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={[styles.qrHelperText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Scan with CircleGuard camera to join instantly
            </Text>
          </View>

          {/* 6-Digit Code Display */}
          <TouchableOpacity 
            style={[styles.codeDisplayCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' }]} 
            onPress={handleCopyCode}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles.codeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>INVITE CODE</Text>
              <Text style={[styles.codeValue, { color: colors.foreground }]}>{inviteCode}</Text>
            </View>
            <View style={[styles.copyChip, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' }]}>
              <Ionicons name="copy-outline" size={15} color={colors.foreground} />
              <Text style={[styles.copyChipText, { color: colors.foreground }]}>COPY</Text>
            </View>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: isDark ? '#F8FAFC' : '#0F172A' }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={16} color={isDark ? '#0F172A' : '#FFFFFF'} />
              <Text style={[styles.actionBtnText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>SHARE INVITE KEY</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    alignItems: 'center',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  iconOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  qrCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  qrHelperText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  codeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 2,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  copyChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  buttonRow: {
    width: '100%',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    width: '100%',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
