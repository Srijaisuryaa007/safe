import { supabase } from '../lib/supabase';
import { isValidUuid } from '../lib/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  assigned_user_ids?: string[];
  category?: string;
  speed_adaptive?: boolean | null;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  active_days?: string[] | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  first_entry_only?: boolean | null;
  expected_arrival_time?: string | null;
  expected_arrival_user_id?: string | null;
}

export interface UserLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  speed_mps?: number;
  activity_state?: string;
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

export interface GeofenceHistoryLog {
  id: string;
  place_id: string;
  user_id: string;
  user_name?: string;
  event_type: 'arrival' | 'departure';
  occurred_at: string;
}

export function getHaversineDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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

export function getDistanceToRouteSegment(
  pLat: number,
  pLng: number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): number {
  const dx = endLng - startLng;
  const dy = endLat - startLat;

  if (dx === 0 && dy === 0) {
    return getHaversineDistanceInMeters(pLat, pLng, startLat, startLng);
  }

  const t = Math.max(0, Math.min(1, ((pLng - startLng) * dx + (pLat - startLat) * dy) / (dx * dx + dy * dy)));
  const projLat = startLat + t * dy;
  const projLng = startLng + t * dx;

  return getHaversineDistanceInMeters(pLat, pLng, projLat, projLng);
}

export function isValidGpsFix(accuracyMeters?: number): boolean {
  if (accuracyMeters === undefined || accuracyMeters === null) return true;
  return accuracyMeters <= 50;
}

interface CandidateTransition {
  targetState: 'inside' | 'outside';
  consecutiveCount: number;
  firstCandidateTime: number;
  lastCandidateTime: number;
  distances: number[];
}

const confirmedStates = new Map<string, 'inside' | 'outside'>();
const candidateTransitions = new Map<string, CandidateTransition>();
const lastAlertTimestamps = new Map<string, number>();

// Enterprise Geofence Constants
const GEOFENCE_TRANSITION_COOLDOWN_MS = 180000; // 3 minutes anti-flapping cooldown
const REQUIRED_EXIT_CONSECUTIVE_SAMPLES = 3;     // 3 consecutive fixes outside required
const REQUIRED_EXIT_DWELL_MS = 25000;            // 25s sustained outside dwell
const REQUIRED_ENTRY_CONSECUTIVE_SAMPLES = 2;    // 2 consecutive fixes inside required
const REQUIRED_ENTRY_DWELL_MS = 8000;            // 8s sustained inside dwell

export async function evaluateGeofenceBreaches(
  userLoc: UserLocation,
  userName: string,
  places: GeofencePlace[]
): Promise<GeofenceBreachEvent[]> {
  if (!isValidGpsFix(userLoc.accuracy_m)) {
    return [];
  }

  const breaches: GeofenceBreachEvent[] = [];
  const now = Date.now();

  for (const place of places) {
    if (place.assigned_user_ids && place.assigned_user_ids.length > 0) {
      if (!place.assigned_user_ids.includes(userLoc.user_id)) {
        continue;
      }
    } else if (place.target_user_id && place.target_user_id !== userLoc.user_id) {
      continue;
    }

    if (place.active_days && place.active_days.length > 0) {
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const currentDay = days[new Date().getDay()];
      if (!place.active_days.includes(currentDay)) {
        continue;
      }
    }

    if (place.active_hours_start && place.active_hours_end) {
      const nowDate = new Date();
      const currentMins = nowDate.getHours() * 60 + nowDate.getMinutes();
      const [startH, startM] = place.active_hours_start.split(':').map(Number);
      const [endH, endM] = place.active_hours_end.split(':').map(Number);
      const startMins = (startH || 0) * 60 + (startM || 0);
      const endMins = (endH || 0) * 60 + (endM || 0);

      if (startMins <= endMins) {
        if (currentMins < startMins || currentMins > endMins) continue;
      } else {
        if (currentMins < startMins && currentMins > endMins) continue;
      }
    }

    let distMeters = 0;

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
      distMeters = getDistanceToRouteSegment(
        userLoc.latitude,
        userLoc.longitude,
        place.start_lat,
        place.start_lng,
        place.end_lat,
        place.end_lng
      );
    } else {
      distMeters = getHaversineDistanceInMeters(
        userLoc.latitude,
        userLoc.longitude,
        place.latitude,
        place.longitude
      );
    }

    const radius = place.radius_m || 150;
    const trackingKey = `${userLoc.user_id}_${place.id}`;
    const accuracy = typeof userLoc.accuracy_m === 'number' ? userLoc.accuracy_m : 15;

    // Layer 1: GPS Accuracy & Confidence Filter
    // If accuracy is worse than 45m or exceeds 60% of the radius, suppress boundary transitions
    if (accuracy > 45 || accuracy > radius * 0.6) {
      continue;
    }

    // Layer 2: Durable State Resolution (Memory -> AsyncStorage -> DB -> Cold-boot default)
    let currentState = confirmedStates.get(trackingKey);
    if (currentState === undefined) {
      try {
        const cached = await AsyncStorage.getItem(`@circleguard_geofence_state_${trackingKey}`);
        if (cached === 'inside' || cached === 'outside') {
          currentState = cached;
        }
      } catch (e) {}

      if (currentState === undefined) {
        try {
          const { data: lastEventData } = await supabase
            .from('place_events')
            .select('event_type')
            .eq('place_id', place.id)
            .eq('user_id', userLoc.user_id)
            .order('occurred_at', { ascending: false })
            .limit(1);

          if (lastEventData && lastEventData.length > 0) {
            currentState = lastEventData[0].event_type === 'arrival' ? 'inside' : 'outside';
          }
        } catch (e) {}
      }

      // Initial bootstrap: If user is anywhere near the safe zone on cold start, initialize as inside
      // and do NOT trigger an immediate departure or arrival alert
      if (currentState === undefined) {
        currentState = distMeters <= radius + Math.max(35, accuracy * 1.5) ? 'inside' : 'outside';
        confirmedStates.set(trackingKey, currentState);
        try {
          await AsyncStorage.setItem(`@circleguard_geofence_state_${trackingKey}`, currentState);
        } catch (e) {}
        continue;
      }

      confirmedStates.set(trackingKey, currentState);
      try {
        await AsyncStorage.setItem(`@circleguard_geofence_state_${trackingKey}`, currentState);
      } catch (e) {}
    }

    // Layer 3: Asymmetric Dynamic Hysteresis Deadband
    // Exit requires distance beyond radius + dynamic accuracy buffer (min 40m)
    const hysteresisExitMargin = Math.max(40, accuracy * 1.5);
    const exitThreshold = radius + hysteresisExitMargin;
    const entryThreshold = radius;

    // Layer 4: Kinematic & Zero-Motion Gate (Speed / Stationary Inertia)
    const rawSpeed = typeof userLoc.speed_mps === 'number' ? userLoc.speed_mps : 0;
    const isStationary = (userLoc.speed_mps !== undefined && rawSpeed < 0.65) || userLoc.activity_state === 'Stationary';

    let candidateState: 'inside' | 'outside' | null = null;

    if (currentState === 'inside') {
      if (distMeters <= exitThreshold) {
        // Firmly within safe zone or hysteresis deadband
        candidateTransitions.delete(trackingKey);
        continue;
      }

      // Beyond outer threshold: evaluate whether this is physical travel or stationary jitter
      if (isStationary && distMeters < radius * 2.0 && distMeters < radius + 150) {
        // Device is stationary! Indoor GPS drift cannot cause exit
        candidateTransitions.delete(trackingKey);
        continue;
      }

      // Layer 5: Temporal Dwell & Multi-Sample Exit Verification
      let candidate = candidateTransitions.get(trackingKey);
      if (!candidate || candidate.targetState !== 'outside') {
        candidateTransitions.set(trackingKey, {
          targetState: 'outside',
          consecutiveCount: 1,
          firstCandidateTime: now,
          lastCandidateTime: now,
          distances: [distMeters],
        });
        continue; // Wait for consecutive confirmation
      }

      candidate.consecutiveCount += 1;
      candidate.lastCandidateTime = now;
      candidate.distances.push(distMeters);

      const dwellDurationMs = now - candidate.firstCandidateTime;
      const isFastVehicle = rawSpeed >= 4.0; // >= 14.4 km/h
      const requiredCount = isFastVehicle ? 2 : REQUIRED_EXIT_CONSECUTIVE_SAMPLES;
      const requiredDwell = isFastVehicle ? 10000 : REQUIRED_EXIT_DWELL_MS;

      if (candidate.consecutiveCount < requiredCount || dwellDurationMs < requiredDwell) {
        continue; // Still pending dwell confirmation
      }

      // Fully confirmed exit
      candidateState = 'outside';
      candidateTransitions.delete(trackingKey);

    } else if (currentState === 'outside') {
      if (distMeters > entryThreshold) {
        // Still outside safe zone
        if (distMeters > radius + 20) {
          candidateTransitions.delete(trackingKey);
        }
        continue;
      }

      // Within safe boundary: evaluate multi-sample entry confirmation
      let candidate = candidateTransitions.get(trackingKey);
      if (!candidate || candidate.targetState !== 'inside') {
        candidateTransitions.set(trackingKey, {
          targetState: 'inside',
          consecutiveCount: 1,
          firstCandidateTime: now,
          lastCandidateTime: now,
          distances: [distMeters],
        });
        continue; // Wait for consecutive confirmation
      }

      candidate.consecutiveCount += 1;
      candidate.lastCandidateTime = now;
      candidate.distances.push(distMeters);

      const dwellDurationMs = now - candidate.firstCandidateTime;
      if (candidate.consecutiveCount < REQUIRED_ENTRY_CONSECUTIVE_SAMPLES || dwellDurationMs < REQUIRED_ENTRY_DWELL_MS) {
        continue; // Still pending dwell confirmation
      }

      // Fully confirmed entry
      candidateState = 'inside';
      candidateTransitions.delete(trackingKey);
    }

    if (candidateState === null) {
      continue;
    }

    // Persist confirmed state immediately
    confirmedStates.set(trackingKey, candidateState);
    try {
      await AsyncStorage.setItem(`@circleguard_geofence_state_${trackingKey}`, candidateState);
    } catch (e) {}

    // Layer 6: Anti-Flapping Transition Cooldown (3 minutes)
    const lastAlertTime = lastAlertTimestamps.get(trackingKey) || 0;
    const inCooldown = now - lastAlertTime < GEOFENCE_TRANSITION_COOLDOWN_MS;

    if (inCooldown) {
      continue;
    }

    lastAlertTimestamps.set(trackingKey, now);
    const isExit = candidateState === 'outside';
    const formattedDist =
      distMeters >= 1000
        ? `${(distMeters / 1000).toFixed(1)} km`
        : `${Math.round(distMeters)} m`;

    const breachEvent: GeofenceBreachEvent = {
      id: `${place.id}_${candidateState}_${now}`,
      type: isExit ? 'exit' : 'entry',
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

    if (!isExit && place.first_entry_only) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingEvents } = await supabase
        .from('place_events')
        .select('id')
        .eq('place_id', place.id)
        .eq('user_id', userLoc.user_id)
        .eq('event_type', 'arrival')
        .gte('occurred_at', todayStart.toISOString())
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        continue;
      }
    }

    if (place.quiet_hours_start && place.quiet_hours_end) {
      const nowDate = new Date();
      const currentMins = nowDate.getHours() * 60 + nowDate.getMinutes();
      const [qStartH, qStartM] = place.quiet_hours_start.split(':').map(Number);
      const [qEndH, qEndM] = place.quiet_hours_end.split(':').map(Number);
      const qStartMins = (qStartH || 0) * 60 + (qStartM || 0);
      const endQuietMins = (qEndH || 0) * 60 + (qEndM || 0);

      let isQuietTime = false;
      if (qStartMins <= endQuietMins) {
        isQuietTime = currentMins >= qStartMins && currentMins <= endQuietMins;
      } else {
        isQuietTime = currentMins >= qStartMins || currentMins <= endQuietMins;
      }

      if (isQuietTime) {
        try {
          await supabase.from('place_events').insert({
            place_id: place.id,
            user_id: userLoc.user_id,
            event_type: isExit ? 'departure' : 'arrival',
            occurred_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Quiet hours event log fallback:', e);
        }
        continue;
      }
    }

    breaches.push(breachEvent);

    try {
      await supabase.from('place_events').insert({
        place_id: place.id,
        user_id: userLoc.user_id,
        event_type: isExit ? 'departure' : 'arrival',
        occurred_at: new Date().toISOString(),
      });
      await dispatchGeofencePushAlert(breachEvent, place);
    } catch (e) {
      console.warn('Error logging place_event:', e);
    }
  }

  return breaches;
}

export async function checkExpectedArrivals(places: GeofencePlace[]): Promise<void> {
  const nowDate = new Date();
  const currentMins = nowDate.getHours() * 60 + nowDate.getMinutes();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const place of places) {
    if (!place.expected_arrival_time || !place.expected_arrival_user_id) {
      continue;
    }

    const [expH, expM] = place.expected_arrival_time.split(':').map(Number);
    const expMins = (expH || 0) * 60 + (expM || 0);

    if (currentMins >= expMins) {
      const { data: arrivals } = await supabase
        .from('place_events')
        .select('id')
        .eq('place_id', place.id)
        .eq('user_id', place.expected_arrival_user_id)
        .eq('event_type', 'arrival')
        .gte('occurred_at', todayStart.toISOString())
        .limit(1);

      if (!arrivals || arrivals.length === 0) {
        const { data: userProf } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', place.expected_arrival_user_id)
          .single();

        const name = userProf?.full_name || 'Member';
        const title = 'Expected Arrival Alert';
        const body = `${name} has not arrived at ${place.name} by the expected time of ${place.expected_arrival_time}.`;

        const { scheduleLocalNotification } = require('./PushNotificationService');
        await scheduleLocalNotification(title, body, {
          screen: 'Map',
          placeId: place.id,
          userId: place.expected_arrival_user_id,
        });
      }
    }
  }
}

export async function dispatchGeofencePushAlert(breach: GeofenceBreachEvent, place: GeofencePlace) {
  try {
    const { CREATIVE_NOTIFICATION_TEMPLATES, scheduleLocalNotification, sendExpoPushNotification } = require('./PushNotificationService');
    const tokenSet = new Set<string>();

    if (place.created_by && isValidUuid(place.created_by) && place.created_by !== breach.userId) {
      const { data: creatorProf } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', place.created_by)
        .single();

      if (creatorProf?.push_token) {
        tokenSet.add(creatorProf.push_token);
      }
    }

    if (place.circle_id && isValidUuid(place.circle_id)) {
      try {
        const { data: membersData, error: relErr } = await supabase
          .from('circle_members')
          .select('user_id, profiles(push_token)')
          .eq('circle_id', place.circle_id);

        if (!relErr && membersData && membersData.length > 0) {
          membersData.forEach(m => {
            let prof = m.profiles as any;
            if (Array.isArray(prof)) prof = prof[0];

            if (prof?.push_token && m.user_id !== breach.userId) {
              tokenSet.add(prof.push_token);
            }
          });
        } else {
          // Tier 2 direct query fallback without relational join
          const { data: rawCmRows } = await supabase
            .from('circle_members')
            .select('user_id')
            .eq('circle_id', place.circle_id);

          if (rawCmRows && rawCmRows.length > 0) {
            const memberIds = rawCmRows.map(cm => cm.user_id).filter(id => id !== breach.userId && isValidUuid(id));
            if (memberIds.length > 0) {
              const { data: profRows } = await supabase
                .from('profiles')
                .select('push_token')
                .in('id', memberIds);

              (profRows || []).forEach(p => {
                if (p.push_token) tokenSet.add(p.push_token);
              });
            }
          }
        }
      } catch (e) {
        console.warn('Geofence member token lookup note:', e);
      }
    }

    const tokens = Array.from(tokenSet);
    const isExit = breach.type === 'exit';
    const placeName = place.name || 'Safe Zone';
    
    const template = isExit 
      ? CREATIVE_NOTIFICATION_TEMPLATES.departure(breach.userName, placeName)
      : CREATIVE_NOTIFICATION_TEMPLATES.arrival(breach.userName, placeName);

    const title = template.title;
    const body = template.body;

    await scheduleLocalNotification(title, body, {
      screen: 'Map',
      userId: breach.userId,
      placeId: breach.placeId,
    });

    if (tokens.length > 0) {
      await sendExpoPushNotification(tokens, title, body, {
        screen: 'Map',
        userId: breach.userId,
        placeId: breach.placeId,
        latitude: breach.latitude,
        longitude: breach.longitude,
      });
    }
  } catch (err) {
    console.error('Error dispatching geofence push notification:', err);
  }
}

export async function fetchPlaceHistoryLogs(placeId: string): Promise<GeofenceHistoryLog[]> {
  try {
    if (!placeId || !isValidUuid(placeId)) return [];

    const { data, error } = await supabase
      .from('place_events')
      .select('id, place_id, user_id, event_type, occurred_at, profiles(full_name)')
      .eq('place_id', placeId)
      .order('occurred_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    return (data || []).map((row: any) => {
      let prof = row.profiles;
      if (Array.isArray(prof)) prof = prof[0];
      return {
        id: row.id,
        place_id: row.place_id,
        user_id: row.user_id,
        user_name: prof?.full_name || 'Circle Member',
        event_type: row.event_type as 'arrival' | 'departure',
        occurred_at: row.occurred_at,
      };
    });
  } catch (e) {
    console.error('Error fetching place history logs:', e);
    return [];
  }
}

export async function fetchCirclePlacesWithMembers(circleId: string): Promise<GeofencePlace[]> {
  try {
    if (!circleId || !isValidUuid(circleId)) return [];

    const { data: placesData, error } = await supabase
      .from('places')
      .select('*')
      .eq('circle_id', circleId);

    if (error || !placesData) return [];

    const placeIds = placesData.map(p => p.id).filter(isValidUuid);
    let memberMap: Record<string, string[]> = {};

    if (placeIds.length > 0) {
      const { data: pmData } = await supabase
        .from('place_members')
        .select('place_id, user_id')
        .in('place_id', placeIds);

      if (pmData) {
        pmData.forEach(row => {
          if (!memberMap[row.place_id]) memberMap[row.place_id] = [];
          memberMap[row.place_id].push(row.user_id);
        });
      }
    }

    return placesData.map(p => {
      let lat = parseFloat(p.start_lat || p.latitude || 0);
      let lng = parseFloat(p.start_lng || p.longitude || 0);

      if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && p.geom) {
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
        latitude: lat,
        longitude: lng,
        assigned_user_ids: memberMap[p.id] || (p.target_user_id ? [p.target_user_id] : [])
      };
    });
  } catch (e) {
    console.error('Error fetching circle places with members:', e);
    return [];
  }
}
