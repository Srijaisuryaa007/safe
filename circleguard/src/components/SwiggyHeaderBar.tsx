import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import AnimatedListDropdown, { AnimatedDropdownItem } from './AnimatedListDropdown';

interface SwiggyHeaderBarProps {
  onNotificationPress?: () => void;
  hasNotification?: boolean;
}

export default function SwiggyHeaderBar({ onNotificationPress, hasNotification }: SwiggyHeaderBarProps) {
  const { colors, themeMode } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, circles, setActiveCircle } = useCircleStore();
  const navigation = useNavigation<any>();

  const [addressTitle, setAddressTitle] = useState('CURRENT LOCATION');
  const [formattedAddress, setFormattedAddress] = useState('Fetching live position...');
  const [fullAddressDetails, setFullAddressDetails] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [circleModalVisible, setCircleModalVisible] = useState(false);

  const cleanAddressPart = (val?: string | null) => {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.includes('+') || /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i.test(trimmed)) {
      return '';
    }
    return trimmed;
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

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc && loc.coords) {
        const geo = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        if (geo && geo.length > 0) {
          const item = geo[0];
          setFullAddressDetails(item);

          const street = cleanAddressPart(item.street || item.name);
          const district = cleanAddressPart(item.district || item.subregion);
          const city = cleanAddressPart(item.city);

          if (district && city) {
            setAddressTitle(district.toUpperCase());
            setFormattedAddress(`${street ? street + ', ' : ''}${city}`);
          } else if (city) {
            setAddressTitle(city.toUpperCase());
            setFormattedAddress(street || city);
          } else {
            setAddressTitle((item.name || 'CURRENT LOCATION').toUpperCase());
            setFormattedAddress(item.street || 'Nearby');
          }
        }
      }
    } catch (e) {
      setFormattedAddress('Live Position Active');
    } finally {
      setLoadingAddress(false);
    }
  };

  useEffect(() => {
    fetchLiveAddress();
  }, []);

  const handleSelectCircle = (circle: any) => {
    setActiveCircle(circle);
    setCircleModalVisible(false);
  };

  return (
    <>
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.background,
            borderBottomWidth: themeMode === 'bauhaus' ? 4 : (themeMode === 'minimalist_monochrome' ? 1 : 0),
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Left Side: Swiggy-Style Location Address Bar */}
        <TouchableOpacity
          style={styles.locationSelector}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.pinCircle, { backgroundColor: themeMode === 'bauhaus' ? '#F0C020' : 'rgba(212, 175, 55, 0.15)', borderWidth: themeMode === 'bauhaus' ? 2 : 0, borderColor: '#121212' }]}>
            <Ionicons name="location" size={20} color={themeMode === 'bauhaus' ? '#121212' : colors.accentGold} />
          </View>

          <View style={styles.addressTextBox}>
            <View style={styles.titleRow}>
              <Text style={[styles.locationTitle, { color: colors.foreground }]}>{addressTitle}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.accentGold} />
            </View>
            <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>
              {loadingAddress ? 'Locating...' : formattedAddress}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right Side: Notification Bell Button */}
        <View style={styles.rightActionRow}>
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => (onNotificationPress ? onNotificationPress() : navigation.navigate('Activity'))}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.foreground} />
            {hasNotification ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Circle Switcher Drawer Modal */}
      <Modal visible={circleModalVisible} animationType="slide" transparent onRequestClose={() => setCircleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={22} color={colors.accentGold} />
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

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtnHalf, { backgroundColor: colors.accentGold }]}
                onPress={() => {
                  setCircleModalVisible(false);
                  navigation.navigate('CreateCircle');
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#1A1A1A" />
                <Text style={styles.actionBtnTextDark}>CREATE CIRCLE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtnHalf, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {
                  setCircleModalVisible(false);
                  navigation.navigate('JoinCircle');
                }}
              >
                <Ionicons name="qr-code-outline" size={16} color={colors.foreground} />
                <Text style={[styles.actionBtnTextDark, { color: colors.foreground }]}>JOIN WITH CODE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Swiggy-Style Full Address Details Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
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
            ) : fullAddressDetails ? (
              <View style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>STREET / AREA</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {fullAddressDetails.cleanStreet}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>SUBREGION / CITY</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {fullAddressDetails.cleanArea}
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
                    {fullAddressDetails.latitude.toFixed(5)}, {fullAddressDetails.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.addressText, { color: colors.textMuted, marginVertical: 16 }]}>
                {formattedAddress}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.refreshBtn, { backgroundColor: colors.accentGold }]}
              onPress={fetchLiveAddress}
            >
              <Ionicons name="refresh" size={16} color="#1A1A1A" />
              <Text style={styles.refreshBtnText}>REFRESH LIVE GPS LOCATION</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingBottom: 12,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  addressText: {
    fontSize: 12,
    marginTop: 2,
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 125,
  },
  circleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
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
