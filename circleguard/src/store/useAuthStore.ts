import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_SESSION_STORAGE_KEY = '@circleguard_auth_session';
export const CACHED_PROFILE_STORAGE_KEY = '@circleguard_cached_profile';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_ghost_mode?: boolean;
  hide_online_presence?: boolean;
  is_premium?: boolean;
  medical_info?: any;
  emergency_contacts?: any;
  created_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileFetching: boolean;
  initAuth: () => Promise<{ cachedSession: Session | null; cachedProfile: Profile | null }>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  setProfileFetching: (isProfileFetching: boolean) => void;
  resetAuthStore: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileFetching: false,

  initAuth: async () => {
    try {
      const [sessionStr, profileStr] = await Promise.all([
        AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY),
        AsyncStorage.getItem(CACHED_PROFILE_STORAGE_KEY),
      ]);

      let cachedSession: Session | null = null;
      let cachedProfile: Profile | null = null;

      if (sessionStr) {
        try {
          cachedSession = JSON.parse(sessionStr);
        } catch (e) {
          console.warn('[useAuthStore] Failed to parse cached session JSON', e);
        }
      }

      if (profileStr) {
        try {
          cachedProfile = JSON.parse(profileStr);
        } catch (e) {
          console.warn('[useAuthStore] Failed to parse cached profile JSON', e);
        }
      }

      // If cached session exists, hydrate immediately for instant cold-boot readiness
      if (cachedSession) {
        set({
          session: cachedSession,
          user: cachedSession.user || null,
          profile: cachedProfile || get().profile,
          isLoading: false,
        });
      } else if (cachedProfile) {
        set({ profile: cachedProfile, isLoading: false });
      } else {
        set({ isLoading: false });
      }

      return { cachedSession, cachedProfile };
    } catch (e) {
      console.warn('[useAuthStore] initAuth AsyncStorage error:', e);
      set({ isLoading: false });
      return { cachedSession: null, cachedProfile: null };
    }
  },

  setSession: (session) => {
    set({ session, user: session?.user || null });
    if (session) {
      AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session)).catch(() => {});
    } else {
      AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY).catch(() => {});
    }
  },

  setProfile: (profile) => {
    set({ profile });
    if (profile) {
      AsyncStorage.setItem(CACHED_PROFILE_STORAGE_KEY, JSON.stringify(profile)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CACHED_PROFILE_STORAGE_KEY).catch(() => {});
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setProfileFetching: (isProfileFetching) => set({ isProfileFetching }),

  resetAuthStore: () => {
    set({ session: null, user: null, profile: null, isLoading: false, isProfileFetching: false });
    AsyncStorage.multiRemove([AUTH_SESSION_STORAGE_KEY, CACHED_PROFILE_STORAGE_KEY]).catch(() => {});
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAuthStore = useAuthStore;
}
