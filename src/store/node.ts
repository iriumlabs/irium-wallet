import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NodeStatus } from '../bridge/types';

// Non-sensitive sync / peer state. syncedHeight is persisted so the light
// client can resume from a checkpoint instead of syncing from genesis.

interface NodeState {
  nodeStatus: NodeStatus | null;
  syncedHeight: number;
  peerCount: number;
  isSyncing: boolean;
  feeRate: number;
  lastRefresh: number;

  setNodeStatus: (s: NodeStatus) => void;
  setSyncedHeight: (h: number) => void;
  setPeerCount: (n: number) => void;
  setIsSyncing: (v: boolean) => void;
  setFeeRate: (r: number) => void;
  touchRefresh: () => void;
  loadSyncedHeight: () => Promise<void>;
}

const SYNCED_HEIGHT_KEY = 'synced_height';

export const useNodeStore = create<NodeState>((set) => ({
  nodeStatus: null,
  syncedHeight: 0,
  peerCount: 0,
  isSyncing: false,
  feeRate: 10,
  lastRefresh: 0,

  setNodeStatus: (s) => set({ nodeStatus: s }),

  setSyncedHeight: (h) => {
    AsyncStorage.setItem(SYNCED_HEIGHT_KEY, String(h)).catch(() => {});
    set({ syncedHeight: h });
  },

  setPeerCount: (n) => set({ peerCount: n }),
  setIsSyncing: (v) => set({ isSyncing: v }),
  setFeeRate: (r) => set({ feeRate: r }),
  touchRefresh: () => set({ lastRefresh: Date.now() }),

  async loadSyncedHeight() {
    try {
      const val = await AsyncStorage.getItem(SYNCED_HEIGHT_KEY);
      if (val) set({ syncedHeight: parseInt(val, 10) });
    } catch {}
  },
}));
