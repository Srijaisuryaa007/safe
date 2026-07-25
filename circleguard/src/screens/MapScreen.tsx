import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

export default function MapScreen() {
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use map tracking.');
        return;
      }
      
      // Start tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (loc) => {
          if (!profile) return;
          
          try {
            // Update location in Supabase
            // We use EWKT format for PostGIS geography type
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
  
  // Fetch and subscribe to circle members' locations
  useEffect(() => {
    if (!activeCircle) return;
    
    fetchLocations();
    
    const channel = supabase
      .channel('public:locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          fetchLocations();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle, members]);
  
  const fetchLocations = async () => {
    if (!activeCircle) return;
    
    try {
      // First get the UUIDs of members in the current circle
      const memberIds = members.map(m => m.user_id);
      
      if (memberIds.length === 0) return;
      
      // Then fetch their locations
      const { data, error } = await supabase
        .from('locations')
        .select('user_id, geom, updated_at')
        .in('user_id', memberIds);
        
      if (error) throw error;
      
      if (data) {
        // Map postgis geom to lat/lng. Usually returned as GeoJSON Point from supabase.
        const parsedLocations = data.map(d => {
          let lat = 0;
          let lng = 0;
          
          if (typeof d.geom === 'object' && d.geom.coordinates) {
             lng = d.geom.coordinates[0];
             lat = d.geom.coordinates[1];
          } else if (typeof d.geom === 'string') {
             // In case it returns string representation, attempt basic parse
             const match = d.geom.match(/POINT\(([-.\d]+)\s+([-.\d]+)\)/i);
             if (match) {
               lng = parseFloat(match[1]);
               lat = parseFloat(match[2]);
             }
          }
          
          return {
            ...d,
            latitude: lat,
            longitude: lng,
          };
        }).filter(d => d.latitude !== 0 && d.longitude !== 0);
        
        setLocations(parsedLocations);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };
  
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
      <MapView
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {locations.map((loc) => {
          // Find member info to show name
          const member = members.find(m => m.user_id === loc.user_id);
          
          // Don't show marker for our own user if showsUserLocation is true
          if (loc.user_id === profile?.id) return null;
          
          return (
            <Marker
              key={loc.user_id}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              title={member?.profile?.full_name || 'Circle Member'}
              description={`Last updated: ${new Date(loc.updated_at).toLocaleTimeString()}`}
            >
              <View style={styles.markerContainer}>
                 <Text style={styles.markerText}>
                   {member?.profile?.full_name?.charAt(0).toUpperCase() || '?'}
                 </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
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
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
