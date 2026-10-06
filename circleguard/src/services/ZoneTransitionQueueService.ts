import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AppState, AppStateStatus } from 'react-native';

const ZONE_TRANSITION_QUEUE_KEY = '@circleguard_zone_transition_queue';

export interface ZoneTransitionPayload {
  memberId: string;
  zoneId: string;
  type: 'EXIT' | 'ENTER';
  occurredAt: string; // Strictly preserved ISO string from transition moment
  lat?: number;
  lng?: number;
  accuracy?: number;
}

let isFlushingQueue = false;

/**
 * Report a zone transition with guaranteed offline resilience.
 * If offline or network errors occur, the payload with its original `occurredAt`
 * is queued locally in AsyncStorage and flushed on next network/foreground/background wake.
 */
export async function reportZoneTransitionAuthoritative(
  payload: ZoneTransitionPayload
): Promise<{ success: boolean; queued: boolean; result?: any }> {
  try {
    const { data, error } = await supabase.rpc('report_zone_transition', {
      p_member_id: payload.memberId,
      p_zone_id: payload.zoneId,
      p_type: payload.type,
      p_occurred_at: payload.occurredAt,
      p_lat: payload.lat ?? null,
      p_lng: payload.lng ?? null,
      p_accuracy: payload.accuracy ?? null,
    });

    if (error) {
      console.warn('[ZoneQueue] RPC report_zone_transition error:', error.message);
      await enqueueTransition(payload);
      return { success: false, queued: true };
    }

    console.log('[ZoneQueue] Transition successfully reported to DB RPC:', data);
    return { success: true, queued: false, result: data };
  } catch (err: any) {
    console.warn('[ZoneQueue] Network exception during transition reporting:', err?.message);
    await enqueueTransition(payload);
    return { success: false, queued: true };
  }
}

/**
 * Persist transition payload into AsyncStorage queue while preserving authentic occurredAt
 */
export async function enqueueTransition(payload: ZoneTransitionPayload): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ZONE_TRANSITION_QUEUE_KEY);
    const queue: ZoneTransitionPayload[] = raw ? JSON.parse(raw) : [];

    // Avoid duplicate queue entries for the same member, zone, and transition type within 1 minute
    const isDup = queue.some(
      item =>
        item.memberId === payload.memberId &&
        item.zoneId === payload.zoneId &&
        item.type === payload.type &&
        Math.abs(new Date(item.occurredAt).getTime() - new Date(payload.occurredAt).getTime()) < 60000
    );

    if (!isDup) {
      queue.push(payload);
      await AsyncStorage.setItem(ZONE_TRANSITION_QUEUE_KEY, JSON.stringify(queue));
      console.log(`[ZoneQueue] Queued offline transition: ${payload.type} at ${payload.occurredAt}. Total queued: ${queue.length}`);
    }
  } catch (e) {
    console.error('[ZoneQueue] Error writing to offline transition queue:', e);
  }
}

/**
 * Flush all pending offline transitions in FIFO order
 */
export async function flushZoneTransitionQueue(): Promise<void> {
  if (isFlushingQueue) return;
  isFlushingQueue = true;

  try {
    const raw = await AsyncStorage.getItem(ZONE_TRANSITION_QUEUE_KEY);
    if (!raw) {
      isFlushingQueue = false;
      return;
    }

    const queue: ZoneTransitionPayload[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) {
      isFlushingQueue = false;
      return;
    }

    console.log(`[ZoneQueue] Flushing ${queue.length} pending offline transitions...`);
    const remaining: ZoneTransitionPayload[] = [];

    for (const item of queue) {
      try {
        const { error } = await supabase.rpc('report_zone_transition', {
          p_member_id: item.memberId,
          p_zone_id: item.zoneId,
          p_type: item.type,
          p_occurred_at: item.occurredAt, // Original authentic timestamp preserved
          p_lat: item.lat ?? null,
          p_lng: item.lng ?? null,
          p_accuracy: item.accuracy ?? null,
        });

        if (error) {
          // If network error, retain for retry
          if (error.code === 'PGRST301' || error.message?.includes('network') || error.message?.includes('fetch')) {
            remaining.push(item);
          } else {
            // Logic/schema error or already ignored - do not retry indefinitely
            console.warn('[ZoneQueue] Dropping unrecoverable transition item:', error.message);
          }
        } else {
          console.log(`[ZoneQueue] Flushed transition: ${item.type} for zone ${item.zoneId}`);
        }
      } catch (networkErr) {
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(ZONE_TRANSITION_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(ZONE_TRANSITION_QUEUE_KEY);
      console.log('[ZoneQueue] Offline transition queue fully cleared.');
    }
  } catch (e) {
    console.error('[ZoneQueue] Exception during queue flush:', e);
  } finally {
    isFlushingQueue = false;
  }
}

// Automatically bind queue flushing on app foreground
AppState.addEventListener('change', (nextState: AppStateStatus) => {
  if (nextState === 'active') {
    flushZoneTransitionQueue().catch(() => {});
  }
});
