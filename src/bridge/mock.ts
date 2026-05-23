import type { SpvBridge, Utxo, BalanceInfo, NodeStatus, TxRecord, HtlcInfo, AgreementParams, LightClientConfig, WifKey, AgreementStatus, SpendEligibility } from './types';

// Deterministic mock addresses for testability
const MOCK_ADDRESS = 'Q8XbJ3h37uUSPnXdBBG3DsXWhzRiDshaPz';
const MOCK_ADDR_LIST = [
  'Q8XbJ3h37uUSPnXdBBG3DsXWhzRiDshaPz',
  'Q9aKmRx7uvWPnXdBBG3DsXWhzRiKpL4hY9',
  'QXn4hRz9pK3tL8mVjBDsXWhzRiDqM2nA8c',
  'QwLpN5jK8tHxV2bWdN3PaXY1RmZqDnPa7b',
  'QrTqB6vS9mPzL3kJfXcU4eGRoYpDhKqV2x',
  'QYx2mNvL7fAjZ8wCkRpSqMnTeJrUbDfV4z',
  'QmZpR4hAj3WnXeKbLsTcVdQoUiPyDfGv2n',
  'QbCkV9nJp6mZwHqLsTdRcXoYiPaUfGxW8e',
  'QnMrK5hLp8tVwGqJxBzNkRoUcPfDgYxA3m',
  'QvWqJ4nLkP7mZtHbXcRdUoYiPaSgFvK2xJ',
];
const MOCK_SEED_HEX = 'deadbeef'.repeat(8);
// 24 words — matches Mnemonic::generate(24) in irium-wallet.rs (256-bit entropy)
const MOCK_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

let _syncedHeight = 45_200;
let _tipHash = 'aaaa' + '00'.repeat(30);
let _peerCount = 3;
let _syncing = false;

const MOCK_UTXOS: Utxo[] = [
  { txid: 'abc1' + '00'.repeat(30), index: 0, value: 500_000, height: 45_100, is_coinbase: false, script_pubkey_hex: '76a914' + '00'.repeat(20) + '88ac' },
  { txid: 'def2' + '00'.repeat(30), index: 1, value: 250_000, height: 45_050, is_coinbase: false, script_pubkey_hex: '76a914' + '00'.repeat(20) + '88ac' },
];

const MOCK_HISTORY: TxRecord[] = [
  { txid: 'abc1' + '00'.repeat(30), height: 45_100, net_sats: 500_000, direction: 'in' },
  { txid: 'def2' + '00'.repeat(30), height: 45_050, net_sats: 250_000, direction: 'in' },
  { txid: 'fff3' + '00'.repeat(30), height: 44_900, net_sats: -100_000, direction: 'out' },
];

function delay(ms = 400): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockBridge: SpvBridge = {
  async generateMnemonic() {
    await delay();
    return MOCK_MNEMONIC;
  },

  async mnemonicToSeed(mnemonic, _passphrase) {
    await delay(200);
    if (!mnemonic.trim()) throw new Error('empty mnemonic');
    return MOCK_SEED_HEX + MOCK_SEED_HEX; // 128 hex chars (64 bytes)
  },

  async deriveAddress(seedHex, index) {
    await delay(100);
    return MOCK_ADDR_LIST[index % MOCK_ADDR_LIST.length];
  },

  async derivePrivkeyHex(seedHex, index) {
    await delay(100);
    const byte = (index % 256).toString(16).padStart(2, '0');
    return byte.repeat(32);
  },

  validateAddress(address) {
    return address.startsWith('Q') && address.length >= 26;
  },

  async exportWif(_seedHex, index) {
    await delay(100);
    const base = '5HueCGU8rMjxECyDialwujzDmgGSzbPyhDGkFKLVkMxiDpYGf';
    const suffix = String.fromCharCode(65 + (index % 26)).repeat(2);
    return base + suffix;
  },

  async importWif(_wif): Promise<WifKey> {
    await delay(100);
    return { address: MOCK_ADDRESS, pubkey_hex: '02' + '00'.repeat(32) };
  },

  async buildSendTx(utxos, toAddress, amountSats, feeSats, seedHex, fromIndex) {
    await delay(300);
    const total = utxos.reduce((s, u) => s + u.value, 0);
    if (total < amountSats + feeSats) throw new Error('insufficient funds');
    return '01000000' + 'ff'.repeat(100);
  },

  async encodeHtlcv1(secretHashHex, recipientAddress, refundAddress, timeoutHeight) {
    await delay(100);
    return 'c001' + secretHashHex + 'aa'.repeat(20) + 'bb'.repeat(20) + '00'.repeat(8);
  },

  async decodeHtlcv1(scriptHex): Promise<HtlcInfo> {
    await delay(100);
    return {
      secret_hash_hex: 'aa'.repeat(32),
      recipient_address: MOCK_ADDRESS,
      refund_address: MOCK_ADDRESS,
      timeout_height: 46_000,
    };
  },

  async buildHtlcClaimTx(..._args) {
    await delay(300);
    return '01000000' + 'cc'.repeat(100);
  },

  async buildHtlcRefundTx(..._args) {
    await delay(300);
    return '01000000' + 'dd'.repeat(100);
  },

  async computeAgreementHash(agreementJson) {
    await delay(50);
    return 'ee'.repeat(32);
  },

  async createAgreement(params: AgreementParams) {
    await delay(200);
    return JSON.stringify({
      agreement_id: 'ff'.repeat(32),
      template_type: params.template_type,
      payer: params.payer_address,
      payee: params.payee_address,
      total_amount: params.total_amount_sats,
      secret_hash_hex: params.secret_hash_hex,
      timeout_height: params.timeout_height,
    }, null, 2);
  },

  async getAgreementStatus(_agreementJson: string): Promise<AgreementStatus> {
    await delay(150);
    return {
      agreement_hash: 'ee'.repeat(32),
      state: 'draft',
      proof_depth: null,
      proof_final: false,
      release_eligible: false,
    };
  },

  async getReleaseEligibility(_agreementJson: string, _fundingTxid: string): Promise<SpendEligibility> {
    await delay(150);
    return {
      agreement_hash: 'ee'.repeat(32),
      branch: 'release',
      eligible: false,
      reasons: ['mock_bridge_not_connected'],
      funded: false,
      unspent: false,
      timeout_reached: false,
    };
  },

  async getRefundEligibility(_agreementJson: string, _fundingTxid: string): Promise<SpendEligibility> {
    await delay(150);
    return {
      agreement_hash: 'ee'.repeat(32),
      branch: 'refund',
      eligible: false,
      reasons: ['mock_bridge_not_connected'],
      funded: false,
      unspent: false,
      timeout_reached: false,
    };
  },

  async verifyMerkleProof(_txid, _root, _proof, _index) {
    await delay(100);
    return true;
  },

  getSyncedHeight() { return _syncedHeight; },
  getTipHash() { return _tipHash; },

  async rpcGetStatus(rpcUrl) {
    await delay(500);
    if (!rpcUrl) throw new Error('no rpc url');
    return { height: _syncedHeight, peer_count: _peerCount, tip_hash: _tipHash, anchor_loaded: true } as NodeStatus;
  },

  async rpcGetBalance(_url, _auth, _addr): Promise<BalanceInfo> {
    await delay(400);
    return { confirmed: 750_000, utxo_count: 2, height: _syncedHeight };
  },

  async rpcGetUtxos(_url, _auth, _addr) {
    await delay(400);
    return MOCK_UTXOS;
  },

  async rpcGetHistory(_url, _auth, _addr) {
    await delay(400);
    return MOCK_HISTORY;
  },

  async rpcGetFeeRate(_url) {
    await delay(200);
    return 10; // sats/byte
  },

  async rpcSubmitTx(_url, _auth, _txHex) {
    await delay(600);
    return 'submittedTxid' + '00'.repeat(20);
  },

  async startLightClient(_config: LightClientConfig) {
    await delay(300);
    _syncing = true;
    setTimeout(() => {
      _syncing = false;
      _peerCount = 4;
      _syncedHeight += 10;
    }, 3000);
  },

  stopLightClient() { _peerCount = 0; },
  isSyncing() { return _syncing; },
  peerCount() { return _peerCount; },

  async broadcastTx(txHex) {
    await delay(500);
    return 'broadcast' + '00'.repeat(28);
  },
};
