// Types mirror spv_mobile.udl exactly.
// u64/i64 → number (safe for Irium's range; real bridge maps via Kotlin Long → JS string → parsed)

export interface Utxo {
  txid: string;
  index: number;        // u32
  value: number;        // u64 sats
  height: number;       // u64
  is_coinbase: boolean;
  script_pubkey_hex: string;
}

export interface BalanceInfo {
  confirmed: number;    // u64 sats
  utxo_count: number;   // u32
  height: number;       // u64
}

export interface NodeStatus {
  height: number;       // u64
  peer_count: number;   // u32
  tip_hash: string;
  anchor_loaded: boolean;
}

export interface TxRecord {
  txid: string;
  height: number;       // u64
  net_sats: number;     // i64 — positive = received, negative = sent
  direction: string;    // "in" | "out"
}

export interface HtlcInfo {
  secret_hash_hex: string;
  recipient_address: string;
  refund_address: string;
  timeout_height: number; // u64
}

export interface AgreementParams {
  // 'otc' or 'simple-settlement' (wizard-side labels; the bridge translates
  // to canonical AgreementTemplateType snake_case enum values).
  template_type: string;
  payer_address: string;
  payee_address: string;
  total_amount_sats: number; // u64
  timeout_height: number;    // u64 — used for deadlines.refund_deadline and refund_conditions[].timeout_height
  secret_hash_hex: string;   // 64-char hex SHA256 of preimage
  asset_reference?: string;
  payment_reference?: string;
  document_hash?: string;    // 64-char hex; bridge defaults to zeros if omitted
  agreement_id?: string;     // bridge generates if omitted
  creation_time?: number;    // unix seconds; bridge fills with Date.now()/1000 if omitted
}

export interface AgreementStatus {
  agreement_hash: string;
  state: string;             // lifecycle.state — draft|proposed|funded|partially_released|released|refunded|expired|cancelled|disputed_metadata_only
  proof_depth: number | null;
  proof_final: boolean;
  release_eligible: boolean;
}

export interface SpendEligibility {
  agreement_hash: string;
  branch: string;            // 'release' | 'refund'
  eligible: boolean;
  reasons: string[];         // plural — machine-readable codes from iriumd
  funded: boolean;
  unspent: boolean;
  timeout_height?: number;
  timeout_reached: boolean;
  expected_hash?: string;
}

export interface LightClientConfig {
  seedlist_path: string;
  extra_peer?: string;
  start_height: number; // u64
  start_hash?: string;
}

export type SpvErrorKind =
  | 'InvalidArgument'
  | 'Network'
  | 'Rpc'
  | 'Wallet'
  | 'Parse'
  | 'Internal';

export class SpvError extends Error {
  constructor(public readonly kind: SpvErrorKind, message: string) {
    super(message);
    this.name = `SpvError.${kind}`;
  }
}

export interface WifKey {
  address: string;
  pubkey_hex: string;
}

// Full bridge interface — every UDL function is represented here.
export interface SpvBridge {
  // Wallet
  generateMnemonic(): Promise<string>;
  mnemonicToSeed(mnemonic: string, passphrase: string): Promise<string>;
  deriveAddress(seedHex: string, index: number): Promise<string>;
  derivePrivkeyHex(seedHex: string, index: number): Promise<string>;
  validateAddress(address: string): boolean;
  exportWif(seedHex: string, index: number): Promise<string>;
  importWif(wif: string): Promise<WifKey>;

  // Transaction
  buildSendTx(
    utxos: Utxo[],
    toAddress: string,
    amountSats: number,
    feeSats: number,
    seedHex: string,
    fromIndex: number,
  ): Promise<string>;

  // HTLC
  encodeHtlcv1(
    secretHashHex: string,
    recipientAddress: string,
    refundAddress: string,
    timeoutHeight: number,
  ): Promise<string>;
  decodeHtlcv1(scriptHex: string): Promise<HtlcInfo>;
  buildHtlcClaimTx(
    htlcTxid: string,
    htlcIndex: number,
    htlcValue: number,
    htlcScriptHex: string,
    preimageHex: string,
    seedHex: string,
    keyIndex: number,
    toAddress: string,
    feeSats: number,
  ): Promise<string>;
  buildHtlcRefundTx(
    htlcTxid: string,
    htlcIndex: number,
    htlcValue: number,
    htlcScriptHex: string,
    seedHex: string,
    keyIndex: number,
    toAddress: string,
    feeSats: number,
    timeoutHeight: number,
  ): Promise<string>;

  // Agreement
  computeAgreementHash(agreementJson: string): Promise<string>;
  createAgreement(params: AgreementParams): Promise<string>;
  getAgreementStatus(agreementJson: string): Promise<AgreementStatus>;
  getReleaseEligibility(agreementJson: string, fundingTxid: string): Promise<SpendEligibility>;
  getRefundEligibility(agreementJson: string, fundingTxid: string): Promise<SpendEligibility>;

  // SPV
  verifyMerkleProof(
    txidHex: string,
    merkleRootHex: string,
    proofHexNodes: string[],
    index: number,
  ): Promise<boolean>;
  getSyncedHeight(): number;
  getTipHash(): string;

  // RPC
  rpcGetStatus(rpcUrl: string, authToken?: string): Promise<NodeStatus>;
  rpcGetBalance(rpcUrl: string, authToken: string | undefined, address: string): Promise<BalanceInfo>;
  rpcGetUtxos(rpcUrl: string, authToken: string | undefined, address: string): Promise<Utxo[]>;
  rpcGetHistory(rpcUrl: string, authToken: string | undefined, address: string): Promise<TxRecord[]>;
  rpcGetFeeRate(rpcUrl: string, authToken?: string): Promise<number>;
  rpcSubmitTx(rpcUrl: string, authToken: string | undefined, txHex: string): Promise<string>;

  // P2P light client
  startLightClient(config: LightClientConfig): Promise<void>;
  stopLightClient(): void;
  isSyncing(): boolean;
  peerCount(): number;
  broadcastTx(txHex: string): Promise<string>;
}
