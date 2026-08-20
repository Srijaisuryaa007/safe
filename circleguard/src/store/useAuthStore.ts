import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_ghost_mode?: boolean;
  hide_online_presence?: boolean;
  is_premium?: boolean;
  created_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user || null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}));
