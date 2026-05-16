import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SettlementTemplate = 'otc' | 'simple-settlement';
export type SettlementStep = 'template' | 'params' | 'review' | 'fund' | 'status';
export type AgreementStatus = 'draft' | 'funded' | 'complete' | 'expired';
export type AgreementRole = 'payer' | 'payee';

export interface SavedAgreement {
  id: string;
  template: SettlementTemplate;
  role: AgreementRole;
  myAddress: string;
  counterpartyAddress: string;
  amountSats: number;
  timeoutHeight: number;
  secretHashHex: string;
  htlcScriptHex: string | null;
  fundingTxid: string | null;
  status: AgreementStatus;
  paymentReference: string;
  createdAt: number;
}

interface SettlementState {
  // Saved agreements list (persisted)
  agreements: SavedAgreement[];

  // Active wizard state (in-memory)
  template: SettlementTemplate | null;
  step: SettlementStep;
  role: AgreementRole;
  payerAddress: string;
  payeeAddress: string;
  amountSats: number;
  timeoutHeight: number;
  secretHashHex: string;
  paymentReference: string;
  agreementJson: string | null;
  htlcScriptHex: string | null;
  fundingTxid: string | null;

  // Actions
  addAgreement: (a: SavedAgreement) => void;
  updateAgreementStatus: (id: string, status: AgreementStatus, fundingTxid?: string) => void;
  setTemplate: (t: SettlementTemplate) => void;
  setStep: (s: SettlementStep) => void;
  setField: <K extends keyof SettlementState>(k: K, v: SettlementState[K]) => void;
  reset: () => void;
  loadAgreements: () => Promise<void>;
}

const AGREEMENTS_KEY = 'settlement_agreements';

const INIT_WIZARD = {
  template: null as SettlementTemplate | null,
  step: 'template' as SettlementStep,
  role: 'payer' as AgreementRole,
  payerAddress: '',
  payeeAddress: '',
  amountSats: 0,
  timeoutHeight: 0,
  secretHashHex: '',
  paymentReference: '',
  agreementJson: null as string | null,
  htlcScriptHex: null as string | null,
  fundingTxid: null as string | null,
};

export const useSettlementStore = create<SettlementState>((set, get) => ({
  agreements: [],
  ...INIT_WIZARD,

  addAgreement: (a) => {
    const next = [...get().agreements, a];
    set({ agreements: next });
    AsyncStorage.setItem(AGREEMENTS_KEY, JSON.stringify(next)).catch(() => {});
  },

  updateAgreementStatus: (id, status, fundingTxid) => {
    const next = get().agreements.map((a) =>
      a.id === id ? { ...a, status, fundingTxid: fundingTxid ?? a.fundingTxid } : a,
    );
    set({ agreements: next });
    AsyncStorage.setItem(AGREEMENTS_KEY, JSON.stringify(next)).catch(() => {});
  },

  setTemplate: (t) => set({ template: t, step: 'params' }),
  setStep: (s) => set({ step: s }),
  setField: (k, v) => set({ [k]: v } as Partial<SettlementState>),
  reset: () => set({ ...INIT_WIZARD }),

  async loadAgreements() {
    try {
      const raw = await AsyncStorage.getItem(AGREEMENTS_KEY);
      if (raw) set({ agreements: JSON.parse(raw) as SavedAgreement[] });
    } catch {}
  },
}));
