import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { LUXURY_THEME } from '../constants/theme';

export default function SafePlacesScreen() {
  const navigation = useNavigation();
  const { activeCircle } = useCircleStore();
  const { profile } = useAuthStore();

  const [placeName, setPlaceName] = useState('Home');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [radius, setRadius] = useState(150);
  const [saving, setSaving] = useState(false);
  
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  const categories = [
    { id: 'home', icon: 'home-outline', label: 'HOME' },
    { id: 'work', icon: 'briefcase-outline', label: 'WORK' },
    { id: 'school', icon: 'school-outline', label: 'SCHOOL' },
    { id: 'fitness', icon: 'fitness-outline', label: 'GYM' },
  ];

  useEffect(() => {
    if (activeCircle?.id) {
      fetchSavedPlaces(activeCircle.id);
    } else {
      setLoadingPlaces(false);
    }
  }, [activeCircle?.id]);

  const fetchSavedPlaces = async (circleId: string) => {
    setLoadingPlaces(true);
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId);

      if (error) throw error;
      setSavedPlaces(data || []);
    } catch (err) {
      console.error('Error fetching places:', err);
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleSavePlace = async () => {
    if (!activeCircle || !profile) {
      Alert.alert('Error', 'No active circle found. Please create or join a circle first.');
      return;
    }

    if (!placeName.trim()) {
      Alert.alert('Required', 'Please enter a name for your bookmarked place.');
      return;
    }

    setSaving(true);
    try {
      let point = `POINT(78.9629 20.5937)`;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          point = `POINT(${loc.coords.longitude} ${loc.coords.latitude})`;
        }
      } catch(e) {}

      const { error } = await supabase.from('places').insert({
        circle_id: activeCircle.id,
        name: placeName.trim(),
        radius_m: radius,
        geom: point,
        created_by: profile.id,
      });

      if (error) throw error;

      Alert.alert('Success', `"${placeName}" has been bookmarked!`);
      setPlaceName('');
      fetchSavedPlaces(activeCircle.id);
    } catch (err: any) {
      console.error('Error saving place:', err);
      Alert.alert('Error', err.message || 'Failed to save safe place.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlace = (placeId: string, name: string) => {
    Alert.alert(
      'Delete Bookmark',
      `Are you sure you want to delete "${name}" from your circle geofences?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('places')
                .delete()
                .eq('id', placeId);

              if (error) throw error;
              if (activeCircle) fetchSavedPlaces(activeCircle.id);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete bookmark.');
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={LUXURY_THEME.colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GEOFENCE MANAGER</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlace} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>SAFE ZONE SETUP</Text>
        <Text style={styles.title}>Define Safe Place</Text>

        <Text style={styles.inputLabel}>GEOFENCE NAME</Text>
        <TextInput
          style={styles.underlineInput}
          placeholder="e.g. Home, Office, School"
          value={placeName}
          onChangeText={setPlaceName}
          placeholderTextColor={LUXURY_THEME.colors.textMuted}
        />

        <Text style={styles.inputLabel}>CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryTile, active ? styles.activeCategoryTile : null]}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  setPlaceName(cat.label);
                }}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={20} 
                  color={active ? LUXURY_THEME.colors.accentGold : LUXURY_THEME.colors.foreground} 
                />
                <Text style={[styles.categoryLabel, active ? styles.activeCategoryLabel : null]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>GEOFENCE RADIUS</Text>
        <View style={styles.radiusRow}>
          {[100, 200, 500, 1000].map((r) => {
            const active = radius === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, active ? styles.activeRadiusChip : null]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.radiusText, active ? styles.activeRadiusText : null]}>
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Existing Bookmarked Places Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>BOOKMARKED PLACES ({savedPlaces.length})</Text>
          <View style={styles.accentLine} />
        </View>

        {loadingPlaces ? (
          <ActivityIndicator size="small" color={LUXURY_THEME.colors.foreground} style={{ marginVertical: 20 }} />
        ) : savedPlaces.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bookmark-outline" size={32} color={LUXURY_THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>NO BOOKMARKS ADDED</Text>
            <Text style={styles.emptySub}>Long press roads on the map or save a location above to create geofence bookmarks.</Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {savedPlaces.map(p => (
              <View key={p.id} style={styles.placeCard}>
                <View style={styles.placeLeft}>
                  <View style={styles.placeIconBox}>
                    <Ionicons name="bookmark" size={20} color={LUXURY_THEME.colors.accentGold} />
                  </View>
                  <View>
                    <Text style={styles.placeName}>{p.name}</Text>
                    <Text style={styles.placeRadius}>GEOFENCE RADIUS: {p.radius_m || 150}m</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.deleteBtn}
                  onPress={() => handleDeletePlace(p.id, p.name)}
                >
                  <Ionicons name="trash-outline" size={18} color={LUXURY_THEME.colors.sosRed} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.border,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: LUXURY_THEME.colors.foreground,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  content: {
    padding: 24,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.foreground,
    paddingVertical: 12,
    fontSize: 16,
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 32,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  categoryTile: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  activeCategoryTile: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  categoryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.2,
  },
  activeCategoryLabel: {
    color: LUXURY_THEME.colors.accentGold,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeRadiusChip: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  radiusText: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.2,
  },
  activeRadiusText: {
    color: LUXURY_THEME.colors.accentGold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
  },
  accentLine: {
    flex: 1,
    height: 1,
    backgroundColor: LUXURY_THEME.colors.border,
  },
  emptyCard: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1.5,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  placesList: {
    gap: 12,
  },
  placeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 16,
  },
  placeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  placeRadius: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
