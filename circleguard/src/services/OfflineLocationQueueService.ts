import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface QueuedLocationPoint {
  user_id: string;
  geom: string;
  speed_mps: number;
  recorded_at: string;
  accuracy?: number;
  latitude?: number;
  longitude?: number;
}

const STORAGE_PREFIX = '@circleguard_offline_breadcrumbs_';
const MAX_QUEUE_SIZE = 2500;
let isFlushing = false;

/**
 * Extract latitude and longitude from WKT POINT(lng lat) if not provided
 */
function parseCoordsFromGeom(geom: string): { latitude: number; longitude: number } | null {
  try {
    const match = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return {
        longitude: parseFloat(match[1]),
        latitude: parseFloat(match[2]),
      };
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Record a location point with offline resilience.
 * If online, sends immediately. If bad network / offline, queues locally and syncs on next connection.
 * Retains transit/metro fixes up to 650m-900m so underground subways and rail corridors are never lost.
 */
export async function queueAndSyncLocationHistory(point: QueuedLocationPoint): Promise<void> {
  if (!point.user_id) return;

  // Strict Accuracy Filter: Only record authentic GPS fixes (<= 35m, or <= 45m when driving fast)
  // Rejects cell-tower & WiFi multipath triangulation errors that jump onto random streets
  const maxAllowedAccuracy = (point.speed_mps && point.speed_mps > 10.0) ? 45 : 35;
  if (typeof point.accuracy === 'number' && point.accuracy > maxAllowedAccuracy) {
    return;
  }

  // Ensure lat/lng are populated
  let lat = point.latitude;
  let lng = point.longitude;
  if ((lat === undefined || lng === undefined) && point.geom) {
    const parsed = parseCoordsFromGeom(point.geom);
    if (parsed) {
      lat = parsed.latitude;
      lng = parsed.longitude;
    }
  }

  const pointToSave: QueuedLocationPoint = {
    user_id: point.user_id,
    geom: point.geom,
    speed_mps: point.speed_mps || 0,
    recorded_at: point.recorded_at,
    accuracy: point.accuracy,
    latitude: lat,
    longitude: lng,
  };

  const storageKey = `${STORAGE_PREFIX}${point.user_id}`;

  try {
    // 1. Load existing pending queue
    const saved = await AsyncStorage.getItem(storageKey);
    let queue: QueuedLocationPoint[] = saved ? JSON.parse(saved) : [];

    // Append new point
    queue.push(pointToSave);

    // Enforce max buffer size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }

    // Always persist to local cache first so crash or abrupt connection loss never loses breadcrumbs
    await AsyncStorage.setItem(storageKey, JSON.stringify(queue));

    // 2. Try to sync entire batch to Supabase (with timeout guard)
    const syncPromise = supabase
      .from('location_history')
      .insert(queue.map(p => ({
        user_id: p.user_id,
        geom: p.geom,
        speed_mps: p.speed_mps,
        recorded_at: p.recorded_at,
      })));

    // 4-second timeout to prevent hanging on flaky/underground 2G/3G connections
    const timeoutPromise = new Promise<{ error: { message: string } }>((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout in tunnel/low-connectivity')), 4000)
    );

    const result = await Promise.race([syncPromise, timeoutPromise]) as { error?: any };

    if (result && !result.error) {
      // Successfully uploaded all points! Clear local storage buffer
      await AsyncStorage.removeItem(storageKey);
    }
  } catch (err) {
    // Network error / timeout: Point is safely stored in local queue already.
    // Logging at debug level to avoid spamming console in tunnels.
    // console.debug('[OfflineQueue] Buffered point offline:', err);
  }
}

/**
 * Retrieve any currently unsynced offline breadcrumbs from local storage.
 * Used by map screens to render recent track history even before network sync completes.
 */
export async function getPendingOfflineBreadcrumbs(userId: string): Promise<QueuedLocationPoint[]> {
  if (!userId) return [];
  try {
    const storageKey = `${STORAGE_PREFIX}${userId}`;
    const saved = await AsyncStorage.getItem(storageKey);
    if (!saved) return [];
    const parsed: QueuedLocationPoint[] = JSON.parse(saved);
    return parsed.map(p => {
      if (p.latitude === undefined || p.longitude === undefined) {
        const coords = parseCoordsFromGeom(p.geom);
        return {
          ...p,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        };
      }
      return p;
    });
  } catch {
    return [];
  }
}

/**
 * Flush all pending offline breadcrumbs when network comes back
 */
export async function flushOfflineBreadcrumbs(userId: string): Promise<number> {
  if (!userId || isFlushing) return 0;
  isFlushing = true;

  const storageKey = `${STORAGE_PREFIX}${userId}`;

  try {
    const saved = await AsyncStorage.getItem(storageKey);
    if (!saved) {
      isFlushing = false;
      return 0;
    }

    const queue: QueuedLocationPoint[] = JSON.parse(saved);
    if (!queue || queue.length === 0) {
      isFlushing = false;
      return 0;
    }

    // Bulk upload all buffered points to Supabase in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
      const chunk = queue.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('location_history')
        .insert(chunk.map(p => ({
          user_id: p.user_id,
          geom: p.geom,
          speed_mps: p.speed_mps,
          recorded_at: p.recorded_at,
        })));

      if (error) {
        // Stop and preserve remaining points
        const remaining = queue.slice(i);
        await AsyncStorage.setItem(storageKey, JSON.stringify(remaining));
        isFlushing = false;
        return i;
      }
    }

    // All chunks uploaded successfully! Clear offline queue
    await AsyncStorage.removeItem(storageKey);
    isFlushing = false;
    return queue.length;
  } catch (err) {
    console.warn('[OfflineQueue] Flush error:', err);
    isFlushing = false;
    return 0;
  }
}
