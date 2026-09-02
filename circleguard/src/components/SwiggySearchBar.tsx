import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

interface SwiggySearchBarProps {
  safePlaces?: any[];
}

export default function SwiggySearchBar({ safePlaces = [] }: SwiggySearchBarProps) {
  const { colors, isDark } = useThemeStore();
  const { members, activeCircle, places: storePlaces, fetchPlaces } = useCircleStore();
  const navigation = useNavigation<any>();

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbPlaces, setDbPlaces] = useState<any[]>([]);
  const [externalLocations, setExternalLocations] = useState<any[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Load safe places whenever modal opens or active circle changes
  useEffect(() => {
    if (activeCircle?.id) {
      fetchPlaces(activeCircle.id);
      (async () => {
        try {
          const { data } = await supabase
            .from('places')
            .select('*')
            .eq('circle_id', activeCircle.id);
          if (data && data.length > 0) {
            setDbPlaces(data);
          }
        } catch (e) {}
      })();
    }
  }, [activeCircle?.id, modalVisible]);

  // Combine and deduplicate all circle safe places
  const allSafePlaces = useMemo(() => {
    const combined = [...safePlaces, ...(storePlaces || []), ...dbPlaces];
    const seen = new Set<string>();
    const unique: any[] = [];
    combined.forEach((p) => {
      const key = p.id || `${p.name}_${p.latitude || p.start_lat}`;
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    });
    return unique;
  }, [safePlaces, storePlaces, dbPlaces]);

  // Filter circle members
  const filteredMembers = (members || []).filter((m: any) => {
    if (!searchQuery.trim()) return true;
    const name = m.profile?.full_name || m.full_name || '';
    const phone = m.profile?.phone || m.phone || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || phone.includes(query);
  });

  // Filter safe places by name, category, and address
  const filteredPlaces = allSafePlaces.filter((p: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const addr = (p.address || '').toLowerCase();
    return name.includes(query) || cat.includes(query) || addr.includes(query);
  });

  const activeControllerRef = useRef<AbortController | null>(null);

  // Live Geocoded External Places Search (Nominatim / OpenStreetMap)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setExternalLocations([]);
      setIsSearchingExternal(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingExternal(true);
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const queryEncoded = encodeURIComponent(q);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${queryEncoded}&limit=6&addressdetails=1`;

        const res = await fetch(url, {
          headers: { 'User-Agent': 'CircleGuardApp/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setExternalLocations(
              data.map((item) => ({
                id: item.place_id,
                name: item.display_name?.split(',')[0] || item.display_name,
                fullAddress: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type || item.class || 'location',
              }))
            );
          }
        }
      } catch (e) {
        // network fallback / abort ignored
      } finally {
        activeControllerRef.current = null;
        setIsSearchingExternal(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
    };
  }, [searchQuery]);

  const parsePlaceCoords = (p: any): { latitude: number; longitude: number } => {
    let lat = parseFloat(p.start_lat || p.latitude || '0');
    let lng = parseFloat(p.start_lng || p.longitude || '0');

    if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && p.geom) {
      if (typeof p.geom === 'string') {
        const match = p.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
        if (match && match.length >= 3) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      } else if (typeof p.geom === 'object' && Array.isArray(p.geom.coordinates)) {
        lng = parseFloat(p.geom.coordinates[0]);
        lat = parseFloat(p.geom.coordinates[1]);
      }
    }
    return { latitude: lat || 0, longitude: lng || 0 };
  };

  const handleSelectMember = (member: any) => {
    setModalVisible(false);
    setSearchQuery('');
    const name = member.profile?.full_name || member.full_name || 'Member';
    const memberId = member.user_id || member.id;
    const lat = Number(member.latitude);
    const lng = Number(member.longitude);

    navigation.navigate('MainTabs', {
      screen: 'Map',
      params: {
        focusUserId: memberId,
        focusLat: !isNaN(lat) && lat !== 0 ? lat : undefined,
        focusLng: !isNaN(lng) && lng !== 0 ? lng : undefined,
        focusUserName: name,
      },
    });
  };

  const handleSelectPlace = (place: any) => {
    setModalVisible(false);
    setSearchQuery('');
    const { latitude: pLat, longitude: pLng } = parsePlaceCoords(place);

    navigation.navigate('MainTabs', {
      screen: 'Map',
      params: {
        focusLat: !isNaN(pLat) && pLat !== 0 ? pLat : undefined,
        focusLng: !isNaN(pLng) && pLng !== 0 ? pLng : undefined,
        focusUserName: place.name || 'Safe Place',
      },
    });
  };

  const handleSelectExternalLocation = (loc: any) => {
    setModalVisible(false);
    setSearchQuery('');

    navigation.navigate('MainTabs', {
      screen: 'Map',
      params: {
        focusLat: loc.lat,
        focusLng: loc.lng,
        focusUserName: loc.name,
      },
    });
  };

  const getCategoryIcon = (category?: string) => {
    const cat = String(category || '').toLowerCase();
    if (cat === 'home') return 'home';
    if (cat === 'work' || cat === 'office') return 'briefcase';
    if (cat === 'school' || cat === 'college') return 'school';
    if (cat === 'gym') return 'fitness';
    if (cat === 'hospital') return 'medkit';
    return 'shield-checkmark';
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.searchBarContainer,
          {
            backgroundColor: isDark ? colors.surface : '#F8FAFC',
            borderColor: colors.border,
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={17} color={colors.accentGold || '#10B981'} />
        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
          Search family members or places...
        </Text>
        <View style={styles.rightIconsRow}>
          <Ionicons name="mic-outline" size={17} color={colors.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Quick Search Overlay Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.searchCard,
              {
                backgroundColor: isDark ? '#1C1D24' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            {/* Search Input Bar */}
            <View
              style={[
                styles.activeSearchInputWrap,
                {
                  backgroundColor: isDark ? '#282A36' : '#F1F5F9',
                  borderColor: colors.accentGold || '#10B981',
                },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.accentGold || '#10B981'} />
              <TextInput
                style={[styles.activeTextInput, { color: colors.foreground }]}
                placeholder="Search member, safe place, city, or address..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {isSearchingExternal ? (
                <ActivityIndicator size="small" color={colors.accentGold || '#10B981'} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results List */}
            <ScrollView
              style={styles.resultsScrollView}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Safe Places Section */}
              {filteredPlaces.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="shield-checkmark" size={13} color={colors.accentGold || '#10B981'} />
                    <Text style={[styles.sectionTitle, { color: colors.accentGold || '#10B981' }]}>
                      CIRCLE SAFE PLACES ({filteredPlaces.length})
                    </Text>
                  </View>
                  {filteredPlaces.map((p: any) => {
                    const iconName = getCategoryIcon(p.category);
                    return (
                      <TouchableOpacity
                        key={p.id || p.name}
                        style={[styles.resultRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                        onPress={() => handleSelectPlace(p)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.placeIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                          <Ionicons name={iconName} size={18} color="#10B981" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.resultTitle, { color: colors.foreground }]}>{p.name}</Text>
                          <Text style={[styles.resultSub, { color: colors.textMuted }]}>
                            {p.category ? `${p.category.toUpperCase()} • ` : ''}Radius: {p.radius_m || 150}m
                          </Text>
                        </View>
                        <View style={styles.viewOnMapPill}>
                          <Text style={styles.viewOnMapText}>VIEW</Text>
                          <Ionicons name="chevron-forward" size={13} color={colors.accentGold || '#10B981'} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Members Section */}
              {filteredMembers.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="people" size={13} color={colors.accentGold || '#10B981'} />
                    <Text style={[styles.sectionTitle, { color: colors.accentGold || '#10B981' }]}>
                      CIRCLE MEMBERS ({filteredMembers.length})
                    </Text>
                  </View>
                  {filteredMembers.map((m: any, idx: number) => {
                    const name = m.profile?.full_name || m.full_name || 'Member';
                    const avatarUrl = m.profile?.avatar_url || m.avatar_url;
                    const initial = String(name).charAt(0).toUpperCase();
                    const key = m.user_id || m.id || `search-member-${idx}`;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.resultRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                        onPress={() => handleSelectMember(m)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.resultAvatarBox, { backgroundColor: isDark ? '#2C2C2E' : '#E2E8F0' }]}>
                          {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.resultAvatarImg} />
                          ) : (
                            <Text style={[styles.resultInitial, { color: colors.foreground }]}>
                              {initial}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.resultTitle, { color: colors.foreground }]}>{name}</Text>
                          <Text style={[styles.resultSub, { color: colors.textMuted }]}>
                            {m.latitude ? 'Tap to view live location' : (m.isOnline ? 'Active' : 'Offline')}
                          </Text>
                        </View>
                        <Ionicons name="navigate-outline" size={18} color={colors.accentGold || '#10B981'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Live Geocoded Places & Addresses Section */}
              {externalLocations.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="map" size={13} color={colors.accentGold || '#10B981'} />
                    <Text style={[styles.sectionTitle, { color: colors.accentGold || '#10B981' }]}>
                      MATCHING PLACES & ADDRESSES ({externalLocations.length})
                    </Text>
                  </View>
                  {externalLocations.map((loc: any) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.resultRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                      onPress={() => handleSelectExternalLocation(loc)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.placeIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                        <Ionicons name="location-outline" size={18} color="#3B82F6" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>{loc.name}</Text>
                        <Text style={[styles.resultSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {loc.fullAddress}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Empty State */}
              {filteredPlaces.length === 0 && filteredMembers.length === 0 && externalLocations.length === 0 && !isSearchingExternal && (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="search-outline" size={36} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>No places or members found</Text>
                  <Text style={[styles.emptyStateSub, { color: colors.textMuted }]}>
                    Try searching for a different name, safe zone, landmark, or street address.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginHorizontal: 0,
    marginBottom: 12,
    gap: 8,
  },
  placeholderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  rightIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  searchCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  activeSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  activeTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  resultsScrollView: {
    flexGrow: 0,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  resultAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  resultInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 11,
    marginTop: 1,
  },
  placeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOnMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  viewOnMapText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
