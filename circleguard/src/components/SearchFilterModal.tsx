import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { generateFallbackPois } from '../services/PoiService';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const { colors, isDark } = useThemeStore();
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
    onApplyFilters([]);
    onClose();
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
    const defaultLat = userLoc?.latitude || 20.5937;
    const defaultLng = userLoc?.longitude || 78.9629;

    if (catId === 'member') {
      const onlineCount = members.filter(m => m.isOnline).length;
      return `${members.length} Members (${onlineCount} Online)`;
    }

    if (catId === 'place') {
      return `${places.length} Saved Geofences`;
    }

    let categoryPois = poiList.filter(p => p.category === catId);
    if (categoryPois.length === 0) {
      categoryPois = generateFallbackPois(catId, defaultLat, defaultLng, unit === 'mi');
    }

    const distances = categoryPois.map(p => {
      return getDistanceInMeters(defaultLat, defaultLng, p.lat, p.lng);
    });

    const minMeters = distances.length > 0 ? Math.min(...distances) : 500;
    const isMiles = unit === 'mi';
    const formattedVal = isMiles
      ? `${(minMeters / 1609.34).toFixed(1)} mi away`
      : `${(minMeters / 1000).toFixed(1)} km away`;

    return `Nearest: ${formattedVal} (${categoryPois.length} nodes)`;
  };

  const filterOptions = [
    { id: 'hospital', title: 'Hospitals / Emergency Clinics', icon: 'medical', color: '#EF4444', defaultDistance: formatDefaultDist(0.8) },
    { id: 'police', title: 'Police Stations & Helplines', icon: 'shield-checkmark', color: '#D4AF37', defaultDistance: formatDefaultDist(1.2) },
    { id: 'school', title: 'Schools & Universities', icon: 'school', color: '#3B82F6', defaultDistance: formatDefaultDist(0.6) },
    { id: 'fuel', title: 'Fuel & EV Fast Chargers', icon: 'car', color: '#10B981', defaultDistance: formatDefaultDist(1.0) },
    { id: 'restaurant', title: 'Dining, Food & Cafes', icon: 'restaurant', color: '#F59E0B', defaultDistance: formatDefaultDist(0.4) },
    { id: 'member', title: 'Circle Member Pins', icon: 'people', color: '#8B5CF6', defaultDistance: `${members.length} Members` },
    { id: 'place', title: 'Safe Places & Geofences', icon: 'bookmark', color: '#EC4899', defaultDistance: `${places.length} Places` },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MAP INTELLIGENCE</Text>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filter Map Layers</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionHeader}>
            <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
              <Text style={[styles.actionText, { color: colors.accentGold }]}>SELECT ALL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text style={[styles.actionText, { color: colors.textMuted }]}>RESET ALL</Text>
            </TouchableOpacity>
          </View>

          {/* Options List */}
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
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(212, 175, 55, 0.12)'
                          : '#FEF9C3'
                        : isDark
                        ? colors.surfaceMuted
                        : '#F4F4F5',
                      borderColor: isSelected ? colors.accentGold : colors.border,
                    },
                  ]}
                  onPress={() => toggleCategory(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                      <Ionicons name={item.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[styles.rowSubtitle, { color: isSelected ? colors.foreground : colors.textMuted }]}>
                        {subtitleText}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? colors.accentGold : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Apply Button */}
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: activeCats.length > 0 ? colors.accentGold : colors.surface, borderWidth: 1.5, borderColor: colors.accentGold }]}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <Text style={[styles.applyBtnText, { color: activeCats.length > 0 ? '#1A1A1A' : colors.accentGold }]}>
              {activeCats.length > 0 
                ? `APPLY MAP FILTERS (${activeCats.length} ACTIVE)`
                : 'CLEAR ALL FILTERS (CLEAN MAP)'}
            </Text>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 22,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollList: {
    maxHeight: 320,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  applyBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  applyBtnText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
