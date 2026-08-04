import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    phone?: string | null;
  };
  isOnline?: boolean;
  lastSeenText?: string;
  batteryPct?: number;
  isDriving?: boolean;
}

interface CircleState {
  activeCircle: Circle | null;
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
  members: [],
  isLoading: false,
  circleFetched: false,
  setActiveCircle: (activeCircle) => set({ activeCircle, circleFetched: true }),
  setMembers: (members) => set({ members }),
  setLoading: (isLoading) => set({ isLoading }),
  fetchMembers: async (circleId: string) => {
    if (!circleId) return [];
    try {
      const { data: membersData, error } = await supabase
        .from('circle_members')
        .select('circle_id, user_id, role, joined_at, profiles(full_name, avatar_url, phone)')
        .eq('circle_id', circleId);

      if (error) throw error;

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
      const formattedMembers: CircleMember[] = (membersData || []).map(m => {
        let prof = m.profiles as any;
        if (Array.isArray(prof)) prof = prof[0];
        
        const loc = locationsMap[m.user_id];
        let isOnline = false;
        let lastSeenText = 'Offline';

        if (loc?.updated_at) {
          const diffMs = now - new Date(loc.updated_at).getTime();
          // If updated within 2 minutes (120,000 ms), member is considered ONLINE
          if (diffMs <= 120000) {
            isOnline = true;
            lastSeenText = 'Online';
          } else {
            const mins = Math.floor(diffMs / 60000);
            if (mins < 60) {
              lastSeenText = `Last seen ${mins}m ago`;
            } else {
              const hours = Math.floor(mins / 60);
              lastSeenText = `Last seen ${hours}h ago`;
            }
          }
        }

        return {
          circle_id: m.circle_id,
          user_id: m.user_id,
          role: m.role as 'owner' | 'member',
          joined_at: m.joined_at,
          profile: prof || { full_name: 'Member', avatar_url: null },
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
        let circle = memberData[0].circles as unknown as Circle;
        if (Array.isArray(circle)) {
          circle = circle[0];
        }

        set({ activeCircle: circle, circleFetched: true });
        await get().fetchMembers(circle.id);
        return circle;
      } else {
        set({ activeCircle: null, members: [], circleFetched: true });
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
