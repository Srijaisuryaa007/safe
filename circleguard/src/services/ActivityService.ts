import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sendInstantLocationPing } from './LocationBackgroundService';
import { sendExpoPushNotification } from './PushNotificationService';
import { CircleMember } from '../store/useCircleStore';

export interface ActivityEvent {
  id: string;
  type: 'GEOFENCE' | 'SOS' | 'MESSAGE' | 'CHECKIN';
  title: string;
  message: string;
  time: string;
  icon: string;
  color: string;
  memberName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  userId?: string;
  timestamp: number;
  eventType?: 'arrival' | 'departure';
  placeName?: string;
  placeId?: string;
  placeCategory?: string;
  radiusMeters?: number;
  dwellDurationText?: string;
  occurredAtIso?: string;
  latitude?: number;
  longitude?: number;
  batteryPct?: number;
}

const getActivityStorageKey = (circleId: string) => `@circleguard_local_activity_events_${circleId}`;

// Standard 7-day retention period (silent automatic background purge without mentioning in UI)
export const ACTIVITY_RETENTION_DAYS = 7;
export const ACTIVITY_RETENTION_MS = ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Formats a clean date/time label for chronological activity items
 */
export const formatEventDisplayTime = (timestamp: number, rawIso?: string): string => {
  const date = timestamp ? new Date(timestamp) : (rawIso ? new Date(rawIso) : new Date());
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (now.toDateString() === date.toDateString()) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }

  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}, ${timeStr}`;
};

/**
 * Silently deletes/purges expired events older than the retention period
 * (Executed in the background; does not show any deletion alerts or UI mentions)
 */
export const purgeExpiredActivities = async (circleId: string): Promise<void> => {
  if (!circleId) return;
  try {
    const cutoffIso = new Date(Date.now() - ACTIVITY_RETENTION_MS).toISOString();

    // 1. Silently prune expired local AsyncStorage events
    const key = getActivityStorageKey(circleId);
    const localStr = await AsyncStorage.getItem(key);
    if (localStr) {
      const localList: ActivityEvent[] = JSON.parse(localStr);
      const unexpiredList = localList.filter((e) => (Date.now() - e.timestamp) <= ACTIVITY_RETENTION_MS);
      if (unexpiredList.length !== localList.length) {
        await AsyncStorage.setItem(key, JSON.stringify(unexpiredList));
      }
    }

    // 2. Silently delete expired place_events from Supabase
    await supabase
      .from('place_events')
      .delete()
      .lt('occurred_at', cutoffIso);

    // 3. Silently delete expired resolved SOS alerts from Supabase
    await supabase
      .from('sos_alerts')
      .delete()
      .eq('circle_id', circleId)
      .eq('status', 'RESOLVED')
      .lt('created_at', cutoffIso);
  } catch (e) {
    // Silent background execution
  }
};

/**
 * Persists an activity event locally in AsyncStorage for instant retrieval
 */
export const saveLocalActivityEvent = async (circleId: string, event: ActivityEvent): Promise<void> => {
  try {
    const key = getActivityStorageKey(circleId);
    const existingStr = await AsyncStorage.getItem(key);
    let list: ActivityEvent[] = existingStr ? JSON.parse(existingStr) : [];
    const now = Date.now();
    // Prepend, prune expired items older than retention period, and cap at 100 events
    list = [event, ...list.filter((e) => e.id !== event.id && (now - e.timestamp) <= ACTIVITY_RETENTION_MS)].slice(0, 100);
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving local activity event:', e);
  }
};

/**
 * Loads cached activity events for the circle, filtering out expired ones
 */
export const getLocalActivityEvents = async (circleId: string): Promise<ActivityEvent[]> => {
  try {
    const key = getActivityStorageKey(circleId);
    const existingStr = await AsyncStorage.getItem(key);
    if (!existingStr) return [];
    const list: ActivityEvent[] = JSON.parse(existingStr);
    const now = Date.now();
    return list.filter((e) => (now - e.timestamp) <= ACTIVITY_RETENTION_MS);
  } catch (e) {
    return [];
  }
};

/**
 * Performs a comprehensive broadcast check-in:
 * 1. Pings GPS location
 * 2. Inserts message into circle_messages
 * 3. Sends push notifications to other members
 * 4. Caches activity event for the Timeline
 */
export const broadcastCheckIn = async ({
  circleId,
  circleName,
  userId,
  userName,
  userAvatar,
  otherMemberIds = [],
  customMessage,
}: {
  circleId: string;
  circleName?: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  otherMemberIds?: string[];
  customMessage?: string;
}): Promise<{ success: boolean; event: ActivityEvent }> => {
  // 1. Send GPS ping
  try {
    await sendInstantLocationPing();
  } catch (e) {}

  const content = customMessage || `${userName} checked in safely.`;

  // 2. Insert into circle_messages
  let messageId = `checkin_${Date.now()}`;
  try {
    const { data } = await supabase
      .from('circle_messages')
      .insert({
        circle_id: circleId,
        sender_id: userId,
        content,
        message_type: 'CHECKIN',
      })
      .select('id')
      .single();

    if (data?.id) messageId = data.id;
  } catch (e) {
    console.warn('Supabase circle_messages insert check-in fallback:', e);
  }

  // 3. Dispatch push notifications
  if (otherMemberIds.length > 0) {
    sendExpoPushNotification(
      otherMemberIds,
      'Safety Check-In',
      `${userName} checked in: Safe & Sound!`,
      { type: 'CHECKIN' }
    ).catch(() => {});
  }

  // 4. Create and cache activity event
  const event: ActivityEvent = {
    id: messageId,
    type: 'CHECKIN',
    title: `${userName} checked in safely`,
    message: content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    icon: 'checkmark-circle',
    color: '#2E7D5B',
    memberName: userName,
    avatarUrl: userAvatar,
    userId,
    timestamp: Date.now(),
  };

  await saveLocalActivityEvent(circleId, event);

  return { success: true, event };
};

/**
 * Requests an instant safety check-in from all circle members:
 * 1. Inserts CHECKIN_REQUEST message
 * 2. Sends priority push notifications
 * 3. Caches event
 */
export const broadcastCheckInRequest = async ({
  circleId,
  circleName,
  userId,
  userName,
  userAvatar,
  otherMemberIds = [],
}: {
  circleId: string;
  circleName?: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  otherMemberIds?: string[];
}): Promise<{ success: boolean; event: ActivityEvent }> => {
  const content = `${userName} requested an instant safety check-in from everyone.`;
  let messageId = `req_${Date.now()}`;

  try {
    const { data } = await supabase
      .from('circle_messages')
      .insert({
        circle_id: circleId,
        sender_id: userId,
        content,
        message_type: 'CHECKIN_REQUEST',
      })
      .select('id')
      .single();

    if (data?.id) messageId = data.id;
  } catch (e) {
    console.warn('Supabase circle_messages insert check-in request fallback:', e);
  }

  if (otherMemberIds.length > 0) {
    sendExpoPushNotification(
      otherMemberIds,
      'Check-In Requested',
      `${userName} is requesting everyone in "${circleName || 'the circle'}" to check in!`,
      { type: 'CHECKIN_REQUEST' }
    ).catch(() => {});
  }

  const event: ActivityEvent = {
    id: messageId,
    type: 'CHECKIN',
    title: `${userName} requested a check-in`,
    message: content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    icon: 'notifications',
    color: '#0284C7',
    memberName: userName,
    avatarUrl: userAvatar,
    userId,
    timestamp: Date.now(),
  };

  await saveLocalActivityEvent(circleId, event);

  return { success: true, event };
};

/**
 * Safely fetches and aggregates all circle activity events from Supabase
 * with resilient fallbacks and joins against local members and place caches
 */
export const fetchCircleActivities = async (
  circleId: string,
  members: CircleMember[] = [],
  places: any[] = []
): Promise<ActivityEvent[]> => {
  // Silently purge expired activities in the background (no UI notification or deletion notice)
  purgeExpiredActivities(circleId).catch(() => {});

  const cutoffTime = new Date(Date.now() - ACTIVITY_RETENTION_MS).toISOString();
  const memberMap = new Map<string, CircleMember>();
  members.forEach((m) => memberMap.set(m.user_id, m));

  const placeMap = new Map<string, any>();
  places.forEach((p) => placeMap.set(p.id, p));

  const memberUserIds = members.map((m) => m.user_id);

  // 1. Fetch circle messages (Check-ins & Chat broadcasts)
  let msgEvents: ActivityEvent[] = [];
  try {
    const { data, error } = await supabase
      .from('circle_messages')
      .select('id, created_at, content, sender_id, message_type')
      .eq('circle_id', circleId)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(60);

    if (!error && Array.isArray(data)) {
      msgEvents = data.map((item: any) => {
        const member = memberMap.get(item.sender_id);
        const name = member?.profile?.full_name || 'Circle Member';
        const isCheckIn = item.message_type === 'CHECKIN';
        const isRequest = item.message_type === 'CHECKIN_REQUEST';

        let title = `${name} checked in safely`;
        let icon = 'checkmark-circle';
        let color = '#2E7D5B';
        let type: ActivityEvent['type'] = 'CHECKIN';

        if (isRequest) {
          title = `${name} requested a check-in`;
          icon = 'notifications';
          color = '#0284C7';
        } else if (!isCheckIn) {
          title = `${name} sent a message`;
          icon = 'chatbubble-ellipses';
          color = '#183CE6';
          type = 'MESSAGE';
        }

        return {
          id: item.id,
          type,
          title,
          message: item.content || 'Safe check-in broadcasted to circle.',
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon,
          color,
          memberName: name,
          avatarUrl: member?.profile?.avatar_url,
          userId: item.sender_id,
          timestamp: new Date(item.created_at).getTime(),
          occurredAtIso: item.created_at,
        };
      });
    }
  } catch (e) {}

  // 2. Fetch SOS alerts
  let sosEvents: ActivityEvent[] = [];
  try {
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('id, created_at, status, user_id')
      .eq('circle_id', circleId)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && Array.isArray(data)) {
      sosEvents = data.map((item: any) => {
        const member = memberMap.get(item.user_id);
        const name = member?.profile?.full_name || 'A circle member';
        return {
          id: item.id,
          type: 'SOS',
          title: `${name} triggered Emergency SOS!`,
          message: `Priority emergency distress signal dispatched. Status: ${item.status}`,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'warning',
          color: '#DC2626',
          memberName: name,
          avatarUrl: member?.profile?.avatar_url,
          userId: item.user_id,
          timestamp: new Date(item.created_at).getTime(),
          occurredAtIso: item.created_at,
        };
      });
    }
  } catch (e) {}

  // 3. Fetch Place Events (Arrivals & Departures) with accurate telemetry
  let geofenceEvents: ActivityEvent[] = [];
  try {
    if (memberUserIds.length > 0) {
      // Query place_events with relational join for place details and user profiles
      let rawPlaceEvents: any[] = [];
      const resWithRel = await supabase
        .from('place_events')
        .select(`
          id,
          occurred_at,
          event_type,
          place_id,
          user_id,
          places:place_id (id, name, radius_m, category, latitude, longitude),
          profiles:user_id (id, full_name, avatar_url, phone)
        `)
        .in('user_id', memberUserIds)
        .gte('occurred_at', cutoffTime)
        .order('occurred_at', { ascending: false })
        .limit(100);

      if (!resWithRel.error && Array.isArray(resWithRel.data)) {
        rawPlaceEvents = resWithRel.data;
      } else {
        // Fallback without relational join if PostgREST schema syntax varies
        const { data: fallbackData } = await supabase
          .from('place_events')
          .select('id, occurred_at, event_type, place_id, user_id')
          .in('user_id', memberUserIds)
          .gte('occurred_at', cutoffTime)
          .order('occurred_at', { ascending: false })
          .limit(100);

        if (fallbackData) rawPlaceEvents = fallbackData;
      }

      if (rawPlaceEvents.length > 0) {
        geofenceEvents = rawPlaceEvents.map((item: any) => {
          const member = memberMap.get(item.user_id);
          let name = member?.profile?.full_name || 'Member';
          if (item.profiles) {
            const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
            if (p?.full_name) name = p.full_name;
          }

          let place = placeMap.get(item.place_id);
          if (item.places) {
            const pl = Array.isArray(item.places) ? item.places[0] : item.places;
            if (pl) place = { ...place, ...pl };
          }
          const placeName = place?.name || 'Safe Zone';
          const placeCategory = place?.category || 'home';
          const radiusM = place?.radius_m || 150;
          const isArrival = item.event_type === 'arrival';

          // Calculate precise dwell duration for departures
          let dwellDurationText = '';
          if (!isArrival) {
            const priorArrival = rawPlaceEvents.find((other: any) =>
              other.user_id === item.user_id &&
              other.place_id === item.place_id &&
              other.event_type === 'arrival' &&
              new Date(other.occurred_at).getTime() < new Date(item.occurred_at).getTime()
            );

            if (priorArrival) {
              const diffMs = new Date(item.occurred_at).getTime() - new Date(priorArrival.occurred_at).getTime();
              const diffMins = Math.round(diffMs / 60000);
              if (diffMins > 0) {
                dwellDurationText = diffMins >= 60
                  ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
                  : `${diffMins} mins`;
              }
            }
          } else {
            dwellDurationText = 'Just arrived';
          }

          const formattedTime = new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const subtitle = isArrival
            ? `Safely entered ${radiusM}m safe boundary at ${formattedTime}.`
            : dwellDurationText
            ? `Departed safe zone after staying ${dwellDurationText}.`
            : `Departed ${placeName} safe boundary.`;

          return {
            id: String(item.id),
            type: 'GEOFENCE' as const,
            eventType: item.event_type as 'arrival' | 'departure',
            title: isArrival ? `${name} arrived at ${placeName}` : `${name} departed ${placeName}`,
            message: subtitle,
            time: formattedTime,
            icon: isArrival ? 'location' : 'walk-outline',
            color: isArrival ? '#2E7D5B' : '#F59E0B',
            memberName: name,
            avatarUrl: member?.profile?.avatar_url || (Array.isArray(item.profiles) ? item.profiles[0]?.avatar_url : item.profiles?.avatar_url),
            phone: member?.profile?.phone || (Array.isArray(item.profiles) ? item.profiles[0]?.phone : item.profiles?.phone),
            userId: item.user_id,
            timestamp: new Date(item.occurred_at).getTime(),
            placeName,
            placeId: item.place_id,
            placeCategory,
            radiusMeters: radiusM,
            dwellDurationText,
            occurredAtIso: item.occurred_at,
            latitude: place?.latitude,
            longitude: place?.longitude,
            batteryPct: member?.batteryPct,
          };
        });
      }
    }
  } catch (e) {}

  // 4. Merge with local events
  const localEvents = await getLocalActivityEvents(circleId);

  // Combine and deduplicate by ID
  const map = new Map<string, ActivityEvent>();
  [...localEvents, ...sosEvents, ...msgEvents, ...geofenceEvents].forEach((ev) => {
    if (!map.has(ev.id)) {
      map.set(ev.id, ev);
    }
  });

  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
};
