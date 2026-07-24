import { create } from 'zustand';

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
  };
}

interface CircleState {
  activeCircle: Circle | null;
  members: CircleMember[];
  isLoading: boolean;
  setActiveCircle: (circle: Circle | null) => void;
  setMembers: (members: CircleMember[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useCircleStore = create<CircleState>((set) => ({
  activeCircle: null,
  members: [],
  isLoading: false,
  setActiveCircle: (activeCircle) => set({ activeCircle }),
  setMembers: (members) => set({ members }),
  setLoading: (isLoading) => set({ isLoading }),
}));
