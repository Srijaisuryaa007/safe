import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  PanResponder,
  Platform,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore, CircleMember, Place } from '../store/useCircleStore';
import { useLocationWatchStore, LocationWatch } from '../store/useLocationWatchStore';

interface MemberLocationWatchModalProps {
  visible: boolean;
  targetMember: CircleMember | null;
  currentAddress?: string | null;
  onClose: () => void;
}

type WatchType = 'leaves_current' | 'arrives_place' | 'leaves_place';

export default function MemberLocationWatchModal({
  visible,
  targetMember,
  currentAddress,
  onClose,
}: MemberLocationWatchModalProps) {
  const { colors, isDark } = useThemeStore();
  const { places, activeCircle } = useCircleStore();
  const { watches, createWatch, cancelWatch } = useLocationWatchStore();

  const [watchType, setWatchType] = useState<WatchType>('leaves_current');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(150);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;

  // Active watches for this specific member
  const memberWatches = useMemo(() => {
    if (!targetMember) return [];
    const targetId = targetMember.user_id || (targetMember as any).id;
    return watches.filter(w => w.target_user_id === targetId && w.status === 'active');
  }, [watches, targetMember]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      setWatchType('leaves_current');
      setSelectedPlaceId(places.length > 0 ? places[0].id : null);
      setRadiusMeters(150);
      setToastMessage(null);
    }
  }, [visible, places]);

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

  const handleCreateWatch = async () => {
    if (!targetMember) return;
    const targetUserId = targetMember.user_id || (targetMember as any).id;
    const targetName = targetMember.profile?.full_name || 'Member';

    let placeName: string | null = null;
    if (watchType === 'arrives_place' || watchType === 'leaves_place') {
      const selectedPlace = places.find(p => p.id === selectedPlaceId);
      if (!selectedPlace) {
        showToast('Please select a Safe Place first.');
        return;
      }
      placeName = selectedPlace.name;
    }

    setIsSubmitting(true);
    try {
      let memberLat = targetMember.latitude;
      let memberLng = targetMember.longitude;

      if (!memberLat || !memberLng) {
        const storeMember = useCircleStore.getState().members.find(m => m.user_id === targetUserId);
        if (storeMember?.latitude && storeMember?.longitude) {
          memberLat = storeMember.latitude;
          memberLng = storeMember.longitude;
        }
      }

      const res = await createWatch({
        targetUserId,
        targetName,
        watchType,
        placeId: selectedPlaceId,
        placeName,
        currentLat: memberLat,
        currentLng: memberLng,
        radiusMeters,
      });

      if (res.success) {
        Vibration.vibrate(50);
        showToast(`Watch set for ${targetName}!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        showToast(res.error || 'Failed to set watch.');
      }
    } catch (_) {
      showToast('An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelWatch = async (watchId: string) => {
    try {
      await cancelWatch(watchId);
      Vibration.vibrate(30);
      showToast('Watch cancelled.');
    } catch (_) {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  if (!visible || !targetMember) return null;

  const memberName = targetMember.profile?.full_name || 'Member';
  const avatarUrl = targetMember.profile?.avatar_url;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View
              style={[
                styles.dragBar,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' },
              ]}
            />
          </View>

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                    ]}
                  >
                    <Ionicons name="person" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                  </View>
                )}
                <View style={styles.bellBadge}>
                  <Ionicons name="notifications" size={10} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Notify Me When...
                </Text>
                <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
                  Ad-hoc alerts for {memberName}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
              ]}
              onPress={onClose}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {toastMessage && (
            <View style={styles.toastBanner}>
              <Ionicons name="information-circle" size={16} color="#3B82F6" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Watch Type Selection Options */}
            <Text style={[styles.sectionTitle, { color: isDark ? '#94A3B8' : '#475569' }]}>
              SELECT TRIGGER CONDITION
            </Text>

            {/* Option 1: Leaves Current Spot */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor:
                    watchType === 'leaves_current'
                      ? isDark
                        ? 'rgba(59, 130, 246, 0.15)'
                        : '#EFF6FF'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : '#F8FAFC',
                  borderColor:
                    watchType === 'leaves_current'
                      ? '#3B82F6'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#E2E8F0',
                },
              ]}
              onPress={() => setWatchType('leaves_current')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.optionIconBox,
                  {
                    backgroundColor:
                      watchType === 'leaves_current' ? '#3B82F6' : isDark ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name="walk"
                  size={20}
                  color={watchType === 'leaves_current' ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'}
                />
              </View>
              <View style={styles.optionDetails}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  Leaves Current Spot
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  Instant alert when {memberName} leaves their current spot (~{radiusMeters}m).
                </Text>
                {currentAddress ? (
                  <View style={styles.currentLocChip}>
                    <Ionicons name="pin" size={11} color="#3B82F6" />
                    <Text style={styles.currentLocText} numberOfLines={1}>
                      {currentAddress}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Ionicons
                name={watchType === 'leaves_current' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={watchType === 'leaves_current' ? '#3B82F6' : isDark ? '#475569' : '#CBD5E1'}
              />
            </TouchableOpacity>

            {/* Option 2: Arrives at Safe Place */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor:
                    watchType === 'arrives_place'
                      ? isDark
                        ? 'rgba(16, 185, 129, 0.15)'
                        : '#ECFDF5'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : '#F8FAFC',
                  borderColor:
                    watchType === 'arrives_place'
                      ? '#10B981'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#E2E8F0',
                },
              ]}
              onPress={() => setWatchType('arrives_place')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.optionIconBox,
                  {
                    backgroundColor:
                      watchType === 'arrives_place' ? '#10B981' : isDark ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={watchType === 'arrives_place' ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'}
                />
              </View>
              <View style={styles.optionDetails}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  Arrives at Safe Place
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  Alert me the moment they step into a designated Safe Place.
                </Text>
              </View>
              <Ionicons
                name={watchType === 'arrives_place' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={watchType === 'arrives_place' ? '#10B981' : isDark ? '#475569' : '#CBD5E1'}
              />
            </TouchableOpacity>

            {/* Option 3: Leaves Safe Place */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor:
                    watchType === 'leaves_place'
                      ? isDark
                        ? 'rgba(245, 158, 11, 0.15)'
                        : '#FFFBEB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : '#F8FAFC',
                  borderColor:
                    watchType === 'leaves_place'
                      ? '#F59E0B'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#E2E8F0',
                },
              ]}
              onPress={() => setWatchType('leaves_place')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.optionIconBox,
                  {
                    backgroundColor:
                      watchType === 'leaves_place' ? '#F59E0B' : isDark ? '#1E293B' : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name="log-out"
                  size={20}
                  color={watchType === 'leaves_place' ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'}
                />
              </View>
              <View style={styles.optionDetails}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  Leaves Safe Place
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  Alert me the moment they depart from a designated Safe Place.
                </Text>
              </View>
              <Ionicons
                name={watchType === 'leaves_place' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={watchType === 'leaves_place' ? '#F59E0B' : isDark ? '#475569' : '#CBD5E1'}
              />
            </TouchableOpacity>

            {/* Place Selection Chips (if arrives or leaves place) */}
            {(watchType === 'arrives_place' || watchType === 'leaves_place') && (
              <View style={styles.placeSelectorContainer}>
                <Text style={[styles.subLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Choose Safe Place:
                </Text>
                {places.length === 0 ? (
                  <View style={styles.emptyPlacesBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                    <Text style={styles.emptyPlacesText}>
                      No Safe Places added yet in this Circle. Add one using the Safe Zone button on the map.
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placesScroll}>
                    {places.map((place: Place) => {
                      const isSelected = selectedPlaceId === place.id;
                      return (
                        <TouchableOpacity
                          key={place.id}
                          style={[
                            styles.placeChip,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? '#1E293B'
                                  : '#0F172A'
                                : isDark
                                ? 'rgba(255,255,255,0.06)'
                                : '#F1F5F9',
                              borderColor: isSelected
                                ? isDark
                                  ? '#3B82F6'
                                  : '#0F172A'
                                : isDark
                                ? 'rgba(255,255,255,0.1)'
                                : '#E2E8F0',
                            },
                          ]}
                          onPress={() => setSelectedPlaceId(place.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="home"
                            size={14}
                            color={isSelected ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.placeChipText,
                              {
                                color: isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#334155',
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {place.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Perimeter / Radius Sensitivity Chips */}
            <View style={styles.radiusContainer}>
              <Text style={[styles.subLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Detection Sensitivity (Radius):
              </Text>
              <View style={styles.radiusRow}>
                {[
                  { label: 'Tight (~100m)', val: 100 },
                  { label: 'Standard (~150m)', val: 150 },
                  { label: 'Wide (~300m)', val: 300 },
                ].map(r => (
                  <TouchableOpacity
                    key={r.val}
                    style={[
                      styles.radiusChip,
                      {
                        backgroundColor:
                          radiusMeters === r.val
                            ? isDark
                              ? '#3B82F6'
                              : '#0F172A'
                            : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : '#F1F5F9',
                        borderColor:
                          radiusMeters === r.val
                            ? '#3B82F6'
                            : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : '#E2E8F0',
                      },
                    ]}
                    onPress={() => setRadiusMeters(r.val)}
                  >
                    <Text
                      style={[
                        styles.radiusChipText,
                        {
                          color: radiusMeters === r.val ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B',
                          fontWeight: radiusMeters === r.val ? '700' : '500',
                        },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* CTA Button: Set Watch */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isDark ? '#3B82F6' : '#0F172A',
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
              onPress={handleCreateWatch}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="notifications" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>SET NOTIFICATION WATCH</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Active Watches List for this member */}
            {memberWatches.length > 0 && (
              <View style={styles.activeWatchesSection}>
                <View style={styles.activeWatchesHeader}>
                  <Text style={[styles.activeWatchesTitle, { color: isDark ? '#94A3B8' : '#475569' }]}>
                    ACTIVE WATCHES ({memberWatches.length})
                  </Text>
                  <Text style={[styles.activeWatchesSub, { color: colors.textMuted }]}>
                    Auto-expires once triggered
                  </Text>
                </View>

                {memberWatches.map((w: LocationWatch) => {
                  let badgeLabel = 'Leaves Spot';
                  let badgeIcon: any = 'walk';
                  let badgeColor = '#3B82F6';

                  if (w.watch_type === 'arrives_place') {
                    badgeLabel = `Arrives at ${w.place_name || 'Place'}`;
                    badgeIcon = 'shield-checkmark';
                    badgeColor = '#10B981';
                  } else if (w.watch_type === 'leaves_place') {
                    badgeLabel = `Leaves ${w.place_name || 'Place'}`;
                    badgeIcon = 'log-out';
                    badgeColor = '#F59E0B';
                  }

                  return (
                    <View
                      key={w.id}
                      style={[
                        styles.watchItemCard,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={[styles.watchBadge, { backgroundColor: `${badgeColor}15` }]}>
                        <Ionicons name={badgeIcon} size={14} color={badgeColor} />
                        <Text style={[styles.watchBadgeText, { color: badgeColor }]}>
                          {badgeLabel}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.cancelWatchBtn}
                        onPress={() => handleCancelWatch(w.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                        <Text style={styles.cancelWatchText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
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
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleArea: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    gap: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  scrollBody: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionDetails: {
    flex: 1,
    paddingRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  currentLocChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  currentLocText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    maxWidth: 220,
  },
  placeSelectorContainer: {
    marginBottom: 16,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyPlacesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  emptyPlacesText: {
    fontSize: 12,
    color: '#D97706',
    flex: 1,
    lineHeight: 16,
  },
  placesScroll: {
    flexDirection: 'row',
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  placeChipText: {
    fontSize: 13,
  },
  radiusContainer: {
    marginBottom: 20,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeWatchesSection: {
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  activeWatchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeWatchesTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeWatchesSub: {
    fontSize: 11,
  },
  watchItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  watchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  watchBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    gap: 4,
  },
  cancelWatchText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
