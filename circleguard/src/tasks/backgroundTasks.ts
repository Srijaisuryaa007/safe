import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  reportZoneTransitionAuthoritative,
  flushZoneTransitionQueue,
} from '../services/ZoneTransitionQueueService';

export const GEOFENCE_TASK = 'CIRCLEGUARD_GEOFENCE_TASK';
export const LOCATION_TASK = 'CIRCLEGUARD_LOCATION_FALLBACK_TASK';

const CACHED_ZONES_KEY = '@circleguard_cached_geofence_places';
const DWELL_OUTSIDE_PREFIX = '@circleguard_dwell_outside_';
const LAST_KNOWN_INSIDE_PREFIX = '@circleguard_zone_inside_';

function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getAuthUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('@circleguard_active_session_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.userId) return parsed.userId;
    }
  } catch {}

  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

// ============================================================================
// 1. PRIMARY NATIVE GEOFENCE TASK (Kernel-managed wakeups on iOS / Android)
// ============================================================================
if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
    if (error || !data) return;

    const { eventType, region } = data;
    if (!region || !region.identifier) return;

    try {
      // In geofence task, when eventType === Exit/Enter, capture occurredAt AT THAT MOMENT inside task
      const occurredAt = new Date().toISOString();
      const userId = await getAuthUserId();
      if (!userId) return;

      const isExit = eventType === Location.GeofencingEventType.Exit;
      const transitionType: 'EXIT' | 'ENTER' = isExit ? 'EXIT' : 'ENTER';

      console.log(`[GeofenceTask] Native OS transition detected: ${transitionType} for zone ${region.identifier} at ${occurredAt}`);

      // Authoritative transition report with offline queuing
      await reportZoneTransitionAuthoritative({
        memberId: userId,
        zoneId: region.identifier,
        type: transitionType,
        occurredAt, // Closest available time to real exit
        lat: region.latitude,
        lng: region.longitude,
      });

      // Update local inside state cache
      await AsyncStorage.setItem(`${LAST_KNOWN_INSIDE_PREFIX}${userId}_${region.identifier}`, isExit ? 'false' : 'true');

      // Clear any dwell timers
      await AsyncStorage.removeItem(`${DWELL_OUTSIDE_PREFIX}${userId}_${region.identifier}`);

      // Flush offline queue if network was restored
      await flushZoneTransitionQueue();
    } catch (err) {
      console.error('[GeofenceTask] Error executing native geofence task:', err);
    }
  });
}

// ============================================================================
// 2. LOCATION FALLBACK TASK (Balanced accuracy background location listener)
// ============================================================================
if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data) return;

    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      // Load monitored places from cache
      let places: any[] = [];
      const cached = await AsyncStorage.getItem(CACHED_ZONES_KEY);
      if (cached) {
        places = JSON.parse(cached);
      }

      if (!Array.isArray(places) || places.length === 0) return;

      for (const loc of locations) {
        const { latitude, longitude, accuracy } = loc.coords;

        // GPS Jitter filter: ignore fixes with accuracy worse than 100m
        if (typeof accuracy === 'number' && accuracy > 100) {
          continue;
        }

        // Strictly use the location's own hardware GPS fix timestamp, NEVER Date.now()
        const fixTimestampMs = loc.timestamp || Date.now();
        const fixTimeIso = new Date(fixTimestampMs).toISOString();

        for (const place of places) {
          const placeLat = parseFloat(place.latitude ?? place.start_lat);
          const placeLng = parseFloat(place.longitude ?? place.start_lng);
          const radius = Math.max(parseFloat(place.radius_m || 150), 100);

          if (isNaN(placeLat) || isNaN(placeLng)) continue;

          const distMeters = calculateHaversineMeters(placeLat, placeLng, latitude, longitude);
          const isOutside = distMeters > radius;

          const stateKey = `${LAST_KNOWN_INSIDE_PREFIX}${userId}_${place.id}`;
          const lastInsideRaw = await AsyncStorage.getItem(stateKey);
          const wasInside = lastInsideRaw === null || lastInsideRaw === 'true';

          const dwellKey = `${DWELL_OUTSIDE_PREFIX}${userId}_${place.id}`;

          if (isOutside) {
            if (wasInside) {
              // Candidate for EXIT: check dwell time to avoid false triggers from GPS jitter
              const dwellRaw = await AsyncStorage.getItem(dwellKey);
              if (!dwellRaw) {
                // Record first moment outside zone
                await AsyncStorage.setItem(dwellKey, String(fixTimestampMs));
              } else {
                const firstDwellMs = parseInt(dwellRaw, 10);
                const dwellDurationSec = (fixTimestampMs - firstDwellMs) / 1000;

                // Minimum dwell of 30-60 seconds outside before confirming EXIT
                if (dwellDurationSec >= 30) {
                  const authenticExitIso = new Date(firstDwellMs).toISOString();
                  console.log(`[LocationFallback] Confirmed EXIT after ${Math.round(dwellDurationSec)}s dwell outside. Transition at: ${authenticExitIso}`);

                  await reportZoneTransitionAuthoritative({
                    memberId: userId,
                    zoneId: place.id,
                    type: 'EXIT',
                    occurredAt: authenticExitIso, // Preserves time of first departure outside radius
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy ?? undefined,
                  });

                  await AsyncStorage.setItem(stateKey, 'false');
                  await AsyncStorage.removeItem(dwellKey);
                }
              }
            }
          } else {
            // Member is currently INSIDE the zone
            if (!wasInside) {
              console.log(`[LocationFallback] ENTER transition detected at ${fixTimeIso} for zone ${place.id}`);
              await reportZoneTransitionAuthoritative({
                memberId: userId,
                zoneId: place.id,
                type: 'ENTER',
                occurredAt: fixTimeIso,
                lat: latitude,
                lng: longitude,
                accuracy: accuracy ?? undefined,
              });

              await AsyncStorage.setItem(stateKey, 'true');
            }
            // Reset dwell outside timer since user is currently inside
            await AsyncStorage.removeItem(dwellKey);
          }
        }
      }

      // Flush any queued offline events
      await flushZoneTransitionQueue();
    } catch (err) {
      console.error('[LocationFallback] Error in background location fallback task:', err);
    }
  });
}

// ============================================================================
// 3. REGISTRATION HELPERS
// ============================================================================

/**
 * Register native OS geofences respecting OS limits:
 * - iOS: Maximum 20 monitored regions
 * - Android: Maximum 100 monitored regions
 */
export async function registerSafeZoneGeofences(
  places: any[],
  currentCoords?: { latitude: number; longitude: number }
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const validPlaces = (places || []).filter(
      p => p && p.id && !isNaN(p.latitude ?? p.start_lat) && !isNaN(p.longitude ?? p.start_lng)
    );

    // Cache valid zones for headless offline task execution
    await AsyncStorage.setItem(CACHED_ZONES_KEY, JSON.stringify(validPlaces));

    if (validPlaces.length === 0) {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }
      return;
    }

    // Sort by proximity to current coordinates if more than OS limit
    let prioritizedPlaces = [...validPlaces];
    if (currentCoords) {
      prioritizedPlaces.sort((a, b) => {
        const distA = calculateHaversineMeters(
          currentCoords.latitude,
          currentCoords.longitude,
          parseFloat(a.latitude ?? a.start_lat),
          parseFloat(a.longitude ?? a.start_lng)
        );
        const distB = calculateHaversineMeters(
          currentCoords.latitude,
          currentCoords.longitude,
          parseFloat(b.latitude ?? b.start_lat),
          parseFloat(b.longitude ?? b.start_lng)
        );
        return distA - distB;
      });
    }

    // Apply strict OS limits: iOS max 20, Android max 100
    const osLimit = Platform.OS === 'ios' ? 20 : 100;
    const boundedPlaces = prioritizedPlaces.slice(0, osLimit);

    const regions: Location.LocationRegion[] = boundedPlaces.map(p => ({
      identifier: p.id,
      latitude: parseFloat(p.latitude ?? p.start_lat),
      longitude: parseFloat(p.longitude ?? p.start_lng),
      radius: Math.max(parseFloat(p.radius_m || 150), 100), // Min 100m radius for native OS radio stability
      notifyOnEnter: true,
      notifyOnExit: true,
    }));

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    console.log(`[Geofence] Registered ${regions.length} OS geofence regions (OS limit: ${osLimit})`);
  } catch (err) {
    console.warn('[Geofence] Native geofence registration note:', err);
  }
}

/**
 * Start background location fallback task with Balanced accuracy and 50m distance interval
 */
export async function startSafeZoneLocationFallback(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (isStarted) return true;

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'CircleGuard Active Protection',
        notificationBody: 'Monitoring safe zones and circle safety in background',
        notificationColor: '#1C1C1E',
      },
    });

    console.log('[LocationFallback] Started background location fallback service');
    return true;
  } catch (err) {
    console.warn('[LocationFallback] Start location updates note:', err);
    return false;
  }
}

/**
 * Stop background location fallback task
 */
export async function stopSafeZoneLocationFallback(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err) {}
}
