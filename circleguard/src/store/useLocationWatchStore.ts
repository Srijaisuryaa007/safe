import { create } from 'zustand';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { useCircleStore } from './useCircleStore';
import { scheduleLocalNotification, sendExpoPushNotification } from '../services/PushNotificationService';

export interface LocationWatch {
  id: string;
  circle_id: string;
  creator_id: string;
  target_user_id: string;
  watch_type: 'leaves_current' | 'arrives_place' | 'leaves_place';
  place_id?: string | null;
  place_name?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  radius_meters: number;
  is_recurring?: boolean;
  status: 'active' | 'triggered' | 'cancelled';
  created_at: string;
  triggered_at?: string | null;
  target_name?: string;
}

export type LocationWatchTriggerListener = (event: {
  watch: LocationWatch;
  title: string;
  body: string;
  targetUserId: string;
  targetName: string;
}) => void;

const watchTriggerListeners = new Set<LocationWatchTriggerListener>();

export function addLocationWatchTriggerListener(listener: LocationWatchTriggerListener): () => void {
  watchTriggerListeners.add(listener);
  return () => {
    watchTriggerListeners.delete(listener);
  };
}

export function notifyLocationWatchTriggered(event: {
  watch: LocationWatch;
  title: string;
  body: string;
  targetUserId: string;
  targetName: string;
}) {
  watchTriggerListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.warn('[LocationWatch] In-app listener error:', e);
    }
  });
}

interface LocationWatchState {
  watches: LocationWatch[];
  isLoading: boolean;

  fetchWatches: (circleId: string) => Promise<void>;
  createWatch: (params: {
    targetUserId: string;
    targetName: string;
    watchType: 'leaves_current' | 'arrives_place' | 'leaves_place';
    placeId?: string | null;
    placeName?: string | null;
    currentLat?: number | null;
    currentLng?: number | null;
    radiusMeters?: number;
    isRecurring?: boolean;
  }) => Promise<{ success: boolean; watch?: LocationWatch; error?: string }>;

  cancelWatch: (watchId: string) => Promise<void>;
  evaluateLocationChange: (targetUserId: string, newLat: number, newLng: number) => Promise<void>;
  subscribeToWatches: (circleId: string) => () => void;
}

// Distance helper
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

const LOCAL_WATCHES_STORAGE_KEY = '@circleguard_local_location_watches';

export const useLocationWatchStore = create<LocationWatchState>((set, get) => ({
  watches: [],
  isLoading: false,

  fetchWatches: async (circleId: string) => {
    if (!circleId) return;

    try {
      const { data, error } = await supabase
        .from('location_watches')
        .select('*')
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        set({ watches: data });
        await AsyncStorage.setItem(LOCAL_WATCHES_STORAGE_KEY, JSON.stringify(data));
      } else {
        // Fallback to local storage if offline
        const localRaw = await AsyncStorage.getItem(LOCAL_WATCHES_STORAGE_KEY);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          set({ watches: parsed });
        }
      }
    } catch (_) {
      const localRaw = await AsyncStorage.getItem(LOCAL_WATCHES_STORAGE_KEY);
      if (localRaw) {
        try {
          set({ watches: JSON.parse(localRaw) });
        } catch (_) {}
      }
    }
  },

  createWatch: async ({
    targetUserId,
    targetName,
    watchType,
    placeId,
    placeName,
    currentLat,
    currentLng,
    radiusMeters = 150,
    isRecurring = false,
  }) => {
    const auth = useAuthStore.getState();
    const circle = useCircleStore.getState();

    const creatorId = auth.profile?.id || auth.user?.id || auth.session?.user?.id || 'local_user';
    const circleId = circle.activeCircle?.id || circle.circles?.[0]?.id || 'local_circle';

    // Reliable fallback for initial member coordinates
    let resolvedLat = currentLat;
    let resolvedLng = currentLng;
    if (!resolvedLat || !resolvedLng) {
      const mem = (circle.members || []).find(m => m.user_id === targetUserId);
      if (mem?.latitude && mem?.longitude) {
        resolvedLat = mem.latitude;
        resolvedLng = mem.longitude;
      }
    }

    const newWatch: LocationWatch = {
      id: `watch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      circle_id: circleId,
      creator_id: creatorId,
      target_user_id: targetUserId,
      target_name: targetName,
      watch_type: watchType,
      place_id: placeId || null,
      place_name: placeName || null,
      current_lat: resolvedLat || null,
      current_lng: resolvedLng || null,
      radius_meters: radiusMeters,
      is_recurring: isRecurring,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    const currentList = get().watches;
    const updatedList = [newWatch, ...currentList];
    set({ watches: updatedList });
    await AsyncStorage.setItem(LOCAL_WATCHES_STORAGE_KEY, JSON.stringify(updatedList));

    Vibration.vibrate(50);

    try {
      if (creatorId !== 'local_user' && circleId !== 'local_circle') {
        const { data, error } = await supabase
          .from('location_watches')
          .insert([{
            circle_id: circleId,
            creator_id: creatorId,
            target_user_id: targetUserId,
            watch_type: watchType,
            place_id: placeId || null,
            place_name: placeName || null,
            current_lat: resolvedLat || null,
            current_lng: resolvedLng || null,
            radius_meters: radiusMeters,
            is_recurring: isRecurring,
            status: 'active',
          }])
          .select()
          .single();

        if (!error && data) {
          const reconciled = updatedList.map(w => (w.id === newWatch.id ? { ...data, target_name: targetName } : w));
          set({ watches: reconciled });
          await AsyncStorage.setItem(LOCAL_WATCHES_STORAGE_KEY, JSON.stringify(reconciled));
          return { success: true, watch: { ...data, target_name: targetName } };
        }
      }
    } catch (e) {
      // Local fallback succeeds
    }

    return { success: true, watch: newWatch };
  },

  cancelWatch: async (watchId: string) => {
    const filtered = get().watches.filter(w => w.id !== watchId);
    set({ watches: filtered });
    await AsyncStorage.setItem(LOCAL_WATCHES_STORAGE_KEY, JSON.stringify(filtered));

    Vibration.vibrate(40);

    try {
      if (!watchId.startsWith('watch_')) {
        await supabase
          .from('location_watches')
          .update({ status: 'cancelled' })
          .eq('id', watchId);
      }
    } catch (_) {}
  },

  evaluateLocationChange: async (targetUserId: string, newLat: number, newLng: number) => {
    if (!newLat || !newLng || isNaN(newLat) || isNaN(newLng)) return;

    const { watches } = get();
    const activeWatches = watches.filter(
      w => w.target_user_id === targetUserId && w.status === 'active'
    );

    if (activeWatches.length === 0) return;

    const auth = useAuthStore.getState();
    const circle = useCircleStore.getState();
    const places = circle.places || [];
    const members = circle.members || [];
    const targetMember = members.find(m => m.user_id === targetUserId);
    const memberName = targetMember?.profile?.full_name || 'Circle Member';
    const currentUserId = auth.profile?.id || auth.user?.id;

    for (const watch of activeWatches) {
      let isTriggered = false;
      let alertTitle = '';
      let alertBody = '';

      if (watch.watch_type === 'leaves_current') {
        if (watch.current_lat && watch.current_lng) {
          const dMeters = calculateDistanceMeters(watch.current_lat, watch.current_lng, newLat, newLng);
          if (dMeters >= (watch.radius_meters || 150)) {
            isTriggered = true;
            alertTitle = `📍 Departure: ${memberName} left location`;
            alertBody = `${memberName} has started moving and left their previous spot.`;
          }
        }
      } else if (watch.watch_type === 'arrives_place' && watch.place_id) {
        const place = places.find(p => p.id === watch.place_id);
        const pLat = place?.latitude ?? (place as any)?.lat;
        const pLng = place?.longitude ?? (place as any)?.lng;
        const pRad = place?.radius_m ?? (place as any)?.radius ?? 150;

        if (pLat && pLng) {
          const dMeters = calculateDistanceMeters(pLat, pLng, newLat, newLng);
          if (dMeters <= pRad) {
            isTriggered = true;
            alertTitle = `🏠 Arrival: ${memberName} at ${watch.place_name || place?.name || 'Safe Place'}`;
            alertBody = `${memberName} has arrived at ${watch.place_name || place?.name || 'Safe Place'}.`;
          }
        }
      } else if (watch.watch_type === 'leaves_place' && watch.place_id) {
        const place = places.find(p => p.id === watch.place_id);
        const pLat = place?.latitude ?? (place as any)?.lat;
        const pLng = place?.longitude ?? (place as any)?.lng;
        const pRad = place?.radius_m ?? (place as any)?.radius ?? 150;

        if (pLat && pLng) {
          const dMeters = calculateDistanceMeters(pLat, pLng, newLat, newLng);
          if (dMeters > pRad) {
            isTriggered = true;
            alertTitle = `🚪 Departure: ${memberName} left ${watch.place_name || place?.name || 'Safe Place'}`;
            alertBody = `${memberName} has departed from ${watch.place_name || place?.name || 'Safe Place'}.`;
          }
        }
      }

      if (isTriggered) {
        const triggeredTime = new Date().toISOString();
        const triggeredWatch: LocationWatch = {
          ...watch,
          status: 'triggered' as const,
          triggered_at: triggeredTime,
        };

        // 1. Dispatch in-app trigger listener immediately (shows in-app pop-up / toast)
        notifyLocationWatchTriggered({
          watch: triggeredWatch,
          title: alertTitle,
          body: alertBody,
          targetUserId,
          targetName: memberName,
        });

        // 2. Schedule local notification on this device if creator
        if (!currentUserId || watch.creator_id === currentUserId) {
          Vibration.vibrate([0, 200, 100, 200]);
          scheduleLocalNotification(
            alertTitle,
            alertBody,
            { screen: 'Map', targetUserId, type: 'LOCATION_WATCH' }
          ).catch(() => {});
        }

        // 3. Dispatch remote push notification outside app to the creator's device!
        sendExpoPushNotification(
          watch.creator_id,
          alertTitle,
          alertBody,
          { screen: 'Map', targetUserId, watchId: watch.id, type: 'LOCATION_WATCH' }
        ).catch(() => {});

        // 4. Update watch status in store and local storage
        const updatedList = get().watches.map(w =>
          w.id === watch.id ? triggeredWatch : w
        );
        set({ watches: updatedList.filter(w => w.status === 'active') });
        await AsyncStorage.setItem(LOCAL_WATCHES_STORAGE_KEY, JSON.stringify(updatedList));

        // 5. Update watch status in database
        try {
          if (!watch.id.startsWith('watch_')) {
            await supabase
              .from('location_watches')
              .update({ status: 'triggered', triggered_at: triggeredTime })
              .eq('id', watch.id);
          }
        } catch (_) {}
      }
    }
  },

  subscribeToWatches: (circleId: string) => {
    if (!circleId) return () => {};

    get().fetchWatches(circleId);

    const channel = supabase
      .channel(`location_watches_${circleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'location_watches', filter: `circle_id=eq.${circleId}` },
        () => {
          get().fetchWatches(circleId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));

/**
 * Authoritative evaluation of location watches for a member who just reported a new GPS position.
 * Called directly by Background Location Task and foreground location pings so that
 * watchers receive push notifications outside the app immediately.
 */
export async function evaluateMemberLocationWatches(
  targetUserId: string,
  newLat: number,
  newLng: number,
  fallbackMemberName?: string
): Promise<void> {
  if (!targetUserId || !newLat || !newLng || isNaN(newLat) || isNaN(newLng)) return;

  try {
    // 1. Fetch active watches targeting this user from database
    const { data: dbWatches, error } = await supabase
      .from('location_watches')
      .select('*')
      .eq('target_user_id', targetUserId)
      .eq('status', 'active');

    if (error || !dbWatches || dbWatches.length === 0) return;

    // Resolve target member's name
    let memberName = fallbackMemberName;
    if (!memberName) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', targetUserId)
          .single();
        memberName = prof?.full_name || 'Circle Member';
      } catch (_) {
        memberName = 'Circle Member';
      }
    }

    // Fetch places for circle if needed
    const circleId = dbWatches[0]?.circle_id;
    let placesData: any[] = [];
    if (circleId) {
      try {
        const { data: pData } = await supabase
          .from('places')
          .select('*')
          .eq('circle_id', circleId);
        if (pData) placesData = pData;
      } catch (_) {}
    }

    const currentUserId = useAuthStore.getState().profile?.id;

    for (const watch of dbWatches) {
      let isTriggered = false;
      let alertTitle = '';
      let alertBody = '';

      if (watch.watch_type === 'leaves_current') {
        if (watch.current_lat && watch.current_lng) {
          const dMeters = calculateDistanceMeters(watch.current_lat, watch.current_lng, newLat, newLng);
          if (dMeters >= (watch.radius_meters || 150)) {
            isTriggered = true;
            alertTitle = `📍 Departure: ${memberName} left location`;
            alertBody = `${memberName} has started moving and left their previous spot.`;
          }
        }
      } else if (watch.watch_type === 'arrives_place' && watch.place_id) {
        const place = placesData.find(p => p.id === watch.place_id);
        const pLat = parseFloat(place?.latitude ?? place?.start_lat ?? place?.lat);
        const pLng = parseFloat(place?.longitude ?? place?.start_lng ?? place?.lng);
        const pRad = parseFloat(place?.radius_m ?? place?.radius ?? 150);

        if (!isNaN(pLat) && !isNaN(pLng)) {
          const dMeters = calculateDistanceMeters(pLat, pLng, newLat, newLng);
          if (dMeters <= pRad) {
            isTriggered = true;
            alertTitle = `🏠 Arrival: ${memberName} at ${watch.place_name || place?.name || 'Safe Place'}`;
            alertBody = `${memberName} has arrived at ${watch.place_name || place?.name || 'Safe Place'}.`;
          }
        }
      } else if (watch.watch_type === 'leaves_place' && watch.place_id) {
        const place = placesData.find(p => p.id === watch.place_id);
        const pLat = parseFloat(place?.latitude ?? place?.start_lat ?? place?.lat);
        const pLng = parseFloat(place?.longitude ?? place?.start_lng ?? place?.lng);
        const pRad = parseFloat(place?.radius_m ?? place?.radius ?? 150);

        if (!isNaN(pLat) && !isNaN(pLng)) {
          const dMeters = calculateDistanceMeters(pLat, pLng, newLat, newLng);
          if (dMeters > pRad) {
            isTriggered = true;
            alertTitle = `🚪 Departure: ${memberName} left ${watch.place_name || place?.name || 'Safe Place'}`;
            alertBody = `${memberName} has departed from ${watch.place_name || place?.name || 'Safe Place'}.`;
          }
        }
      }

      if (isTriggered) {
        const triggeredTime = new Date().toISOString();
        const triggeredWatch: LocationWatch = {
          ...watch,
          status: 'triggered' as const,
          triggered_at: triggeredTime,
        };

        // 1. Mark watch as triggered in database
        try {
          await supabase
            .from('location_watches')
            .update({ status: 'triggered', triggered_at: triggeredTime })
            .eq('id', watch.id);
        } catch (_) {}

        // 2. Dispatch in-app trigger listener immediately (shows in-app popup/toast)
        notifyLocationWatchTriggered({
          watch: triggeredWatch,
          title: alertTitle,
          body: alertBody,
          targetUserId,
          targetName: memberName || 'Member',
        });

        // 3. Schedule local notification on this device if creator
        if (!currentUserId || watch.creator_id === currentUserId) {
          Vibration.vibrate([0, 200, 100, 200]);
          scheduleLocalNotification(
            alertTitle,
            alertBody,
            { screen: 'Map', targetUserId, watchId: watch.id, type: 'LOCATION_WATCH' }
          ).catch(() => {});
        }

        // 4. Send Remote Push Notification to the creator's phone (OUTSIDE APP)
        sendExpoPushNotification(
          watch.creator_id,
          alertTitle,
          alertBody,
          { screen: 'Map', targetUserId, watchId: watch.id, type: 'LOCATION_WATCH' }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[LocationWatch] Error in evaluateMemberLocationWatches:', err);
  }
}

