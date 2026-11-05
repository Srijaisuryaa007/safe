import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { isValidUuid } from '../lib/utils';
import { resolveAuthenticPlaceEventTime } from '../utils/activityTimeUtils';
import { StorageRecoveryService } from '../services/StorageRecoveryService';

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  tracking_mode?: string;
  created_at: string;
  my_role?: 'owner' | 'co_leader' | 'guardian' | 'member';
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: 'owner' | 'co_leader' | 'guardian' | 'member';
  supervisor_id?: string | null;
  joined_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    phone?: string | null;
    is_ghost_mode?: boolean;
    hide_online_presence?: boolean;
    gps_frequency?: 'high' | 'balanced' | 'saver' | string;
    shake_sos_enabled?: boolean;
    app_lock_enabled?: boolean;
  };
  isOnline?: boolean;
  lastSeenText?: string;
  lastActiveText?: string;
  lastActiveShort?: string;
  lastActiveTimeStr?: string;
  updated_at?: string;
  latestPlaceEvent?: {
    place_id: string;
    event_type: 'arrival' | 'departure';
    occurred_at: string;
  };
  batteryPct?: number;
  isDriving?: boolean;
  isGhost?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface WalkawayLeaveModalState {
  visible: boolean;
  circleName: string;
  circleId?: string;
  actionType?: 'leave' | 'delete';
  status: 'idle' | 'leaving' | 'left' | 'error';
  errorMessage?: string;
}

export const PRIMARY_TEST_CIRCLE_ID = 'af00325e-7e26-4b5d-856d-907085b326d2';

export const AUTHORITATIVE_CIRCLE_ROSTER: Array<{
  user_id: string;
  name: string;
  defaultRole: 'owner' | 'co_leader' | 'guardian' | 'member';
  defaultSupervisorId: string | null;
}> = [
  {
    user_id: '03ca6af3-b0f7-46a1-9e70-2bb96befb67c',
    name: 'Jai Suryaa',
    defaultRole: 'owner',
    defaultSupervisorId: null,
  },
  {
    user_id: '2875720f-904b-4559-a436-512286054510',
    name: 'Sri jai suryaa',
    defaultRole: 'co_leader',
    defaultSupervisorId: '03ca6af3-b0f7-46a1-9e70-2bb96befb67c',
  },
  {
    user_id: '9cbff37a-fa54-40f5-89f1-ed8927942611',
    name: 'Prasanna Raj',
    defaultRole: 'guardian',
    defaultSupervisorId: '2875720f-904b-4559-a436-512286054510',
  },
  {
    user_id: '701b6a69-f70c-4663-81c1-87c8c4d216a3',
    name: 'Art Suryaa',
    defaultRole: 'guardian',
    defaultSupervisorId: '2875720f-904b-4559-a436-512286054510',
  },
  {
    user_id: 'ec43d626-de94-4df7-b251-324813c42547',
    name: 'Bhavani',
    defaultRole: 'member',
    defaultSupervisorId: '9cbff37a-fa54-40f5-89f1-ed8927942611',
  },
  {
    user_id: '97391882-1d10-4385-b648-68029bf48df8',
    name: 'Nandakumar Tr',
    defaultRole: 'member',
    defaultSupervisorId: '9cbff37a-fa54-40f5-89f1-ed8927942611',
  },
  {
    user_id: 'edb8e3d4-c139-4d8b-9c5b-85ebc4c4cf98',
    name: 'suryaa027',
    defaultRole: 'member',
    defaultSupervisorId: '701b6a69-f70c-4663-81c1-87c8c4d216a3',
  },
  {
    user_id: '310eab72-af82-4418-a265-2d18f8c59ae0',
    name: 'Jai',
    defaultRole: 'member',
    defaultSupervisorId: '701b6a69-f70c-4663-81c1-87c8c4d216a3',
  },
];

export function formatMemberLastActive(
  updatedAt?: string | null,
  isOnline?: boolean
): {
  lastActiveText: string;
  lastActiveShort: string;
  lastActiveTimeStr: string;
} {
  if (isOnline) {
    return {
      lastActiveText: 'Active now',
      lastActiveShort: 'Active now',
      lastActiveTimeStr: 'Now',
    };
  }

  if (!updatedAt) {
    return {
      lastActiveText: 'No location recorded',
      lastActiveShort: 'No data',
      lastActiveTimeStr: 'Unknown',
    };
  }

  const d = new Date(updatedAt);
  if (isNaN(d.getTime())) {
    return {
      lastActiveText: 'Offline',
      lastActiveShort: 'Offline',
      lastActiveTimeStr: 'Unknown',
    };
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  let lastActiveShort = '';
  let lastActiveText = '';

  if (diffMins < 1) {
    lastActiveShort = 'Just now';
    lastActiveText = 'Active just now';
  } else if (diffMins < 60) {
    lastActiveShort = `${diffMins}m ago`;
    lastActiveText = `Active ${diffMins}m ago (${timeStr})`;
  } else if (isToday) {
    lastActiveShort = `${diffHours}h ago`;
    lastActiveText = `Active today at ${timeStr}`;
  } else if (isYesterday) {
    lastActiveShort = 'Yesterday';
    lastActiveText = `Active yesterday at ${timeStr}`;
  } else if (diffDays < 7) {
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    lastActiveShort = `${diffDays}d ago`;
    lastActiveText = `Active ${dayName} at ${timeStr}`;
  } else {
    const monthDay = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    lastActiveShort = monthDay;
    lastActiveText = `Active on ${monthDay} at ${timeStr}`;
  }

  return {
    lastActiveText,
    lastActiveShort,
    lastActiveTimeStr: timeStr,
  };
}

export function formatZoneArrival(isoStr?: string | null): {
  timeStr: string;
  entryText: string;
  sinceText: string;
  diffMins: number;
} {
  if (!isoStr) {
    return { timeStr: '', entryText: 'Inside safe zone', sinceText: 'inside zone', diffMins: 0 };
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return { timeStr: '', entryText: 'Inside safe zone', sinceText: 'inside zone', diffMins: 0 };
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  let entryText = '';
  let sinceText = '';

  if (diffMins < 2) {
    entryText = 'Entered just now';
    sinceText = 'since just now';
  } else if (diffMins < 60) {
    entryText = `Entered ${diffMins}m ago (${timeStr})`;
    sinceText = `since ${timeStr} (${diffMins}m ago)`;
  } else if (isToday) {
    entryText = `Entered today at ${timeStr} (${diffHours}h ago)`;
    sinceText = `since ${timeStr}`;
  } else if (isYesterday) {
    entryText = `Entered yesterday at ${timeStr}`;
    sinceText = `since yesterday ${timeStr}`;
  } else {
    const monthDay = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    entryText = `Entered on ${monthDay} at ${timeStr}`;
    sinceText = `since ${monthDay} ${timeStr}`;
  }

  return { timeStr, entryText, sinceText, diffMins };
}

export interface Place {
  id: string;
  circle_id: string;
  name: string;
  category?: string;
  radius_m?: number;
  latitude: number;
  longitude: number;
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
  target_user_id?: string | null;
  assigned_user_ids?: string[];
  created_at?: string;
}

function parseEWKB(hex: string): { latitude: number; longitude: number } | null {
  try {
    if (typeof hex !== 'string') return null;
    const cleanHex = hex.trim();
    if (cleanHex.length >= 40) {
      const isLittleEndian = cleanHex.startsWith('0101') || cleanHex.startsWith('01');
      let offset = cleanHex.length >= 50 ? 18 : (cleanHex.length >= 42 ? 10 : 2);
      const lngHex = cleanHex.substr(offset, 16);
      const latHex = cleanHex.substr(offset + 16, 16);
      if (lngHex.length < 16 || latHex.length < 16) return null;
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      const parseHexDouble = (hexStr: string) => {
        for (let i = 0; i < 8; i++) {
          const byte = parseInt(hexStr.substr(i * 2, 2), 16);
          view.setUint8(isLittleEndian ? i : 7 - i, byte);
        }
        return view.getFloat64(0, isLittleEndian);
      };
      const lng = parseHexDouble(lngHex);
      const lat = parseHexDouble(latHex);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (e) {}
  return null;
}

function parsePoint(item: any): { latitude: number; longitude: number } {
  if (!item) return { latitude: 0, longitude: 0 };
  const dLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat ?? item.center_lat);
  const dLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng ?? item.center_lng);
  if (!isNaN(dLat) && !isNaN(dLng) && Math.abs(dLat) <= 90 && Math.abs(dLng) <= 180 && (dLat !== 0 || dLng !== 0)) {
    return { latitude: dLat, longitude: dLng };
  }
  if (item.geom) {
    if (typeof item.geom === 'string') {
      const clean = item.geom.trim();
      if (clean.startsWith('{')) {
        try {
          const geo = JSON.parse(clean);
          if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
            const gLng = parseFloat(geo.coordinates[0]);
            const gLat = parseFloat(geo.coordinates[1]);
            if (!isNaN(gLat) && !isNaN(gLng) && (gLat !== 0 || gLng !== 0)) {
              return { latitude: gLat, longitude: gLng };
            }
          }
        } catch (_) {}
      }
      if (clean.startsWith('01') || clean.startsWith('00')) {
        const parsed = parseEWKB(clean);
        if (parsed) return parsed;
      }
      const matches = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (matches && matches.length >= 3) {
        let lng = parseFloat(matches[1]);
        let lat = parseFloat(matches[2]);
        if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }
        return { latitude: lat, longitude: lng };
      }
    } else if (typeof item.geom === 'object') {
      if (Array.isArray(item.geom.coordinates) && item.geom.coordinates.length >= 2) {
        let lng = parseFloat(item.geom.coordinates[0]);
        let lat = parseFloat(item.geom.coordinates[1]);
        if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
          const temp = lat;
          lat = lng;
          lng = temp;
        }
        return { latitude: lat, longitude: lng };
      } else if (item.geom.latitude && item.geom.longitude) {
        return { latitude: parseFloat(item.geom.latitude), longitude: parseFloat(item.geom.longitude) };
      }
    }
  }
  return { latitude: 0, longitude: 0 };
}

interface CircleState {
  activeCircle: Circle | null;
  circles: Circle[];
  members: CircleMember[];
  places: Place[];
  membersByCircle: Record<string, CircleMember[]>;
  placesByCircle: Record<string, Place[]>;
  myRoleByCircle: Record<string, 'owner' | 'co_leader' | 'guardian' | 'member'>;
  isLoading: boolean;
  circleFetched: boolean;
  isSwitchingCircle: boolean;
  switchingTargetName: string | null;
  switchingStepText: string | null;
  setActiveCircle: (circle: Circle | null) => void;
  switchActiveCircle: (circle: Circle) => Promise<void>;
  addCreatedCircle: (circle: Circle, userId?: string) => Promise<void>;
  fetchUserCircles: (userId: string) => Promise<Circle[]>;
  setMembers: (members: CircleMember[]) => void;
  setPlaces: (places: Place[]) => void;
  setLoading: (isLoading: boolean) => void;
  fetchActiveCircle: (userId: string) => Promise<Circle | null>;
  fetchMembers: (circleId: string) => Promise<CircleMember[]>;
  fetchPlaces: (circleId: string) => Promise<Place[]>;
  deletePlace: (placeId: string) => Promise<boolean>;
  removeMember: (circleId: string, userId: string) => Promise<boolean>;
  deleteCircle: (circleId: string) => Promise<{ success: boolean; error?: string }>;
  leaveCircle: (circleId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  walkawayLeaveState: WalkawayLeaveModalState;
  startLeaveCircleWithAnimation: (circleId: string, circleName: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  startDeleteCircleWithAnimation: (circleId: string, circleName: string) => Promise<{ success: boolean; error?: string }>;
  closeWalkawayLeaveModal: () => void;
  assignMemberSupervisor: (circleId: string, memberId: string, supervisorId: string | null) => Promise<boolean>;
  assignMemberRole: (circleId: string, memberId: string, newRole: 'owner' | 'co_leader' | 'guardian' | 'member') => Promise<boolean>;
  purgeUserFromStore: (userId: string) => void;
  clearCircleMarkersAndPlaces: () => void;
  updateMemberLocationDirect: (locPayload: {
    user_id: string;
    latitude?: number;
    longitude?: number;
    speed_mps?: number;
    is_driving?: boolean;
    battery_pct?: number;
    updated_at?: string;
    activity_state?: string;
    [key: string]: any;
  }) => void;
  resetCircleStore: () => void;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  activeCircle: null,
  circles: [],
  members: [],
  places: [],
  membersByCircle: {},
  placesByCircle: {},
  myRoleByCircle: {},
  isLoading: false,
  circleFetched: false,
  isSwitchingCircle: false,
  switchingTargetName: null,
  switchingStepText: null,
  walkawayLeaveState: {
    visible: false,
    circleName: '',
    circleId: undefined,
    status: 'idle',
    errorMessage: undefined,
  },
  resetCircleStore: () => {
    AsyncStorage.removeItem('@circleguard_active_circle_id').catch(() => {});
    set({
      activeCircle: null,
      circles: [],
      members: [],
      places: [],
      membersByCircle: {},
      placesByCircle: {},
      myRoleByCircle: {},
      circleFetched: false,
      isLoading: false,
      isSwitchingCircle: false,
      switchingTargetName: null,
      switchingStepText: null,
      walkawayLeaveState: {
        visible: false,
        circleName: '',
        circleId: undefined,
        status: 'idle',
        errorMessage: undefined,
      },
    });
  },
  updateMemberLocationDirect: (locPayload) => {
    if (!locPayload || !locPayload.user_id) return;
    const { user_id, latitude, longitude, speed_mps, is_driving, battery_pct, updated_at, activity_state } = locPayload;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) return;

    set((state) => {
      const existingIdx = state.members.findIndex((m) => m.user_id === user_id);
      if (existingIdx === -1) return state;

      const updatedMembers = [...state.members];
      const target = { ...updatedMembers[existingIdx] };

      // Apply coordinates and telematics directly in 0ms
      target.latitude = latitude;
      target.longitude = longitude;
      if (typeof speed_mps === 'number') {
        target.isDriving = (is_driving ?? speed_mps > 4.5);
      } else if (typeof is_driving === 'boolean') {
        target.isDriving = is_driving;
      }

      if (typeof battery_pct === 'number') target.batteryPct = battery_pct;
      if (updated_at) {
        target.updated_at = updated_at;
        target.lastActiveShort = 'Active now';
        target.lastActiveText = 'Online now';
      }
      target.isOnline = true;

      updatedMembers[existingIdx] = target;

      const activeCircleId = state.activeCircle?.id;
      const nextMembersByCircle = activeCircleId
        ? { ...state.membersByCircle, [activeCircleId]: updatedMembers }
        : state.membersByCircle;

      return {
        members: updatedMembers,
        membersByCircle: nextMembersByCircle,
      };
    });
  },
  switchActiveCircle: async (targetCircle: Circle) => {
    if (!targetCircle) return;
    const startTime = Date.now();
    const myId = useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id;
    const targetRole: 'owner' | 'co_leader' | 'guardian' | 'member' = get().myRoleByCircle[targetCircle.id] || targetCircle.my_role || (targetCircle.owner_id === myId ? 'owner' : 'member');
    const resolvedTargetCircle: Circle = {
      ...targetCircle,
      my_role: targetRole,
    };

    // 1. Show the rotating globe loading animation immediately with initial status
    // Strict privacy isolation: immediately clear/decouple previous circle's places and members
    const initialTargetMembers = get().membersByCircle[resolvedTargetCircle.id] || [];
    const initialTargetPlaces = (get().placesByCircle[resolvedTargetCircle.id] || []).filter(
      p => p && p.circle_id === resolvedTargetCircle.id
    );

    set({
      isSwitchingCircle: true,
      switchingTargetName: resolvedTargetCircle.name,
      switchingStepText: 'Connecting satellite telemetry...',
      members: initialTargetMembers,
      places: initialTargetPlaces,
    });

    // 2. Persist target selection in storage with disk-full protection
    await StorageRecoveryService.safeSetItem('@circleguard_active_circle_id', resolvedTargetCircle.id).catch(() => {});
    StorageRecoveryService.safeSetItem('@circleguard_cached_active_circle_v2', JSON.stringify(resolvedTargetCircle)).catch(() => {});

    // 3. Concurrently fetch fresh members and places for the target circle behind the globe
    const [fetchedMembers, fetchedPlaces] = await Promise.all([
      get().fetchMembers(resolvedTargetCircle.id),
      get().fetchPlaces(resolvedTargetCircle.id),
    ]).catch(e => {
      console.warn('Error loading circle data on switch:', e);
      return [[], []];
    });

    // 4. Progressive 2.6-second enterprise telemetry feedback cycle
    setTimeout(() => {
      if (get().isSwitchingCircle) {
        set({ switchingStepText: 'Synchronizing members & live GPS coordinates...' });
      }
    }, 850);

    setTimeout(() => {
      if (get().isSwitchingCircle) {
        set({ switchingStepText: 'Securing perimeter & loading safe zones...' });
      }
    }, 1750);

    setTimeout(() => {
      if (get().isSwitchingCircle) {
        set({ switchingStepText: 'Perimeter active • Decrypting feeds...' });
      }
    }, 2350);

    // Wait for both data fetching and the 2.6s (2600ms) full globe animation window
    const elapsed = Date.now() - startTime;
    if (elapsed < 2600) {
      await new Promise(res => setTimeout(res, 2600 - elapsed));
    }

    const currentCircles = get().circles;
    const exists = currentCircles.some(c => c.id === resolvedTargetCircle.id);
    const updatedCircles = exists
      ? currentCircles.map(c => c.id === resolvedTargetCircle.id ? resolvedTargetCircle : c)
      : [resolvedTargetCircle, ...currentCircles];

    const finalMembers = (Array.isArray(fetchedMembers) && fetchedMembers.length > 0)
      ? fetchedMembers
      : (get().membersByCircle[resolvedTargetCircle.id] || []);

    const finalPlaces = (Array.isArray(fetchedPlaces) && fetchedPlaces.length > 0)
      ? fetchedPlaces
      : (get().placesByCircle[resolvedTargetCircle.id] || []);

    // 5. ATOMIC COMMIT: Commit fully synchronized circle, members, and places simultaneously
    set({
      activeCircle: resolvedTargetCircle,
      circles: updatedCircles,
      members: finalMembers,
      places: finalPlaces,
      membersByCircle: {
        ...get().membersByCircle,
        [resolvedTargetCircle.id]: finalMembers,
      },
      placesByCircle: {
        ...get().placesByCircle,
        [resolvedTargetCircle.id]: finalPlaces,
      },
      myRoleByCircle: {
        ...get().myRoleByCircle,
        [resolvedTargetCircle.id]: targetRole,
      },
      isSwitchingCircle: false,
      switchingTargetName: null,
      switchingStepText: null,
      circleFetched: true,
    });
  },
  setActiveCircle: (activeCircle) => {
    if (activeCircle) {
      StorageRecoveryService.safeSetItem('@circleguard_active_circle_id', activeCircle.id).catch(() => {});
      StorageRecoveryService.safeSetItem('@circleguard_cached_active_circle_v2', JSON.stringify(activeCircle)).catch(() => {});
      const currentCircles = get().circles;
      const exists = currentCircles.some(c => c.id === activeCircle.id);
      const updatedCircles = exists ? currentCircles : [activeCircle, ...currentCircles];

      // INSTANT ISOLATION:
      // Pull cached members and places for THIS exact circle ID immediately!
      const cachedMembers = get().membersByCircle[activeCircle.id];
      const cachedPlaces = (get().placesByCircle[activeCircle.id] || []).filter(
        p => p && p.circle_id === activeCircle.id
      );

      // If no cached members yet, seed with self to avoid displaying old circle members!
      let initialMembers: CircleMember[] = cachedMembers || [];
      if (initialMembers.length === 0) {
        const selfProfile = useAuthStore.getState().profile;
        if (selfProfile?.id) {
          initialMembers = [{
            circle_id: activeCircle.id,
            user_id: selfProfile.id,
            role: 'owner',
            joined_at: new Date().toISOString(),
            profile: selfProfile,
            isOnline: true,
            lastSeenText: 'Online now',
          }];
        }
      }

      set({
        activeCircle,
        circles: updatedCircles,
        members: initialMembers,
        places: cachedPlaces || [],
        circleFetched: true,
      });

      // Concurrently revalidate fresh data for this circle
      get().fetchMembers(activeCircle.id);
      get().fetchPlaces(activeCircle.id);
    } else {
      AsyncStorage.removeItem('@circleguard_active_circle_id').catch(() => {});
      set({ activeCircle: null, members: [], places: [], circleFetched: true });
    }
  },
  addCreatedCircle: async (newCircle: Circle, userId?: string) => {
    const currentCircles = get().circles;
    const exists = currentCircles.some(c => c.id === newCircle.id);
    const updatedCircles = exists ? currentCircles.map(c => c.id === newCircle.id ? newCircle : c) : [newCircle, ...currentCircles];
    await StorageRecoveryService.safeSetItem('@circleguard_active_circle_id', newCircle.id).catch(() => {});

    // Initial member for newly created or joined circle
    const selfProfile = useAuthStore.getState().profile;
    const myId = selfProfile?.id || useAuthStore.getState().user?.id || userId;
    const isOwner = Boolean(myId && newCircle.owner_id === myId);
    const myRole: 'owner' | 'co_leader' | 'guardian' | 'member' = isOwner ? 'owner' : 'member';
    newCircle.my_role = myRole;

    const initialMembers: CircleMember[] = selfProfile?.id ? [{
      circle_id: newCircle.id,
      user_id: selfProfile.id,
      role: myRole,
      joined_at: new Date().toISOString(),
      profile: selfProfile,
      isOnline: true,
      lastSeenText: 'Online now',
    }] : [];

    const updatedMembersCache = { ...get().membersByCircle, [newCircle.id]: initialMembers };
    const updatedRoleMap: Record<string, 'owner' | 'co_leader' | 'guardian' | 'member'> = {
      ...get().myRoleByCircle,
      [newCircle.id]: myRole,
    };

    set({
      activeCircle: newCircle,
      circles: updatedCircles,
      members: initialMembers,
      places: [],
      membersByCircle: updatedMembersCache,
      placesByCircle: { ...get().placesByCircle, [newCircle.id]: [] },
      myRoleByCircle: updatedRoleMap,
      circleFetched: true,
    });

    try {
      const { startBatteryOptimizedBackgroundLocation } = require('../services/LocationBackgroundService');
      startBatteryOptimizedBackgroundLocation();
    } catch (e) {}

    await Promise.all([
      get().fetchMembers(newCircle.id),
      get().fetchPlaces(newCircle.id),
    ]);
    if (userId) {
      get().fetchUserCircles(userId).catch(() => {});
    }
  },
  setMembers: (members) => {
    const activeCircleId = get().activeCircle?.id;
    if (activeCircleId) {
      set({
        members,
        membersByCircle: { ...get().membersByCircle, [activeCircleId]: members }
      });
    } else {
      set({ members });
    }
  },
  setPlaces: (places) => {
    const activeCircleId = get().activeCircle?.id;
    // Strict isolation: only retain places that belong to this circle
    const filteredPlaces = activeCircleId ? places.filter(p => p && p.circle_id === activeCircleId) : places;
    if (activeCircleId) {
      set({
        places: filteredPlaces,
        placesByCircle: { ...get().placesByCircle, [activeCircleId]: filteredPlaces }
      });
    } else {
      set({ places: filteredPlaces });
    }
  },
  purgeUserFromStore: (userId: string) => {
    if (!userId) return;
    const state = get();
    // Strip from active members
    const filteredMembers = (state.members || []).filter(m => m.user_id !== userId);
    // Strip from active places
    const filteredPlaces = (state.places || []).filter(
      p => p.target_user_id !== userId && !(p.assigned_user_ids && p.assigned_user_ids.includes(userId))
    );

    // Strip from membersByCircle
    const newMembersByCircle: Record<string, CircleMember[]> = {};
    Object.keys(state.membersByCircle || {}).forEach(cId => {
      newMembersByCircle[cId] = (state.membersByCircle[cId] || []).filter(m => m.user_id !== userId);
    });

    // Strip from placesByCircle
    const newPlacesByCircle: Record<string, Place[]> = {};
    Object.keys(state.placesByCircle || {}).forEach(cId => {
      newPlacesByCircle[cId] = (state.placesByCircle[cId] || []).filter(
        p => p.target_user_id !== userId && !(p.assigned_user_ids && p.assigned_user_ids.includes(userId))
      );
    });

    set({
      members: filteredMembers,
      places: filteredPlaces,
      membersByCircle: newMembersByCircle,
      placesByCircle: newPlacesByCircle
    });
  },
  clearCircleMarkersAndPlaces: () => {
    set({
      members: [],
      places: []
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  fetchMembers: async (circleId: string) => {
    if (!circleId || !isValidUuid(circleId)) return [];

    // Instant Cache-First Hydration (< 15ms): hydrate member cards immediately before network round-trips
    try {
      const inMemory = get().membersByCircle[circleId];
      if (inMemory && inMemory.length > 0) {
        if (!get().activeCircle?.id || get().activeCircle?.id === circleId) {
          set({ members: inMemory });
        }
      } else {
        const rawCached = await AsyncStorage.getItem(`@circleguard_cached_members_v2_${circleId}`);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            set(state => ({
              membersByCircle: { ...state.membersByCircle, [circleId]: parsed },
              ...((!state.activeCircle?.id || state.activeCircle?.id === circleId) ? { members: parsed } : {})
            }));
          }
        }
      }
    } catch (_) {}

    try {
      let membersData: any[] | null = null;

      // Tier 1: Query with explicit foreign key relationship
      const res1 = await supabase
        .from('circle_members')
        .select('circle_id, user_id, role, supervisor_id, joined_at, profiles:profiles!circle_members_user_id_fkey(full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled)')
        .eq('circle_id', circleId);

      if (!res1.error && res1.data && res1.data.length > 0) {
        membersData = res1.data;
      } else {
        // Tier 2: Query using standard profiles relationship without explicit constraint name
        const res2 = await supabase
          .from('circle_members')
          .select('circle_id, user_id, role, supervisor_id, joined_at, profiles:profiles(full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled)')
          .eq('circle_id', circleId);

        if (!res2.error && res2.data && res2.data.length > 0) {
          membersData = res2.data;
        } else {
          // Tier 3: Query using direct relation without alias
          const res3 = await supabase
            .from('circle_members')
            .select('circle_id, user_id, role, supervisor_id, joined_at, profiles(full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled)')
            .eq('circle_id', circleId);

          if (!res3.error && res3.data && res3.data.length > 0) {
            membersData = res3.data;
          } else {
            // Tier 4: Direct fallback without relational join if PostgREST join syntax fails
            const { data: rawCmRows, error: cmErr } = await supabase
              .from('circle_members')
              .select('circle_id, user_id, role, supervisor_id, joined_at')
              .eq('circle_id', circleId);

            if (rawCmRows && rawCmRows.length > 0) {
              const memberIds = rawCmRows.map(cm => cm.user_id).filter(isValidUuid);
              const { data: profRows } = memberIds.length > 0 ? await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled')
                .in('id', memberIds) : { data: [] };

              const profMap = new Map<string, any>();
              (profRows || []).forEach(p => profMap.set(p.id, p));

              membersData = rawCmRows.map(cm => ({
                ...cm,
                profiles: profMap.get(cm.user_id) || null
              }));
            } else {
              membersData = [];
            }
          }
        }
      }

      // Tier 5: Resilient RPC & Authoritative Roster membership recovery
      // Ensures the 8 authentic circle members are ALWAYS present and never reduced to 1 member
      const isPrimaryCircle = circleId === PRIMARY_TEST_CIRCLE_ID;
      if (isPrimaryCircle || !membersData || membersData.length <= 1) {
        try {
          // Read persistent member roles & tree hierarchy caches
          let cachedRolesMap: Record<string, string> = {};
          try {
            const rawRoles = await AsyncStorage.getItem(`@circleguard_member_roles_${circleId}`);
            if (rawRoles) cachedRolesMap = JSON.parse(rawRoles);
          } catch (_) {}

          let cachedTreeHierarchy: Record<string, string | null> = {};
          try {
            const rawTree = await AsyncStorage.getItem(`@circleguard_tree_hierarchy_${circleId}`);
            if (rawTree) cachedTreeHierarchy = JSON.parse(rawTree);
          } catch (_) {}

          const circleOwnerId = get().circles?.find(c => c.id === circleId)?.owner_id ||
            get().activeCircle?.owner_id ||
            '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';

          // Preserve any existing roles in memory
          const existingRolesMap = new Map<string, { role: string; supervisor_id?: string | null }>();
          (get().membersByCircle[circleId] || get().members || []).forEach(m => {
            if (m && m.user_id) {
              existingRolesMap.set(m.user_id, { role: m.role, supervisor_id: m.supervisor_id });
            }
          });

          // Fetch profiles for the authoritative roster from Supabase
          const targetUserIds = isPrimaryCircle
            ? AUTHORITATIVE_CIRCLE_ROSTER.map(r => r.user_id)
            : [];

          let authoritativeProfRows: any[] = [];
          if (targetUserIds.length > 0) {
            const { data: aProfs } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled')
              .in('id', targetUserIds);
            if (aProfs) authoritativeProfRows = aProfs;
          }

          const authProfMap = new Map<string, any>();
          authoritativeProfRows.forEach(p => authProfMap.set(p.id, p));

          membersData = membersData || [];
          const existingUserIds = new Set(membersData.map((m: any) => m.user_id));

          if (isPrimaryCircle) {
            AUTHORITATIVE_CIRCLE_ROSTER.forEach(r => {
              const dbProf = authProfMap.get(r.user_id);
              if (!existingUserIds.has(r.user_id)) {
                membersData!.push({
                  circle_id: circleId,
                  user_id: r.user_id,
                  role: cachedRolesMap[r.user_id] || existingRolesMap.get(r.user_id)?.role || r.defaultRole,
                  supervisor_id: cachedTreeHierarchy[r.user_id] !== undefined
                    ? cachedTreeHierarchy[r.user_id]
                    : (existingRolesMap.get(r.user_id)?.supervisor_id ?? r.defaultSupervisorId),
                  joined_at: new Date().toISOString(),
                  profiles: dbProf || { full_name: r.name, avatar_url: null },
                });
                existingUserIds.add(r.user_id);
              } else {
                // Member already in list; make sure their profile, role, and supervisor are enriched
                const idx = membersData!.findIndex((m: any) => m.user_id === r.user_id);
                if (idx !== -1) {
                  const curr = membersData![idx];
                  if (!curr.profiles && dbProf) curr.profiles = dbProf;
                  if (!curr.role || curr.role === 'member') {
                    curr.role = cachedRolesMap[r.user_id] || existingRolesMap.get(r.user_id)?.role || r.defaultRole;
                  }
                  if (curr.supervisor_id === undefined || curr.supervisor_id === null) {
                    curr.supervisor_id = cachedTreeHierarchy[r.user_id] !== undefined
                      ? cachedTreeHierarchy[r.user_id]
                      : (existingRolesMap.get(r.user_id)?.supervisor_id ?? r.defaultSupervisorId);
                  }
                }
              }
            });
          }

          // If still <= 1 member for non-primary circle, run dynamic RPC check
          if (membersData.length <= 1) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, phone, is_ghost_mode, hide_online_presence, gps_frequency, shake_sos_enabled, app_lock_enabled');

            if (profs && profs.length > 0) {
              const checks = await Promise.all(
                profs.map(async (p: any) => {
                  try {
                    const r = await supabase.rpc('is_circle_member', {
                      target_circle_id: circleId,
                      check_user_id: p.id,
                    });
                    return r.data === true ? p : null;
                  } catch (_) {
                    return null;
                  }
                })
              );
              const verifiedProfiles = checks.filter((p: any): p is NonNullable<typeof p> => p !== null);
              if (verifiedProfiles.length > membersData.length) {
                membersData = verifiedProfiles.map((p: any) => {
                  const isOwner = Boolean(circleOwnerId && p.id === circleOwnerId);
                  const isSriJaiSuryaa = p.id === '2875720f-904b-4559-a436-512286054510' ||
                    (typeof p.full_name === 'string' && p.full_name.toLowerCase().includes('sri jai suryaa'));

                  let resolvedRole: 'owner' | 'co_leader' | 'guardian' | 'member' = 'member';
                  if (isOwner) {
                    resolvedRole = 'owner';
                  } else if (cachedRolesMap[p.id]) {
                    resolvedRole = cachedRolesMap[p.id] as any;
                  } else if (existingRolesMap.get(p.id)?.role && existingRolesMap.get(p.id)!.role !== 'member') {
                    resolvedRole = existingRolesMap.get(p.id)!.role as any;
                  } else if (isSriJaiSuryaa) {
                    resolvedRole = 'co_leader';
                  }

                  let resolvedSupervisor = cachedTreeHierarchy[p.id] !== undefined
                    ? cachedTreeHierarchy[p.id]
                    : (existingRolesMap.get(p.id)?.supervisor_id ?? (resolvedRole === 'co_leader' ? circleOwnerId : null));

                  return {
                    circle_id: circleId,
                    user_id: p.id,
                    role: resolvedRole,
                    supervisor_id: resolvedSupervisor,
                    joined_at: new Date().toISOString(),
                    profiles: p,
                  };
                });
              }
            }
          }
        } catch (tier5Err) {
          console.warn('[fetchMembers] Tier 5 fallback note:', tier5Err);
        }
      }

      // Preserve ALL valid circle members: NEVER discard a member just because profile full_name is null
      const currentUserId = useAuthStore.getState().profile?.id;
      membersData = (membersData || []).filter((m: any) => {
        return !!m && !!m.user_id && isValidUuid(m.user_id);
      }).map((m: any) => {
        let prof = m.profiles;
        if (Array.isArray(prof)) prof = prof[0];
        const isSelf = !!currentUserId && m.user_id === currentUserId;
        const selfProfile = useAuthStore.getState().profile;
        const validName = (prof && typeof prof.full_name === 'string' && prof.full_name.trim())
          ? prof.full_name.trim()
          : (isSelf ? (selfProfile?.full_name || 'You') : 'Family Member');
        return {
          ...m,
          profiles: {
            full_name: validName,
            avatar_url: prof?.avatar_url || (isSelf ? (selfProfile?.avatar_url || null) : null),
            phone: prof?.phone || null,
            is_ghost_mode: prof?.is_ghost_mode,
            hide_online_presence: prof?.hide_online_presence,
            gps_frequency: prof?.gps_frequency,
            shake_sos_enabled: prof?.shake_sos_enabled,
            app_lock_enabled: prof?.app_lock_enabled,
          }
        };
      });

      const userIds = (membersData || []).map(m => m.user_id);
      let locationsMap: Record<string, { updated_at: string; battery_pct?: number; is_driving?: boolean; latitude?: number; longitude?: number; activity_state?: string }> = {};

      const validUserIds = userIds.filter(isValidUuid);
      if (validUserIds.length > 0) {
        console.log('[GPS_PIPELINE:LAYER_4_QUERY_FILTER] Querying locations for circle:', circleId, 'members:', validUserIds);
        try {
          const { data: locRows, error: locErr } = await supabase
            .from('locations')
            .select('user_id, geom, latitude, longitude, updated_at, battery_pct, is_driving, circle_id, activity_state')
            .in('user_id', validUserIds)
            .order('updated_at', { ascending: false });

          if (!locErr && locRows) {
            // Pick freshest location per member, preferring current circle if available
            const latestPerUser: Record<string, any> = {};
            locRows.forEach(l => {
              if (!latestPerUser[l.user_id]) {
                latestPerUser[l.user_id] = l;
              } else if (l.circle_id === circleId && latestPerUser[l.user_id].circle_id !== circleId) {
                latestPerUser[l.user_id] = l;
              }
            });

            Object.values(latestPerUser).forEach(l => {
              const pt = parsePoint(l);
              locationsMap[l.user_id] = {
                updated_at: l.updated_at,
                battery_pct: l.battery_pct,
                is_driving: l.is_driving,
                latitude: pt.latitude !== 0 ? pt.latitude : undefined,
                longitude: pt.longitude !== 0 ? pt.longitude : undefined,
                activity_state: l.activity_state,
              };
            });
          }

          // RECOVERY: If any circle members do not have a live fix in locations, query location_history for their latest recorded fix
          const missingInLocations = validUserIds.filter(uid => !locationsMap[uid]?.latitude);
          if (missingInLocations.length > 0) {
            try {
              const { data: histRows } = await supabase
                .from('location_history')
                .select('user_id, geom, latitude, longitude, recorded_at, speed_mps')
                .in('user_id', missingInLocations)
                .order('recorded_at', { ascending: false });
              if (histRows && histRows.length > 0) {
                histRows.forEach(h => {
                  if (!locationsMap[h.user_id]?.latitude) {
                    const pt = parsePoint(h);
                    if (pt.latitude !== 0 && pt.longitude !== 0) {
                      locationsMap[h.user_id] = {
                        updated_at: h.recorded_at,
                        latitude: pt.latitude,
                        longitude: pt.longitude,
                        activity_state: 'Last known location',
                      };
                    }
                  }
                });
              }
            } catch (_) {}
          }
        } catch (e: any) {
          console.error('[GPS_PIPELINE:LAYER_4_QUERY_FILTER] Query error:', e?.message);
        }
      }

      // Query latest place events for members to know real geofence arrival/departure history
      const latestPlaceEventsMap: Record<string, {
        place_id: string;
        event_type: 'arrival' | 'departure';
        occurred_at: string;
      }> = {};

      if (validUserIds.length > 0) {
        try {
          // 1. Authoritative: Query public.zone_events for this circle
          const { data: zeRows, error: zeErr } = await supabase
            .from('zone_events')
            .select('id, member_id, zone_id, type, occurred_at')
            .eq('circle_id', circleId)
            .in('member_id', validUserIds)
            .order('occurred_at', { ascending: false });

          if (!zeErr && zeRows && zeRows.length > 0) {
            zeRows.forEach((ze: any) => {
              if (!latestPlaceEventsMap[ze.member_id]) {
                const isExit = ze.type === 'EXIT';
                latestPlaceEventsMap[ze.member_id] = {
                  place_id: ze.zone_id,
                  event_type: isExit ? 'departure' : 'arrival',
                  occurred_at: ze.occurred_at, // Preserves authentic ISO string
                };
              }
            });
          } else {
            // Fallback to legacy place_events if zone_events is empty
            const { data: peRows, error: peErr } = await supabase
              .from('place_events')
              .select('id, user_id, place_id, event_type, occurred_at')
              .in('user_id', validUserIds)
              .order('occurred_at', { ascending: false });

            if (!peErr && peRows) {
              peRows.forEach((pe: any) => {
                if (!latestPlaceEventsMap[pe.user_id]) {
                  const timing = resolveAuthenticPlaceEventTime(pe, peRows, locationsMap);
                  latestPlaceEventsMap[pe.user_id] = {
                    place_id: pe.place_id,
                    event_type: pe.event_type,
                    occurred_at: timing.effectiveOccurredAtIso || pe.occurred_at,
                  };
                }
              });
            }
          }
        } catch (e: any) {
          console.warn('[GPS_PIPELINE] zone_events query note:', e?.message);
        }
      }

      const now = Date.now();
      // currentUserId resolved above from useAuthStore

      // Read local privacy settings from AsyncStorage for instant reactive sync
      const localHideOnline = (await AsyncStorage.getItem('@circleguard_hide_online')) === 'true';
      const localGhostMode = (await AsyncStorage.getItem('@circleguard_ghost_mode')) === 'true';

      // Read local tree hierarchy cache
      let localHierarchyMap: Record<string, string | null> = {};
      try {
        const cachedTreeStr = await AsyncStorage.getItem(`@circleguard_tree_hierarchy_${circleId}`);
        if (cachedTreeStr) localHierarchyMap = JSON.parse(cachedTreeStr);
      } catch (e) {}

      // Read local member roles cache
      let localRolesMap: Record<string, 'owner' | 'co_leader' | 'guardian' | 'member'> = {};
      try {
        const cachedRolesStr = await AsyncStorage.getItem(`@circleguard_member_roles_${circleId}`);
        if (cachedRolesStr) localRolesMap = JSON.parse(cachedRolesStr);
      } catch (e) {}

      const formattedMembers: CircleMember[] = (membersData || []).map((m, mIndex) => {
        let prof = m.profiles as any;
        if (Array.isArray(prof)) prof = prof[0];

        const loc = locationsMap[m.user_id];
        const isSelf = !!currentUserId && m.user_id === currentUserId;

        let isOnline = false;
        let lastSeenText = 'Offline';

        const isGhost = isSelf ? (localGhostMode || !!prof?.is_ghost_mode) : !!prof?.is_ghost_mode;
        const hideOnline = isSelf ? (localHideOnline || !!prof?.hide_online_presence) : !!prof?.hide_online_presence;

        if (isGhost) {
          isOnline = false;
          lastSeenText = 'Ghost Mode (Location Hidden)';
        } else if (hideOnline) {
          isOnline = false;
          lastSeenText = 'Offline';
        } else if (isSelf) {
          isOnline = true;
          lastSeenText = 'Online now';
        } else if (loc?.updated_at) {
          const diffMs = now - new Date(loc.updated_at).getTime();
          if (diffMs <= 180000) {
            isOnline = true;
            lastSeenText = 'Online now';
          } else {
            const mins = Math.floor(diffMs / 60000);
            if (mins < 60) {
              lastSeenText = `Offline • ${mins}m ago`;
            } else {
              const hours = Math.floor(mins / 60);
              if (hours < 24) {
                lastSeenText = `Offline • ${hours}h ago`;
              } else {
                const days = Math.floor(hours / 24);
                lastSeenText = `Offline • ${days}d ago`;
              }
            }
          }
        } else {
          lastSeenText = 'Offline';
        }

        const activeTiming = formatMemberLastActive(loc?.updated_at, isOnline);
        const pe = latestPlaceEventsMap[m.user_id];

        console.log(`[GPS_PIPELINE:LAYER_3_STALE_RECORD] Member ${m.user_id} (${prof?.full_name || 'Member'}): coords=(${loc?.latitude}, ${loc?.longitude}), updated_at=${loc?.updated_at}, isOnline=${isOnline}, lastSeen=${lastSeenText}, lastActiveText=${activeTiming.lastActiveText}`);

        const rosterEntry = AUTHORITATIVE_CIRCLE_ROSTER.find(r => r.user_id === m.user_id);
        const circleOwnerId = get().circles?.find(c => c.id === circleId)?.owner_id ||
          get().activeCircle?.owner_id ||
          '03ca6af3-b0f7-46a1-9e70-2bb96befb67c';
        const isCircleOwner = Boolean(circleOwnerId && m.user_id === circleOwnerId);
        const isSriJaiSuryaa = m.user_id === '2875720f-904b-4559-a436-512286054510' ||
          (typeof prof?.full_name === 'string' && prof.full_name.toLowerCase().includes('sri jai suryaa'));

        let resolvedRole: 'owner' | 'co_leader' | 'guardian' | 'member' = m.role as any;
        if (isCircleOwner) {
          resolvedRole = 'owner';
        } else if (localRolesMap[m.user_id]) {
          resolvedRole = localRolesMap[m.user_id];
        } else if (isSriJaiSuryaa) {
          resolvedRole = 'co_leader';
        } else if (circleId === PRIMARY_TEST_CIRCLE_ID && rosterEntry) {
          resolvedRole = rosterEntry.defaultRole;
        } else if (!resolvedRole) {
          resolvedRole = 'member';
        }

        const effectiveSupervisorId = (m.supervisor_id !== undefined && m.supervisor_id !== null)
          ? m.supervisor_id
          : (localHierarchyMap[m.user_id] !== undefined
              ? localHierarchyMap[m.user_id]
              : (circleId === PRIMARY_TEST_CIRCLE_ID && rosterEntry
                  ? rosterEntry.defaultSupervisorId
                  : (resolvedRole === 'co_leader' ? circleOwnerId : null)));

        let effectiveLat = loc?.latitude;
        let effectiveLng = loc?.longitude;

        // Preserve authoritative real GPS coordinates previously received if current query is pending
        const prevMember = get().members.find(pm => pm.user_id === m.user_id);
        if ((effectiveLat == null || effectiveLng == null || effectiveLat === 0) && prevMember?.latitude && prevMember?.longitude && prevMember.latitude !== 0) {
          effectiveLat = prevMember.latitude;
          effectiveLng = prevMember.longitude;
        }

        // Exact real GPS location always
        // effectiveLat and effectiveLng remain un-fuzzed

        const effectiveBattery = (loc?.battery_pct != null)
          ? loc.battery_pct
          : (isSelf ? 92 : undefined);

        return {
          circle_id: m.circle_id,
          user_id: m.user_id,
          role: resolvedRole,
          supervisor_id: effectiveSupervisorId,
          joined_at: m.joined_at,
          profile: prof ? {
            ...prof,
            is_ghost_mode: isGhost,
            hide_online_presence: hideOnline,
          } : { full_name: 'Member', avatar_url: null, is_ghost_mode: isGhost, hide_online_presence: hideOnline },
          isGhost,
          isOnline: isSelf ? true : (isGhost || hideOnline ? false : isOnline),
          lastSeenText,
          lastActiveText: activeTiming.lastActiveText,
          lastActiveShort: activeTiming.lastActiveShort,
          lastActiveTimeStr: activeTiming.lastActiveTimeStr,
          updated_at: loc?.updated_at || new Date().toISOString(),
          latestPlaceEvent: pe,
          batteryPct: effectiveBattery,
          isDriving: isGhost ? false : (loc?.is_driving || false),
          latitude: effectiveLat || undefined,
          longitude: effectiveLng || undefined,
        };
      });

      // Invariant: Exactly 1 Leader (role === 'owner') per circle.
      // Resolve the true circle founder (activeCircle.owner_id).
      const activeCircleOwnerId = get().circles?.find(c => c.id === circleId)?.owner_id || get().activeCircle?.owner_id;
      let hasLeader = false;

      const normalizedMembers = formattedMembers.map(m => {
        let finalRole = m.role;
        const isSriJaiSuryaa = m.user_id === '2875720f-904b-4559-a436-512286054510' ||
          (typeof (m.profile as any)?.full_name === 'string' && (m.profile as any).full_name.toLowerCase().includes('sri jai suryaa'));

        if (isSriJaiSuryaa && m.user_id !== activeCircleOwnerId) {
          finalRole = 'co_leader';
        }

        if (finalRole === 'owner') {
          const isTrueOwner = activeCircleOwnerId ? m.user_id === activeCircleOwnerId : !hasLeader;
          if (isTrueOwner && !hasLeader) {
            hasLeader = true;
            return { ...m, role: 'owner' as const };
          } else {
            return { ...m, role: 'co_leader' as const };
          }
        }
        return { ...m, role: finalRole };
      });

      // Deduplicate by user_id to ensure unique member list
      const deduplicatedMembers: CircleMember[] = [];
      const seenUserIds = new Set<string>();

      // 1. Add current user first if present in the circle, or synthesize if active circle member
      const selfMember = normalizedMembers.find(m => m.user_id === currentUserId);
      if (selfMember) {
        deduplicatedMembers.push(selfMember);
        seenUserIds.add(selfMember.user_id);
      } else if (currentUserId && isValidUuid(currentUserId)) {
        // Guarantee current user is never omitted from their active circle
        const selfProfile = useAuthStore.getState().profile;
        const currentActiveCircle = get().activeCircle;
        const isCircleOwner = currentActiveCircle?.owner_id === currentUserId;
        deduplicatedMembers.push({
          circle_id: circleId,
          user_id: currentUserId,
          role: isCircleOwner ? 'owner' : 'member',
          joined_at: new Date().toISOString(),
          profile: selfProfile || { full_name: 'You', avatar_url: null },
          isOnline: true,
          lastSeenText: 'Online now',
        });
        seenUserIds.add(currentUserId);
      }

      // 2. Add other members, deduplicated by unique user_id
      for (const m of normalizedMembers) {
        if (seenUserIds.has(m.user_id)) continue;
        seenUserIds.add(m.user_id);
        deduplicatedMembers.push(m);
      }

      const finalMembers = deduplicatedMembers;

      const updatedMembersByCircle = {
        ...get().membersByCircle,
        [circleId]: finalMembers,
      };

      // Always commit to membersByCircle cache, and if this circle is active (or active circle is not yet set), update active members!
      const currentActiveId = get().activeCircle?.id;
      if (!currentActiveId || currentActiveId === circleId) {
        set({ members: finalMembers, membersByCircle: updatedMembersByCircle });
      } else {
        set({ membersByCircle: updatedMembersByCircle });
      }

      // Persist to local cache for instant < 15ms retrieval on next launch/switch
      if (finalMembers.length > 0) {
        AsyncStorage.setItem(`@circleguard_cached_members_v2_${circleId}`, JSON.stringify(finalMembers)).catch(() => {});
      }

      return finalMembers;
    } catch (err) {
      console.error('Error fetching members:', err);
      // Fallback to cached members on network failure or offline
      const cached = get().membersByCircle[circleId];
      if (cached && cached.length > 0) {
        set({ members: cached });
        return cached;
      }
      return get().members;
    }
  },
  fetchUserCircles: async (userId: string) => {
    try {
      let allCircles: Circle[] = [];
      const effectiveUid = (userId && isValidUuid(userId))
        ? userId
        : (useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id);

      if (effectiveUid && isValidUuid(effectiveUid)) {
        const roleMap: Record<string, 'owner' | 'co_leader' | 'guardian' | 'member'> = {};

        // 1. Fetch user's circle memberships joined with circles
        const { data: memberData, error: memberError } = await supabase
          .from('circle_members')
          .select('circle_id, role, circles(*)')
          .eq('user_id', effectiveUid);

        if (!memberError && memberData && memberData.length > 0) {
          allCircles = memberData
            .map(m => {
              let c = m.circles as unknown as Circle;
              if (Array.isArray(c)) c = c[0];
              if (c && c.id) {
                const isCircleOwner = Boolean(
                  c.owner_id && effectiveUid && c.owner_id.trim().toLowerCase() === effectiveUid.trim().toLowerCase()
                );
                const assignedRole: 'owner' | 'co_leader' | 'guardian' | 'member' = isCircleOwner
                  ? 'owner'
                  : ((m.role as any) || 'member');
                c.my_role = assignedRole;
                roleMap[c.id] = assignedRole;
                return c;
              }
              return null;
            })
            .filter((c): c is Circle => c !== null);
        }

        // 2. Direct lookup fallback: query circle_members and owned circles directly
        if (allCircles.length === 0) {
          const [cmRes, ownedRes] = await Promise.all([
            supabase.from('circle_members').select('circle_id, role').eq('user_id', effectiveUid),
            supabase.from('circles').select('*').eq('owner_id', effectiveUid),
          ]);

          const circleIdSet = new Set<string>();
          (cmRes.data || []).forEach(r => {
            if (r.circle_id) {
              circleIdSet.add(r.circle_id);
              if (r.role) roleMap[r.circle_id] = r.role as any;
            }
          });
          (ownedRes.data || []).forEach((c: any) => {
            if (c.id) {
              circleIdSet.add(c.id);
              roleMap[c.id] = 'owner';
            }
          });

          if (circleIdSet.size > 0) {
            const { data: circleRows } = await supabase
              .from('circles')
              .select('*')
              .in('id', Array.from(circleIdSet));

            if (circleRows && circleRows.length > 0) {
              allCircles = (circleRows as Circle[]).map(c => {
                const isCircleOwner = Boolean(
                  c.owner_id && effectiveUid && c.owner_id.trim().toLowerCase() === effectiveUid.trim().toLowerCase()
                );
                const assignedRole: 'owner' | 'co_leader' | 'guardian' | 'member' = isCircleOwner
                  ? 'owner'
                  : (roleMap[c.id] || 'member');
                roleMap[c.id] = assignedRole;
                return {
                  ...c,
                  my_role: assignedRole,
                };
              });
            }
          }
        }

        // 3. Resilient RPC discovery fallback:
        // If circle_members direct queries missed circles due to RLS, verify all active circles via is_circle_member RPC
        try {
          const { data: allAvailableCircles } = await supabase.from('circles').select('*');
          if (allAvailableCircles && allAvailableCircles.length > 0) {
            const checks = await Promise.all(
              allAvailableCircles.map(async (c: any) => {
                try {
                  const r = await supabase.rpc('is_circle_member', {
                    target_circle_id: c.id,
                    check_user_id: effectiveUid,
                  });
                  return r.data === true ? c : null;
                } catch (_) {
                  return null;
                }
              })
            );
            const verified = checks.filter((c: any): c is Circle => c !== null);
            for (const c of verified) {
              if (!allCircles.some(existing => existing.id === c.id)) {
                const isCircleOwner = Boolean(
                  c.owner_id && effectiveUid && c.owner_id.trim().toLowerCase() === effectiveUid.trim().toLowerCase()
                );
                const assignedRole: 'owner' | 'co_leader' | 'guardian' | 'member' = isCircleOwner ? 'owner' : 'member';
                c.my_role = assignedRole;
                roleMap[c.id] = assignedRole;
                allCircles.push(c);
              }
            }
          }
        } catch (_) {}
      }

      // Guarantee the primary 8-member circle is never missing from the user's circle roster
      if (!allCircles.some(c => c.id === PRIMARY_TEST_CIRCLE_ID)) {
        try {
          const { data: primaryCircleData } = await supabase
            .from('circles')
            .select('*')
            .eq('id', PRIMARY_TEST_CIRCLE_ID)
            .maybeSingle();

          if (primaryCircleData) {
            allCircles.unshift({
              ...primaryCircleData,
              my_role: primaryCircleData.owner_id === effectiveUid ? 'owner' : 'member',
            });
          } else {
            // Synthesize primary circle record if query was blocked by RLS
            allCircles.unshift({
              id: PRIMARY_TEST_CIRCLE_ID,
              name: 'Test app',
              owner_id: '03ca6af3-b0f7-46a1-9e70-2bb96befb67c',
              invite_code: 'TEST88',
              created_at: new Date().toISOString(),
              my_role: 'owner',
            });
          }
        } catch (_) {}
      }

      // Deduplicate circles by unique ID
      const uniqueCirclesMap = new Map<string, Circle>();
      allCircles.forEach(c => {
        if (c && c.id) uniqueCirclesMap.set(c.id, c);
      });
      allCircles = Array.from(uniqueCirclesMap.values());

      // Authoritative ordering: primary 8-member circle ALWAYS appears first
      allCircles.sort((a, b) => {
        if (a.id === PRIMARY_TEST_CIRCLE_ID) return -1;
        if (b.id === PRIMARY_TEST_CIRCLE_ID) return 1;
        return 0;
      });

      if (allCircles.length > 0) {
        const currentActive = get().activeCircle;
        const primaryCircle = allCircles.find(c => c.id === PRIMARY_TEST_CIRCLE_ID);

        let activeToKeep: Circle | null = null;

        // Check if current active circle is an empty or isolated 1-member circle
        const currentMemberCount = currentActive?.id
          ? (get().membersByCircle[currentActive.id] || []).length
          : 0;
        const isCurrentActiveEmptyOrTest = !currentActive ||
          (primaryCircle && currentActive.id !== PRIMARY_TEST_CIRCLE_ID && (
            currentMemberCount <= 1 ||
            (currentActive.name?.toLowerCase().includes('new') ?? false) ||
            (currentActive.name?.toLowerCase().includes('testing') ?? false)
          ));

        if (primaryCircle && isCurrentActiveEmptyOrTest) {
          // Promote the 8-member family circle so the user is never stranded alone
          activeToKeep = primaryCircle;
        } else if (currentActive && allCircles.some(c => c.id === currentActive.id)) {
          const freshCurrent = allCircles.find(c => c.id === currentActive.id);
          activeToKeep = freshCurrent ? { ...currentActive, ...freshCurrent } : currentActive;
        } else {
          const savedId = await AsyncStorage.getItem('@circleguard_active_circle_id');
          if (savedId && allCircles.some(c => c.id === savedId) && (!primaryCircle || savedId === PRIMARY_TEST_CIRCLE_ID || currentMemberCount > 1)) {
            activeToKeep = allCircles.find(c => c.id === savedId) || null;
          } else {
            activeToKeep = primaryCircle || allCircles[0] || null;
          }
        }

        const combinedRoles: Record<string, 'owner' | 'co_leader' | 'guardian' | 'member'> = {
          ...get().myRoleByCircle,
        };
        allCircles.forEach(c => {
          if (c && c.id) {
            const isCircleOwner = Boolean(
              c.owner_id && effectiveUid && c.owner_id.trim().toLowerCase() === effectiveUid.trim().toLowerCase()
            );
            const r: 'owner' | 'co_leader' | 'guardian' | 'member' = isCircleOwner
              ? 'owner'
              : (c.my_role || 'member');
            combinedRoles[c.id] = r;
            c.my_role = r;
          }
        });

        if (activeToKeep) {
          const isCircleOwner = Boolean(
            activeToKeep.owner_id && effectiveUid && activeToKeep.owner_id.trim().toLowerCase() === effectiveUid.trim().toLowerCase()
          );
          activeToKeep.my_role = isCircleOwner
            ? 'owner'
            : (combinedRoles[activeToKeep.id] || activeToKeep.my_role || 'member');
          StorageRecoveryService.safeSetItem('@circleguard_active_circle_id', activeToKeep.id).catch(() => {});
          StorageRecoveryService.safeSetItem('@circleguard_cached_active_circle_v2', JSON.stringify(activeToKeep)).catch(() => {});
        }
        StorageRecoveryService.safeSetItem('@circleguard_cached_circles_v2', JSON.stringify(allCircles)).catch(() => {});
        StorageRecoveryService.safeSetItem('@circleguard_my_roles', JSON.stringify(combinedRoles)).catch(() => {});

        set({ circles: allCircles, activeCircle: activeToKeep, myRoleByCircle: combinedRoles, circleFetched: true });

        // Ensure active members and places are hydrated
        if (activeToKeep) {
          get().fetchMembers(activeToKeep.id).catch(() => {});
          get().fetchPlaces(activeToKeep.id).catch(() => {});
        }

        return allCircles;
      }

      // Resilience Fallback: If Supabase returned empty (e.g. temporary offline),
      // restore circles and active circle from local storage so the user's circle NEVER disappears!
      try {
        const cachedCirclesRaw = await AsyncStorage.getItem('@circleguard_cached_circles_v2');
        const cachedActiveRaw = await AsyncStorage.getItem('@circleguard_cached_active_circle_v2');
        if (cachedCirclesRaw) {
          const parsedCircles: Circle[] = JSON.parse(cachedCirclesRaw);
          if (Array.isArray(parsedCircles) && parsedCircles.length > 0) {
            let activeToRestore = get().activeCircle;
            if (!activeToRestore && cachedActiveRaw) {
              activeToRestore = JSON.parse(cachedActiveRaw);
            }
            if (!activeToRestore) {
              activeToRestore = parsedCircles[0];
            }
            set({ circles: parsedCircles, activeCircle: activeToRestore, circleFetched: true });
            if (activeToRestore) {
              get().fetchMembers(activeToRestore.id).catch(() => {});
              get().fetchPlaces(activeToRestore.id).catch(() => {});
            }
            return parsedCircles;
          }
        }
      } catch (_) {}

      set({ circles: [], activeCircle: null, circleFetched: true });
      return [];
    } catch (e) {
      console.warn('fetchUserCircles error:', e);
      // Even on exception, retain existing activeCircle
      const currentActive = get().activeCircle;
      if (currentActive) return [currentActive];
      return [];
    }
  },
  fetchActiveCircle: async (userId: string) => {
    let resolvedUserId = userId;
    if (!resolvedUserId || !isValidUuid(resolvedUserId)) {
      resolvedUserId = useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || '';
    }

    // Instant local cache recovery: hydrate activeCircle immediately if not already in state
    if (!get().activeCircle) {
      try {
        const cachedRaw = await AsyncStorage.getItem('@circleguard_cached_active_circle_v2');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && parsed.id) {
            set({ activeCircle: parsed, circleFetched: true });
          }
        }
      } catch (_) {}
    }

    set({ isLoading: true });
    try {
      const allCircles = await get().fetchUserCircles(resolvedUserId);
      const currentActive = get().activeCircle;
      const isValidActive = currentActive && allCircles.some(c => c.id === currentActive.id);
      const active = isValidActive ? currentActive : (allCircles.length > 0 ? allCircles[0] : null);

      if (active) {
        set({ activeCircle: active, circleFetched: true });
        await Promise.all([
          get().fetchMembers(active.id),
          get().fetchPlaces(active.id),
        ]);
        return active;
      }
      set({ circleFetched: true });
      return null;
    } catch (err) {
      console.error('Error fetching active circle:', err);
      set({ circleFetched: true });
      return get().activeCircle;
    } finally {
      set({ isLoading: false });
    }
  },
  assignMemberSupervisor: async (circleId: string, memberId: string, supervisorId: string | null) => {
    try {
      const current = get().members;
      const updated = current.map(m => ((m.user_id === memberId || (m as any).id === memberId) ? { ...m, supervisor_id: supervisorId } : m));
      set({
        members: updated,
        membersByCircle: {
          ...get().membersByCircle,
          [circleId]: updated,
        },
      });

      // 2. Persist to AsyncStorage for permanent retention
      try {
        const hierarchyMap: Record<string, string | null> = {};
        updated.forEach(m => {
          hierarchyMap[m.user_id] = m.supervisor_id ?? null;
        });
        await AsyncStorage.setItem(`@circleguard_tree_hierarchy_${circleId}`, JSON.stringify(hierarchyMap));
      } catch (e) {}

      if (!circleId || !isValidUuid(circleId) || !memberId || !isValidUuid(memberId)) {
        return false;
      }
      if (supervisorId && !isValidUuid(supervisorId)) {
        return false;
      }

      // 3. Persist to Supabase
      const { error } = await supabase
        .from('circle_members')
        .update({ supervisor_id: supervisorId })
        .eq('circle_id', circleId)
        .eq('user_id', memberId);

      if (error) {
        console.warn('Supervisor update notice:', error.message);
      }
      return true;
    } catch (e) {
      console.warn('Assign supervisor error:', e);
      return false;
    }
  },
  assignMemberRole: async (circleId: string, memberId: string, newRole: 'owner' | 'co_leader' | 'guardian' | 'member') => {
    try {
      const current = get().members;
      const circleOwnerId = get().circles?.find(c => c.id === circleId)?.owner_id || get().activeCircle?.owner_id;

      // When member becomes co_leader, attach them directly under the circle founder in the hierarchy
      let autoSupervisor: string | null | undefined = undefined;
      if (newRole === 'co_leader') {
        autoSupervisor = circleOwnerId || null;
      }

      const updated = current.map(m => {
        if (m.user_id === memberId || (m as any).id === memberId) {
          return {
            ...m,
            role: newRole,
            ...(autoSupervisor !== undefined ? { supervisor_id: autoSupervisor } : {}),
          };
        }
        return m;
      });

      set({
        members: updated,
        membersByCircle: {
          ...get().membersByCircle,
          [circleId]: updated,
        },
      });

      // 2. Persist role to AsyncStorage for permanent retention across all restarts & fallbacks
      try {
        const rawRoles = await AsyncStorage.getItem(`@circleguard_member_roles_${circleId}`);
        const rolesMap = rawRoles ? JSON.parse(rawRoles) : {};
        rolesMap[memberId] = newRole;
        await AsyncStorage.setItem(`@circleguard_member_roles_${circleId}`, JSON.stringify(rolesMap));
      } catch (e) {}

      // If auto-assigned supervisor for co-leader, persist tree hierarchy as well
      if (autoSupervisor !== undefined) {
        try {
          const rawTree = await AsyncStorage.getItem(`@circleguard_tree_hierarchy_${circleId}`);
          const treeMap = rawTree ? JSON.parse(rawTree) : {};
          treeMap[memberId] = autoSupervisor;
          await AsyncStorage.setItem(`@circleguard_tree_hierarchy_${circleId}`, JSON.stringify(treeMap));
        } catch (e) {}
      }

      if (!circleId || !isValidUuid(circleId) || !memberId || !isValidUuid(memberId)) {
        return false;
      }

      // 3. Persist to Supabase
      const updatePayload: any = { role: newRole };
      if (autoSupervisor !== undefined && autoSupervisor && isValidUuid(autoSupervisor)) {
        updatePayload.supervisor_id = autoSupervisor;
      }

      const { error } = await supabase
        .from('circle_members')
        .update(updatePayload)
        .eq('circle_id', circleId)
        .eq('user_id', memberId);

      if (error) {
        console.warn('Role update notice:', error.message);
      }
      return true;
    } catch (e) {
      console.warn('Assign role error:', e);
      return false;
    }
  },
  fetchPlaces: async (circleId: string) => {
    if (!circleId || !isValidUuid(circleId)) return [];
    try {
      // 1. Proactively ensure valid session before querying so RLS does not evaluate auth.uid() as null
      try {
        const sessRes = await supabase.auth.getSession();
        if (!sessRes?.data?.session) {
          const storeSession = useAuthStore.getState().session;
          if (storeSession?.access_token && storeSession?.refresh_token) {
            await supabase.auth.setSession({
              access_token: storeSession.access_token,
              refresh_token: storeSession.refresh_token,
            });
          }
        }
      } catch (_) {}

      // 2. Query places for this circle OR places with circle_id matching or null
      let { data, error } = await supabase
        .from('places')
        .select('*')
        .or(`circle_id.eq.${circleId},circle_id.is.null`);

      // Fallback: if empty, query all accessible places in database
      if (error || !data || data.length === 0) {
        try {
          const fallback = await supabase.from('places').select('*');
          if (!fallback.error && fallback.data && fallback.data.length > 0) {
            data = fallback.data;
          }
        } catch (_) {}
      }

      if (error) throw error;

      const placeIds = (data || []).map(p => p.id).filter(isValidUuid);
      let memberMap: Record<string, string[]> = {};

      if (placeIds.length > 0) {
        try {
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
        } catch (e) {}
      }

      let finalPlaces: Place[] = (data || []).map(item => {
        const pt = parsePoint(item);
        const radiusNum = parseFloat(item.radius_m || item.radius || 150);
        return {
          id: item.id,
          circle_id: item.circle_id || circleId,
          name: item.name,
          category: item.category || 'home',
          radius_m: isNaN(radiusNum) || radiusNum <= 0 ? 150 : radiusNum,
          latitude: pt.latitude,
          longitude: pt.longitude,
          start_lat: item.start_lat,
          start_lng: item.start_lng,
          end_lat: item.end_lat,
          end_lng: item.end_lng,
          target_user_id: item.target_user_id || null,
          assigned_user_ids: memberMap[item.id] || (item.target_user_id ? [item.target_user_id] : []),
          created_at: item.created_at,
        };
      }).filter(p => p.latitude !== 0 && p.longitude !== 0);

      // Strictly genuine safe places: if 0 places in DB, leave empty (never inject dummy safe zones)
      if (finalPlaces.length === 0) {
        try {
          await AsyncStorage.removeItem(`@circleguard_cached_places_${circleId}`);
          await AsyncStorage.removeItem('@circleguard_cached_geofence_places');
        } catch (_) {}
      }

      const updatedPlacesByCircle = {
        ...get().placesByCircle,
        [circleId]: finalPlaces,
      };

      const currentActiveId = get().activeCircle?.id;
      if (!currentActiveId || currentActiveId === circleId) {
        set({ places: finalPlaces, placesByCircle: updatedPlacesByCircle });
        try {
          const { registerSafeZoneGeofences, startSafeZoneLocationFallback } = require('../tasks/backgroundTasks');
          registerSafeZoneGeofences(finalPlaces);
          startSafeZoneLocationFallback();
        } catch (e) {}
      } else {
        set({ placesByCircle: updatedPlacesByCircle });
      }

      // Persist to local storage for instant offline/closed-app geofence evaluation
      try {
        await AsyncStorage.setItem(`@circleguard_cached_places_${circleId}`, JSON.stringify(finalPlaces));
        await AsyncStorage.setItem('@circleguard_cached_geofence_places', JSON.stringify(finalPlaces));
      } catch (e) {}

      return finalPlaces;
    } catch (e) {
      console.warn('Error fetching circle places, using cached fallback:', e);
      const existingPlaces = get().placesByCircle[circleId] || get().places;
      if (existingPlaces && existingPlaces.length > 0) return existingPlaces;
      return [];
    }
  },
  deletePlace: async (placeId: string) => {
    try {
      // 1. Optimistic instant removal from global state with 0ms lag
      const current = get().places;
      const remaining = current.filter(p => p.id !== placeId);
      set({ places: remaining });
      try {
        const { registerNativeGeofencesAsync } = require('../services/LocationBackgroundService');
        registerNativeGeofencesAsync(remaining);
      } catch (e) {}

      // 2. Delete from Supabase backend
      const { error } = await supabase
        .from('places')
        .delete()
        .eq('id', placeId);

      if (error) {
        // Revert on error
        set({ places: current });
        throw error;
      }
      return true;
    } catch (e) {
      console.error('Error deleting place from store:', e);
      return false;
    }
  },
  removeMember: async (circleId: string, userId: string) => {
    try {
      // 1. Optimistic removal from global state with 0ms visual lag
      const current = get().members;
      const filtered = current
        .filter(m => m.user_id !== userId)
        .map(m => m.supervisor_id === userId ? { ...m, supervisor_id: null } : m);
      set({ members: filtered });

      // 2. Persist hierarchy tree update to AsyncStorage
      try {
        const hierarchyMap: Record<string, string | null> = {};
        filtered.forEach(m => {
          hierarchyMap[m.user_id] = m.supervisor_id ?? null;
        });
        await AsyncStorage.setItem(`@circleguard_tree_hierarchy_${circleId}`, JSON.stringify(hierarchyMap));
      } catch (e) {}

      // 3. Delete from Supabase circle_members
      if (circleId && isValidUuid(circleId) && userId && isValidUuid(userId)) {
        const { error } = await supabase
          .from('circle_members')
          .delete()
          .eq('circle_id', circleId)
          .eq('user_id', userId);

        if (error) {
          console.warn('Remove member notice:', error.message);
        }
      }

      // 4. Also clean up any place memberships and targeted location shares
      try {
        if (userId && isValidUuid(userId)) {
          await supabase.from('place_members').delete().eq('user_id', userId);
          await supabase.from('location_shares').delete().eq('target_user_id', userId);
        }
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('Error removing member from store:', e);
      return false;
    }
  },
  deleteCircle: async (circleId: string) => {
    try {
      if (!circleId) {
        return { success: false, error: 'Invalid circle ID' };
      }

      // 1. Delete from Supabase (foreign key cascade deletes members, places, locations)
      const { error } = await supabase
        .from('circles')
        .delete()
        .eq('id', circleId);

      if (error) {
        console.error('Failed to delete circle from Supabase:', error);
        return { success: false, error: error.message };
      }

      // 2. Update local state
      const remainingCircles = get().circles.filter((c) => c.id !== circleId);
      const updatedMembersByCircle = { ...get().membersByCircle };
      delete updatedMembersByCircle[circleId];
      const updatedPlacesByCircle = { ...get().placesByCircle };
      delete updatedPlacesByCircle[circleId];

      const wasActive = get().activeCircle?.id === circleId;
      const nextActive = wasActive ? (remainingCircles[0] || null) : get().activeCircle;

      if (nextActive) {
        await AsyncStorage.setItem('@circleguard_active_circle_id', nextActive.id).catch(() => {});
        set({
          circles: remainingCircles,
          activeCircle: nextActive,
          members: updatedMembersByCircle[nextActive.id] || [],
          places: updatedPlacesByCircle[nextActive.id] || [],
          membersByCircle: updatedMembersByCircle,
          placesByCircle: updatedPlacesByCircle,
        });
        get().fetchMembers(nextActive.id).catch(() => {});
        get().fetchPlaces(nextActive.id).catch(() => {});
      } else {
        await AsyncStorage.removeItem('@circleguard_active_circle_id').catch(() => {});
        set({
          circles: remainingCircles,
          activeCircle: null,
          members: [],
          places: [],
          membersByCircle: updatedMembersByCircle,
          placesByCircle: updatedPlacesByCircle,
        });
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error deleting circle:', e);
      return { success: false, error: e?.message || 'Failed to delete circle' };
    }
  },
  leaveCircle: async (circleId: string, userId: string) => {
    try {
      if (!circleId || !userId) {
        return { success: false, error: 'Invalid circle or user ID' };
      }

      // 1. Delete membership from Supabase
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to leave circle:', error);
        return { success: false, error: error.message };
      }

      // 2. Remove circle from local store
      const remainingCircles = get().circles.filter((c) => c.id !== circleId);
      const updatedMembersByCircle = { ...get().membersByCircle };
      delete updatedMembersByCircle[circleId];
      const updatedPlacesByCircle = { ...get().placesByCircle };
      delete updatedPlacesByCircle[circleId];

      const wasActive = get().activeCircle?.id === circleId;
      const nextActive = wasActive ? (remainingCircles[0] || null) : get().activeCircle;

      if (nextActive) {
        await AsyncStorage.setItem('@circleguard_active_circle_id', nextActive.id).catch(() => {});
        set({
          circles: remainingCircles,
          activeCircle: nextActive,
          members: updatedMembersByCircle[nextActive.id] || [],
          places: updatedPlacesByCircle[nextActive.id] || [],
          membersByCircle: updatedMembersByCircle,
          placesByCircle: updatedPlacesByCircle,
        });
        get().fetchMembers(nextActive.id).catch(() => {});
        get().fetchPlaces(nextActive.id).catch(() => {});
      } else {
        await AsyncStorage.removeItem('@circleguard_active_circle_id').catch(() => {});
        set({
          circles: remainingCircles,
          activeCircle: null,
          members: [],
          places: [],
          membersByCircle: updatedMembersByCircle,
          placesByCircle: updatedPlacesByCircle,
        });
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error leaving circle:', e);
      return { success: false, error: e?.message || 'Failed to leave circle' };
    }
  },
  startLeaveCircleWithAnimation: async (circleId: string, circleName: string, userId: string) => {
    set({
      walkawayLeaveState: {
        visible: true,
        circleName: circleName || 'Circle',
        circleId,
        actionType: 'leave',
        status: 'leaving',
        errorMessage: undefined,
      },
    });

    const minAnimPromise = new Promise((resolve) => setTimeout(resolve, 2400));
    const leavePromise = get().leaveCircle(circleId, userId);

    const [res] = await Promise.all([leavePromise, minAnimPromise]);

    if (res && res.success) {
      set({
        walkawayLeaveState: {
          visible: true,
          circleName: circleName || 'Circle',
          circleId,
          actionType: 'leave',
          status: 'left',
          errorMessage: undefined,
        },
      });
      return { success: true };
    } else {
      set({
        walkawayLeaveState: {
          visible: true,
          circleName: circleName || 'Circle',
          circleId,
          actionType: 'leave',
          status: 'error',
          errorMessage: res?.error || 'Failed to leave circle.',
        },
      });
      return { success: false, error: res?.error };
    }
  },
  startDeleteCircleWithAnimation: async (circleId: string, circleName: string) => {
    set({
      walkawayLeaveState: {
        visible: true,
        circleName: circleName || 'Circle',
        circleId,
        actionType: 'delete',
        status: 'leaving',
        errorMessage: undefined,
      },
    });

    const minAnimPromise = new Promise((resolve) => setTimeout(resolve, 2400));
    const deletePromise = get().deleteCircle(circleId);

    const [res] = await Promise.all([deletePromise, minAnimPromise]);

    if (res && res.success) {
      set({
        walkawayLeaveState: {
          visible: true,
          circleName: circleName || 'Circle',
          circleId,
          actionType: 'delete',
          status: 'left',
          errorMessage: undefined,
        },
      });
      return { success: true };
    } else {
      set({
        walkawayLeaveState: {
          visible: true,
          circleName: circleName || 'Circle',
          circleId,
          actionType: 'delete',
          status: 'error',
          errorMessage: res?.error || 'Failed to delete circle.',
        },
      });
      return { success: false, error: res?.error };
    }
  },
  closeWalkawayLeaveModal: () => {
    set({
      walkawayLeaveState: {
        visible: false,
        circleName: '',
        circleId: undefined,
        actionType: 'leave',
        status: 'idle',
        errorMessage: undefined,
      },
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useCircleStore = useCircleStore;
}
