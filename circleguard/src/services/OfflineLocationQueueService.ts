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
const MAX_QUEUE_SIZE = 1000;
let isFlushing = false;

/**
 * Record a location point with offline resilience.
 * If online, sends immediately. If bad network / offline, queues locally and syncs on next connection.
 */
export async function queueAndSyncLocationHistory(point: QueuedLocationPoint): Promise<void> {
  if (!point.user_id) return;

  // 1. Accuracy Filter: Drop inaccurate cell-tower triangulation spikes (> 40 meters error)
  if (typeof point.accuracy === 'number' && point.accuracy > 40) {
    return;
  }

  const storageKey = `${STORAGE_PREFIX}${point.user_id}`;

  try {
    // 2. Load existing pending queue
    const saved = await AsyncStorage.getItem(storageKey);
    let queue: QueuedLocationPoint[] = saved ? JSON.parse(saved) : [];

    // Append new point
    queue.push({
      user_id: point.user_id,
      geom: point.geom,
      speed_mps: point.speed_mps,
      recorded_at: point.recorded_at,
    });

    // Enforce max buffer size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(-MAX_QUEUE_SIZE);
    }

    // 3. Try to sync entire batch to Supabase
    const { error } = await supabase
      .from('location_history')
      .insert(queue.map(p => ({
        user_id: p.user_id,
        geom: p.geom,
        speed_mps: p.speed_mps,
        recorded_at: p.recorded_at,
      })));

    if (!error) {
      // Successfully uploaded all points! Clear local storage buffer
      await AsyncStorage.removeItem(storageKey);
    } else {
      // Network failed / slow: Persist pending queue in local AsyncStorage for future flush
      await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
    }
  } catch (err) {
    // Network error / timeout: Ensure point is saved locally
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      let queue: QueuedLocationPoint[] = saved ? JSON.parse(saved) : [];
      queue.push({
        user_id: point.user_id,
        geom: point.geom,
        speed_mps: point.speed_mps,
        recorded_at: point.recorded_at,
      });
      await AsyncStorage.setItem(storageKey, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
    } catch (e) {
      console.warn('[OfflineQueue] Local storage save error:', e);
    }
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
