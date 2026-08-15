import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export const LOCATION_BACKGROUND_TASK = 'CIRCLEGUARD_BACKGROUND_LOCATION_TASK';

try {
  if (!TaskManager.isTaskDefined(LOCATION_BACKGROUND_TASK)) {
    TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
      if (error || !data) {
        return;
      }
      const { locations } = data as { locations: Location.LocationObject[] };
      if (!locations || locations.length === 0) return;

      const latest = locations[locations.length - 1];
      const { latitude, longitude, speed } = latest.coords;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        // Check profile info & Ghost Mode
        const { data: userProf } = await supabase
          .from('profiles')
          .select('full_name, is_ghost_mode')
          .eq('id', userId)
          .single();

        let finalLat = latitude;
        let finalLng = longitude;

        if (userProf?.is_ghost_mode) {
          // Fuzz position by ~500m to obscure real position
          finalLat += (Math.random() - 0.5) * 0.009;
          finalLng += (Math.random() - 0.5) * 0.009;
        }

        // Check active circle tracking mode first (Option A Privacy vs Option B Continuous)
        const { data: memberCircle } = await supabase
          .from('circle_members')
          .select('circle_id, circles(tracking_mode)')
          .eq('user_id', userId)
          .limit(1);

        if (memberCircle && memberCircle.length > 0) {
          let circleObj = memberCircle[0].circles as any;
          if (Array.isArray(circleObj)) circleObj = circleObj[0];

          const trackingMode = circleObj?.tracking_mode || 'continuous';
          if (trackingMode === 'privacy') {
            // Option A: Privacy-First Mode - Disconnect location updates when app is closed in background
            console.log('[LocationService] Privacy-First Circle Mode active. Location disconnected while app is closed.');
            return;
          }
        }

        let batteryPct = 100;
        try {
          const level = await Battery.getBatteryLevelAsync();
          if (level >= 0) batteryPct = Math.round(level * 100);
        } catch (e) {}

        const rawSpeed = speed || 0;
        const speedKmh = Math.round(rawSpeed * 3.6);
        const isDriving = rawSpeed > 4.5;
        
        let activityState = 'Stationary / Idle';
        if (rawSpeed > 4.5) {
          activityState = `Traveling • ${speedKmh} km/h`;
        } else if (rawSpeed >= 0.8) {
          activityState = `Walking • ${speedKmh} km/h`;
        } else {
          activityState = 'Stationary / Idle';
        }

        const point = `POINT(${finalLng} ${finalLat})`;

        // 1. Live location upsert to keep user ONLINE continuously in background
        await supabase.from('locations').upsert({
          user_id: userId,
          battery_pct: batteryPct,
          is_driving: isDriving,
          speed_mps: rawSpeed,
          activity_state: activityState,
          geom: point,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
          if (memberCircle && memberCircle.length > 0) {
            const circleId = memberCircle[0].circle_id;
            const { data: placesData } = await supabase
              .from('places')
              .select('*')
              .eq('circle_id', circleId);

            if (placesData && placesData.length > 0) {
              const { evaluateGeofenceBreaches } = require('./GeofenceEngine');
              const formattedPlaces = placesData.map((p: any) => {
                let lat = 20.5937;
                let lng = 78.9629;
                if (p.geom) {
                  if (typeof p.geom === 'string') {
                    const match = p.geom.match(/POINT\(([-0-9.]+)\s+([-0-9.]+)\)/);
                    if (match) {
                      lng = parseFloat(match[1]);
                      lat = parseFloat(match[2]);
                    }
                  } else if (p.geom.coordinates) {
                    lng = p.geom.coordinates[0];
                    lat = p.geom.coordinates[1];
                  }
                }
                return {
                  ...p,
                  latitude: lat,
                  longitude: lng,
                };
              });

              await evaluateGeofenceBreaches(
                { user_id: userId, latitude: finalLat, longitude: finalLng },
                userProf?.full_name || 'Member',
                formattedPlaces
              );
            }
          }
      } catch (err) {
        console.error('Background location update error:', err);
      }
    });
  }
} catch (e) {
  console.warn('Location background task definition skipped:', e);
}

export const LOCATION_GEOFENCE_TASK = 'CIRCLEGUARD_NATIVE_GEOFENCE_TASK';

try {
  if (!TaskManager.isTaskDefined(LOCATION_GEOFENCE_TASK)) {
    // Native OS Geofence Task: Executed by iOS/Android kernel coprocessor even when app process is killed!
    TaskManager.defineTask(LOCATION_GEOFENCE_TASK, async ({ data, error }: any) => {
      if (error || !data) return;
      const { eventType, region } = data;
      if (!region) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        const { data: placeData } = await supabase
          .from('places')
          .select('*')
          .eq('id', region.identifier)
          .single();

        if (!placeData) return;

        const { data: userProf } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();

        const isExit = eventType === Location.GeofencingEventType.Exit;
        const { dispatchGeofencePushAlert } = require('./GeofenceEngine');

        const breachEvent = {
          id: `${region.identifier}_${isExit ? 'exit' : 'entry'}_${Date.now()}`,
          type: isExit ? 'exit' : 'entry',
          placeId: placeData.id,
          placeName: placeData.name,
          userId,
          userName: userProf?.full_name || 'Member',
          distanceMeters: placeData.radius_m || 150,
          formattedDistance: `${placeData.radius_m || 150}m boundary`,
          timestamp: new Date().toISOString(),
          latitude: region.latitude,
          longitude: region.longitude,
        };

        await dispatchGeofencePushAlert(breachEvent, placeData);
      } catch (err) {
        console.error('Native geofence OS task error:', err);
      }
    });
  }
} catch (e) {
  console.warn('Location geofence task definition skipped:', e);
}

export const registerNativeGeofencesAsync = async (places: any[]) => {
  if (Platform.OS === 'web') return;
  try {
    const regions = places.map(p => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: Math.max(p.radius_m || 150, 100), // Native OS geofence min radius 100m
      notifyOnEnter: true,
      notifyOnExit: true,
    }));

    if (regions.length > 0) {
      await Location.startGeofencingAsync(LOCATION_GEOFENCE_TASK, regions.slice(0, 20)); // Max 20 monitored regions on iOS
    }
  } catch (err) {
    console.warn('Native geofence registration note:', err);
  }
};

import AsyncStorage from '@react-native-async-storage/async-storage';

export const startBatteryOptimizedBackgroundLocation = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission optional/pending');
    }

    // Read user GPS sync rate settings from AsyncStorage
    const syncRate = await AsyncStorage.getItem('@circleguard_gps_sync_rate');
    let timeInterval = 5000;
    let distanceInterval = 3;
    let accuracy = Location.Accuracy.High;

    if (syncRate === 'high') {
      timeInterval = 3000; // Fast 3-second sync cycle
      distanceInterval = 1; // Moved 1+ meter
      accuracy = Location.Accuracy.Highest;
    } else if (syncRate === 'saver') {
      timeInterval = 30000; // 30-second battery saver sync
      distanceInterval = 15; // Moved 15+ meters
      accuracy = Location.Accuracy.Balanced;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_BACKGROUND_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
    }

    await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
      accuracy,
      distanceInterval,
      timeInterval,
      deferredUpdatesDistance: distanceInterval,
      deferredUpdatesInterval: timeInterval,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false, // Never pause updates when app is closed!
      foregroundService: {
        notificationTitle: "CircleGuard Location Active",
        notificationBody: "Sharing live circle location with family.",
        notificationColor: "#10B981",
      },
      activityType: Location.ActivityType.AutomotiveNavigation,
    });

    sendInstantLocationPing();
    return true;
  } catch (err) {
    console.error('Error starting background location service:', err);
    return false;
  }
};

export const sendInstantLocationPing = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (!loc) return;

    const { latitude, longitude, speed } = loc.coords;

    const { data: userProf } = await supabase
      .from('profiles')
      .select('is_ghost_mode')
      .eq('id', userId)
      .single();

    let finalLat = latitude;
    let finalLng = longitude;

    if (userProf?.is_ghost_mode) {
      finalLat += (Math.random() - 0.5) * 0.009;
      finalLng += (Math.random() - 0.5) * 0.009;
    }

    let batteryPct = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) batteryPct = Math.round(level * 100);
    } catch (e) {}

    const isDriving = (speed || 0) > 4.5;
    const point = `POINT(${finalLng} ${finalLat})`;

    await supabase.from('locations').upsert({
      user_id: userId,
      battery_pct: batteryPct,
      is_driving: isDriving,
      geom: point,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (e) {
    console.warn('Instant location ping error:', e);
  }
};

export const stopBackgroundLocation = async () => {
  if (Platform.OS === 'web') return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_BACKGROUND_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
    }
    const isGeofenceRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_GEOFENCE_TASK);
    if (isGeofenceRegistered) {
      await Location.stopGeofencingAsync(LOCATION_GEOFENCE_TASK);
    }
    console.log('[LocationService] Background location and geofence tracking fully stopped by user.');
  } catch (err) {
    console.error('Error stopping background location service:', err);
  }
};
