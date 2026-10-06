import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_SESSION_STORAGE_KEY = '@circleguard_auth_session';
export const CACHED_PROFILE_STORAGE_KEY = '@circleguard_cached_profile';

export interface MedicalInfo {
  user_id?: string;
  blood_type?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
  notes?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface EmergencyContactItem {
  id: string;
  user_id?: string;
  name: string;
  phone: string;
  relationship: string;
  sort_order?: number;
  updated_at?: string;
  [key: string]: any;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_ghost_mode?: boolean;
  hide_online_presence?: boolean;
  gps_frequency?: 'high' | 'balanced' | 'saver' | string;
  shake_sos_enabled?: boolean;
  app_lock_enabled?: boolean;
  is_premium?: boolean;
  medical_info?: MedicalInfo | null;
  emergency_contacts?: EmergencyContactItem[] | null;
  created_at: string;
  [key: string]: any;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileFetching: boolean;
  isPasswordRecovery: boolean;
  initAuth: () => Promise<{ cachedSession: Session | null; cachedProfile: Profile | null }>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  updateProfileFields: (partial: Partial<Profile>) => void;
  setLoading: (isLoading: boolean) => void;
  setProfileFetching: (isProfileFetching: boolean) => void;
  setPasswordRecovery: (isPasswordRecovery: boolean) => void;
  resetAuthStore: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileFetching: false,
  isPasswordRecovery: false,

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

  setProfile: (incomingProfile) => {
    set((state) => {
      if (!incomingProfile) {
        AsyncStorage.removeItem(CACHED_PROFILE_STORAGE_KEY).catch(() => {});
        return { profile: null };
      }

      // Safe field-by-field merge: never let an incoming null/empty field wipe existing non-empty medical or emergency contacts
      const prev = state.profile;
      const mergedProfile: Profile = {
        ...(prev || {}),
        ...incomingProfile,
        medical_info: incomingProfile.medical_info !== undefined && incomingProfile.medical_info !== null
          ? incomingProfile.medical_info
          : (prev?.medical_info ?? null),
        emergency_contacts: (incomingProfile.emergency_contacts && incomingProfile.emergency_contacts.length > 0)
          ? incomingProfile.emergency_contacts
          : (prev?.emergency_contacts ?? []),
      };

      AsyncStorage.setItem(CACHED_PROFILE_STORAGE_KEY, JSON.stringify(mergedProfile)).catch(() => {});
      return { profile: mergedProfile };
    });
  },

  updateProfileFields: (partial) => {
    set((state) => {
      if (!state.profile) return {};
      const updated: Profile = {
        ...state.profile,
        ...partial,
        medical_info: partial.medical_info !== undefined ? partial.medical_info : state.profile.medical_info,
        emergency_contacts: partial.emergency_contacts !== undefined ? partial.emergency_contacts : state.profile.emergency_contacts,
      };
      AsyncStorage.setItem(CACHED_PROFILE_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return { profile: updated };
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setProfileFetching: (isProfileFetching) => set({ isProfileFetching }),
  setPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),

  resetAuthStore: () => {
    const currentUserId = get().profile?.id;
    set({ session: null, user: null, profile: null, isLoading: false, isProfileFetching: false, isPasswordRecovery: false });
    const keysToRemove = [
      AUTH_SESSION_STORAGE_KEY,
      CACHED_PROFILE_STORAGE_KEY,
      '@circleguard_emergency_contacts',
      '@circleguard_primary_emergency_contact',
      '@circleguard_medical_info_active',
      '@circleguard_medical_info_guest',
    ];
    if (currentUserId) {
      keysToRemove.push(
        `@circleguard_emergency_contacts_${currentUserId}`,
        `@circleguard_primary_emergency_contact_${currentUserId}`,
        `@circleguard_primary_contact_${currentUserId}`,
        `@circleguard_medical_info_${currentUserId}`,
        `@circleguard_pending_medical_${currentUserId}`,
        `@circleguard_pending_contacts_${currentUserId}`
      );
    }
    AsyncStorage.multiRemove(keysToRemove).catch(() => {});
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__useAuthStore = useAuthStore;
}
