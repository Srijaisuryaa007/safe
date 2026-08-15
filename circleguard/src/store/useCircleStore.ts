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
}

interface CircleState {
  activeCircle: Circle | null;
  circles: Circle[];
  members: CircleMember[];
  isLoading: boolean;
  circleFetched: boolean;
  setActiveCircle: (circle: Circle | null) => void;
  setMembers: (members: CircleMember[]) => void;
  setLoading: (isLoading: boolean) => void;
  fetchActiveCircle: (userId: string) => Promise<Circle | null>;
  fetchMembers: (circleId: string) => Promise<CircleMember[]>;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  activeCircle: null,
  circles: [],
  members: [],
  isLoading: false,
  circleFetched: false,
  setActiveCircle: (activeCircle) => set({ activeCircle, circleFetched: true }),
  setMembers: (members) => set({ members }),
  setLoading: (isLoading) => set({ isLoading }),
  fetchMembers: async (circleId: string) => {
    if (!circleId) return [];
    try {
      let membersData: any[] | null = null;

      // Tier 1: Attempt query with privacy columns
      const res1 = await supabase
        .from('circle_members')
        .select('circle_id, user_id, role, joined_at, profiles(full_name, avatar_url, phone, is_ghost_mode, hide_online_presence)')
        .eq('circle_id', circleId);

      if (!res1.error && res1.data) {
        membersData = res1.data;
      } else {
        // Tier 2: Fallback query for core columns
        const res2 = await supabase
          .from('circle_members')
          .select('circle_id, user_id, role, joined_at, profiles(full_name, avatar_url, phone)')
          .eq('circle_id', circleId);

        if (res2.error) throw res2.error;
        membersData = res2.data;
      }

      const userIds = (membersData || []).map(m => m.user_id);
      let locationsMap: Record<string, { updated_at: string; battery_pct?: number; is_driving?: boolean }> = {};

      if (userIds.length > 0) {
        const { data: locData } = await supabase
          .from('locations')
          .select('user_id, updated_at, battery_pct, is_driving')
          .in('user_id', userIds);

        if (locData) {
          locData.forEach(l => {
            locationsMap[l.user_id] = {
              updated_at: l.updated_at,
              battery_pct: l.battery_pct,
              is_driving: l.is_driving,
            };
          });
        }
      }

      const now = Date.now();
      const currentUserId = useAuthStore.getState().profile?.id;

      // Read local privacy settings from AsyncStorage for instant reactive sync
      const localHideOnline = (await AsyncStorage.getItem('@circleguard_hide_online')) === 'true';
      const localGhostMode = (await AsyncStorage.getItem('@circleguard_ghost_mode')) === 'true';

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
          // Logged-in active app user is online when privacy settings are off
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

        return {
          circle_id: m.circle_id,
          user_id: m.user_id,
          role: m.role as 'owner' | 'co_leader' | 'guardian' | 'member',
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
      const { data: memberData, error: memberError } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles(*)')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const allCircles: Circle[] = memberData
          .map(m => {
            let c = m.circles as unknown as Circle;
            if (Array.isArray(c)) c = c[0];
            return c;
          })
          .filter(Boolean);

        let circle = allCircles[0];

        set({ activeCircle: circle, circles: allCircles, circleFetched: true });
        await get().fetchMembers(circle.id);
        return circle;
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
}));
