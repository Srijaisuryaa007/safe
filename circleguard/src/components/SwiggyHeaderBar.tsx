import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import AnimatedListDropdown, { AnimatedDropdownItem } from './AnimatedListDropdown';
import { reverseGeocodeLive } from '../services/GeocodingService';

interface SwiggyHeaderBarProps {
  onNotificationPress?: () => void;
  hasNotification?: boolean;
}

export default function SwiggyHeaderBar({ onNotificationPress, hasNotification }: SwiggyHeaderBarProps) {
  const { colors, themeMode, isDark } = useThemeStore();
  const { profile, user } = useAuthStore();
  const { activeCircle, circles, setActiveCircle, switchActiveCircle, fetchUserCircles } = useCircleStore();
  const navigation = useNavigation<any>();

  const [addressTitle, setAddressTitle] = useState('CURRENT LOCATION');
  const [formattedAddress, setFormattedAddress] = useState('Locating live address...');
  const [fullAddressDetails, setFullAddressDetails] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [circleModalVisible, setCircleModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [customAreaInput, setCustomAreaInput] = useState('');
  const [customRoadInput, setCustomRoadInput] = useState('');

  const handleOpenCircleModal = () => {
    const uid = profile?.id || user?.id;
    if (uid) {
      fetchUserCircles(uid).catch(() => {});
    }
    setCircleModalVisible(true);
  };

  const fetchLiveAddress = async () => {
    setLoadingAddress(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setFormattedAddress('Location Permission Denied');
        setLoadingAddress(false);
        return;
      }

      // 1. Force High Accuracy GPS Satellite position acquisition
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (!loc) {
        loc = (await Location.getLastKnownPositionAsync({})) || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      }

      if (loc && loc.coords) {
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;

        const resolved = await reverseGeocodeLive(lat, lng, {
          accuracyMeters: loc.coords.accuracy ?? undefined,
        });

        let finalArea = resolved.safePlaceName || resolved.neighbourhood || resolved.district || resolved.city || 'CURRENT LOCATION';
        let finalStreet = resolved.headline || resolved.road || 'Live Position';

        // Check for saved custom location overrides
        try {
          const a = await AsyncStorage.getItem('@circleguard_custom_area');
          const r = await AsyncStorage.getItem('@circleguard_custom_road');
          if (a) finalArea = a;
          if (r) finalStreet = r;
        } catch (e) {}

        setFullAddressDetails({
          areaName: finalArea,
          street: finalStreet,
          city: resolved.city || '',
          state: resolved.state || '',
          country: resolved.country || '',
          postalCode: resolved.postalCode || 'N/A',
          latitude: lat,
          longitude: lng,
        });

        setCustomAreaInput(finalArea);
        setCustomRoadInput(finalStreet);

        setAddressTitle(finalArea.toUpperCase());
        setFormattedAddress(resolved.fullAddress || `${finalStreet}, ${resolved.city || ''}`);
      }
    } catch (e) {
      setAddressTitle('CURRENT LOCATION');
      setFormattedAddress('Live GPS Satellite Active');
    } finally {
      setLoadingAddress(false);
    }
  };

  useEffect(() => {
    fetchLiveAddress();
  }, []);

  const handleSelectCircle = (circle: any) => {
    setCircleModalVisible(false);
    switchActiveCircle(circle);
  };

  return (
    <>
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.background,
            borderBottomWidth: 0,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Left Side: Location Address Chip */}
        <TouchableOpacity
          style={styles.locationSelector}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.pinCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.06)' }]}>
            <Ionicons name="location" size={18} color={isDark ? '#38BDF8' : '#0F172A'} />
          </View>

          <View style={styles.addressTextBox}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.locationTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {addressTitle}
              </Text>
              <Ionicons name="chevron-down" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
            </View>
            <Text
              style={[styles.addressText, { color: isDark ? '#94A3B8' : '#64748B' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {loadingAddress ? 'Locating...' : formattedAddress}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right Side: Circle Switcher Badge & Notification Bell Button */}
        <View style={styles.rightActionRow}>
          {activeCircle ? (
            <TouchableOpacity
              style={[
                styles.circleBadgePill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
                },
              ]}
              onPress={handleOpenCircleModal}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark" size={14} color={isDark ? '#38BDF8' : '#0F172A'} />
              <Text
                style={[styles.circleBadgeText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {activeCircle.name || 'Circle'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.bellBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
              },
            ]}
            onPress={() => (onNotificationPress ? onNotificationPress() : navigation.navigate('Activity'))}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
            {hasNotification ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Circle Switcher Drawer Modal */}
      <Modal visible={circleModalVisible} animationType="slide" transparent statusBarTranslucent={true} onRequestClose={() => setCircleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={22} color={isDark ? '#38BDF8' : '#0F172A'} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Your Active Safety Circles</Text>
              </View>
              <TouchableOpacity onPress={() => setCircleModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              {(circles || []).length > 0 ? (
                <AnimatedListDropdown
                  items={(circles || []).map((c: any) => ({
                    id: c.id,
                    title: c.name,
                    subtitle: `${c.member_count || 1} members active`,
                    iconName: 'shield-checkmark-outline',
                    badge: activeCircle?.id === c.id ? 'ACTIVE' : undefined,
                    data: c,
                  }))}
                  selectedIndex={(circles || []).findIndex((c: any) => c.id === activeCircle?.id)}
                  onItemSelect={(item) => handleSelectCircle(item.data)}
                />
              ) : (
                <Text style={[styles.addressText, { color: colors.textMuted, marginVertical: 12 }]}>
                  No active circles joined yet.
                </Text>
              )}
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.actionBtnFull,
                  {
                    backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
                    borderRadius: 14,
                  },
                ]}
                onPress={() => {
                  setCircleModalVisible(false);
                  navigation.navigate('CreateCircle');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={17} color={isDark ? '#0F172A' : '#FFFFFF'} />
                <Text style={[styles.actionBtnTextDark, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>CREATE NEW CIRCLE</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.actionBtnHalf,
                    {
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.08)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(14, 165, 233, 0.25)',
                      borderRadius: 14,
                    },
                  ]}
                  onPress={() => {
                    setCircleModalVisible(false);
                    navigation.navigate('JoinCircle', { initialTab: 'qr' });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="qr-code-outline" size={16} color={isDark ? '#38BDF8' : '#0284C7'} />
                  <Text style={[styles.actionBtnTextDark, { color: isDark ? '#38BDF8' : '#0284C7' }]}>JOIN WITH QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtnHalf,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                      borderRadius: 14,
                    },
                  ]}
                  onPress={() => {
                    setCircleModalVisible(false);
                    navigation.navigate('JoinCircle', { initialTab: 'code' });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="keypad-outline" size={16} color={colors.foreground} />
                  <Text style={[styles.actionBtnTextDark, { color: colors.foreground }]}>ENTER CODE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Swiggy-Style Full Address Details Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent statusBarTranslucent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="navigate-circle-outline" size={24} color={colors.accentGold} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Your Live Address Details</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingAddress ? (
              <ActivityIndicator color={colors.accentGold} style={{ marginVertical: 24 }} />
            ) : editMode ? (
              <View style={{ marginBottom: 18, gap: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accentGold, letterSpacing: 1 }}>CUSTOMIZE AREA & STREET NAME</Text>
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, marginBottom: 4, letterSpacing: 1 }}>AREA / NEIGHBORHOOD NAME</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.foreground, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: '600' }}
                    value={customAreaInput}
                    onChangeText={setCustomAreaInput}
                    placeholder="e.g. Golden City"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, marginBottom: 4, letterSpacing: 1 }}>ROAD / STREET NAME</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, color: colors.foreground, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: '600' }}
                    value={customRoadInput}
                    onChangeText={setCustomRoadInput}
                    placeholder="e.g. Thotagri Road"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.refreshBtn, { backgroundColor: colors.accentGold, marginTop: 6 }]}
                  onPress={async () => {
                    await AsyncStorage.setItem('@circleguard_custom_area', customAreaInput);
                    await AsyncStorage.setItem('@circleguard_custom_road', customRoadInput);
                    setEditMode(false);
                    fetchLiveAddress();
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#1A1A1A" />
                  <Text style={styles.refreshBtnText}>SAVE CUSTOM LOCATION</Text>
                </TouchableOpacity>
              </View>
            ) : fullAddressDetails ? (
              <View style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>AREA / NEIGHBORHOOD</Text>
                  <Text style={[styles.detailVal, { color: colors.accentGold }]}>
                    {fullAddressDetails.areaName || 'Current Location'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>STREET / ROAD</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {fullAddressDetails.street || 'Live Position'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>CITY / REGION</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {[fullAddressDetails.city, fullAddressDetails.state, fullAddressDetails.country].filter(Boolean).join(', ')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>POSTAL CODE</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {fullAddressDetails.postalCode || 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>GPS COORDINATES</Text>
                  <Text style={[styles.detailVal, { color: colors.accentGold }]}>
                    {typeof fullAddressDetails?.latitude === 'number' ? fullAddressDetails.latitude.toFixed(5) : 'N/A'}, {typeof fullAddressDetails?.longitude === 'number' ? fullAddressDetails.longitude.toFixed(5) : 'N/A'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.refreshBtn, { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderWidth: 1, borderColor: colors.accentGold, marginTop: 4 }]}
                  onPress={() => setEditMode(true)}
                >
                  <Ionicons name="create-outline" size={16} color={colors.accentGold} />
                  <Text style={[styles.refreshBtnText, { color: colors.accentGold }]}>EDIT AREA & ROAD NAME</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.addressText, { color: colors.textMuted, marginVertical: 16 }]}>
                {formattedAddress}
              </Text>
            )}

            {!editMode ? (
              <TouchableOpacity
                style={[styles.refreshBtn, { backgroundColor: colors.accentGold, marginTop: 8 }]}
                onPress={fetchLiveAddress}
              >
                <Ionicons name="refresh" size={16} color="#1A1A1A" />
                <Text style={styles.refreshBtnText}>REFRESH LIVE GPS LOCATION</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 10,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextBox: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  addressText: {
    fontSize: 11.5,
    marginTop: 1,
    fontWeight: '500',
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: 135,
  },
  circleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 72,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  circleRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  circleRowName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  actionBtnFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 10,
  },
  actionBtnTextDark: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#1A1A1A',
  },
  detailsContent: {
    gap: 14,
    marginBottom: 24,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
  },
  refreshBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
