import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  PanResponder,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';

interface MemberShortProfileModalProps {
  visible: boolean;
  onClose: () => void;
  member: any;
  circleId?: string;
  onNavigateToHistory?: (member: any) => void;
  onNavigateToDriving?: (member: any) => void;
  onNavigateToMap?: (member: any) => void;
  onNavigateToChat?: (member: any) => void;
}

export default function MemberShortProfileModal({
  visible,
  onClose,
  member,
  circleId,
  onNavigateToHistory,
  onNavigateToDriving,
  onNavigateToMap,
  onNavigateToChat,
}: MemberShortProfileModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeStore();
  const translateY = React.useRef(new Animated.Value(0)).current;
  const isClosingRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible]);

  const handleDismiss = React.useCallback(
    (callback?: (() => void) | any) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      // When a navigation callback is triggered, execute immediately without animation lag
      if (typeof callback === 'function') {
        onClose();
        callback();
        return;
      }

      Animated.timing(translateY, {
        toValue: 650,
        duration: 160,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        onClose();
      });
    },
    [onClose, translateY]
  );

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const isTap = Math.abs(gestureState.dy) < 8 && Math.abs(gestureState.dx) < 8;
        const isDragDown = gestureState.dy > 30 || gestureState.vy > 0.25;

        if (isTap || isDragDown) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      },
    })
  ).current;

  if (!visible || !member) return null;

  const profile = member.profile || {};
  const name = profile.full_name || 'Circle Member';
  const role = member.role || 'member';
  const phone = profile.phone || '';
  const avatarUrl = profile.avatar_url;
  const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
  const isLowBattery = member.batteryPct != null && member.batteryPct <= 20;
  const isDriving = Boolean(member.isDriving);
  const isOnline = member.isOnline !== false;

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
        Alert.alert('Unable to Call', 'Device dialer could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  const handleMessage = () => {
    if (phone) {
      Linking.openURL(`sms:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
        Alert.alert('Unable to SMS', 'Messaging application could not be launched.');
      });
    } else {
      Alert.alert('Phone Unavailable', `${name} does not have a registered phone number.`);
    }
  };

  const roleLabel =
    role === 'owner'
      ? 'Circle Leader'
      : role === 'co_leader'
      ? 'Co-Leader'
      : role === 'guardian'
      ? 'Guardian'
      : 'Member';

  const roleColor =
    role === 'owner'
      ? (isDark ? '#3ADFAB' : '#059669')
      : role === 'co_leader'
      ? (isDark ? '#818CF8' : '#4F46E5')
      : role === 'guardian'
      ? (isDark ? '#2DD4BF' : '#0D9488')
      : (isDark ? '#94A3B8' : '#64748B');

  const roleBg =
    role === 'owner'
      ? (isDark ? 'rgba(58, 223, 171, 0.12)' : '#ECFDF5')
      : role === 'co_leader'
      ? (isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF')
      : role === 'guardian'
      ? (isDark ? 'rgba(13, 148, 136, 0.12)' : '#F0FDFA')
      : (isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => handleDismiss()}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => handleDismiss()} />

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141A17' : '#FFFFFF',
              borderColor: isDark ? '#233029' : '#E5E7EB',
              paddingBottom: Math.max(insets.bottom + 16, 28),
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Interactive Drag Handle: Both Tap to Close and Drag Down to Dismiss */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragHandleBox}
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.dragHandle, isDark && { backgroundColor: '#374151' }]} />
          </View>

          {/* Top-Right Tap Close Button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              isDark ? { backgroundColor: 'rgba(255, 255, 255, 0.08)' } : { backgroundColor: '#F1F5F9' },
            ]}
            onPress={() => handleDismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close profile"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={17} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
            {/* Header Profile Section */}
            <View style={styles.heroSection}>
              <View style={styles.avatarWrapper}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarLarge} />
                ) : (
                  <View style={[styles.avatarLarge, styles.avatarFallback, isDark && { backgroundColor: '#1E2B24' }]}>
                    <Text style={[styles.avatarFallbackText, isDark && { color: '#3ADFAB' }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.statusRingDot,
                    {
                      backgroundColor: isDriving ? '#6366F1' : isOnline ? '#10B981' : '#94A3B8',
                      borderColor: isDark ? '#141A17' : '#FFFFFF',
                    },
                  ]}
                >
                  <Ionicons
                    name={isDriving ? 'car' : isOnline ? 'checkmark' : 'time'}
                    size={10}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={[styles.heroName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {name}
              </Text>

              <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleColor }]}>
                <Ionicons
                  name={
                    role === 'owner'
                      ? 'shield-checkmark'
                      : role === 'co_leader'
                      ? 'shield'
                      : 'person'
                  }
                  size={12}
                  color={roleColor}
                />
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                  {roleLabel}
                </Text>
              </View>

              {phone ? (
                <Text style={[styles.heroPhone, isDark && { color: '#94A3B8' }]}>{phone}</Text>
              ) : null}
            </View>

            {/* Quick Contact Actions: Symmetrical 4-Card Luxury Row */}
            <View style={styles.actionShortcutsRow}>
              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark ? { backgroundColor: '#18241D', borderColor: '#26372D' } : { backgroundColor: '#F4F6F4', borderColor: '#E5E8E5' },
                ]}
                onPress={handleCall}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Call member"
              >
                <Ionicons name="call" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#F1F5F3' : '#1F2A24' }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark ? { backgroundColor: '#18241D', borderColor: '#26372D' } : { backgroundColor: '#F4F6F4', borderColor: '#E5E8E5' },
                ]}
                onPress={handleMessage}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="SMS member"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={isDark ? '#818CF8' : '#4F46E5'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#F1F5F3' : '#1F2A24' }]}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark ? { backgroundColor: '#18241D', borderColor: '#26372D' } : { backgroundColor: '#F4F6F4', borderColor: '#E5E8E5' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToMap) onNavigateToMap(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Location on Map"
              >
                <Ionicons name="navigate" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#F1F5F3' : '#1F2A24' }]}>Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutBtn,
                  isDark ? { backgroundColor: '#18241D', borderColor: '#26372D' } : { backgroundColor: '#F4F6F4', borderColor: '#E5E8E5' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToChat) onNavigateToChat(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Chat with member"
              >
                <Ionicons name="chatbubbles" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                <Text style={[styles.shortcutBtnText, { color: isDark ? '#F1F5F3' : '#1F2A24' }]}>Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Status & Activity Grid */}
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, isDark && { color: '#94A3B8' }]}>CURRENT STATUS</Text>
            </View>

            <View style={styles.telemetryGrid}>
              {/* Battery Card */}
              <View
                style={[
                  styles.telemetryCard,
                  isDark ? { backgroundColor: '#1A231F', borderColor: '#26342D' } : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                <View style={styles.telemetryCardTop}>
                  <Ionicons
                    name={isLowBattery ? 'battery-dead' : 'battery-charging'}
                    size={16}
                    color={isLowBattery ? '#EF4444' : '#10B981'}
                  />
                  <Text style={[styles.telemetryLabel, isDark && { color: '#94A3B8' }]}>BATTERY</Text>
                </View>
                <Text
                  style={[
                    styles.telemetryValue,
                    isDark && { color: '#FFFFFF' },
                    isLowBattery && { color: '#EF4444' },
                  ]}
                >
                  {battery}
                </Text>
                <Text style={[styles.telemetrySub, isDark && { color: '#64748B' }]}>
                  {isLowBattery ? 'Low Battery' : 'Normal Power'}
                </Text>
              </View>

              {/* State Card */}
              <View
                style={[
                  styles.telemetryCard,
                  isDark ? { backgroundColor: '#1A231F', borderColor: '#26342D' } : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                <View style={styles.telemetryCardTop}>
                  <Ionicons
                    name={isDriving ? 'speedometer' : isOnline ? 'radio' : 'time'}
                    size={16}
                    color={isDriving ? '#6366F1' : isOnline ? '#10B981' : '#94A3B8'}
                  />
                  <Text style={[styles.telemetryLabel, isDark && { color: '#94A3B8' }]}>MOVEMENT</Text>
                </View>
                <Text style={[styles.telemetryValue, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                  {isDriving ? 'In Transit' : isOnline ? 'Active' : 'Offline'}
                </Text>
                <Text style={[styles.telemetrySub, isDark && { color: '#64748B' }]} numberOfLines={1}>
                  {isDriving ? 'Driving on road' : isOnline ? 'Sharing live location' : 'Recently active'}
                </Text>
              </View>
            </View>

            {/* Navigation Actions */}
            <View style={{ marginTop: 14, gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.navActionRow,
                  isDark ? { backgroundColor: '#1A231F', borderColor: '#283730' } : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToHistory) onNavigateToHistory(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Location History"
              >
                <View style={[styles.navActionIconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' }]}>
                  <Ionicons name="time" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navActionTitle, isDark && { color: '#FFFFFF' }]}>Location History</Text>
                  <Text style={[styles.navActionSubtitle, isDark && { color: '#64748B' }]}>
                    Review recent routes, timeline, and place visits
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navActionRow,
                  isDark ? { backgroundColor: '#1A231F', borderColor: '#283730' } : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
                ]}
                onPress={() => {
                  handleDismiss(() => {
                    if (onNavigateToDriving) onNavigateToDriving(member);
                  });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Driving Summary"
              >
                <View style={[styles.navActionIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                  <Ionicons name="car-sport" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navActionTitle, isDark && { color: '#FFFFFF' }]}>Driving Summary</Text>
                  <Text style={[styles.navActionSubtitle, isDark && { color: '#64748B' }]}>
                    Speed trends, trip logs, and driving habits
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#4B5563' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarLarge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#334155',
  },
  statusRingDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroPhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  actionShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  shortcutBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeadingRow: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  telemetryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  telemetryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#64748B',
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  telemetrySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  navActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  navActionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
