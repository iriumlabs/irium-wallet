import type {
  SpvBridge,
  Utxo,
  BalanceInfo,
  NodeStatus,
  TxRecord,
  HtlcInfo,
  AgreementParams,
  LightClientConfig,
  WifKey,
  AgreementStatus,
  SpendEligibility,
  FundingResult,
  SpendBuildResult,
  ProofSubmitResult,
  AgreementInspectResult,
} from './types';
import { SpvError } from './types';

// Fallback bridge implementation used only when:
//   (a) the spv-mobile native module fails to load (Expo Go, Jest, CI), AND
//   (b) the httpBridge does not override the called method.
//
// There is no fake data here. Every method throws a clear, actionable error.
// The previous version of this file returned hardcoded mnemonics, addresses,
// UTXOs, and agreement hashes so the wallet would "appear to work" in Expo
// Go. That hid real failures — users could complete onboarding with the
// canned `abandon × 23 + art` mnemonic and not realise their wallet was
// pointing at a synthetic address. Loud errors are safer.

function notAvailable(method: string): never {
  throw new SpvError(
    'Internal',
    `${method}: spv-mobile native module not loaded. Use the Irium custom dev client (npx expo run:android / run:ios) instead of Expo Go.`,
  );
}

export const mockBridge: SpvBridge = {
  // Wallet — native module required
  async generateMnemonic() { return notAvailable('generateMnemonic'); },
  async mnemonicToSeed(_m, _p) { return notAvailable('mnemonicToSeed'); },
  async deriveAddress(_seed, _idx) { return notAvailable('deriveAddress'); },
  async derivePrivkeyHex(_seed, _idx) { return notAvailable('derivePrivkeyHex'); },
  validateAddress(_addr) { return notAvailable('validateAddress'); },
  async exportWif(_seed, _idx) { return notAvailable('exportWif'); },
  async importWif(_wif): Promise<WifKey> { return notAvailable('importWif'); },

  // Transaction signing — native module required
  async buildSendTx(_utxos, _to, _amount, _fee, _seed, _idx) {
    return notAvailable('buildSendTx');
  },

  // HTLC scripts + spends — native module required
  async encodeHtlcv1(_hash, _recipient, _refund, _timeout) {
    return notAvailable('encodeHtlcv1');
  },
  async decodeHtlcv1(_scriptHex): Promise<HtlcInfo> {
    return notAvailable('decodeHtlcv1');
  },
  async buildHtlcClaimTx(..._args): Promise<string> {
    return notAvailable('buildHtlcClaimTx');
  },
  async buildHtlcRefundTx(..._args): Promise<string> {
    return notAvailable('buildHtlcRefundTx');
  },

  // Agreement layer — httpBridge overrides every method below in normal
  // composition. These throws only fire if httpBridge is also absent.
  async computeAgreementHash(_json) { return notAvailable('computeAgreementHash'); },
  async createAgreement(_params: AgreementParams) { return notAvailable('createAgreement'); },
  async getAgreementStatus(_json): Promise<AgreementStatus> {
    return notAvailable('getAgreementStatus');
  },
  async getReleaseEligibility(_json, _txid): Promise<SpendEligibility> {
    return notAvailable('getReleaseEligibility');
  },
  async getRefundEligibility(_json, _txid): Promise<SpendEligibility> {
    return notAvailable('getRefundEligibility');
  },
  async fundAgreement(_json, _broadcast, _milestoneId): Promise<FundingResult> {
    return notAvailable('fundAgreement');
  },
  async buildAgreementRelease(_json, _txid, _secret, _broadcast): Promise<SpendBuildResult> {
    return notAvailable('buildAgreementRelease');
  },
  async buildAgreementRefund(_json, _txid, _broadcast): Promise<SpendBuildResult> {
    return notAvailable('buildAgreementRefund');
  },
  async submitProof(_proofJson): Promise<ProofSubmitResult> {
    return notAvailable('submitProof');
  },
  async inspectAgreement(_json): Promise<AgreementInspectResult> {
    return notAvailable('inspectAgreement');
  },

  // SPV — native module required
  async verifyMerkleProof(..._args) { return notAvailable('verifyMerkleProof'); },
  getSyncedHeight() { return notAvailable('getSyncedHeight'); },
  getTipHash() { return notAvailable('getTipHash'); },

  // RPC client — httpBridge overrides; same caveat as agreement methods.
  async rpcGetStatus(_url, _auth): Promise<NodeStatus> {
    return notAvailable('rpcGetStatus');
  },
  async rpcGetBalance(_url, _auth, _addr): Promise<BalanceInfo> {
    return notAvailable('rpcGetBalance');
  },
  async rpcGetUtxos(_url, _auth, _addr): Promise<Utxo[]> {
    return notAvailable('rpcGetUtxos');
  },
  async rpcGetHistory(_url, _auth, _addr): Promise<TxRecord[]> {
    return notAvailable('rpcGetHistory');
  },
  async rpcGetFeeRate(_url, _auth): Promise<number> {
    return notAvailable('rpcGetFeeRate');
  },
  async rpcSubmitTx(_url, _auth, _txHex): Promise<string> {
    return notAvailable('rpcSubmitTx');
  },

  // P2P light client — native module owns this state. No mobile-side hook
  // currently consumes these methods; calls would only originate from
  // future feature work.
  async startLightClient(_config: LightClientConfig) { return notAvailable('startLightClient'); },
  stopLightClient() { return notAvailable('stopLightClient'); },
  isSyncing() { return notAvailable('isSyncing'); },
  peerCount() { return notAvailable('peerCount'); },
  async broadcastTx(_txHex) { return notAvailable('broadcastTx'); },
};
