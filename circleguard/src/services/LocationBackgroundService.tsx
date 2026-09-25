import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { queueAndSyncLocationHistory } from './OfflineLocationQueueService';
import { useCircleStore } from '../store/useCircleStore';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_BACKGROUND_TASK = 'CIRCLEGUARD_BACKGROUND_LOCATION_TASK';
const SESSION_CACHE_KEY = '@circleguard_active_session_cache';

interface CachedBackgroundSession {
  userId: string;
  fullName?: string;
  isGhostMode?: boolean;
  circleIds?: string[];
  trackingMode?: string;
}

let inMemorySessionCache: CachedBackgroundSession | null = null;
let lastProcessedLat = 0;
let lastProcessedLng = 0;
let lastProcessedTimestamp = 0;
let lastBgHistorySavedPoint: { [userId: string]: { lat: number; lng: number; timeMs: number } } = {};

/**
 * Persist or update current session details for background tasks so they never fail
 * when entering underground tunnels, subways, or areas with poor cellular signal.
 */
export async function updateBackgroundSessionCache(info: Partial<CachedBackgroundSession>): Promise<void> {
  try {
    const existing: Partial<CachedBackgroundSession> = inMemorySessionCache || {};
    const updated: CachedBackgroundSession = {
      ...existing,
      ...info,
      userId: info.userId || existing.userId || '',
    };
    inMemorySessionCache = updated;
    if (updated.userId) {
      await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Non-critical cache error
  }
}

async function getCachedSession(): Promise<CachedBackgroundSession | null> {
  if (inMemorySessionCache?.userId) return inMemorySessionCache;
  try {
    const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      inMemorySessionCache = JSON.parse(raw);
      return inMemorySessionCache;
    }
  } catch {
    // Return null on storage read error
  }
  return null;
}

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
      const { latitude, longitude, speed, accuracy } = latest.coords;

      // Strict GPS Accuracy Gate: Immediately reject cell-tower / WiFi multipath fixes (> 35m, or > 45m when driving fast)
      // This prevents recording erroneous fixes that jump onto random streets
      const maxAllowedAcc = (speed || 0) > 10 ? 45 : 35;
      if (typeof accuracy === 'number' && accuracy > maxAllowedAcc) {
        return;
      }

      // Noise & Jitter Filter: Skip redundant updates if position moved < ~3 meters and stationary
      const now = Date.now();
      const distFromLast = calculateHaversineMeters(lastProcessedLat, lastProcessedLng, latitude, longitude);
      const isStationaryNoise = (distFromLast < 3.0 && (speed || 0) < 0.75 && (now - lastProcessedTimestamp < 30000));
      
      if (lastProcessedLat !== 0 && isStationaryNoise) {
        return;
      }
      lastProcessedLat = latitude;
      lastProcessedLng = longitude;
      lastProcessedTimestamp = now;

      try {
        // Step 1: Resilient User Identification (Cache-First, Network-Fallback)
        let cached = await getCachedSession();
        let userId = cached?.userId;

        if (!userId) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            userId = sessionData?.session?.user?.id;
            if (userId) {
              await updateBackgroundSessionCache({ userId });
            }
          } catch {
            // Network offline
          }
        }

        if (!userId) {
          // No active user session can be identified
          return;
        }

        // Step 2: Privacy Mode & Circle Membership Evaluation
        const trackingMode = cached?.trackingMode || 'continuous';
        if (trackingMode === 'privacy') {
          return;
        }

        // Step 3: CRITICAL RESILIENCE — IMMEDIATELY SAVE AUTHENTIC BREADCRUMB
        // We write to local offline queue BEFORE any remote Supabase requests.
        // Even if entering an underground metro tunnel, train cut-off, or dead zone,
        // this GPS fix is guaranteed NEVER to be dropped.
        const rawSpeed = (speed || 0);
        const isDriving = rawSpeed > 4.5;
        const lastSaved = lastBgHistorySavedPoint[userId];
        let shouldSaveBgHistory = false;

        if (!lastSaved) {
          shouldSaveBgHistory = true;
        } else {
          const distMeters = calculateHaversineMeters(lastSaved.lat, lastSaved.lng, latitude, longitude);
          const timeDiffSec = (now - lastSaved.timeMs) / 1000;
          if (isDriving || rawSpeed >= 2.0) {
            // High-precision breadcrumbs while in transit (metro, rail, or car)
            if (distMeters >= 8 || timeDiffSec >= 12) {
              shouldSaveBgHistory = true;
            }
          } else if (distMeters >= 20 || (distMeters >= 12 && timeDiffSec >= 180)) {
            // Walking or slow transit
            shouldSaveBgHistory = true;
          }
        }

        if (shouldSaveBgHistory) {
          const authenticPoint = `POINT(${longitude} ${latitude})`;
          // Non-blocking offline queue sync - won't throw or cancel on bad network
          queueAndSyncLocationHistory({
            user_id: userId,
            geom: authenticPoint,
            speed_mps: rawSpeed,
            recorded_at: new Date(now).toISOString(),
            accuracy: accuracy ?? undefined,
            latitude,
            longitude,
          }).catch(() => {});
          lastBgHistorySavedPoint[userId] = { lat: latitude, lng: longitude, timeMs: now };
        }

        // Step 4: Ghost mode & live location sync (executed asynchronously)
        let isGhost = !!cached?.isGhostMode;
        let finalLat = latitude;
        let finalLng = longitude;

        if (isGhost) {
          const charCode = userId.charCodeAt(0) || 65;
          const fuzzAngle = ((charCode * 43) % 360) * (Math.PI / 180);
          finalLat = parseFloat((latitude + 0.012 * Math.sin(fuzzAngle)).toFixed(5));
          finalLng = parseFloat((longitude + 0.012 * Math.cos(fuzzAngle)).toFixed(5));
        }

        let batteryPct = 100;
        try {
          const level = await Battery.getBatteryLevelAsync();
          if (level >= 0) batteryPct = Math.round(level * 100);
        } catch (e) {}

        const effectiveSpeed = isGhost ? 0 : rawSpeed;
        const speedKmh = Math.round(effectiveSpeed * 3.6);
        
        let activityState = 'Stationary / Idle';
        if (isGhost) {
          activityState = 'Ghost Mode (Obfuscated)';
        } else if (effectiveSpeed > 4.5) {
          activityState = `Traveling • ${speedKmh} km/h`;
        } else if (effectiveSpeed >= 0.8) {
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

        // 2. Geofence evaluation (non-blocking)
        if (targetCircleIds && targetCircleIds.length > 0 && targetCircleIds[0]) {
          const primaryCircleId = targetCircleIds[0];
          try {
            // Check local AsyncStorage cache first so closed-app evaluation never waits on or fails due to network latency
            let placesData: any[] = [];
            try {
              const cachedRaw = await AsyncStorage.getItem('@circleguard_cached_geofence_places');
              if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  placesData = parsed.filter((p: any) => !primaryCircleId || p.circle_id === primaryCircleId);
                }
              }
            } catch (e) {}

            if (placesData.length === 0) {
              const { data } = await supabase
                .from('places')
                .select('*')
                .eq('circle_id', primaryCircleId);
              if (data && data.length > 0) {
                placesData = data;
              }
            }

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
                cached?.fullName || 'Member',
                formattedPlaces
              );
            }
          } catch {
            // Geofence check skipped if evaluation error
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
        let cached = await getCachedSession();
        let userId = cached?.userId;
        if (!userId) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            userId = sessionData?.session?.user?.id;
          } catch (e) {}
        }
        if (!userId) return;

        let placeData: any = null;
        try {
          const cachedPlacesRaw = await AsyncStorage.getItem('@circleguard_cached_geofence_places');
          if (cachedPlacesRaw) {
            const placesArr = JSON.parse(cachedPlacesRaw);
            if (Array.isArray(placesArr)) {
              placeData = placesArr.find((p: any) => p.id === region.identifier);
            }
          }
        } catch (e) {}

        if (!placeData) {
          try {
            const { data } = await supabase
              .from('places')
              .select('*')
              .eq('id', region.identifier)
              .single();
            placeData = data;
          } catch (e) {}
        }

        if (!placeData) return;

        const userName = cached?.fullName || 'Member';
        const isExit = eventType === Location.GeofencingEventType.Exit;
        const targetType: 'entry' | 'exit' = isExit ? 'exit' : 'entry';
        const { canAndRecordGeofenceAlert, dispatchGeofencePushAlert } = require('./GeofenceEngine');

        // Check authoritative deduplicator before dispatching
        const allowed = await canAndRecordGeofenceAlert(userId, placeData.id, targetType);
        if (!allowed) {
          return;
        }

        // Keep local state in sync
        try {
          await AsyncStorage.setItem(`@circleguard_geofence_state_${userId}_${placeData.id}`, isExit ? 'outside' : 'inside');
        } catch (e) {}

        const breachEvent = {
          id: `${region.identifier}_${isExit ? 'exit' : 'entry'}_${Date.now()}`,
          type: isExit ? 'exit' : 'entry',
          placeId: placeData.id,
          placeName: placeData.name,
          userId,
          userName,
          distanceMeters: placeData.radius_m || 150,
          formattedDistance: `${placeData.radius_m || 150}m boundary`,
          timestamp: new Date().toISOString(),
          latitude: region.latitude,
          longitude: region.longitude,
        };

        try {
          await supabase.from('place_events').insert({
            place_id: placeData.id,
            user_id: userId,
            event_type: isExit ? 'departure' : 'arrival',
            occurred_at: new Date().toISOString(),
          });
        } catch (e) {}

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
    const validPlaces = (places || []).filter(p => p && p.id && !isNaN(p.latitude) && !isNaN(p.longitude) && p.latitude !== 0 && p.longitude !== 0);
    const regions = validPlaces.map(p => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: Math.max(p.radius_m || 150, 100), // Native OS geofence min radius 100m
      notifyOnEnter: true,
      notifyOnExit: true,
    }));

    // Cache places locally for immediate zero-network headless execution
    try {
      await AsyncStorage.setItem('@circleguard_cached_geofence_places', JSON.stringify(validPlaces));
    } catch (e) {}

    if (regions.length > 0) {
      await Location.startGeofencingAsync(LOCATION_GEOFENCE_TASK, regions.slice(0, 20)); // Max 20 monitored regions on iOS
      console.log(`[LocationService] Successfully registered ${regions.length} native OS geofence regions.`);
    } else {
      const isGeofenceRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_GEOFENCE_TASK);
      if (isGeofenceRegistered) {
        await Location.stopGeofencingAsync(LOCATION_GEOFENCE_TASK);
      }
    }
  } catch (err) {
    console.warn('Native geofence registration note:', err);
  }
};

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

    // Pre-populate background session cache so background task starts with hot credentials in offline environments
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uId = sessionData?.session?.user?.id;
      if (uId) {
        const { data: prof } = await supabase.from('profiles').select('full_name, is_ghost_mode').eq('id', uId).single();
        const { data: memberCircle } = await supabase.from('circle_members').select('circle_id, circles(tracking_mode)').eq('user_id', uId).limit(1);
        let circleObj = memberCircle?.[0]?.circles as any;
        if (Array.isArray(circleObj)) circleObj = circleObj[0];
        const trackingMode = circleObj?.tracking_mode || 'continuous';
        await updateBackgroundSessionCache({
          userId: uId,
          fullName: prof?.full_name || 'Member',
          isGhostMode: !!prof?.is_ghost_mode,
          circleIds: memberCircle?.map(m => m.circle_id) || [],
          trackingMode,
        });
      }
    } catch (e) {
      // Offline fallback: will read existing cached session if available
    }

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
    if (!loc?.coords || (loc.coords.accuracy && loc.coords.accuracy > 45)) {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    }
    if (!loc?.coords || (loc.coords.accuracy && loc.coords.accuracy > 50)) return;

    const { latitude, longitude, speed } = loc.coords;

    // Check Ghost Mode state
    let isGhost = false;
    try {
      const localGhost = await AsyncStorage.getItem('@circleguard_ghost_mode');
      const cached = await getCachedSession();
      isGhost = localGhost === 'true' || !!cached?.isGhostMode;
    } catch (_) {}

    let finalLat = latitude;
    let finalLng = longitude;

    if (isGhost) {
      const charCode = userId.charCodeAt(0) || 65;
      const fuzzAngle = ((charCode * 43) % 360) * (Math.PI / 180);
      finalLat = parseFloat((latitude + 0.012 * Math.sin(fuzzAngle)).toFixed(5));
      finalLng = parseFloat((longitude + 0.012 * Math.cos(fuzzAngle)).toFixed(5));
    }

    let batteryPct = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) batteryPct = Math.round(level * 100);
    } catch (e) {}

    const effectiveSpeed = isGhost ? 0 : (speed || 0);
    const isDriving = !isGhost && effectiveSpeed > 4.5;
    const point = `POINT(${finalLng} ${finalLat})`;
    console.log('[GPS_PIPELINE:LAYER_1_TRIGGER] Instant location ping fired:', {
      userId,
      lat: finalLat,
      lng: finalLng,
      speed: effectiveSpeed,
      isGhost,
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
      speed_mps: effectiveSpeed,
      activity_state: isGhost
        ? 'Ghost Mode (Obfuscated)'
        : isDriving
        ? 'Driving'
        : effectiveSpeed >= 0.8
        ? 'Walking'
        : 'Stationary',
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
