import { supabase } from '../lib/supabase';

export interface GeofencePlace {
  id: string;
  circle_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  created_by?: string;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  target_user_id?: string | null;
  category?: string;
}

export interface UserLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  speed_mps?: number;
  updated_at?: string;
}

export interface GeofenceBreachEvent {
  id: string;
  type: 'exit' | 'entry';
  placeId: string;
  placeName: string;
  userId: string;
  userName: string;
  distanceMeters: number;
  formattedDistance: string;
  timestamp: string;
  latitude: number;
  longitude: number;
}

// 1. Haversine Formula for exact geodesic distance in meters
export function getHaversineDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
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

// 2. Midpoint calculation for route-based geofences (start & end points)
export function getRouteMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { latitude: number; longitude: number } {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;

  const Bx = Math.cos(rLat2) * Math.cos(dLon);
  const By = Math.cos(rLat2) * Math.sin(dLon);

  const midLat = Math.atan2(
    Math.sin(rLat1) + Math.sin(rLat2),
    Math.sqrt((Math.cos(rLat1) + Bx) * (Math.cos(rLat1) + Bx) + By * By)
  );
  const midLon = rLon1 + Math.atan2(By, Math.cos(rLat1) + Bx);

  return {
    latitude: (midLat * 180) / Math.PI,
    longitude: (midLon * 180) / Math.PI,
  };
}

// 3. GPS Signal Quality Filter (Threshold <= 50 meters accuracy)
export function isValidGpsFix(accuracyMeters?: number): boolean {
  if (accuracyMeters === undefined || accuracyMeters === null) return true;
  return accuracyMeters <= 50;
}

// Memory tracking for boundary states and alert cooldowns
// Key: `${user_id}_${place_id}`
const previousInsideStates = new Map<string, boolean>();
const lastAlertTimestamps = new Map<string, number>();

// 4. Core Geofence Breach Evaluator with Hysteresis (15m buffer) & Cooldown (60s)
export async function evaluateGeofenceBreaches(
  userLoc: UserLocation,
  userName: string,
  places: GeofencePlace[]
): Promise<GeofenceBreachEvent[]> {
  // Reject noisy GPS positions
  if (!isValidGpsFix(userLoc.accuracy_m)) {
    return [];
  }

  const breaches: GeofenceBreachEvent[] = [];
  const now = Date.now();
  const COOLDOWN_MS = 60000; // 60-second alert cooldown to eliminate boundary hovering spam
  const HYSTERESIS_BUFFER_M = 15; // 15-meter hysteresis buffer

  for (const place of places) {
    // Target user filter check: if target_user_id is set, only track that user
    if (place.target_user_id && place.target_user_id !== userLoc.user_id) {
      continue;
    }

    // Determine center coords (Route midpoint if start/end exist, else place coords)
    let centerLat = place.latitude;
    let centerLng = place.longitude;

    if (
      place.start_lat !== null &&
      place.start_lat !== undefined &&
      place.end_lat !== null &&
      place.end_lat !== undefined &&
      place.start_lng !== null &&
      place.start_lng !== undefined &&
      place.end_lng !== null &&
      place.end_lng !== undefined
    ) {
      const mid = getRouteMidpoint(
        place.start_lat,
        place.start_lng,
        place.end_lat,
        place.end_lng
      );
      centerLat = mid.latitude;
      centerLng = mid.longitude;
    }

    const distMeters = getHaversineDistanceInMeters(
      userLoc.latitude,
      userLoc.longitude,
      centerLat,
      centerLng
    );

    const radius = place.radius_m || 150;
    const trackingKey = `${userLoc.user_id}_${place.id}`;
    const wasInside = previousInsideStates.get(trackingKey);

    // Initial state registration
    if (wasInside === undefined) {
      previousInsideStates.set(trackingKey, distMeters <= radius);
      continue;
    }

    const lastAlertTime = lastAlertTimestamps.get(trackingKey) || 0;
    const inCooldown = now - lastAlertTime < COOLDOWN_MS;

    // Exit Breach Condition (Distance > Radius + Hysteresis Buffer)
    if (wasInside && distMeters > radius + HYSTERESIS_BUFFER_M) {
      previousInsideStates.set(trackingKey, false);

      if (!inCooldown) {
        lastAlertTimestamps.set(trackingKey, now);
        const formattedDist =
          distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(1)} km`
            : `${Math.round(distMeters)} m`;

        const breachEvent: GeofenceBreachEvent = {
          id: `${place.id}_exit_${now}`,
          type: 'exit',
          placeId: place.id,
          placeName: place.name,
          userId: userLoc.user_id,
          userName: userName,
          distanceMeters: distMeters,
          formattedDistance: formattedDist,
          timestamp: new Date().toISOString(),
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
        };

        breaches.push(breachEvent);

        // Async log breach to place_events table & dispatch Push Notification
        try {
          await supabase.from('place_events').insert({
            place_id: place.id,
            user_id: userLoc.user_id,
            event_type: 'departure',
            occurred_at: new Date().toISOString(),
          });
          dispatchGeofencePushAlert(breachEvent, place);
        } catch (e) {
          console.warn('Error logging departure place_event:', e);
        }
      }
    }
    // Re-entry Breach Condition (Distance < Radius - Hysteresis Buffer)
    else if (!wasInside && distMeters < radius - HYSTERESIS_BUFFER_M) {
      previousInsideStates.set(trackingKey, true);

      if (!inCooldown) {
        lastAlertTimestamps.set(trackingKey, now);
        const formattedDist =
          distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(1)} km`
            : `${Math.round(distMeters)} m`;

        const breachEvent: GeofenceBreachEvent = {
          id: `${place.id}_entry_${now}`,
          type: 'entry',
          placeId: place.id,
          placeName: place.name,
          userId: userLoc.user_id,
          userName: userName,
          distanceMeters: distMeters,
          formattedDistance: formattedDist,
          timestamp: new Date().toISOString(),
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
        };

        breaches.push(breachEvent);

        // Async log breach to place_events table & dispatch Push Notification to Bookmarker & Members
        try {
          await supabase.from('place_events').insert({
            place_id: place.id,
            user_id: userLoc.user_id,
            event_type: 'arrival',
            occurred_at: new Date().toISOString(),
          });
          dispatchGeofencePushAlert(breachEvent, place);
        } catch (e) {
          console.warn('Error logging arrival place_event:', e);
        }
      }
    }
  }

  return breaches;
}

/**
 * Dispatch Mobile System Push Notifications to Place Bookmarker & Circle Members
 */
export async function dispatchGeofencePushAlert(breach: GeofenceBreachEvent, place: GeofencePlace) {
  try {
    const { sendExpoPushNotification } = require('./PushNotificationService');

    const tokenSet = new Set<string>();

    // 1. Fetch push token for the user who created/bookmarked this geofence place
    if (place.created_by && place.created_by !== breach.userId) {
      const { data: creatorProf } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', place.created_by)
        .single();

      if (creatorProf?.push_token) {
        tokenSet.add(creatorProf.push_token);
      }
    }

    // 2. Fetch push tokens for all other circle members
    if (place.circle_id) {
      const { data: membersData } = await supabase
        .from('circle_members')
        .select('user_id, profiles(push_token)')
        .eq('circle_id', place.circle_id);

      if (membersData && membersData.length > 0) {
        membersData.forEach(m => {
          let prof = m.profiles as any;
          if (Array.isArray(prof)) prof = prof[0];

          if (prof?.push_token && m.user_id !== breach.userId) {
            tokenSet.add(prof.push_token);
          }
        });
      }
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) return;

    const isExit = breach.type === 'exit';
    const title = isExit ? `🚨 Geofence Breach Alert` : `✅ Geofence Re-Entry`;
    const body = isExit
      ? `${breach.userName} has exited ${breach.placeName} (${breach.formattedDistance} outside boundary)`
      : `${breach.userName} has returned to ${breach.placeName}`;

    // Send System Notification to target mobile devices
    await sendExpoPushNotification(tokens, title, body, {
      screen: 'Map',
      userId: breach.userId,
      placeId: breach.placeId,
      latitude: breach.latitude,
      longitude: breach.longitude,
    });
  } catch (err) {
    console.error('Error dispatching geofence push notification:', err);
  }
}
