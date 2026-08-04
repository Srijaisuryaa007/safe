import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    if (visible) {
      setActiveCats(selectedCategories);
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
      const meters = getDistanceInMeters(userLoc.latitude, userLoc.longitude, p.lat, p.lng);
      return meters / 1000;
    });

    const minKm = Math.min(...distances);
    return `Nearest: ${minKm.toFixed(1)} km away (${categoryPois.length} found)`;
  };

  const filterOptions = [
    { id: 'hospital', title: 'Hospitals / Clinics', icon: 'medical', color: '#EF4444', defaultDistance: '1.2 km away' },
    { id: 'school', title: 'Schools / Universities', icon: 'school', color: '#3B82F6', defaultDistance: '0.8 km away' },
    { id: 'police', title: 'Police Stations', icon: 'shield-checkmark', color: '#D4AF37', defaultDistance: '2.4 km away' },
    { id: 'restaurant', title: 'Dining & Cafes', icon: 'restaurant', color: '#F59E0B', defaultDistance: '0.5 km away' },
    { id: 'fuel', title: 'Fuel Stations', icon: 'car', color: '#10B981', defaultDistance: '1.1 km away' },
    { id: 'member', title: 'Circle Members', icon: 'person', color: '#A855F7', defaultDistance: 'Live Online Status' },
    { id: 'place', title: 'Bookmarked Places', icon: 'bookmark', color: '#EC4899', defaultDistance: 'Saved Safe Zones' },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleBox}>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MAP SEARCH FILTERS</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Filter Categories</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Filter Items */}
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.quickActions}>
              <TouchableOpacity onPress={handleSelectAll} style={[styles.quickBtn, { borderColor: colors.border }]}>
                <Text style={[styles.quickBtnText, { color: colors.accentGold }]}>SELECT ALL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReset} style={[styles.quickBtn, { borderColor: colors.border }]}>
                <Text style={[styles.quickBtnText, { color: colors.textMuted }]}>RESET</Text>
              </TouchableOpacity>
            </View>

            {filterOptions.map(opt => {
              const isChecked = activeCats.includes(opt.id);
              const liveDist = getNearestDistance(opt.id);

              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.filterRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isChecked && { borderColor: opt.color, borderWidth: 1.5 }
                  ]}
                  onPress={() => toggleCategory(opt.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: opt.color }]}>
                      <Ionicons name={opt.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.textWrapper}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{opt.title}</Text>
                      <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                        {liveDist !== '0 Nearby' ? liveDist : opt.defaultDistance}
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={isChecked}
                    onValueChange={() => toggleCategory(opt.id)}
                    trackColor={{ false: colors.border, true: opt.color }}
                    thumbColor="#FFFFFF"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.accentGold }]}
              onPress={handleApply}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-sharp" size={18} color="#1A1A1A" />
              <Text style={styles.applyBtnText}>APPLY SEARCH FILTERS</Text>
            </TouchableOpacity>
          </View>
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
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 6,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  textWrapper: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 11,
  },
  footer: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  applyBtnText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
