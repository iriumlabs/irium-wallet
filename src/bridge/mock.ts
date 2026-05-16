import type { SpvBridge, Utxo, BalanceInfo, NodeStatus, TxRecord, HtlcInfo, AgreementParams, LightClientConfig, WifKey } from './types';

// Deterministic mock addresses for testability
const MOCK_ADDRESS = 'QmockAddr1234567890abcdef1234567890abcdef';
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
    return MOCK_ADDRESS;
  },

  async derivePrivkeyHex(seedHex, index) {
    await delay(100);
    return 'cc'.repeat(32);
  },

  validateAddress(address) {
    return address.startsWith('Q') && address.length >= 26;
  },

  async exportWif(_seedHex, _index) {
    await delay(100);
    return '5HueCGU8rMjxECyDialwujzDmgGSzbPyhDGkFKLVkMxiDpYGfEA'; // mock WIF
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
