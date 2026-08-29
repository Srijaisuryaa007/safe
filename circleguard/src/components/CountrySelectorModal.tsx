import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCountryStore, SUPPORTED_COUNTRIES, CountryInfo } from '../store/useCountryStore';
import { getThemeCardStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';

interface CountrySelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCountry?: (country: CountryInfo) => void;
}

export default function CountrySelectorModal({
  visible,
  onClose,
  onSelectCountry,
}: CountrySelectorModalProps) {
  const { colors, isDark, themeMode } = useThemeStore();
  const { countryCode, setCountryCode } = useCountryStore();
  const [search, setSearch] = useState('');

  const cardStyles = getThemeCardStyles(themeMode);
  const borderStyles = getThemeBorderStyles(themeMode);

  const countriesList = Object.values(SUPPORTED_COUNTRIES);

  const filteredCountries = countriesList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search)
  );

  const handleSelect = (country: CountryInfo) => {
    setCountryCode(country.code);
    if (onSelectCountry) {
      onSelectCountry(country);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, cardStyles, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.headerIconBox, { backgroundColor: `${colors.accentGold}18` }]}>
                <Ionicons name="globe-outline" size={18} color={colors.accentGold} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>SELECT REGION / COUNTRY</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Configures emergency hotlines & dialing</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search country or code (e.g. India, +91)..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* List of Countries */}
          <ScrollView contentContainerStyle={styles.listBody} showsVerticalScrollIndicator={false}>
            {filteredCountries.map((c) => {
              const isSelected = c.code === countryCode;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.countryItem,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.08)')
                        : 'transparent',
                      borderColor: isSelected ? colors.accentGold : colors.border,
                    },
                  ]}
                  onPress={() => handleSelect(c)}
                  activeOpacity={0.7}
                >
                  <View style={styles.countryLeft}>
                    <Text style={styles.flagText}>{c.flag}</Text>
                    <View style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.countryName, { color: colors.foreground }]}>{c.name}</Text>
                        <Text style={[styles.dialCode, { color: colors.accentGold }]}>({c.dialCode})</Text>
                      </View>
                      <Text style={[styles.emergencySummary, { color: colors.textMuted }]}>
                        {c.code === 'IN'
                          ? 'Police (100) • Ambulance (108) • Fire (101) • ERSS (112)'
                          : `Emergency Hotline: ${c.primaryEmergency}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.countryRight}>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.accentGold} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
  },
  listBody: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  countryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  flagText: {
    fontSize: 26,
  },
  countryName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  dialCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  emergencySummary: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  countryRight: {
    marginLeft: 10,
  },
});
