import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';

interface SwiggySearchBarProps {
  safePlaces?: any[];
}

export default function SwiggySearchBar({ safePlaces = [] }: SwiggySearchBarProps) {
  const { colors, isDark } = useThemeStore();
  const { members, activeCircle } = useCircleStore();
  const navigation = useNavigation<any>();

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = (members || []).filter((m: any) => {
    const name = m.profile?.full_name || m.full_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPlaces = safePlaces.filter((p: any) =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    const pLat = parseFloat(place.latitude || place.start_lat || '0');
    const pLng = parseFloat(place.longitude || place.start_lng || '0');

    navigation.navigate('MainTabs', {
      screen: 'Map',
      params: {
        focusLat: !isNaN(pLat) && pLat !== 0 ? pLat : undefined,
        focusLng: !isNaN(pLng) && pLng !== 0 ? pLng : undefined,
        focusUserName: place.name,
      },
    });
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
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.searchCard,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            {/* Search Input Bar */}
            <View
              style={[
                styles.activeSearchInputWrap,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9',
                  borderColor: colors.accentGold || '#10B981',
                },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.accentGold || '#10B981'} />
              <TextInput
                style={[styles.activeTextInput, { color: colors.foreground }]}
                placeholder="Search by name, place, or address..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            <FlatList
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <View style={{ paddingTop: 10 }}>
                  {/* Members Section */}
                  <Text style={[styles.sectionTitle, { color: colors.accentGold || '#10B981' }]}>
                    CIRCLE MEMBERS ({filteredMembers.length})
                  </Text>
                  {filteredMembers.map((m: any, idx: number) => {
                    const name = m.profile?.full_name || m.full_name || 'Member';
                    const avatarUrl = m.profile?.avatar_url || m.avatar_url;
                    const initial = String(name).charAt(0).toUpperCase();
                    const key = m.user_id || m.id || `search-member-${idx}`;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.resultRow, { borderBottomColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}
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
                            {m.latitude ? 'Tap to view live location' : 'Offline'}
                          </Text>
                        </View>
                        <Ionicons name="navigate-outline" size={18} color={colors.accentGold || '#10B981'} />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Safe Places Section */}
                  {filteredPlaces.length > 0 ? (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.accentGold || '#10B981', marginTop: 16 }]}>
                        SAFE PLACES ({filteredPlaces.length})
                      </Text>
                      {filteredPlaces.map((p: any) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.resultRow, { borderBottomColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}
                          onPress={() => handleSelectPlace(p)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.placeIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                            <Ionicons name="location" size={18} color={colors.accentGold} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.resultTitle, { color: colors.foreground }]}>{p.name}</Text>
                            <Text style={[styles.resultSub, { color: colors.textMuted }]}>
                              Radius: {p.radius_m || 150}m
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : null}
                </View>
              }
            />
          </View>
        </View>
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
  },
  searchCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  activeSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  activeTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
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
});
