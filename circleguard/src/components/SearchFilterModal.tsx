import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/useThemeStore';
import { POI, fetchCategoryPois } from '../services/PoiService';

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

function parseCoord(item: any): { latitude: number; longitude: number } {
  if (!item) return { latitude: 0, longitude: 0 };
  const dLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat);
  const dLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng);
  if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
    return { latitude: dLat, longitude: dLng };
  }
  if (item.geom) {
    if (typeof item.geom === 'string') {
      const m = item.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (m && m.length >= 3) {
        return { latitude: parseFloat(m[2]), longitude: parseFloat(m[1]) };
      }
    } else if (typeof item.geom === 'object' && Array.isArray(item.geom.coordinates)) {
      return { latitude: parseFloat(item.geom.coordinates[1]), longitude: parseFloat(item.geom.coordinates[0]) };
    }
  }
  return { latitude: 0, longitude: 0 };
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
  onSelectPoi?: (poi: any) => void;
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
  onSelectPoi,
}: SearchFilterModalProps) {
  const { colors, isDark } = useThemeStore();
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [localPois, setLocalPois] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState<string[]>([]);

  useEffect(() => {
    const loadUnit = async () => {
      const u = await AsyncStorage.getItem('@circleguard_distance_unit');
      if (u) setUnit(u as 'km' | 'mi');
    };
    if (visible) {
      setActiveCats(selectedCategories);
      if (poiList && poiList.length > 0) {
        setLocalPois(poiList);
      }
      loadUnit();

      // Pre-fetch POIs for currently active categories if needed
      selectedCategories.forEach(c => {
        if (c !== 'member' && c !== 'place') {
          fetchCategoryPoisForModal(c);
        }
      });
    }
  }, [visible, selectedCategories]);

  // Merge external poiList updates
  useEffect(() => {
    if (poiList && poiList.length > 0) {
      setLocalPois(prev => {
        const merged = [...prev];
        poiList.forEach(p => {
          if (!merged.some(m => m.id === p.id)) {
            merged.push(p);
          }
        });
        return merged;
      });
    }
  }, [poiList]);

  const fetchCategoryPoisForModal = async (catId: string) => {
    if (catId === 'member' || catId === 'place') return;
    const defaultLat = userLoc?.latitude || 20.5937;
    const defaultLng = userLoc?.longitude || 78.9629;
    if (defaultLat === 20.5937 && defaultLng === 78.9629) return;

    setLoadingCats(prev => prev.includes(catId) ? prev : [...prev, catId]);
    try {
      const isMiles = unit === 'mi';
      const results = await fetchCategoryPois(catId, defaultLat, defaultLng, isMiles);
      if (results && results.length > 0) {
        setLocalPois(prev => {
          const filtered = prev.filter(p => p.category !== catId);
          return [...filtered, ...results];
        });
      }
    } catch (e) {
      console.warn(`Error fetching ${catId} POIs for modal:`, e);
    } finally {
      setLoadingCats(prev => prev.filter(c => c !== catId));
    }
  };

  const toggleCategory = (catId: string) => {
    if (activeCats.includes(catId)) {
      setActiveCats(activeCats.filter(c => c !== catId));
    } else {
      const next = [...activeCats, catId];
      setActiveCats(next);
      if (catId !== 'member' && catId !== 'place') {
        const hasExisting = localPois.some(p => p.category === catId);
        if (!hasExisting) {
          fetchCategoryPoisForModal(catId);
        }
      }
    }
  };

  const handleSelectAll = () => {
    const all = ['hospital', 'school', 'police', 'restaurant', 'fuel', 'member', 'place'];
    setActiveCats(all);
    all.forEach(c => {
      if (c !== 'member' && c !== 'place') {
        fetchCategoryPoisForModal(c);
      }
    });
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

  const formatDistance = (meters: number) => {
    if (unit === 'mi') {
      const mi = meters / 1609.34;
      return mi < 0.1 ? `${Math.round(meters * 3.28084)} ft away` : `${mi.toFixed(1)} mi away`;
    }
    return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
  };

  const getCategoryColor = (catId: string) => {
    switch (catId) {
      case 'hospital': return '#EF4444'; // SOS Red Emergency
      case 'police': return '#2563EB'; // Cobalt Security Blue
      case 'school': return '#0284C7'; // Cyan Education
      case 'fuel': return '#F97316'; // Dynamic Energy Orange
      case 'restaurant': return '#F59E0B'; // Luxury Amber Gold
      case 'member': return '#8B5CF6'; // Circle Royal Violet
      case 'place': return '#10B981'; // Perimeter Safe Emerald
      default: return '#64748B';
    }
  };

  const getCategoryIcon = (catId: string): any => {
    switch (catId) {
      case 'hospital': return 'medical';
      case 'police': return 'shield-checkmark';
      case 'school': return 'school';
      case 'fuel': return 'flash';
      case 'restaurant': return 'restaurant';
      case 'member': return 'people';
      case 'place': return 'shield';
      default: return 'location';
    }
  };

  const getCategorySummary = (catId: string) => {
    const defaultLat = userLoc?.latitude || 20.5937;
    const defaultLng = userLoc?.longitude || 78.9629;

    if (catId === 'member') {
      const nonSelf = members.filter(m => String(m.user_id).toLowerCase() !== String(m.profile?.id || '').toLowerCase());
      const withLoc = nonSelf.filter(m => m.latitude && m.longitude);
      if (withLoc.length > 0) {
        const closest = withLoc.map(m => ({
          name: m.profile?.full_name || 'Member',
          dist: getDistanceInMeters(defaultLat, defaultLng, m.latitude, m.longitude)
        })).sort((a, b) => a.dist - b.dist)[0];
        return `Closest: ${closest.name.split(' ')[0]} • ${formatDistance(closest.dist)}`;
      }
      return `${members.length} Members in Circle`;
    }

    if (catId === 'place') {
      if (places.length > 0) {
        const withLoc = places.map(p => {
          const pt = parseCoord(p);
          return {
            name: p.name || 'Safe Zone',
            dist: pt.latitude ? getDistanceInMeters(defaultLat, defaultLng, pt.latitude, pt.longitude) : 9999999
          };
        }).filter(p => p.dist < 9999999).sort((a, b) => a.dist - b.dist);

        if (withLoc.length > 0) {
          return `Closest: ${withLoc[0].name} • ${formatDistance(withLoc[0].dist)}`;
        }
      }
      return `${places.length} Saved Geofences`;
    }

    if (loadingCats.includes(catId)) {
      return 'Scanning live nearby places...';
    }

    const catPois = [...localPois, ...(poiList || [])].filter(p => p.category === catId);
    if (catPois.length === 0) {
      return `Tap to scan closest ${catId}s`;
    }

    const sorted = catPois.map(p => ({
      name: p.name,
      dist: getDistanceInMeters(defaultLat, defaultLng, p.lat, p.lng)
    })).sort((a, b) => a.dist - b.dist);

    return `Closest: ${sorted[0].name} • ${formatDistance(sorted[0].dist)} (${catPois.length} found)`;
  };

  // Compute all matching nearby places strictly sorted ascending by distance (closest first!)
  const nearbyPlaces = useMemo(() => {
    const defaultLat = userLoc?.latitude || 20.5937;
    const defaultLng = userLoc?.longitude || 78.9629;
    const list: any[] = [];

    // 1. POIs
    const combinedPois = [...localPois];
    (poiList || []).forEach(p => {
      if (!combinedPois.some(cp => cp.id === p.id)) {
        combinedPois.push(p);
      }
    });

    combinedPois.forEach(p => {
      if (activeCats.includes(p.category)) {
        const dMeters = getDistanceInMeters(defaultLat, defaultLng, p.lat, p.lng);
        list.push({
          id: p.id,
          name: p.name,
          subText: p.subText || `${p.category.toUpperCase()} nearby`,
          category: p.category,
          lat: p.lat,
          lng: p.lng,
          distMeters: dMeters,
          formattedDist: formatDistance(dMeters),
        });
      }
    });

    // 2. Safe Places / Geofences
    if (activeCats.includes('place') && places && places.length > 0) {
      places.forEach(p => {
        const pt = parseCoord(p);
        if (pt.latitude && pt.longitude) {
          const dMeters = getDistanceInMeters(defaultLat, defaultLng, pt.latitude, pt.longitude);
          list.push({
            id: p.id,
            name: p.name || 'Safe Place',
            subText: `Safe Zone • ${p.radius_m || 150}m radius`,
            category: 'place',
            lat: pt.latitude,
            lng: pt.longitude,
            distMeters: dMeters,
            formattedDist: formatDistance(dMeters),
          });
        }
      });
    }

    // 3. Circle Members
    if (activeCats.includes('member') && members && members.length > 0) {
      members.forEach(m => {
        const isSelf = String(m.user_id).toLowerCase() === String(m.profile?.id || '').toLowerCase();
        if (isSelf) return;
        const lat = m.latitude;
        const lng = m.longitude;
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          const dMeters = getDistanceInMeters(defaultLat, defaultLng, lat, lng);
          list.push({
            id: m.user_id,
            name: m.profile?.full_name || 'Member',
            subText: m.isOnline ? 'Online • Live GPS telemetry' : 'Offline',
            category: 'member',
            lat,
            lng,
            distMeters: dMeters,
            formattedDist: formatDistance(dMeters),
          });
        }
      });
    }

    // STRICT ASCENDING SORT: Closest nearby places always at the very top!
    return list.sort((a, b) => a.distMeters - b.distMeters);
  }, [activeCats, localPois, poiList, places, members, userLoc, unit]);

  const filterOptions = [
    { id: 'hospital', title: 'Hospitals / Emergency Clinics', icon: 'medical', color: '#EF4444' },
    { id: 'police', title: 'Police Stations & Helplines', icon: 'shield-checkmark', color: '#2563EB' },
    { id: 'school', title: 'Schools & Universities', icon: 'school', color: '#0284C7' },
    { id: 'fuel', title: 'Fuel & EV Fast Chargers', icon: 'flash', color: '#F97316' },
    { id: 'restaurant', title: 'Dining, Food & Cafes', icon: 'restaurant', color: '#F59E0B' },
    { id: 'member', title: 'Circle Member Pins', icon: 'people', color: '#8B5CF6' },
    { id: 'place', title: 'Safe Places & Geofences', icon: 'shield', color: '#10B981' },
  ];

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

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

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [
                {
                  translateY: translateY.interpolate({
                    inputRange: [-50, 0, 600],
                    outputRange: [0, 0, 600],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {/* Top Interactive Drag-to-Dismiss / Tap-to-Close Handle */}
          <TouchableOpacity
            style={styles.handleContainer}
            onPress={onClose}
            activeOpacity={0.7}
            {...panResponder.panHandlers}
            accessibilityLabel="Drag down or tap to close map filters"
          >
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>RADAR & MAP FILTERS</Text>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filter Map Layers</Text>
            </View>
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

          {/* Quick Category Selector Pills */}
          <View style={styles.quickPillsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPillsContainer}>
              {filterOptions.map((item) => {
                const isSelected = activeCats.includes(item.id);
                const isLoadingThis = loadingCats.includes(item.id);

                return (
                  <TouchableOpacity
                    key={`pill_${item.id}`}
                    style={[
                      styles.quickFilterPill,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(255, 255, 255, 0.16)' : '#0F172A')
                          : (isDark ? colors.surfaceMuted : '#F1F5F9'),
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : colors.border,
                      }
                    ]}
                    onPress={() => toggleCategory(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pillIconBox, { backgroundColor: item.color }]}>
                      <Ionicons name={item.icon as any} size={11} color="#FFFFFF" />
                    </View>
                    <Text style={[
                      styles.pillText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textMuted,
                        fontWeight: isSelected ? '800' : '600',
                      }
                    ]}>
                      {item.title.split('/')[0].split('&')[0].trim()}
                    </Text>
                    {isLoadingThis ? (
                      <ActivityIndicator size="small" color={item.color} style={{ transform: [{ scale: 0.6 }] }} />
                    ) : isSelected ? (
                      <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Scrollable Content */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* 1. NEARBY THINGS (CLOSEST FIRST) - SHOWN FIRST! */}
            <View style={styles.nearbySection}>
              <View style={styles.nearbySectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="navigate-circle" size={17} color={colors.accentGold} />
                  <Text style={[styles.nearbySectionTitle, { color: colors.foreground }]}>
                    NEARBY THINGS (CLOSEST FIRST)
                  </Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  <Text style={[styles.countBadgeText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>{nearbyPlaces.length} FOUND</Text>
                </View>
              </View>

              {loadingCats.length > 0 && (
                <View style={[styles.scanningBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' }]}>
                  <ActivityIndicator size="small" color={colors.accentGold} />
                  <Text style={[styles.scanningText, { color: colors.textMuted }]}>
                    Scanning live places around your coordinates...
                  </Text>
                </View>
              )}

              {activeCats.length === 0 && (
                <View style={styles.emptyNearbyBox}>
                  <Ionicons name="filter-outline" size={28} color={colors.textMuted} />
                  <Text style={[styles.emptyNearbyTitle, { color: colors.foreground }]}>
                    No Filter Selected
                  </Text>
                  <Text style={[styles.emptyNearbyText, { color: colors.textMuted }]}>
                    Tap any filter pill above (e.g. Hospitals, Fuel, Police) to immediately see live nearby places closest to your current location.
                  </Text>
                </View>
              )}

              {activeCats.length > 0 && nearbyPlaces.length === 0 && loadingCats.length === 0 && (
                <View style={styles.emptyNearbyBox}>
                  <Ionicons name="location-outline" size={28} color={colors.textMuted} />
                  <Text style={[styles.emptyNearbyTitle, { color: colors.foreground }]}>
                    No Places in Immediate Range
                  </Text>
                  <Text style={[styles.emptyNearbyText, { color: colors.textMuted }]}>
                    No places found for the selected category within your immediate vicinity. As you move, related places will automatically appear.
                  </Text>
                </View>
              )}

              {nearbyPlaces.map((place, idx) => (
                <TouchableOpacity
                  key={`nearby_${place.category}_${place.id}_${idx}`}
                  style={[
                    styles.nearbyPoiCard,
                    {
                      backgroundColor: isDark ? colors.surfaceMuted : '#F8FAFC',
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => {
                    if (onSelectPoi) {
                      onSelectPoi(place);
                      onClose();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rankBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)' }]}>
                    <Text style={[styles.rankBadgeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>#{idx + 1}</Text>
                  </View>
                  <View style={[styles.poiIconBox, { backgroundColor: getCategoryColor(place.category) }]}>
                    <Ionicons name={getCategoryIcon(place.category)} size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.poiCardName, { color: colors.foreground }]} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={[styles.poiCardSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {place.subText}
                    </Text>
                  </View>
                  <View style={[
                    styles.distancePill,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                    }
                  ]}>
                    <Ionicons name="navigate" size={10} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.distancePillText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {place.formattedDist}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2. CATEGORY BREAKDOWN & RADAR SETTINGS */}
            <View style={[styles.categorySettingsSection, { borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>CATEGORY DETAILS & LIVE STATUS</Text>
              {filterOptions.map((item) => {
                const isSelected = activeCats.includes(item.id);
                const summaryText = getCategorySummary(item.id);
                const isLoadingThis = loadingCats.includes(item.id);

                return (
                  <TouchableOpacity
                    key={`cat_detail_${item.id}`}
                    style={[
                      styles.filterRow,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.10)'
                            : '#F8FAFC'
                          : isDark
                          ? colors.surfaceMuted
                          : '#FFFFFF',
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : colors.border,
                        borderWidth: isSelected ? 1.8 : 1,
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
                        <Text style={[styles.rowTitle, { color: colors.foreground, fontWeight: isSelected ? '800' : '700' }]}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {isLoadingThis && (
                            <ActivityIndicator size="small" color={item.color} style={{ transform: [{ scale: 0.65 }] }} />
                          )}
                          <Text style={[styles.rowSubtitle, { color: isSelected ? colors.foreground : colors.textMuted }]} numberOfLines={1}>
                            {summaryText}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={[
                      styles.customCheckbox,
                      {
                        borderColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1'),
                        backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : 'transparent',
                      }
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={13} color={isDark ? '#0F172A' : '#FFFFFF'} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Apply Button */}
          <TouchableOpacity
            style={[
              styles.applyBtn,
              {
                backgroundColor: activeCats.length > 0 ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9'),
                borderWidth: 1.5,
                borderColor: activeCats.length > 0 ? (isDark ? '#FFFFFF' : '#0F172A') : colors.border,
              }
            ]}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <Text style={[styles.applyBtnText, { color: activeCats.length > 0 ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted }]}>
              {activeCats.length > 0
                ? `APPLY MAP FILTERS (${activeCats.length} ACTIVE • ${nearbyPlaces.length} NEARBY)`
                : 'CLEAR ALL FILTERS (CLEAN MAP)'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
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
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 22,
    maxHeight: '88%',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 10,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    marginBottom: 8,
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
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  quickPillsWrapper: {
    marginBottom: 10,
  },
  quickPillsContainer: {
    gap: 8,
    paddingVertical: 2,
  },
  quickFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.2,
  },
  pillIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  scrollList: {
    maxHeight: 460,
    marginBottom: 14,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 7,
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
  nearbySection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  nearbySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nearbySectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: '900',
  },
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  scanningText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyNearbyBox: {
    alignItems: 'center',
    padding: 18,
    gap: 6,
  },
  emptyNearbyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyNearbyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  rankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  categorySettingsSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  nearbyPoiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 7,
  },
  poiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  poiCardName: {
    fontSize: 13,
    fontWeight: '700',
  },
  poiCardSub: {
    fontSize: 11,
    marginTop: 1.5,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  distancePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  applyBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
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
  customCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
