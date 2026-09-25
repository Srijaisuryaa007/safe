import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCircleStore, Circle } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface CircleSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CircleSwitcherModal({ visible, onClose }: CircleSwitcherModalProps) {
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { isDark } = useThemeStore();
  const { activeCircle, circles, switchActiveCircle, fetchUserCircles, deleteCircle, leaveCircle, isLoading } = useCircleStore();
  const translateY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: 650,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, translateY]);

  const panResponder = useRef(
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
        const isDragDown = gestureState.dy > 35 || gestureState.vy > 0.2;

        if (isTap || isDragDown) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible && profile?.id) {
      fetchUserCircles(profile.id).catch(() => {});
    }
  }, [visible, profile?.id]);

  const handleSelectCircle = (circle: Circle) => {
    onClose();
    if (circle.id !== activeCircle?.id) {
      switchActiveCircle(circle);
    }
  };

  const handleDeleteCircle = (circle: Circle) => {
    const isOwnerOfCircle = profile?.id && circle.owner_id === profile.id;
    const title = isOwnerOfCircle ? 'Delete Circle' : 'Leave Circle';
    const message = isOwnerOfCircle
      ? `Are you sure you want to permanently delete "${circle.name}"? All members, safe places, and location history will be erased.`
      : `Are you sure you want to leave "${circle.name}"?`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: title,
        style: 'destructive',
        onPress: async () => {
          if (isOwnerOfCircle) {
            await deleteCircle(circle.id);
          } else if (profile?.id) {
            await leaveCircle(circle.id, profile.id);
          }
        },
      },
    ]);
  };

  const handleCreateNew = () => {
    onClose();
    navigation.navigate('CreateCircle');
  };

  const handleJoinCircle = () => {
    onClose();
    navigation.navigate('JoinCircle');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />

        <Animated.View
          style={[
            styles.sheetCard,
            isDark && styles.sheetCardDark,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Top Sheet Drag Handle: Both Tap to Close and Drag Down to Dismiss */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragHandleBox}
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.dragHandle, isDark && styles.dragHandleDark]} />
          </View>

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.shieldBadge, isDark && styles.shieldBadgeDark]}>
                <Ionicons name="shield-checkmark" size={20} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              </View>
              <View>
                <Text style={[styles.headerTitle, isDark && styles.textLight]}>Your Safety Circles</Text>
                <Text style={[styles.headerSubtitle, isDark && styles.textSubDark]}>
                  Switch active circle or join another
                </Text>
              </View>
            </View>
          </View>

          {/* Circles List */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {circles && circles.length > 0 ? (
              circles.map((c) => {
                const isActive = activeCircle?.id === c.id;
                const circleInitial = (c.name || 'C').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.circleItem,
                      isDark && styles.circleItemDark,
                      isActive && (isDark ? styles.circleItemActiveDark : styles.circleItemActive),
                    ]}
                    onPress={() => handleSelectCircle(c)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.circleAvatar,
                        isDark && styles.circleAvatarDark,
                        isActive && styles.circleAvatarActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.circleAvatarText,
                          isDark && styles.textLight,
                          isActive && styles.circleAvatarTextActive,
                        ]}
                      >
                        {circleInitial}
                      </Text>
                    </View>

                    <View style={styles.circleInfo}>
                      <Text
                        style={[
                          styles.circleName,
                          isDark && styles.textLight,
                          isActive && (isDark ? { color: '#3ADFAB' } : styles.circleNameActive),
                        ]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      <View style={styles.metaRow}>
                        {c.invite_code ? (
                          <Text style={[styles.codeText, isDark && styles.textSubDark]}>
                            Code: <Text style={[styles.codeBold, isDark && styles.textLight]}>{c.invite_code}</Text>
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.itemRightGroup}>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.circleDeleteBtn, isDark && { backgroundColor: '#331B1B' }]}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleDeleteCircle(c);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={profile?.id && c.owner_id === profile.id ? 'trash-outline' : 'log-out-outline'}
                          size={17}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="small" color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                <Text style={[styles.emptyText, isDark && styles.textSubDark]}>Loading your circles...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={36} color={isDark ? '#5C665F' : '#94A3B8'} />
                <Text style={[styles.emptyText, isDark && styles.textSubDark]}>No circles joined yet.</Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleCreateNew}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Create New Circle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryActionBtn, isDark && styles.secondaryActionBtnDark]}
              onPress={handleJoinCircle}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={18} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <Text style={[styles.secondaryActionText, isDark && styles.secondaryActionTextDark]}>
                Join With Code / QR
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
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
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
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shieldBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    maxHeight: 320,
    marginVertical: 14,
  },
  listContent: {
    gap: 10,
    paddingVertical: 4,
  },
  circleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  circleItemActive: {
    borderColor: '#2E7D5B',
    backgroundColor: '#F0FDF4',
  },
  circleAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAvatarActive: {
    backgroundColor: '#2E7D5B',
  },
  circleAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#475569',
  },
  circleAvatarTextActive: {
    color: '#FFFFFF',
  },
  circleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  circleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  circleNameActive: {
    color: '#2E7D5B',
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  codeText: {
    fontSize: 12,
    color: '#64748B',
  },
  codeBold: {
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#0F172A',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  footerActions: {
    gap: 10,
    marginTop: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D5B',
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionText: {
    color: '#2E7D5B',
    fontSize: 14,
    fontWeight: '600',
  },
  // Dark Theme Tokens
  sheetCardDark: {
    backgroundColor: '#141A17',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#283730',
  },
  dragHandleDark: {
    backgroundColor: '#26342D',
  },
  shieldBadgeDark: {
    backgroundColor: '#1C2621',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textSubDark: {
    color: '#CAD5CE',
  },
  closeBtnDark: {
    backgroundColor: '#1C2621',
  },
  circleItemDark: {
    backgroundColor: '#1A231F',
    borderColor: '#283730',
  },
  circleItemActiveDark: {
    backgroundColor: '#23352B',
    borderColor: '#3ADFAB',
  },
  circleAvatarDark: {
    backgroundColor: '#26342D',
  },
  secondaryActionBtnDark: {
    backgroundColor: '#26342D',
    borderWidth: 1,
    borderColor: '#33463C',
  },
  secondaryActionTextDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
