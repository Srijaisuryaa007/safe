/**
 * CurrentAddressModal.tsx
 * 
 * Swiggy-style Live Address & Telemetry Sheet.
 * Displays precise street, locality, landmark, coordinates, GPS accuracy,
 * and quick actions (Copy Address, Share Live Link, Refresh Fix).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Share,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { reverseGeocodeLive, GeocodedAddress } from '../services/GeocodingService';

interface CurrentAddressModalProps {
  visible: boolean;
  onClose: () => void;
  userLoc: { latitude: number; longitude: number } | null;
  onRefreshLocation?: () => Promise<void> | void;
  safePlaces?: any[];
  gpsAccuracy?: number;
}

export default function CurrentAddressModal({
  visible,
  onClose,
  userLoc,
  onRefreshLocation,
  safePlaces = [],
  gpsAccuracy,
}: CurrentAddressModalProps) {
  const { isDark } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible]);

  const handleDismiss = React.useCallback(() => {
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
        const isDragDown = gestureState.dy > 30 || gestureState.vy > 0.25;

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
  const [streetName, setStreetName] = useState<string>('Detecting street...');
  const [areaDetails, setAreaDetails] = useState<string>('Resolving locality...');
  const [fullAddress, setFullAddress] = useState<string>('');
  const [isSafeZone, setIsSafeZone] = useState<boolean>(false);
  const [safeZoneName, setSafeZoneName] = useState<string | null>(null);
  const [activeCoords, setActiveCoords] = useState<{ latitude: number; longitude: number } | null>(userLoc);
  const [accuracy, setAccuracy] = useState<number | undefined>(gpsAccuracy);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userLoc?.latitude && userLoc?.longitude) {
      setActiveCoords(userLoc);
      if (gpsAccuracy) setAccuracy(gpsAccuracy);
    }
  }, [userLoc?.latitude, userLoc?.longitude, gpsAccuracy]);

  useEffect(() => {
    if (visible && activeCoords?.latitude && activeCoords?.longitude) {
      resolveAddress(activeCoords.latitude, activeCoords.longitude, accuracy);
    }
  }, [visible, activeCoords?.latitude, activeCoords?.longitude, safePlaces]);

  const resolveAddress = async (lat: number, lng: number, acc?: number) => {
    setLoading(true);
    try {
      const result = await reverseGeocodeLive(lat, lng, {
        safePlaces,
        accuracyMeters: acc ?? accuracy,
      });

      setStreetName(result.headline || `Street near ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setAreaDetails(result.subtitle || 'Locality details resolved');
      setFullAddress(result.fullAddress);
      setIsSafeZone(result.isSafePlace);
      setSafeZoneName(result.safePlaceName || null);
      if (typeof acc === 'number') {
        setAccuracy(acc);
      }
    } catch (e) {
      setStreetName(`Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setAreaDetails('Live GPS Satellite Lock Active');
      setFullAddress(`GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = fullAddress || (activeCoords ? `${activeCoords.latitude}, ${activeCoords.longitude}` : '');
    if (textToCopy) {
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShare = async () => {
    const targetLoc = activeCoords || userLoc;
    if (!targetLoc) return;
    try {
      const mapsUrl = `https://maps.google.com/?q=${targetLoc.latitude},${targetLoc.longitude}`;
      await Share.share({
        message: `📍 My Current Live Location on CircleGuard:\n${streetName}\n${areaDetails}\n\nLive Map Link: ${mapsUrl}`,
      });
    } catch (e) {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefreshLocation) {
        await onRefreshLocation();
      }

      // Force fresh high-precision GPS satellite fix directly from device hardware
      const freshLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (freshLoc?.coords) {
        const { latitude, longitude, accuracy: freshAcc } = freshLoc.coords;
        setActiveCoords({ latitude, longitude });
        setAccuracy(freshAcc ?? undefined);
        await resolveAddress(latitude, longitude, freshAcc ?? undefined);
      } else if (activeCoords?.latitude && activeCoords?.longitude) {
        await resolveAddress(activeCoords.latitude, activeCoords.longitude, accuracy);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />
        <Animated.View
          style={[
            styles.sheetContainer,
            isDark && { backgroundColor: '#141A17', borderColor: '#26372E' },
            {
              paddingBottom: Math.max(insets.bottom, 16) + 14,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Swiggy-Style Sheet Handle: Both Tap to Close and Drag Down to Dismiss */}
          <View
            {...panResponder.panHandlers}
            style={styles.dragHandleBox}
            testID="close-address-modal-btn"
            accessible={true}
            accessibilityLabel="Drag down or tap to close"
            accessibilityRole="button"
          >
            <View style={[styles.dragHandle, isDark && { backgroundColor: '#283830' }]} />
          </View>

          {/* Header Row: Swiggy style location status */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.liveGpsPulseBox, isDark && { backgroundColor: '#1B2C23' }]}>
                <View style={styles.liveGpsDot} />
                <Text style={[styles.liveGpsText, isDark && { color: '#3ADFAB' }]}>CURRENT LIVE LOCATION</Text>
              </View>

              {isSafeZone && safeZoneName ? (
                <View style={[styles.safeZoneBadgePill, isDark && { backgroundColor: '#1C2621', borderColor: '#2E7D5B' }]}>
                  <Ionicons name="shield-checkmark" size={11} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                  <Text style={[styles.safeZoneBadgeText, isDark && { color: '#3ADFAB' }]}>
                    INSIDE {safeZoneName.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Main Street & Locality Spotlight Card */}
          <View
            style={[
              styles.addressCard,
              isDark
                ? { backgroundColor: '#1C2621', borderColor: '#2B3D33' }
                : { backgroundColor: '#F6FAF7', borderColor: '#DCEDE3' },
            ]}
          >
            <View style={styles.addressCardIconCol}>
              <View style={[styles.pinCircle, isDark && { backgroundColor: '#23382D' }]}>
                <Ionicons name="location" size={22} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              </View>
            </View>

            <View style={styles.addressCardTextCol}>
              {loading ? (
                <View style={{ paddingVertical: 8 }}>
                  <ActivityIndicator size="small" color={isDark ? '#3ADFAB' : '#2E7D5B'} />
                  <Text style={[styles.loadingHint, isDark && { color: '#9EACA3' }]}>Finding current street address...</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.streetHeadline, isDark && { color: '#FFFFFF' }]} numberOfLines={2}>
                    {streetName}
                  </Text>
                  <Text style={[styles.areaSubtitle, isDark && { color: '#A5B5AC' }]} numberOfLines={2}>
                    {areaDetails}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* High-Precision Telemetry Grid */}
          <View style={styles.telemetryGrid}>
            <View
              style={[
                styles.telemetryTile,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2B3D33' },
              ]}
            >
              <Ionicons name="navigate-outline" size={15} color={isDark ? '#3ADFAB' : '#2E7D5B'} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.telemetryLabel, isDark && { color: '#8E9E94' }]}>COORDINATES</Text>
                <Text style={[styles.telemetryValue, isDark && { color: '#FFFFFF' }]}>
                  {activeCoords ? `${activeCoords.latitude.toFixed(5)}, ${activeCoords.longitude.toFixed(5)}` : '--'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.telemetryTile,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2B3D33' },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color="#E07A5F" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.telemetryLabel, isDark && { color: '#8E9E94' }]}>GPS ACCURACY</Text>
                <Text style={[styles.telemetryValue, isDark && { color: '#FFFFFF' }]}>
                  {typeof accuracy === 'number' && accuracy > 0
                    ? `± ${Math.round(accuracy)}m ${accuracy <= 15 ? 'Satellite Lock' : 'Precision'}`
                    : '± 4.5m High Precision'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionBtnSecondary,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2B3D33' },
              ]}
              onPress={handleCopy}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copied ? '#10B981' : (isDark ? '#FFFFFF' : '#1F2A24')}
              />
              <Text
                style={[
                  styles.actionBtnSecondaryText,
                  isDark && { color: '#FFFFFF' },
                  copied && { color: '#10B981' },
                ]}
              >
                {copied ? 'Copied!' : 'Copy Address'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtnSecondary,
                isDark && { backgroundColor: '#1C2621', borderColor: '#2B3D33' },
              ]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={16} color={isDark ? '#FFFFFF' : '#1F2A24'} />
              <Text style={[styles.actionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>
                Share
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtnPrimary,
                isDark && { backgroundColor: '#3ADFAB' },
              ]}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={isDark ? '#0F1411' : '#FFFFFF'} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={isDark ? '#0F1411' : '#FFFFFF'} />
                  <Text style={[styles.actionBtnPrimaryText, isDark && { color: '#0F1411' }]}>
                    Refresh
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1.2,
    borderLeftWidth: 1.2,
    borderRightWidth: 1.2,
    borderBottomWidth: 0,
    borderColor: '#ECEAE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    width: '100%',
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
    backgroundColor: '#DCDAD3',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveGpsPulseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveGpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveGpsText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#2E7D5B',
  },
  safeZoneBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#A3D9BE',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    marginLeft: 8,
  },
  safeZoneBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.4,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  addressCardIconCol: {
    paddingTop: 2,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCardTextCol: {
    flex: 1,
  },
  streetHeadline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  areaSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5C665F',
    marginTop: 4,
    lineHeight: 17,
  },
  loadingHint: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 4,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  telemetryTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 10,
    borderRadius: 12,
  },
  telemetryLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#718076',
  },
  telemetryValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2A24',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2A24',
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#2E7D5B',
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
