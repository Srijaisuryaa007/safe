import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface SearchFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onApplyFilters: (categories: string[]) => void;
  poiList: any[];
  members: any[];
  places: any[];
  userLoc: { latitude: number; longitude: number } | null;
}

export default function SearchFilterModal({
  visible,
  onClose,
  selectedCategories,
  onApplyFilters,
  poiList,
  members,
  places,
  userLoc,
}: SearchFilterModalProps) {
  const { colors } = useThemeStore();
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [unit, setUnit] = useState<'km' | 'mi'>('km');

  useEffect(() => {
    const loadUnit = async () => {
      const u = await AsyncStorage.getItem('@circleguard_distance_unit');
      if (u) setUnit(u as 'km' | 'mi');
    };
    if (visible) {
      setActiveCats(selectedCategories);
      loadUnit();
    }
  }, [visible, selectedCategories]);

  const toggleCategory = (catId: string) => {
    if (activeCats.includes(catId)) {
      setActiveCats(activeCats.filter(c => c !== catId));
    } else {
      setActiveCats([...activeCats, catId]);
    }
  };

  const handleSelectAll = () => {
    setActiveCats(['hospital', 'school', 'police', 'restaurant', 'fuel', 'member', 'place']);
  };

  const handleReset = () => {
    setActiveCats([]);
  };

  const handleApply = () => {
    onApplyFilters(activeCats);
    onClose();
  };

  const formatDefaultDist = (kmVal: number) => {
    if (unit === 'mi') {
      const milesVal = kmVal * 0.621371;
      return `${milesVal.toFixed(1)} mi away`;
    }
    return `${kmVal.toFixed(1)} km away`;
  };

  const getNearestDistance = (catId: string) => {
    if (!userLoc) return 'Nearby';

    if (catId === 'member') {
      const onlineCount = members.filter(m => m.isOnline).length;
      return `${members.length} Members (${onlineCount} Online)`;
    }

    if (catId === 'place') {
      return `${places.length} Saved Zones`;
    }

    const categoryPois = poiList.filter(p => p.category === catId);
    if (categoryPois.length === 0) return '0 Nearby';

    const distances = categoryPois.map(p => {
      return getDistanceInMeters(userLoc.latitude, userLoc.longitude, p.lat, p.lng);
    });

    const minMeters = Math.min(...distances);
    const isMiles = unit === 'mi';
    const formattedVal = isMiles
      ? `${(minMeters / 1609.34).toFixed(1)} mi away`
      : `${(minMeters / 1000).toFixed(1)} km away`;

    return `Nearest: ${formattedVal} (${categoryPois.length} found)`;
  };

  const filterOptions = [
    { id: 'hospital', title: 'Hospitals / Clinics', icon: 'medical', color: '#EF4444', defaultDistance: formatDefaultDist(1.2) },
    { id: 'school', title: 'Schools / Universities', icon: 'school', color: '#3B82F6', defaultDistance: formatDefaultDist(0.8) },
    { id: 'police', title: 'Police Stations', icon: 'shield-checkmark', color: '#D4AF37', defaultDistance: formatDefaultDist(2.4) },
    { id: 'restaurant', title: 'Dining & Cafes', icon: 'restaurant', color: '#F59E0B', defaultDistance: formatDefaultDist(0.5) },
    { id: 'fuel', title: 'Fuel Stations', icon: 'car', color: '#10B981', defaultDistance: formatDefaultDist(1.1) },
    { id: 'member', title: 'Circle Members', icon: 'people', color: '#10B981', defaultDistance: `${members.length} Members` },
    { id: 'place', title: 'Safe Places & Geofences', icon: 'bookmark', color: '#D4AF37', defaultDistance: `${places.length} Places` },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MAP INTELLIGENCE</Text>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filter Map Layers</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionHeader}>
            <TouchableOpacity onPress={handleSelectAll}>
              <Text style={[styles.actionText, { color: colors.accentGold }]}>SELECT ALL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset}>
              <Text style={[styles.actionText, { color: colors.textMuted }]}>RESET</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {filterOptions.map((item) => {
              const isSelected = activeCats.includes(item.id);
              const subtitleText = isSelected ? getNearestDistance(item.id) : item.defaultDistance;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.filterRow,
                    {
                      backgroundColor: isSelected ? 'rgba(212, 175, 55, 0.12)' : colors.background,
                      borderColor: isSelected ? colors.accentGold : colors.border,
                    },
                  ]}
                  onPress={() => toggleCategory(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: `${item.color}20` }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.rowSubtitle, { color: isSelected ? colors.accentGold : colors.textMuted }]}>
                        {subtitleText}
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={isSelected}
                    onValueChange={() => toggleCategory(item.id)}
                    trackColor={{ false: '#374151', true: colors.accentGold }}
                    thumbColor={isSelected ? '#1A1A1A' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.accentGold }]}
            onPress={handleApply}
          >
            <Text style={styles.applyBtnText}>APPLY MAP LAYERS ({activeCats.length})</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  scrollList: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  applyBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
