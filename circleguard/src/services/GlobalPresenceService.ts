// circleguard/src/services/GlobalPresenceService.ts
// App-level continuous presence and location telemetry heartbeat

import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: any = null;
let currentTrackingUserId: string | null = null;

async function sendPresenceHeartbeat(userId: string, circleId?: string | null) {
  if (!userId) return;

  try {
    let lat: number | undefined;
    let lng: number | undefined;
    let speed: number | undefined;
    let heading: number | undefined;
    let accuracy: number | undefined;

    // Check location permission before calling expo-location
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      try {
        let loc = await Location.getLastKnownPositionAsync({
          maxAge: 60000,
          requiredAccuracy: 150,
        });

        if (!loc?.coords) {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }

        if (loc?.coords) {
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          speed = loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : 0;
          heading = loc.coords.heading || 0;
          accuracy = loc.coords.accuracy ?? undefined;
        }
      } catch (locErr) {
        console.warn('[GlobalPresenceService] Location fetch skipped:', locErr);
      }
    }

    let batteryPct: number | undefined;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (typeof level === 'number' && level >= 0) {
        batteryPct = Math.round(level * 100);
      }
    } catch (_) {}

    const nowIso = new Date().toISOString();
    const point = lat != null && lng != null ? `POINT(${lng} ${lat})` : null;

    const locPayload: any = {
      user_id: userId,
      circle_id: circleId || null,
      updated_at: nowIso,
    };

    if (lat != null && lng != null) {
      locPayload.latitude = lat;
      locPayload.longitude = lng;
      locPayload.geom = point;
      if (accuracy != null) locPayload.accuracy_m = accuracy;
      if (speed != null) locPayload.speed_mps = speed;
      if (heading != null) locPayload.heading = heading;
      locPayload.is_driving = (speed || 0) > 4.5;
    }

    if (batteryPct != null) {
      locPayload.battery_pct = batteryPct;
    }

    // 1. Persistent write to Supabase locations table
    const { error } = await supabase
      .from('locations')
      .upsert(locPayload, { onConflict: 'user_id' });

    if (error) {
      if (
        error.message?.includes('row-level security') ||
        error.message?.includes('JWT') ||
        error.message?.includes('expired')
      ) {
        try {
          const { data: refData } = await supabase.auth.refreshSession();
          const refreshedUid = refData?.session?.user?.id;
          if (refreshedUid) {
            locPayload.user_id = refreshedUid;
            await supabase.from('locations').upsert(locPayload, { onConflict: 'user_id' });
          }
        } catch (_) {}
      }
    }

    // 2. Immediate local store update
    if (lat != null && lng != null) {
      useCircleStore.getState().updateMemberLocationDirect({
        user_id: userId,
        latitude: lat,
        longitude: lng,
        speed_mps: speed,
        is_driving: (speed || 0) > 4.5,
        battery_pct: batteryPct,
        updated_at: nowIso,
      });
    }

    // 3. Peer Realtime Broadcast to active circle channel
    if (circleId) {
      const peerChannel = supabase.channel(`circle_locations_${circleId}`);
      peerChannel.send({
        type: 'broadcast',
        event: 'location_update',
        payload: {
          user_id: userId,
          latitude: lat,
          longitude: lng,
          speed_mps: speed,
          battery_pct: batteryPct,
          is_online: true,
          updated_at: nowIso,
        },
      });
    }
  } catch (err) {
    console.warn('[GlobalPresenceService] Heartbeat warning:', err);
  }
}

export function startGlobalPresence(
  userId: string,
  getActiveCircleId: () => string | undefined
): () => void {
  if (!userId) return () => {};

  if (currentTrackingUserId === userId && heartbeatTimer) {
    return stopGlobalPresence;
  }

  currentTrackingUserId = userId;

  const runHeartbeat = () => {
    const circleId = getActiveCircleId();
    sendPresenceHeartbeat(userId, circleId);
  };

  // Immediate heartbeat on boot/login
  runHeartbeat();

  // Clear existing timer if any
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // Send every 25 seconds while active
  heartbeatTimer = setInterval(runHeartbeat, 25000);

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      runHeartbeat();
      if (!heartbeatTimer) {
        heartbeatTimer = setInterval(runHeartbeat, 25000);
      }
    } else {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  };

  if (appStateSubscription) {
    appStateSubscription.remove();
  }
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return stopGlobalPresence;
}

export function stopGlobalPresence(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  currentTrackingUserId = null;
}
