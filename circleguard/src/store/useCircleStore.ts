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
  assignMemberSupervisor: (circleId: string, memberId: string, supervisorId: string | null) => Promise<boolean>;
  resetCircleStore: () => void;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  activeCircle: null,
  circles: [],
  members: [],
  places: [],
  membersByCircle: {},
  placesByCircle: {},
  isLoading: false,
  circleFetched: false,
  isSwitchingCircle: false,
  switchingTargetName: null,
  switchingStepText: null,
  resetCircleStore: () => set({ activeCircle: null, circles: [], members: [], places: [], membersByCircle: {}, placesByCircle: {}, circleFetched: false, isLoading: false, isSwitchingCircle: false, switchingTargetName: null, switchingStepText: null }),
  switchActiveCircle: async (targetCircle: Circle) => {
    if (!targetCircle) return;
    const startTime = Date.now();

    // 1. Show the rotating globe loading animation immediately with initial status
    set({
      isSwitchingCircle: true,
      switchingTargetName: targetCircle.name,
      switchingStepText: 'Connecting satellite telemetry...',
    });

    // 2. Persist target selection in storage
    await AsyncStorage.setItem('@circleguard_active_circle_id', targetCircle.id).catch(() => {});

    // 3. Concurrently fetch fresh members and places for the target circle behind the globe
    const [fetchedMembers, fetchedPlaces] = await Promise.all([
      get().fetchMembers(targetCircle.id),
      get().fetchPlaces(targetCircle.id),
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
    const exists = currentCircles.some(c => c.id === targetCircle.id);
    const updatedCircles = exists ? currentCircles : [targetCircle, ...currentCircles];

    const finalMembers = (Array.isArray(fetchedMembers) && fetchedMembers.length > 0)
      ? fetchedMembers
      : (get().membersByCircle[targetCircle.id] || []);

    const finalPlaces = (Array.isArray(fetchedPlaces) && fetchedPlaces.length > 0)
      ? fetchedPlaces
      : (get().placesByCircle[targetCircle.id] || []);

    // 5. ATOMIC COMMIT: Commit fully synchronized circle, members, and places simultaneously
    set({
      activeCircle: targetCircle,
      circles: updatedCircles,
      members: finalMembers,
      places: finalPlaces,
      membersByCircle: {
        ...get().membersByCircle,
        [targetCircle.id]: finalMembers,
      },
      placesByCircle: {
        ...get().placesByCircle,
        [targetCircle.id]: finalPlaces,
      },
      isSwitchingCircle: false,
      switchingTargetName: null,
      switchingStepText: null,
      circleFetched: true,
    });
  },
  setActiveCircle: (activeCircle) => {
    if (activeCircle) {
      AsyncStorage.setItem('@circleguard_active_circle_id', activeCircle.id).catch(() => {});
      const currentCircles = get().circles;
      const exists = currentCircles.some(c => c.id === activeCircle.id);
      const updatedCircles = exists ? currentCircles : [activeCircle, ...currentCircles];

      // INSTANT ISOLATION:
      // Pull cached members and places for THIS exact circle ID immediately!
      const cachedMembers = get().membersByCircle[activeCircle.id];
      const cachedPlaces = get().placesByCircle[activeCircle.id];

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
    await AsyncStorage.setItem('@circleguard_active_circle_id', newCircle.id);

    // Initial member for newly created circle is creator
    const selfProfile = useAuthStore.getState().profile;
    const initialMembers: CircleMember[] = selfProfile?.id ? [{
      circle_id: newCircle.id,
      user_id: selfProfile.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
      profile: selfProfile,
      isOnline: true,
      lastSeenText: 'Online now',
    }] : [];

    const updatedMembersCache = { ...get().membersByCircle, [newCircle.id]: initialMembers };

    set({
      activeCircle: newCircle,
      circles: updatedCircles,
      members: initialMembers,
      places: [],
      membersByCircle: updatedMembersCache,
      circleFetched: true,
    });

    await Promise.all([
      get().fetchMembers(newCircle.id),
      get().fetchPlaces(newCircle.id),
    ]);
    if (userId) {
      get().fetchUserCircles(userId).catch(() => {});
    }
  },
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
          .select('circle_id, user_id, role, supervisor_id, joined_at, profiles(full_name, avatar_url, phone)')
          .eq('circle_id', circleId);

        if (!res2.error && res2.data) {
          membersData = res2.data;
        } else {
          // Tier 3: Direct fallback without relational join if PostgREST join syntax fails
          const { data: rawCmRows, error: cmErr } = await supabase
            .from('circle_members')
            .select('circle_id, user_id, role, supervisor_id, joined_at')
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

        // Query location_history fallback for any members without active locations row
        const missingUserIds = userIds.filter(uid => !locationsMap[uid]?.latitude || !locationsMap[uid]?.longitude);
        if (missingUserIds.length > 0) {
          for (const mId of missingUserIds) {
            try {
              const { data: histData } = await supabase
                .from('location_history')
                .select('user_id, geom, speed_mps, recorded_at')
                .eq('user_id', mId)
                .order('recorded_at', { ascending: false })
                .limit(1);

              if (histData && histData.length > 0) {
                const pt = parsePoint(histData[0]);
                if (pt.latitude !== 0 && pt.longitude !== 0) {
                  locationsMap[mId] = {
                    updated_at: histData[0].recorded_at,
                    latitude: pt.latitude,
                    longitude: pt.longitude,
                  };
                }
              }
            } catch(e) {}
          }
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

      const updatedMembersByCircle = {
        ...get().membersByCircle,
        [circleId]: formattedMembers,
      };

      // RACE CONDITION DEFENSE:
      // Only set active members if this circle is still the active circle!
      if (get().activeCircle?.id === circleId) {
        set({ members: formattedMembers, membersByCircle: updatedMembersByCircle });
      } else {
        set({ membersByCircle: updatedMembersByCircle });
      }

      return formattedMembers;
    } catch (err) {
      console.error('Error fetching members:', err);
      return [];
    }
  },
  fetchUserCircles: async (userId: string) => {
    if (!userId) return [];
    try {
      let allCircles: Circle[] = [];
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
      } else {
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
          }
        }
      }

      if (allCircles.length > 0) {
        const currentActive = get().activeCircle;
        const savedId = await AsyncStorage.getItem('@circleguard_active_circle_id');

        // STRICT PRESERVATION:
        // 1. If currently selected activeCircle is in allCircles, ALWAYS keep it!
        // 2. Else if saved ID from AsyncStorage is in allCircles, keep it!
        // 3. Only if neither exists, fall back to allCircles[0].
        let activeToKeep = currentActive ? allCircles.find(c => c.id === currentActive.id) : null;
        if (!activeToKeep && savedId) {
          activeToKeep = allCircles.find(c => c.id === savedId) || null;
        }
        if (!activeToKeep) {
          activeToKeep = allCircles[0];
        }

        if (activeToKeep) {
          AsyncStorage.setItem('@circleguard_active_circle_id', activeToKeep.id).catch(() => {});
        }

        set({ circles: allCircles, activeCircle: activeToKeep, circleFetched: true });
        return allCircles;
      }
      return [];
    } catch (e) {
      console.warn('fetchUserCircles error:', e);
      return [];
    }
  },
  fetchActiveCircle: async (userId: string) => {
    if (!userId) return null;
    
    // If active circle is ALREADY active, refresh its members and DO NOT switch!
    const existingActive = get().activeCircle;
    if (existingActive) {
      await get().fetchMembers(existingActive.id);
      get().fetchUserCircles(userId).catch(() => {});
      return existingActive;
    }

    set({ isLoading: true });
    try {
      const allCircles = await get().fetchUserCircles(userId);
      if (allCircles.length > 0) {
        const active = get().activeCircle;
        if (active) {
          await get().fetchMembers(active.id);
          return active;
        }
      }
      set({ activeCircle: null, circles: [], members: [], circleFetched: true });
      return null;
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

      const placeIds = (data || []).map(p => p.id);
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
          target_user_id: item.target_user_id || null,
          assigned_user_ids: memberMap[item.id] || (item.target_user_id ? [item.target_user_id] : []),
          created_at: item.created_at,
        };
      }).filter(p => p.latitude !== 0 && p.longitude !== 0);

      const updatedPlacesByCircle = {
        ...get().placesByCircle,
        [circleId]: formatted,
      };

      // RACE CONDITION DEFENSE:
      // Only set active places if this circle is still the active circle!
      if (get().activeCircle?.id === circleId) {
        set({ places: formatted, placesByCircle: updatedPlacesByCircle });
      } else {
        set({ placesByCircle: updatedPlacesByCircle });
      }
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
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      if (error) {
        console.warn('Remove member notice:', error.message);
      }

      // 4. Also clean up any place memberships and targeted location shares
      try {
        await supabase.from('place_members').delete().eq('user_id', userId);
        await supabase.from('location_shares').delete().eq('target_user_id', userId);
      } catch (e) {}

      return true;
    } catch (e) {
      console.error('Error removing member from store:', e);
      return false;
    }
  },
}));
