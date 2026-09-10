import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { queueAndSyncLocationHistory } from './OfflineLocationQueueService';
import { useCircleStore } from '../store/useCircleStore';

export const LOCATION_BACKGROUND_TASK = 'CIRCLEGUARD_BACKGROUND_LOCATION_TASK';

let lastProcessedLat = 0;
let lastProcessedLng = 0;
let lastProcessedTimestamp = 0;
let lastBgHistorySavedPoint: { [userId: string]: { lat: number; lng: number; timeMs: number } } = {};

function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

      // Noise & Jitter Filter: Skip redundant updates if position moved < ~4 meters and updated recently
      const now = Date.now();
      const distFromLast = calculateHaversineMeters(lastProcessedLat, lastProcessedLng, latitude, longitude);
      const isStationaryNoise = (distFromLast < 4.0 && (speed || 0) < 0.75 && (now - lastProcessedTimestamp < 30000));
      
      if (lastProcessedLat !== 0 && isStationaryNoise) {
        return;
      }
      lastProcessedLat = latitude;
      lastProcessedLng = longitude;
      lastProcessedTimestamp = now;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        // Check profile info & Ghost Mode
        const { data: userProf } = await supabase
          .from('profiles')
          .select('full_name, is_ghost_mode, hide_online_presence')
          .eq('id', userId)
          .single();

        let finalLat = latitude;
        let finalLng = longitude;
        const isGhost = !!userProf?.is_ghost_mode;

        if (isGhost) {
          // Obfuscate real GPS coordinates with a deterministic ~1.5km fuzzing offset
          const charCode = userId.charCodeAt(0) || 65;
          const fuzzAngle = ((charCode * 43) % 360) * (Math.PI / 180);
          finalLat = parseFloat((latitude + 0.012 * Math.sin(fuzzAngle)).toFixed(5));
          finalLng = parseFloat((longitude + 0.012 * Math.cos(fuzzAngle)).toFixed(5));
        }

        // Check active circle tracking mode first (Option A Privacy vs Option B Continuous)
        const { data: memberCircle } = await supabase
          .from('circle_members')
          .select('circle_id, circles(tracking_mode)')
          .eq('user_id', userId)
          .limit(1);

        if (!memberCircle || memberCircle.length === 0) {
          // Logical Enterprise Rule: If user has not joined or created a circle, do NOT track or record location history
          return;
        }

        let circleObj = memberCircle[0].circles as any;
        if (Array.isArray(circleObj)) circleObj = circleObj[0];

        const trackingMode = circleObj?.tracking_mode || 'continuous';
        if (trackingMode === 'privacy') {
          // Option A: Privacy-First Mode - Disconnect location updates when app is closed in background
          console.log('[LocationService] Privacy-First Circle Mode active. Location disconnected while app is closed.');
          return;
        }

        let batteryPct = 100;
        try {
          const level = await Battery.getBatteryLevelAsync();
          if (level >= 0) batteryPct = Math.round(level * 100);
        } catch (e) {}

        const rawSpeed = isGhost ? 0 : (speed || 0);
        const speedKmh = Math.round(rawSpeed * 3.6);
        const isDriving = rawSpeed > 4.5;
        
        let activityState = 'Stationary / Idle';
        if (isGhost) {
          activityState = 'Ghost Mode (Obfuscated)';
        } else if (rawSpeed > 4.5) {
          activityState = `Traveling • ${speedKmh} km/h`;
        } else if (rawSpeed >= 0.8) {
          activityState = `Walking • ${speedKmh} km/h`;
        } else {
          activityState = 'Stationary / Idle';
        }

        const point = `POINT(${finalLng} ${finalLat})`;
        let activeCircleId = useCircleStore.getState().activeCircle?.id;

        console.log('[GPS_PIPELINE:LAYER_1_TRIGGER] Background GPS event fired:', {
          userId,
          lat: finalLat,
          lng: finalLng,
          speed: rawSpeed,
          battery: batteryPct,
          activeCircleId,
          timestamp: new Date(now).toISOString(),
        });

        // 1. Live location upsert to keep user ONLINE continuously in background
        const locPayload: any = {
          user_id: userId,
          latitude: finalLat,
          longitude: finalLng,
          battery_pct: batteryPct,
          is_driving: isDriving,
          speed_mps: rawSpeed,
          activity_state: activityState,
          geom: point,
          updated_at: new Date().toISOString(),
        };

        // Resolve target circle IDs: if activeCircleId is not in store, query circle_members
        let targetCircleIds: (string | null)[] = activeCircleId ? [activeCircleId] : [];
        if (targetCircleIds.length === 0) {
          try {
            const { data: cmRows } = await supabase.from('circle_members').select('circle_id').eq('user_id', userId);
            if (cmRows && cmRows.length > 0) {
              targetCircleIds = cmRows.map(r => r.circle_id).filter(Boolean);
            }
          } catch (e) {}
        }
        if (targetCircleIds.length === 0) {
          targetCircleIds = [null];
        }

        for (const cId of targetCircleIds) {
          const payload = { ...locPayload };
          if (cId) payload.circle_id = cId;

          try {
            const { error: upsertErr } = await supabase.from('locations').upsert(payload, {
              onConflict: 'user_id'
            });
            if (upsertErr) {
              console.error('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] Upsert error for circle', cId, ':', upsertErr.message);
            } else {
              console.log('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] DB updated successfully for user:', userId, 'circle_id:', cId);
            }
          } catch (err: any) {
            console.error('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] Exception writing location to DB:', err?.message);
          }
        }

        // 2. Insert authentic GPS coordinate into location_history for 2-day historical logging (with 15m noise filter)
        const lastSaved = lastBgHistorySavedPoint[userId];
        let shouldSaveBgHistory = false;

        if (!lastSaved) {
          shouldSaveBgHistory = true;
        } else {
          const distMeters = calculateHaversineMeters(lastSaved.lat, lastSaved.lng, latitude, longitude);
          const timeDiffSec = (now - lastSaved.timeMs) / 1000;
          if (isDriving || (rawSpeed || 0) >= 2.0) {
            // High-precision background breadcrumbs while driving (every 10m or 15s)
            if (distMeters >= 10 || timeDiffSec >= 15) {
              shouldSaveBgHistory = true;
            }
          } else if (distMeters >= 25 || (distMeters >= 15 && timeDiffSec >= 300)) {
            // Filter stationary drift: only log new point if truly moved >25m
            shouldSaveBgHistory = true;
          }
        }

        if (shouldSaveBgHistory) {
          const authenticPoint = `POINT(${longitude} ${latitude})`;
          await queueAndSyncLocationHistory({
            user_id: userId,
            geom: authenticPoint,
            speed_mps: rawSpeed,
            recorded_at: new Date(now).toISOString(),
            accuracy: latest.coords.accuracy ?? undefined,
            latitude,
            longitude,
          });
          lastBgHistorySavedPoint[userId] = { lat: latitude, lng: longitude, timeMs: now };
        }
          if (memberCircle && memberCircle.length > 0) {
            const circleId = memberCircle[0].circle_id;
            const { data: placesData } = await supabase
              .from('places')
              .select('*')
              .eq('circle_id', circleId);

            if (placesData && placesData.length > 0) {
              const { evaluateGeofenceBreaches } = require('./GeofenceEngine');
              const formattedPlaces = placesData.map((p: any) => {
                let directLat = parseFloat(p.latitude ?? p.start_lat ?? p.lat);
                let directLng = parseFloat(p.longitude ?? p.start_lng ?? p.lng);

                if (!isNaN(directLat) && !isNaN(directLng) && directLat !== 0 && directLng !== 0) {
                  return { ...p, latitude: directLat, longitude: directLng };
                }

                let lat = 0;
                let lng = 0;

                if (p.geom) {
                  if (typeof p.geom === 'string') {
                    const matches = p.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
                    if (matches && matches.length >= 3) {
                      lng = parseFloat(matches[1]);
                      lat = parseFloat(matches[2]);
                    }
                  } else if (typeof p.geom === 'object' && Array.isArray(p.geom.coordinates)) {
                    lng = parseFloat(p.geom.coordinates[0]);
                    lat = parseFloat(p.geom.coordinates[1]);
                  }
                }

                return {
                  ...p,
                  latitude: lat || directLat || 20.5937,
                  longitude: lng || directLng || 78.9629,
                };
              });

              await evaluateGeofenceBreaches(
                {
                  user_id: userId,
                  latitude: finalLat,
                  longitude: finalLng,
                  accuracy_m: latest.coords.accuracy ?? undefined,
                  speed_mps: rawSpeed,
                  activity_state: activityState,
                },
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

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_BACKGROUND_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
      }
    } catch (e) {
      // Task not active yet, safe to proceed
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

    const activeCircleId = useCircleStore.getState().activeCircle?.id;

    let loc = await Location.getLastKnownPositionAsync();
    if (!loc?.coords) {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    }
    if (!loc?.coords) return;

    const { latitude, longitude, speed } = loc.coords;

    let finalLat = latitude;
    let finalLng = longitude;

    let batteryPct = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) batteryPct = Math.round(level * 100);
    } catch (e) {}

    const isDriving = (speed || 0) > 4.5;
    const point = `POINT(${finalLng} ${finalLat})`;
    console.log('[GPS_PIPELINE:LAYER_1_TRIGGER] Instant location ping fired:', {
      userId,
      lat: finalLat,
      lng: finalLng,
      speed,
      battery: batteryPct,
      activeCircleId,
      timestamp: new Date().toISOString(),
    });

    const locPayload: any = {
      user_id: userId,
      latitude: finalLat,
      longitude: finalLng,
      battery_pct: batteryPct,
      is_driving: isDriving,
      speed_mps: speed || 0,
      activity_state: isDriving ? 'Driving' : ((speed || 0) >= 0.8 ? 'Walking' : 'Stationary'),
      geom: point,
      updated_at: new Date().toISOString(),
    };

    let targetCircleIds: (string | null)[] = activeCircleId ? [activeCircleId] : [];
    if (targetCircleIds.length === 0) {
      try {
        const { data: cmRows } = await supabase.from('circle_members').select('circle_id').eq('user_id', userId);
        if (cmRows && cmRows.length > 0) {
          targetCircleIds = cmRows.map(r => r.circle_id).filter(Boolean);
        }
      } catch (e) {}
    }
    if (targetCircleIds.length === 0) {
      targetCircleIds = [null];
    }

    for (const cId of targetCircleIds) {
      const payload = { ...locPayload };
      if (cId) payload.circle_id = cId;

      try {
        const { error: upsertErr } = await supabase.from('locations').upsert(payload, {
          onConflict: 'user_id'
        });
        if (upsertErr) {
          console.error('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] Instant ping upsert error for circle', cId, ':', upsertErr.message);
        } else {
          console.log('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] Instant ping wrote location to DB for user:', userId, 'circle_id:', cId);
        }
      } catch (err: any) {
        console.error('[GPS_PIPELINE:LAYER_2_BACKEND_WRITE] Instant ping exception writing location:', err?.message);
      }
    }
  } catch (e) {
    console.warn('Instant location ping error:', e);
  }
};

export const stopBackgroundLocation = async () => {
  lastProcessedLat = 0;
  lastProcessedLng = 0;
  lastProcessedTimestamp = 0;
  lastBgHistorySavedPoint = {};

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
    console.log('[LocationService] Background location and geofence tracking fully stopped and module state cleansed.');
  } catch (err) {
    console.error('Error stopping background location service:', err);
  }
};

export const stopBatteryOptimizedBackgroundLocation = stopBackgroundLocation;
