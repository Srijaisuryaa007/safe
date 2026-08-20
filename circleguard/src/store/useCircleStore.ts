import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  tracking_mode?: string;
  created_at: string;
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
  };
  isOnline?: boolean;
  lastSeenText?: string;
  batteryPct?: number;
  isDriving?: boolean;
  latitude?: number;
  longitude?: number;
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
  const dLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat);
  const dLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng);
  if (!isNaN(dLat) && !isNaN(dLng) && Math.abs(dLat) <= 90 && Math.abs(dLng) <= 180 && (dLat !== 0 || dLng !== 0)) {
    return { latitude: dLat, longitude: dLng };
  }
  if (item.geom) {
    if (typeof item.geom === 'string') {
      const clean = item.geom.trim();
      if (clean.startsWith('01') || clean.startsWith('00')) {
        const parsed = parseEWKB(clean);
        if (parsed) return parsed;
      }
      const matches = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (matches && matches.length >= 3) {
        const v1 = parseFloat(matches[1]);
        const v2 = parseFloat(matches[2]);
        if (Math.abs(v1) > 90) {
          return { latitude: v2, longitude: v1 };
        } else if (Math.abs(v2) > 90) {
          return { latitude: v1, longitude: v2 };
        } else {
          return { latitude: v2, longitude: v1 };
        }
      }
    } else if (typeof item.geom === 'object') {
      if (Array.isArray(item.geom.coordinates) && item.geom.coordinates.length >= 2) {
        const c0 = parseFloat(item.geom.coordinates[0]);
        const c1 = parseFloat(item.geom.coordinates[1]);
        if (Math.abs(c0) > 90) {
          return { latitude: c1, longitude: c0 };
        } else {
          return { latitude: c0, longitude: c1 };
        }
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
  isLoading: boolean;
  circleFetched: boolean;
  setActiveCircle: (circle: Circle | null) => void;
  setMembers: (members: CircleMember[]) => void;
  setPlaces: (places: Place[]) => void;
  setLoading: (isLoading: boolean) => void;
  fetchActiveCircle: (userId: string) => Promise<Circle | null>;
  fetchMembers: (circleId: string) => Promise<CircleMember[]>;
  fetchPlaces: (circleId: string) => Promise<Place[]>;
  deletePlace: (placeId: string) => Promise<boolean>;
  assignMemberSupervisor: (circleId: string, memberId: string, supervisorId: string | null) => Promise<boolean>;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  activeCircle: null,
  circles: [],
  members: [],
  places: [],
  isLoading: false,
  circleFetched: false,
  setActiveCircle: (activeCircle) => set({ activeCircle, circleFetched: true }),
  setMembers: (members) => set({ members }),
  setPlaces: (places) => set({ places }),
  setLoading: (isLoading) => set({ isLoading }),
  fetchMembers: async (circleId: string) => {
    if (!circleId) return [];
    try {
      let membersData: any[] | null = null;

      // Tier 1: Attempt query with privacy and supervisor columns
      const res1 = await supabase
        .from('circle_members')
        .select('circle_id, user_id, role, supervisor_id, joined_at, profiles(full_name, avatar_url, phone, is_ghost_mode, hide_online_presence)')
        .eq('circle_id', circleId);

      if (!res1.error && res1.data) {
        membersData = res1.data;
      } else {
        // Tier 2: Fallback query for core columns
        const res2 = await supabase
          .from('circle_members')
          .select('circle_id, user_id, role, joined_at, profiles(full_name, avatar_url, phone)')
          .eq('circle_id', circleId);

        if (!res2.error && res2.data) {
          membersData = res2.data;
        } else {
          // Tier 3: Direct fallback without relational join if PostgREST join syntax fails
          const { data: rawCmRows, error: cmErr } = await supabase
            .from('circle_members')
            .select('circle_id, user_id, role, joined_at')
            .eq('circle_id', circleId);

          if (cmErr) throw cmErr;
          
          if (rawCmRows && rawCmRows.length > 0) {
            const memberIds = rawCmRows.map(cm => cm.user_id);
            const { data: profRows } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, phone, is_ghost_mode, hide_online_presence')
              .in('id', memberIds);

            const profMap = new Map<string, any>();
            (profRows || []).forEach(p => profMap.set(p.id, p));

            membersData = rawCmRows.map(cm => ({
              ...cm,
              profiles: profMap.get(cm.user_id) || { full_name: 'Circle Member', avatar_url: null }
            }));
          } else {
            membersData = [];
          }
        }
      }

      const userIds = (membersData || []).map(m => m.user_id);
      let locationsMap: Record<string, { updated_at: string; battery_pct?: number; is_driving?: boolean; latitude?: number; longitude?: number }> = {};

      if (userIds.length > 0) {
        const { data: locData } = await supabase
          .from('locations')
          .select('user_id, geom, latitude, longitude, updated_at, battery_pct, is_driving')
          .in('user_id', userIds);

        if (locData) {
          locData.forEach(l => {
            const pt = parsePoint(l);
            locationsMap[l.user_id] = {
              updated_at: l.updated_at,
              battery_pct: l.battery_pct,
              is_driving: l.is_driving,
              latitude: pt.latitude !== 0 ? pt.latitude : undefined,
              longitude: pt.longitude !== 0 ? pt.longitude : undefined,
            };
          });
        }
      }

      const now = Date.now();
      const currentUserId = useAuthStore.getState().profile?.id;

      // Read local privacy settings from AsyncStorage for instant reactive sync
      const localHideOnline = (await AsyncStorage.getItem('@circleguard_hide_online')) === 'true';
      const localGhostMode = (await AsyncStorage.getItem('@circleguard_ghost_mode')) === 'true';

      // Read local tree hierarchy cache
      let localHierarchyMap: Record<string, string | null> = {};
      try {
        const cachedTreeStr = await AsyncStorage.getItem(`@circleguard_tree_hierarchy_${circleId}`);
        if (cachedTreeStr) localHierarchyMap = JSON.parse(cachedTreeStr);
      } catch (e) {}

      const formattedMembers: CircleMember[] = (membersData || []).map(m => {
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
          lastSeenText = 'Offline • No location data';
        }

        const effectiveSupervisorId = m.supervisor_id !== undefined && m.supervisor_id !== null
          ? m.supervisor_id
          : (localHierarchyMap[m.user_id] ?? null);

        return {
          circle_id: m.circle_id,
          user_id: m.user_id,
          role: m.role as 'owner' | 'co_leader' | 'guardian' | 'member',
          supervisor_id: effectiveSupervisorId,
          joined_at: m.joined_at,
          profile: prof ? {
            ...prof,
            is_ghost_mode: isGhost,
            hide_online_presence: hideOnline,
          } : { full_name: 'Member', avatar_url: null, is_ghost_mode: isGhost, hide_online_presence: hideOnline },
          isOnline,
          lastSeenText,
          batteryPct: loc?.battery_pct,
          isDriving: loc?.is_driving,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        };
      });

      set({ members: formattedMembers });
      return formattedMembers;
    } catch (err) {
      console.error('Error fetching members:', err);
      return [];
    }
  },
  fetchActiveCircle: async (userId: string) => {
    if (!userId) return null;
    set({ isLoading: true });
    try {
      let circleObj: Circle | null = null;
      let allCircles: Circle[] = [];

      // Tier 1: Relational join query
      const { data: memberData, error: memberError } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles(*)')
        .eq('user_id', userId);

      if (!memberError && memberData && memberData.length > 0) {
        allCircles = memberData
          .map(m => {
            let c = m.circles as unknown as Circle;
            if (Array.isArray(c)) c = c[0];
            return c;
          })
          .filter(Boolean);
        if (allCircles.length > 0) circleObj = allCircles[0];
      } else {
        // Tier 2: Direct fallback without relational join
        const { data: cmRows } = await supabase
          .from('circle_members')
          .select('circle_id, role')
          .eq('user_id', userId);

        if (cmRows && cmRows.length > 0) {
          const circleIds = cmRows.map(c => c.circle_id);
          const { data: circleRows } = await supabase
            .from('circles')
            .select('*')
            .in('id', circleIds);

          if (circleRows && circleRows.length > 0) {
            allCircles = circleRows as Circle[];
            circleObj = allCircles[0];
          }
        }
      }

      if (circleObj) {
        set({ activeCircle: circleObj, circles: allCircles, circleFetched: true });
        await get().fetchMembers(circleObj.id);
        return circleObj;
      } else {
        set({ activeCircle: null, circles: [], members: [], circleFetched: true });
        return null;
      }
    } catch (err) {
      console.error('Error fetching active circle:', err);
      set({ circleFetched: true });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  assignMemberSupervisor: async (circleId: string, memberId: string, supervisorId: string | null) => {
    try {
      // 1. Optimistic state update for 0ms visual re-branching
      const current = get().members;
      const updated = current.map(m => m.user_id === memberId ? { ...m, supervisor_id: supervisorId } : m);
      set({ members: updated });

      // 2. Persist to AsyncStorage for permanent retention
      try {
        const hierarchyMap: Record<string, string | null> = {};
        updated.forEach(m => {
          hierarchyMap[m.user_id] = m.supervisor_id ?? null;
        });
        await AsyncStorage.setItem(`@circleguard_tree_hierarchy_${circleId}`, JSON.stringify(hierarchyMap));
      } catch (e) {}

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
  fetchPlaces: async (circleId: string) => {
    if (!circleId) return [];
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('circle_id', circleId);

      if (error) throw error;

      const formatted: Place[] = (data || []).map(item => {
        const pt = parsePoint(item);
        const radiusNum = parseFloat(item.radius_m || item.radius || 150);
        return {
          id: item.id,
          circle_id: item.circle_id,
          name: item.name,
          category: item.category || 'home',
          radius_m: isNaN(radiusNum) || radiusNum <= 0 ? 150 : radiusNum,
          latitude: pt.latitude,
          longitude: pt.longitude,
          start_lat: item.start_lat,
          start_lng: item.start_lng,
          end_lat: item.end_lat,
          end_lng: item.end_lng,
          created_at: item.created_at,
        };
      }).filter(p => p.latitude !== 0 && p.longitude !== 0);

      set({ places: formatted });
      return formatted;
    } catch (e) {
      console.warn('Error fetching circle places:', e);
      return [];
    }
  },
  deletePlace: async (placeId: string) => {
    try {
      // 1. Optimistic instant removal from global state with 0ms lag
      const current = get().places;
      set({ places: current.filter(p => p.id !== placeId) });

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
}));
