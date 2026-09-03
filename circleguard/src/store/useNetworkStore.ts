import { create } from 'zustand';

export type NetworkState = 'good' | 'slow' | 'offline';

interface NetworkStoreState {
  networkState: NetworkState;
  latencyMs: number | null;
  setNetworkState: (state: NetworkState, latency?: number | null) => void;
}

export const useNetworkStore = create<NetworkStoreState>((set) => ({
  networkState: 'good',
  latencyMs: null,
  setNetworkState: (networkState, latencyMs = null) => set({ networkState, latencyMs }),
}));
