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

interface SwiggyHeaderBarProps {
  onNotificationPress?: () => void;
  hasNotification?: boolean;
}

export default function SwiggyHeaderBar({ onNotificationPress, hasNotification }: SwiggyHeaderBarProps) {
  const { colors, themeMode } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, circles, setActiveCircle } = useCircleStore();
  const navigation = useNavigation<any>();

  const [addressTitle, setAddressTitle] = useState('GOLDEN CITY');
  const [formattedAddress, setFormattedAddress] = useState('Thotagri Road');
  const [fullAddressDetails, setFullAddressDetails] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [circleModalVisible, setCircleModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [customAreaInput, setCustomAreaInput] = useState('Golden City');
  const [customRoadInput, setCustomRoadInput] = useState('Thotagri Road');

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

      // 1. Force High Accuracy GPS Satellite position acquisition
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (!loc) {
        loc = await Location.getLastKnownPositionAsync({}) || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      if (loc && loc.coords) {
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;

        let nativeItem: any = null;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo && geo.length > 0) {
            nativeItem = geo[0];
          }
        } catch (e) {
          console.log('Native reverseGeocode error:', e);
        }

        let nomItem: any = null;
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'CircleGuardApp/1.0' } }
          );
          const nomData = await nomRes.json();
          if (nomData && nomData.address) {
            nomItem = nomData.address;
          }
        } catch (e) {
          console.log('Nominatim fetch error:', e);
        }

        // Native Priority Parsing (Google Maps / Apple Maps on device)
        const nativeStreetNum = cleanAddressPart(nativeItem?.streetNumber);
        const nativeStreetName = cleanAddressPart(nativeItem?.street);
        const nativeName = cleanAddressPart(nativeItem?.name);
        const nativeDistrict = cleanAddressPart(nativeItem?.district);
        const nativeSubregion = cleanAddressPart(nativeItem?.subregion);
        const nativeCity = cleanAddressPart(nativeItem?.city);
        const nativeRegion = cleanAddressPart(nativeItem?.region);

        // OpenStreetMap Nominatim Parsing
        const nomRoad = cleanAddressPart(nomItem?.road || nomItem?.pedestrian || nomItem?.footway || nomItem?.path);
        const nomHouseNum = cleanAddressPart(nomItem?.house_number || nomItem?.building);
        const nomSuburb = cleanAddressPart(nomItem?.suburb || nomItem?.neighbourhood || nomItem?.residential || nomItem?.quarter);
        const nomDistrict = cleanAddressPart(nomItem?.city_district || nomItem?.district || nomItem?.subdistrict || nomItem?.borough);
        const nomCity = cleanAddressPart(nomItem?.city || nomItem?.town || nomItem?.village || nomItem?.municipality || nomItem?.county);
        const nomState = cleanAddressPart(nomItem?.state);

        // Compute Street Name (Street Number + Street Name or Road)
        let street = '';
        if (nativeStreetName) {
          street = nativeStreetNum ? `${nativeStreetNum} ${nativeStreetName}` : nativeStreetName;
        } else if (nomRoad) {
          street = nomHouseNum ? `${nomHouseNum} ${nomRoad}` : nomRoad;
        } else if (nativeName && nativeName !== nativeDistrict && nativeName !== nativeCity) {
          street = nativeName;
        } else if (nomSuburb) {
          street = nomSuburb;
        } else {
          street = 'Thotagri Road';
        }

        // Compute Area / Neighborhood Name
        let areaName = '';
        if (nativeDistrict && nativeDistrict.toLowerCase() !== (nativeCity || '').toLowerCase()) {
          areaName = nativeDistrict;
        } else if (nomSuburb && nomSuburb.toLowerCase() !== (nomCity || '').toLowerCase()) {
          areaName = nomSuburb;
        } else if (nomDistrict && nomDistrict.toLowerCase() !== (nomCity || '').toLowerCase()) {
          areaName = nomDistrict;
        } else if (nativeSubregion && nativeSubregion.toLowerCase() !== (nativeCity || '').toLowerCase()) {
          areaName = nativeSubregion;
        } else if (nativeName && nativeName !== street && nativeName !== nativeCity) {
          areaName = nativeName;
        } else {
          areaName = 'Golden City';
        }

        const city = nativeCity || nomCity || '';
        const state = nativeRegion || nomState || '';
        const country = cleanAddressPart(nativeItem?.country || nomItem?.country || '');
        const postalCode = nativeItem?.postalCode || nomItem?.postcode || 'N/A';

        // Check for saved custom location overrides
        let savedArea = '';
        let savedRoad = '';
        try {
          const a = await AsyncStorage.getItem('@circleguard_custom_area');
          const r = await AsyncStorage.getItem('@circleguard_custom_road');
          if (a) savedArea = a;
          if (r) savedRoad = r;
        } catch (e) {}

        const finalArea = savedArea || (areaName !== 'CURRENT LOCATION' ? areaName : 'Golden City');
        const finalStreet = savedRoad || (street !== 'Current Location' ? street : 'Thotagri Road');

        setFullAddressDetails({
          areaName: finalArea,
          street: finalStreet,
          city,
          state,
          country,
          postalCode,
          latitude: lat,
          longitude: lng,
        });

        setCustomAreaInput(finalArea);
        setCustomRoadInput(finalStreet);

        setAddressTitle(finalArea.toUpperCase());
        setFormattedAddress(`${finalStreet}${city ? ', ' + city : ''}`);
      }
    } catch (e) {
      setFormattedAddress('Thotagri Road');
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
                    {fullAddressDetails.areaName || 'Golden City'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>STREET / ROAD</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>
                    {fullAddressDetails.street || 'Thotagri Road'}
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
