import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { BalanceInfo, Utxo, TxRecord } from '../bridge/types';

interface WalletState {
  // Persisted in SecureStore
  seedHex: string | null;
  wif: string | null;
  rpcUrl: string;
  authToken: string | undefined;
  extraPeer: string | undefined;

  // Derived / in-memory
  address: string | null;
  addressIndex: number;
  balance: BalanceInfo | null;
  utxos: Utxo[];
  history: TxRecord[];

  // Actions
  setSeedHex: (seed: string) => Promise<void>;
  setWif: (w: string) => Promise<void>;
  setAddress: (addr: string) => void;
  setAddressIndex: (idx: number) => void;
  setBalance: (b: BalanceInfo) => void;
  setUtxos: (u: Utxo[]) => void;
  setHistory: (h: TxRecord[]) => void;
  setRpcUrl: (url: string) => void;
  setAuthToken: (token: string | undefined) => void;
  setExtraPeer: (peer: string | undefined) => void;
  loadFromStorage: () => Promise<void>;
  clear: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  seedHex: null,
  wif: null,
  address: null,
  addressIndex: 0,
  rpcUrl: 'http://127.0.0.1:38300',
  authToken: undefined,
  extraPeer: undefined,
  balance: null,
  utxos: [],
  history: [],

  async setSeedHex(seed) {
    await SecureStore.setItemAsync('seed_hex', seed);
    set({ seedHex: seed });
  },

  async setWif(w) {
    await SecureStore.setItemAsync('wif_key', w);
    set({ wif: w });
  },

  setAddress: (addr) => set({ address: addr }),
  setAddressIndex: (idx) => set({ addressIndex: idx }),
  setBalance: (b) => set({ balance: b }),
  setUtxos: (u) => set({ utxos: u }),
  setHistory: (h) => set({ history: h }),

  setRpcUrl: (url) => {
    SecureStore.setItemAsync('rpc_url', url).catch(() => {});
    set({ rpcUrl: url });
  },

  setAuthToken: (token) => {
    if (token) SecureStore.setItemAsync('auth_token', token).catch(() => {});
    else SecureStore.deleteItemAsync('auth_token').catch(() => {});
    set({ authToken: token });
  },

  setExtraPeer: (peer) => {
    if (peer) SecureStore.setItemAsync('extra_peer', peer).catch(() => {});
    else SecureStore.deleteItemAsync('extra_peer').catch(() => {});
    set({ extraPeer: peer });
  },

  async loadFromStorage() {
    try {
      const [seed, wif, rpc, auth, peer] = await Promise.all([
        SecureStore.getItemAsync('seed_hex'),
        SecureStore.getItemAsync('wif_key'),
        SecureStore.getItemAsync('rpc_url'),
        SecureStore.getItemAsync('auth_token'),
        SecureStore.getItemAsync('extra_peer'),
      ]);
      set({
        seedHex: seed ?? null,
        wif: wif ?? null,
        rpcUrl: rpc ?? 'http://127.0.0.1:38300',
        authToken: auth ?? undefined,
        extraPeer: peer ?? undefined,
      });
    } catch {
      // Keychain unavailable (Expo Go first boot, permissions, etc.) — start with safe defaults
      set({ seedHex: null, wif: null, rpcUrl: 'http://127.0.0.1:38300' });
    }
  },

  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync('seed_hex'),
      SecureStore.deleteItemAsync('wif_key'),
      SecureStore.deleteItemAsync('rpc_url'),
      SecureStore.deleteItemAsync('auth_token'),
      SecureStore.deleteItemAsync('extra_peer'),
    ]);
    set({
      seedHex: null, wif: null, address: null, addressIndex: 0,
      authToken: undefined, extraPeer: undefined,
      balance: null, utxos: [], history: [],
    });
  },
}));
