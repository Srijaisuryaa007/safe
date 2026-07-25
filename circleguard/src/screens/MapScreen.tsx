import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import AlertModal from '../components/AlertModal';
import AddPlaceModal from '../components/AddPlaceModal';

// Haversine formula to calculate distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
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

export default function MapScreen() {
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const userPlaceStates = useRef<Record<string, boolean>>({});

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'sos' | 'place'>('sos');
  
  // Add Place Modal State
  const [addPlaceVisible, setAddPlaceVisible] = useState(false);
  const [addPlaceCoord, setAddPlaceCoord] = useState<{latitude: number, longitude: number} | null>(null);
  
  const webViewRef = useRef<WebView | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use map tracking.');
        return;
      }

      // Fetch initial position
      try {
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (currentLoc?.coords) {
          setUserLoc({ latitude: currentLoc.coords.latitude, longitude: currentLoc.coords.longitude });
        }
      } catch (e) {
        console.warn("Initial location fetch error:", e);
      }
      
      // Start tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 10000,
          distanceInterval: 0,
        },
        async (loc) => {
          if (!profile) return;
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          
          try {
            const point = `POINT(${loc.coords.longitude} ${loc.coords.latitude})`;
            await supabase.from('locations').upsert({
              user_id: profile.id,
              geom: point,
              accuracy_m: loc.coords.accuracy,
              speed_mps: loc.coords.speed,
              updated_at: new Date().toISOString()
            });
          } catch (err) {
            console.error('Error updating location:', err);
          }
        }
      );
    })();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [profile]);

  useEffect(() => {
    if (!activeCircle) return;
    
    fetchPlaces();
    fetchLocations();
    
    const channel = supabase
      .channel('public:locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => fetchLocations()
      )
      .subscribe();
      
    const placesChannel = supabase
      .channel('public:places')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `circle_id=eq.${activeCircle.id}` },
        () => fetchPlaces()
      )
      .subscribe();
      
    const fallbackInterval = setInterval(() => {
      fetchLocations();
    }, 10000);
      
    const sosChannel = supabase
      .channel('public:sos_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts', filter: `circle_id=eq.${activeCircle.id}` },
        (payload) => {
          if (payload.new.user_id === profile?.id) return;
          if (payload.new.status !== 'active') return;
          
          const sender = members.find(m => m.user_id === payload.new.user_id);
          const name = sender?.profile?.full_name || 'A circle member';
          
          setModalTitle('SOS ALERT');
          setModalMessage(`${name} triggered an SOS!`);
          setModalType('sos');
          setModalVisible(true);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(sosChannel);
      supabase.removeChannel(placesChannel);
      clearInterval(fallbackInterval);
    };
  }, [activeCircle, members, profile]);

  const fetchPlaces = async () => {
    if (!activeCircle) return;
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', activeCircle.id);
        
      if (error) throw error;
      
      if (data) {
        const parsedPlaces = data.map(p => {
          let lat = 0, lng = 0;
          if (typeof p.geom === 'string' && p.geom.startsWith('01010000')) {
             try {
                const bytes = new Uint8Array(p.geom.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                const view = new DataView(bytes.buffer);
                lng = view.getFloat64(9, true);
                lat = view.getFloat64(17, true);
             } catch(e){}
          }
          return { ...p, latitude: lat, longitude: lng };
        }).filter(p => p.latitude !== 0);
        
        setPlaces(parsedPlaces);
      }
    } catch (e) {
      console.error("Error fetching places:", e);
    }
  };

  const fetchLocations = async () => {
    if (!activeCircle) return;
    
    try {
      const memberIds = members.map(m => m.user_id);
      if (memberIds.length === 0) return;
      
      const { data, error } = await supabase
        .from('locations')
        .select('user_id, geom, updated_at')
        .in('user_id', memberIds);
        
      if (error) throw error;
      
      if (data) {
        const parsedLocations = data.map(d => {
          let lat = 0, lng = 0;
          if (typeof d.geom === 'object' && d.geom.coordinates) {
             lng = d.geom.coordinates[0];
             lat = d.geom.coordinates[1];
          } else if (typeof d.geom === 'string' && d.geom.startsWith('01010000')) {
             try {
               const bytes = new Uint8Array(d.geom.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
               const view = new DataView(bytes.buffer);
               lng = view.getFloat64(9, true);
               lat = view.getFloat64(17, true);
             } catch (e) {}
          }
          return { ...d, latitude: lat, longitude: lng };
        }).filter(d => d.latitude !== 0 && d.longitude !== 0);
        
        setLocations(parsedLocations);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const triggerSOS = async () => {
    if (!activeCircle || !profile) return;
    let point = null;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      point = `POINT(${loc.coords.longitude} ${loc.coords.latitude})`;
    } catch(e) {}

    try {
      const { error } = await supabase.from('sos_alerts').insert({
        user_id: profile.id,
        circle_id: activeCircle.id,
        geom: point,
        status: 'active'
      });
      if (error) throw error;
      Alert.alert('SOS Sent', 'Your circle has been notified.');
    } catch (e) {
      Alert.alert('Error', 'Failed to send SOS.');
    }
  };

  const savePlace = async (name: string, radius: number) => {
    if (!activeCircle || !addPlaceCoord || !profile) return;
    try {
      const point = `POINT(${addPlaceCoord.longitude} ${addPlaceCoord.latitude})`;
      const { error } = await supabase.from('places').insert({
        circle_id: activeCircle.id,
        name,
        radius_m: radius,
        geom: point,
        created_by: profile.id
      });
      if (error) throw error;
      setAddPlaceVisible(false);
      fetchPlaces();
    } catch (e) {
      Alert.alert('Error', 'Failed to save place.');
    }
  };

  // Generate Leaflet HTML
  const centerLat = userLoc?.latitude || 20.5937;
  const centerLng = userLoc?.longitude || 78.9629;

  const mapData = {
    center: [centerLat, centerLng],
    userLocation: userLoc,
    members: locations.map(loc => {
      const m = members.find(mem => mem.user_id === loc.user_id);
      return {
        id: loc.user_id,
        lat: loc.latitude,
        lng: loc.longitude,
        name: m?.profile?.full_name || 'Member',
        initial: (m?.profile?.full_name || 'M').charAt(0).toUpperCase()
      };
    }),
    places: places.map(p => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      name: p.name,
      radius: p.radius_m
    }))
  };

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f8f9fa; }
        .member-avatar {
          background: #0066cc; color: white; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-family: sans-serif; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const data = ${JSON.stringify(mapData)};
        const map = L.map('map').setView(data.center, 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: 'OpenStreetMap'
        }).addTo(map);

        // Current user marker
        if (data.userLocation) {
          L.circleMarker([data.userLocation.latitude, data.userLocation.longitude], {
            radius: 8, fillColor: '#0066cc', color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9
          }).addTo(map).bindPopup("Your Location");
        }

        // Places circles
        data.places.forEach(p => {
          L.circle([p.lat, p.lng], {
            radius: p.radius, color: '#0066cc', fillColor: '#0066cc', fillOpacity: 0.15
          }).addTo(map).bindPopup(p.name);
        });

        // Members markers
        data.members.forEach(m => {
          const icon = L.divIcon({
            className: 'custom-icon',
            html: '<div class="member-avatar" style="width:32px;height:32px;">' + m.initial + '</div>',
            iconSize: [32, 32]
          });
          L.marker([m.lat, m.lng], { icon: icon }).addTo(map).bindPopup(m.name);
        });

        // Long press for adding places
        map.on('contextmenu', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LONG_PRESS',
            lat: e.latlng.lat,
            lng: e.latlng.lng
          }));
        });
      </script>
    </body>
    </html>
  `;

  if (!activeCircle) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Join or create a circle to view the map.</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Requesting location permission...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.map}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'LONG_PRESS') {
              setAddPlaceCoord({ latitude: msg.lat, longitude: msg.lng });
              setAddPlaceVisible(true);
            }
          } catch(e) {}
        }}
      />

      <TouchableOpacity style={styles.sosButton} onPress={triggerSOS}>
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <AlertModal 
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />

      <AddPlaceModal
        visible={addPlaceVisible}
        coordinate={addPlaceCoord}
        onClose={() => setAddPlaceVisible(false)}
        onSave={savePlace}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  sosButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff3333',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sosText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
