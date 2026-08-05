import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { LUXURY_THEME } from '../constants/theme';
import { getHaversineDistanceInMeters } from '../services/GeofenceEngine';

export default function SafePlacesScreen() {
  const navigation = useNavigation();
  const { activeCircle, members, fetchMembers } = useCircleStore();
  const { profile } = useAuthStore();

  const [placeName, setPlaceName] = useState('Home Safe Zone');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [radius, setRadius] = useState(150);
  const [saving, setSaving] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null); // null = All Circle Members

  // Interactive Mini Map & Start/End Points State
  const webViewRef = useRef<WebView | null>(null);
  const [startPoint, setStartPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activePointMode, setActivePointMode] = useState<'start' | 'end'>('start');
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRouteGeofence, setIsRouteGeofence] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const mainScrollViewRef = useRef<ScrollView | null>(null);

  const categories = [
    { id: 'home', icon: 'home-outline', label: 'HOME' },
    { id: 'work', icon: 'briefcase-outline', label: 'WORK' },
    { id: 'school', icon: 'school-outline', label: 'SCHOOL' },
    { id: 'fitness', icon: 'fitness-outline', label: 'GYM' },
    { id: 'route', icon: 'navigate-outline', label: 'ROUTE' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const initialCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLoc(initialCoords);
          setStartPoint(initialCoords);
        }
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (activeCircle?.id) {
      fetchSavedPlaces(activeCircle.id);
      fetchMembers(activeCircle.id);
    } else {
      setLoadingPlaces(false);
    }
  }, [activeCircle?.id]);

  const pushMiniMapData = () => {
    if (!webViewRef.current) return;
    const centerLat = startPoint?.latitude || userLoc?.latitude || 20.5937;
    const centerLng = startPoint?.longitude || userLoc?.longitude || 78.9629;

    const data = {
      center: [centerLat, centerLng],
      startPoint,
      endPoint,
      radius,
    };

    const jsCode = `
      (function() {
        if (window.updateMiniMap) {
          window.updateMiniMap(${JSON.stringify(data)});
        } else {
          setTimeout(function() {
            if (window.updateMiniMap) window.updateMiniMap(${JSON.stringify(data)});
          }, 300);
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  useEffect(() => {
    pushMiniMapData();
  }, [startPoint, endPoint, radius]);

  const handleMapTap = (lat: number, lng: number) => {
    if (activePointMode === 'start') {
      const newStart = { latitude: lat, longitude: lng };
      setStartPoint(newStart);
      setActivePointMode('end');

      if (endPoint) {
        const dist = getHaversineDistanceInMeters(lat, lng, endPoint.latitude, endPoint.longitude);
        const autoRadius = Math.max(50, Math.round(dist));
        setRadius(autoRadius);
      }
    } else {
      const newEnd = { latitude: lat, longitude: lng };
      setEndPoint(newEnd);
      setIsRouteGeofence(true);

      if (startPoint) {
        const dist = getHaversineDistanceInMeters(startPoint.latitude, startPoint.longitude, lat, lng);
        const autoRadius = Math.max(50, Math.round(dist));
        setRadius(autoRadius);
      }
    }
  };

  const handleResetPoints = () => {
    if (userLoc) {
      setStartPoint(userLoc);
    } else {
      setStartPoint(null);
    }
    setEndPoint(null);
    setActivePointMode('start');
    setIsRouteGeofence(false);
    setRadius(150);
  };

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
      Alert.alert('Required', 'Please enter a name for your geofence boundary.');
      return;
    }

    setSaving(true);
    try {
      const startPointLat = startPoint?.latitude || userLoc?.latitude || 20.5937;
      const startPointLng = startPoint?.longitude || userLoc?.longitude || 78.9629;
      const pointGeom = `POINT(${startPointLng} ${startPointLat})`;

      const endLatitude = endPoint ? endPoint.latitude : null;
      const endLongitude = endPoint ? endPoint.longitude : null;

      const basePayload = {
        circle_id: activeCircle.id,
        name: placeName.trim(),
        radius_m: radius,
        geom: pointGeom,
        created_by: profile.id,
      };

      if (editingPlaceId) {
        let { error } = await supabase.from('places').update({
          name: placeName.trim(),
          radius_m: radius,
          geom: pointGeom,
          start_lat: startPointLat,
          start_lng: startPointLng,
          end_lat: endLatitude,
          end_lng: endLongitude,
          target_user_id: targetUserId,
          category: selectedCategory,
        }).eq('id', editingPlaceId);

        if (error) throw error;

        Alert.alert('Geofence Updated', `"${placeName}" has been updated with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius!`);
        setEditingPlaceId(null);
      } else {
        let { error } = await supabase.from('places').insert({
          ...basePayload,
          start_lat: startPointLat,
          start_lng: startPointLng,
          end_lat: endLatitude,
          end_lng: endLongitude,
          target_user_id: targetUserId,
          category: selectedCategory,
        });

        if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache'))) {
          const fallbackRes = await supabase.from('places').insert(basePayload);
          error = fallbackRes.error;
        }

        if (error) throw error;

        Alert.alert('Success', `Geofence "${placeName}" created with ${radius >= 1000 ? `${(radius/1000).toFixed(1)}km` : `${radius}m`} radius!`);
      }

      setPlaceName('');
      handleResetPoints();
      fetchSavedPlaces(activeCircle.id);
    } catch (err: any) {
      console.error('Error saving/updating place:', err);
      Alert.alert('Error', err.message || 'Failed to save geofence.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditPlace = (p: any) => {
    setEditingPlaceId(p.id);
    setPlaceName(p.name || '');
    setRadius(p.radius_m || 150);
    setSelectedCategory(p.category || 'home');
    setTargetUserId(p.target_user_id || null);

    if (p.start_lat && p.start_lng) {
      setStartPoint({ latitude: p.start_lat, longitude: p.start_lng });
    } else if (p.latitude && p.longitude) {
      setStartPoint({ latitude: p.latitude, longitude: p.longitude });
    }

    if (p.end_lat && p.end_lng) {
      setEndPoint({ latitude: p.end_lat, longitude: p.end_lng });
    } else {
      setEndPoint(null);
    }

    if (mainScrollViewRef.current) {
      mainScrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleCancelEdit = () => {
    setEditingPlaceId(null);
    setPlaceName('');
    setRadius(150);
    setSelectedCategory('home');
    setTargetUserId(null);
    handleResetPoints();
  };

  const handleDeletePlace = (placeId: string, name: string) => {
    Alert.alert(
      'Delete Geofence',
      `Are you sure you want to remove "${name}" from your circle geofences?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setSavedPlaces(prev => prev.filter(p => p.id !== placeId));

              const { error } = await supabase
                .from('places')
                .delete()
                .eq('id', placeId);

              if (error) {
                if (activeCircle) fetchSavedPlaces(activeCircle.id);
                throw error;
              }

              Alert.alert('Geofence Removed', `"${name}" has been deleted.`);
            } catch (err: any) {
              Alert.alert('Error Deleting Geofence', err.message || 'Permission denied or network error.');
            }
          } 
        }
      ]
    );
  };

  const miniMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0D0E12; }
        .start-pin { background: #10B981; border: 2px solid #FFFFFF; border-radius: 50%; width: 18px; height: 18px; box-shadow: 0 0 12px rgba(16,185,129,0.9); }
        .end-pin { background: #EF4444; border: 2px solid #FFFFFF; border-radius: 50%; width: 18px; height: 18px; box-shadow: 0 0 12px rgba(239,68,68,0.9); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

        var startMarker = null;
        var endMarker = null;
        var geofenceCircle = null;
        var routePolyline = null;

        map.on('click', function(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_TAP',
              lat: e.latlng.lat,
              lng: e.latlng.lng
            }));
          }
        });

        window.updateMiniMap = function(data) {
          if (!data) return;
          if (data.center) {
            map.setView(data.center, 13);
          }

          if (startMarker) map.removeLayer(startMarker);
          if (endMarker) map.removeLayer(endMarker);
          if (geofenceCircle) map.removeLayer(geofenceCircle);
          if (routePolyline) map.removeLayer(routePolyline);

          if (data.startPoint) {
            startMarker = L.marker([data.startPoint.latitude, data.startPoint.longitude], {
              icon: L.divIcon({ className: 'custom-icon', html: '<div class="start-pin"></div>', iconSize: [18, 18] })
            }).addTo(map).bindPopup("Start Point");

            geofenceCircle = L.circle([data.startPoint.latitude, data.startPoint.longitude], {
              radius: data.radius || 150,
              color: '#D4AF37',
              fillColor: '#D4AF37',
              fillOpacity: 0.25,
              weight: 2
            }).addTo(map);
          }

          if (data.endPoint) {
            endMarker = L.marker([data.endPoint.latitude, data.endPoint.longitude], {
              icon: L.divIcon({ className: 'custom-icon', html: '<div class="end-pin"></div>', iconSize: [18, 18] })
            }).addTo(map).bindPopup("End Point");

            if (data.startPoint) {
              routePolyline = L.polyline([
                [data.startPoint.latitude, data.startPoint.longitude],
                [data.endPoint.latitude, data.endPoint.longitude]
              ], { color: '#60A5FA', weight: 3, dashArray: '6, 6' }).addTo(map);
            }
          }
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={LUXURY_THEME.colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editingPlaceId ? 'EDIT GEOFENCE' : 'SAFE PLACES GEOFENCING'}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {editingPlaceId ? (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: LUXURY_THEME.colors.surface, borderWidth: 1, borderColor: LUXURY_THEME.colors.border }]} onPress={handleCancelEdit}>
              <Text style={[styles.saveBtnText, { color: LUXURY_THEME.colors.textMuted }]}>CANCEL</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlace} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : editingPlaceId ? 'UPDATE' : 'SAVE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={mainScrollViewRef} contentContainerStyle={styles.content}>
        <Text style={styles.overline}>{editingPlaceId ? 'MODIFY BOUNDARY' : 'SETUP BOUNDARY'}</Text>
        <Text style={styles.title}>{editingPlaceId ? 'Edit Geofence' : 'Define Geofence'}</Text>

        <Text style={styles.inputLabel}>GEOFENCE NAME</Text>
        <TextInput
          style={styles.underlineInput}
          placeholder="e.g. Home Safe Zone, School Perimeter, Commute Corridor"
          value={placeName}
          onChangeText={setPlaceName}
          placeholderTextColor={LUXURY_THEME.colors.textMuted}
        />

        <Text style={styles.inputLabel}>CATEGORY & TYPE</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryTile, active ? styles.activeCategoryTile : null]}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  if (cat.id === 'route') {
                    setIsRouteGeofence(true);
                    setPlaceName('Commute Route Corridor');
                  } else {
                    setIsRouteGeofence(false);
                    setPlaceName(`${cat.label} Safe Zone`);
                  }
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

        {/* Tracked Member Target Selector */}
        <Text style={styles.inputLabel}>TRACKED MEMBER ASSIGNMENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <TouchableOpacity
            style={[styles.memberChip, targetUserId === null ? styles.activeMemberChip : null]}
            onPress={() => setTargetUserId(null)}
          >
            <Text style={[styles.memberChipText, targetUserId === null ? styles.activeMemberChipText : null]}>
              ALL CIRCLE MEMBERS
            </Text>
          </TouchableOpacity>
          {members.map(m => {
            const isSelected = targetUserId === m.user_id;
            const firstName = String(m.profile?.full_name || 'Member').split(' ')[0];
            return (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.memberChip, isSelected ? styles.activeMemberChip : null]}
                onPress={() => setTargetUserId(m.user_id)}
              >
                <Text style={[styles.memberChipText, isSelected ? styles.activeMemberChipText : null]}>
                  {firstName.toUpperCase()} ONLY
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Interactive Mini Map Picker (Mark Start & End Points) */}
        <View style={styles.miniMapHeaderRow}>
          <Text style={styles.inputLabel}>INTERACTIVE GEOFENCE MAP (TAP TO SET PINS)</Text>
          <TouchableOpacity onPress={handleResetPoints}>
            <Text style={styles.resetMapText}>RESET PINS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeToggleRow}>
          <TouchableOpacity 
            style={[styles.modeBtn, activePointMode === 'start' ? styles.activeStartModeBtn : null]}
            onPress={() => setActivePointMode('start')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.modeBtnText, activePointMode === 'start' ? { color: '#FFFFFF' } : null]}>
              {startPoint ? 'START: SET' : 'TAP MAP: SET START'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modeBtn, activePointMode === 'end' ? styles.activeEndModeBtn : null]}
            onPress={() => setActivePointMode('end')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.modeBtnText, activePointMode === 'end' ? { color: '#FFFFFF' } : null]}>
              {endPoint ? 'END: SET' : 'TAP MAP: SET END'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.miniMapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: miniMapHtml }}
            style={styles.miniMap}
            onLoadEnd={pushMiniMapData}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data);
                if (msg.type === 'MAP_TAP') {
                  handleMapTap(msg.lat, msg.lng);
                }
              } catch(e) {}
            }}
          />
        </View>

        {/* Coordinates & Calculated Distance Readout */}
        <View style={styles.coordReadoutBox}>
          <View style={styles.coordCol}>
            <Text style={styles.coordLabel}>START PIN</Text>
            <Text style={styles.coordVal}>
              {startPoint ? `${startPoint.latitude.toFixed(4)}, ${startPoint.longitude.toFixed(4)}` : 'Tap map to set'}
            </Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordCol}>
            <Text style={styles.coordLabel}>END PIN</Text>
            <Text style={styles.coordVal}>
              {endPoint ? `${endPoint.latitude.toFixed(4)}, ${endPoint.longitude.toFixed(4)}` : 'Optional'}
            </Text>
          </View>
        </View>

        {/* Radius Selector */}
        <View style={styles.radiusHeaderRow}>
          <Text style={styles.inputLabel}>AUTO-COMPUTED GEOFENCE RADIUS</Text>
          <Text style={styles.radiusValText}>{radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}</Text>
        </View>
        
        <View style={styles.radiusRow}>
          {[100, 200, 500, 1000, 2500, 5000].map((r) => {
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

        {/* Saved Geofences Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ACTIVE CIRCLE GEOFENCES ({savedPlaces.length})</Text>
          <View style={styles.accentLine} />
        </View>

        {loadingPlaces ? (
          <ActivityIndicator size="small" color={LUXURY_THEME.colors.foreground} style={{ marginVertical: 20 }} />
        ) : savedPlaces.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={32} color={LUXURY_THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>NO GEOFENCES CONFIGURED</Text>
            <Text style={styles.emptySub}>Tap points on the Mini Map above to automatically calculate radius and define geofence boundaries.</Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {savedPlaces.map(p => {
              const targetMember = members.find(m => m.user_id === p.target_user_id);
              const targetName = targetMember ? String(targetMember.profile?.full_name).split(' ')[0] : 'ALL MEMBERS';

              return (
                <View key={p.id} style={styles.placeCard}>
                  <View style={styles.placeLeft}>
                    <View style={styles.placeIconBox}>
                      <Ionicons name={p.end_lat ? "navigate" : "bookmark"} size={18} color={LUXURY_THEME.colors.accentGold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeName}>{p.name}</Text>
                      <View style={styles.tagRow}>
                        <Text style={styles.placeRadius}>RADIUS: {p.radius_m || 150}M</Text>
                        <Text style={styles.tagDot}>•</Text>
                        <Text style={styles.targetTag}>TRACKING: {targetName.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity 
                      style={styles.editBtn}
                      onPress={() => handleStartEditPlace(p)}
                    >
                      <Ionicons name="create-outline" size={18} color={LUXURY_THEME.colors.accentGold} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.deleteBtn}
                      onPress={() => handleDeletePlace(p.id, p.name)}
                    >
                      <Ionicons name="trash-outline" size={18} color={LUXURY_THEME.colors.sosRed} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    padding: 4,
  },
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
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    marginBottom: 24,
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
    fontSize: 15,
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  categoryTile: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  activeCategoryTile: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  categoryLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  activeCategoryLabel: {
    color: LUXURY_THEME.colors.accentGold,
  },
  memberChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    marginRight: 8,
  },
  activeMemberChip: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  memberChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  activeMemberChipText: {
    color: LUXURY_THEME.colors.accentGold,
  },
  miniMapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetMapText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 1,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 8,
  },
  activeStartModeBtn: {
    backgroundColor: '#047857',
    borderColor: '#10B981',
  },
  activeEndModeBtn: {
    backgroundColor: '#B91C1C',
    borderColor: '#EF4444',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
  },
  miniMapContainer: {
    height: 220,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  miniMap: {
    flex: 1,
  },
  coordReadoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    padding: 12,
    marginBottom: 24,
  },
  coordCol: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  coordVal: {
    fontSize: 11,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
  },
  coordDivider: {
    width: 1,
    height: 24,
    backgroundColor: LUXURY_THEME.colors.border,
    marginHorizontal: 12,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusValText: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  radiusChip: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeRadiusChip: {
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  radiusText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.foreground,
    letterSpacing: 1,
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
    width: 38,
    height: 38,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeRadius: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  tagDot: {
    fontSize: 9,
    color: LUXURY_THEME.colors.textMuted,
  },
  targetTag: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 0.8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
