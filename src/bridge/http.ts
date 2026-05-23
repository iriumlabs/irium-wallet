import type {
  SpvBridge,
  NodeStatus,
  BalanceInfo,
  Utxo,
  TxRecord,
  AgreementParams,
  AgreementStatus,
  SpendEligibility,
  FundingResult,
  FundingOutput,
  SpendBuildResult,
  ProofSubmitResult,
  AgreementInspectResult,
} from './types';
import { SpvError } from './types';
import { useWalletStore } from '../store/wallet';

const DEFAULT_TIMEOUT_MS = 10_000;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildUrl(rpcUrl: string, path: string, query?: Record<string, string | number>): string {
  const base = stripTrailingSlash(rpcUrl);
  let url = `${base}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }
  return url;
}

function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  ms = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpcGet<T>(
  rpcUrl: string,
  authToken: string | undefined,
  path: string,
  query?: Record<string, string | number>,
): Promise<T> {
  if (!rpcUrl) throw new SpvError('InvalidArgument', 'rpcUrl is empty');
  const url = buildUrl(rpcUrl, path, query);
  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders(authToken) },
    });
  } catch (e: any) {
    throw new SpvError('Network', `GET ${path} failed: ${e?.message ?? String(e)}`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new SpvError('Rpc', `HTTP ${resp.status} ${path}: ${text.slice(0, 200)}`);
  }
  try {
    return (await resp.json()) as T;
  } catch (e: any) {
    throw new SpvError('Parse', `Bad JSON from ${path}: ${e?.message ?? String(e)}`);
  }
}

async function rpcPost<T>(
  rpcUrl: string,
  authToken: string | undefined,
  path: string,
  body: unknown,
): Promise<T> {
  if (!rpcUrl) throw new SpvError('InvalidArgument', 'rpcUrl is empty');
  const url = buildUrl(rpcUrl, path);
  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders(authToken),
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new SpvError('Network', `POST ${path} failed: ${e?.message ?? String(e)}`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new SpvError('Rpc', `HTTP ${resp.status} ${path}: ${text.slice(0, 200)}`);
  }
  try {
    return (await resp.json()) as T;
  } catch (e: any) {
    throw new SpvError('Parse', `Bad JSON from ${path}: ${e?.message ?? String(e)}`);
  }
}

interface RawStatus {
  height?: number;
  peer_count?: number;
  anchor_loaded?: boolean;
  best_header_tip?: { height: number; hash: string };
  anchors_digest?: string;
}

interface RawBalance {
  balance?: number;
  utxo_count?: number;
  height?: number;
}

interface RawUtxosResponse {
  utxos?: Array<{
    txid?: string;
    index?: number;
    value?: number;
    height?: number;
    is_coinbase?: boolean;
    script_pubkey?: string;
  }>;
}

interface RawSubmitTxResponse {
  txid?: string;
  hash?: string;
}

interface RawFeeEstimate {
  min_fee_per_byte?: number;
}

interface RawAgreementHashResponse {
  agreement_hash?: string;
}

interface RawAgreementInspectResponse {
  agreement_hash?: string;
}

interface RawAgreementStatusResponse {
  agreement_hash?: string;
  lifecycle?: { state?: string };
  proof_depth?: number | null;
  proof_final?: boolean;
  release_eligible?: boolean;
}

interface RawSpendEligibilityResponse {
  agreement_hash?: string;
  branch?: string;
  eligible?: boolean;
  reasons?: string[];
  funded?: boolean;
  unspent?: boolean;
  timeout_height?: number;
  timeout_reached?: boolean;
  expected_hash?: string;
}

// Build the canonical AgreementObject body for the wizard's params. Honours
// the per-template payer/payee semantics from build_otc_agreement /
// build_simple_settlement_agreement in src/settlement.rs:
//   otc_settlement     -> payer = seller (locks IRM in HTLC), payee = buyer
//   simple_release_refund -> payer = payer, payee = payee (wizard semantics match)
// The wizard's `payer_address` / `payee_address` carry the wizard's intent;
// we map them to canonical roles per template below.
function buildAgreementBody(params: AgreementParams): Record<string, unknown> {
  // Wizard label -> canonical AgreementTemplateType (snake_case).
  //   'otc'              -> otc_settlement
  //   'deposit'          -> refundable_deposit
  //   anything else      -> simple_release_refund (the Freelance wizard's value)
  const isOtc = params.template_type === 'otc';
  const isDeposit = params.template_type === 'deposit';
  const templateType = isOtc
    ? 'otc_settlement'
    : isDeposit
      ? 'refundable_deposit'
      : 'simple_release_refund';

  // For OTC, the wizard's payer_address is the buyer (fiat payer / IRM receiver)
  // and payee_address is the seller (IRM locker). The canonical OTC agreement
  // inverts that: payer = seller (locks IRM in escrow), payee = buyer (receives
  // IRM after delivering off-chain payment). See build_otc_agreement in
  // src/settlement.rs:1478. We keep the wizard's addresses but swap the
  // party_id refs to match the canonical OTC schema.
  //
  // For deposit and simple_release_refund, payer/payee semantics already
  // align with the wizard's inputs (payer = locker = depositor or hiring
  // party; payee = release destination = recipient or contractor).
  const parties = isOtc
    ? [
        { party_id: 'buyer',  display_name: 'Buyer',  address: params.payer_address, role: 'buyer' },
        { party_id: 'seller', display_name: 'Seller', address: params.payee_address, role: 'seller' },
      ]
    : [
        { party_id: 'payer', display_name: 'Payer', address: params.payer_address, role: 'payer' },
        { party_id: 'payee', display_name: 'Payee', address: params.payee_address, role: 'payee' },
      ];

  const payerId = isOtc ? 'seller' : 'payer';
  const payeeId = isOtc ? 'buyer'  : 'payee';
  const refundAddress = isOtc ? params.payee_address : params.payer_address;
  const releaseAuthorizer = isOtc ? 'seller' : 'payee';

  const now = params.creation_time ?? Math.floor(Date.now() / 1000);

  return {
    agreement_id: params.agreement_id ?? `${templateType}-${now}`,
    version: 1,
    schema_id: 'irium.phase1.canonical.v1',
    template_type: templateType,
    parties,
    payer: payerId,
    payee: payeeId,
    total_amount: params.total_amount_sats,
    network_marker: 'IRIUM',
    creation_time: now,
    deadlines: {
      settlement_deadline: null,
      refund_deadline: params.timeout_height,
      dispute_window: null,
    },
    release_conditions: [
      {
        mode: 'secret_preimage',
        secret_hash_hex: params.secret_hash_hex,
        release_authorizer: releaseAuthorizer,
      },
    ],
    refund_conditions: [
      {
        refund_address: refundAddress,
        timeout_height: params.timeout_height,
      },
    ],
    milestones: [],
    ...(params.asset_reference ? { asset_reference: params.asset_reference } : {}),
    ...(params.payment_reference ? { payment_reference: params.payment_reference } : {}),
    document_hash: params.document_hash ?? '0'.repeat(64),
    disputed_metadata_only: false,
  };
}

async function submitTxHex(
  rpcUrl: string,
  authToken: string | undefined,
  txHex: string,
): Promise<string> {
  if (!txHex) throw new SpvError('InvalidArgument', 'txHex is empty');
  const json = await rpcPost<RawSubmitTxResponse>(rpcUrl, authToken, '/rpc/submit_tx', {
    tx_hex: txHex,
  });
  return String(json.txid ?? json.hash ?? '');
}

// /rpc/history response shape is not documented in API.md; try common shapes
// and map fields loosely. Logs and returns [] on a mismatch so the UI degrades
// to empty-state instead of crashing.
function parseHistory(raw: unknown): TxRecord[] {
  let list: unknown[] | null = null;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.transactions)) list = obj.transactions;
    else if (Array.isArray(obj.history)) list = obj.history;
    else if (Array.isArray(obj.txs)) list = obj.txs;
    else if (Array.isArray(obj.entries)) list = obj.entries;
  }
  if (!list) {
    console.warn('[bridge.http] unknown /rpc/history response shape; returning []. raw=', raw);
    return [];
  }
  return list.map((item: any) => {
    const txid = String(item?.txid ?? item?.hash ?? item?.tx_hash ?? '');
    const height = Number(item?.height ?? item?.block_height ?? 0);
    const rawNet = item?.net_sats ?? item?.net ?? item?.amount ?? item?.value ?? 0;
    const net_sats = Number(rawNet);
    let direction: string = item?.direction ?? '';
    if (direction !== 'in' && direction !== 'out') {
      direction = net_sats >= 0 ? 'in' : 'out';
    }
    return { txid, height, net_sats, direction };
  });
}

export const httpBridge: Partial<SpvBridge> = {
  async rpcGetStatus(rpcUrl, authToken) {
    const json = await rpcGet<RawStatus>(rpcUrl, authToken, '/status');
    const status: NodeStatus = {
      height: Number(json.height ?? 0),
      peer_count: Number(json.peer_count ?? 0),
      tip_hash: json.best_header_tip?.hash ?? json.anchors_digest ?? '',
      anchor_loaded: !!json.anchor_loaded,
    };
    return status;
  },

  async rpcGetBalance(rpcUrl, authToken, address) {
    if (!address) throw new SpvError('InvalidArgument', 'address is empty');
    const json = await rpcGet<RawBalance>(rpcUrl, authToken, '/rpc/balance', { address });
    const info: BalanceInfo = {
      confirmed: Number(json.balance ?? 0),
      utxo_count: Number(json.utxo_count ?? 0),
      height: Number(json.height ?? 0),
    };
    return info;
  },

  async rpcGetUtxos(rpcUrl, authToken, address) {
    if (!address) throw new SpvError('InvalidArgument', 'address is empty');
    const json = await rpcGet<RawUtxosResponse>(rpcUrl, authToken, '/rpc/utxos', { address });
    const utxos = Array.isArray(json.utxos) ? json.utxos : [];
    return utxos.map<Utxo>((u) => ({
      txid: String(u.txid ?? ''),
      index: Number(u.index ?? 0),
      value: Number(u.value ?? 0),
      height: Number(u.height ?? 0),
      is_coinbase: !!u.is_coinbase,
      script_pubkey_hex: String(u.script_pubkey ?? ''),
    }));
  },

  async rpcGetHistory(rpcUrl, authToken, address) {
    if (!address) throw new SpvError('InvalidArgument', 'address is empty');
    const json = await rpcGet<unknown>(rpcUrl, authToken, '/rpc/history', { address });
    return parseHistory(json);
  },

  async rpcGetFeeRate(rpcUrl, authToken) {
    const json = await rpcGet<RawFeeEstimate>(rpcUrl, authToken, '/rpc/fee_estimate');
    return Number(json.min_fee_per_byte ?? 1);
  },

  async rpcSubmitTx(rpcUrl, authToken, txHex) {
    return submitTxHex(rpcUrl, authToken, txHex);
  },

  // broadcastTx() doesn't take rpcUrl in the SpvBridge interface (the native module
  // was meant to own P2P). Read it from the wallet store so this remains a drop-in
  // replacement for the mock.
  async broadcastTx(txHex) {
    const { rpcUrl, authToken } = useWalletStore.getState();
    return submitTxHex(rpcUrl, authToken, txHex);
  },

  // Settlement methods. All read rpcUrl/authToken from the wallet store for
  // the same reason as broadcastTx — the SpvBridge interface predates the
  // HTTP shim.

  async createAgreement(params) {
    const body = buildAgreementBody(params);
    const { rpcUrl, authToken } = useWalletStore.getState();
    await rpcPost<RawAgreementInspectResponse>(rpcUrl, authToken, '/rpc/createagreement', {
      agreement: body,
    });
    return JSON.stringify(body);
  },

  async computeAgreementHash(agreementJson) {
    let agreement: unknown;
    try {
      agreement = JSON.parse(agreementJson);
    } catch (e: any) {
      throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
    }
    const { rpcUrl, authToken } = useWalletStore.getState();
    const r = await rpcPost<RawAgreementHashResponse>(
      rpcUrl,
      authToken,
      '/rpc/computeagreementhash',
      { agreement },
    );
    return String(r.agreement_hash ?? '');
  },

  async getAgreementStatus(agreementJson) {
    let agreement: unknown;
    try {
      agreement = JSON.parse(agreementJson);
    } catch (e: any) {
      throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
    }
    const { rpcUrl, authToken } = useWalletStore.getState();
    const r = await rpcPost<RawAgreementStatusResponse>(
      rpcUrl,
      authToken,
      '/rpc/agreementstatus',
      { agreement },
    );
    const status: AgreementStatus = {
      agreement_hash: String(r.agreement_hash ?? ''),
      state: String(r.lifecycle?.state ?? 'draft'),
      proof_depth: r.proof_depth ?? null,
      proof_final: !!r.proof_final,
      release_eligible: !!r.release_eligible,
    };
    return status;
  },

  async getReleaseEligibility(agreementJson, fundingTxid) {
    return spendEligibility(agreementJson, fundingTxid, 'release');
  },

  async getRefundEligibility(agreementJson, fundingTxid) {
    return spendEligibility(agreementJson, fundingTxid, 'refund');
  },

  // POST /rpc/fundagreement — iriumd's wallet signs and (optionally) broadcasts
  // the funding tx that locks IRM into the HTLC. The mobile wallet does not
  // sign; the on-chain funder is whoever iriumd's wallet identifies as. Per
  // canonical OTC, the agreement's `payer` party_id (= seller) is expected to
  // be the funder semantically — but iriumd will sign from whichever address
  // in its wallet has spendable UTXOs.
  async fundAgreement(agreementJson, broadcast, milestoneId) {
    let agreement: unknown;
    try {
      agreement = JSON.parse(agreementJson);
    } catch (e: any) {
      throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
    }
    const { rpcUrl, authToken } = useWalletStore.getState();
    const body: Record<string, unknown> = { agreement, broadcast };
    if (milestoneId) body.milestone_id = milestoneId;
    const r = await rpcPost<RawFundAgreementResponse>(rpcUrl, authToken, '/rpc/fundagreement', body);
    const outputs: FundingOutput[] = Array.isArray(r.outputs)
      ? r.outputs.map((o) => ({
          vout: Number(o.vout ?? 0),
          role: String(o.role ?? ''),
          milestone_id: o.milestone_id ?? null,
          amount: Number(o.amount ?? 0),
        }))
      : [];
    const result: FundingResult = {
      agreement_hash: String(r.agreement_hash ?? ''),
      txid: String(r.txid ?? ''),
      accepted: !!r.accepted,
      raw_tx_hex: String(r.raw_tx_hex ?? ''),
      outputs,
      fee: Number(r.fee ?? 0),
    };
    return result;
  },

  async buildAgreementRelease(agreementJson, fundingTxid, secretHex, broadcast) {
    return spendBuild(agreementJson, fundingTxid, 'release', broadcast, secretHex);
  },

  async buildAgreementRefund(agreementJson, fundingTxid, broadcast) {
    return spendBuild(agreementJson, fundingTxid, 'refund', broadcast);
  },

  async submitProof(proofJson) {
    let proof: unknown;
    try {
      proof = JSON.parse(proofJson);
    } catch (e: any) {
      throw new SpvError('Parse', `bad proof JSON: ${e?.message ?? String(e)}`);
    }
    const { rpcUrl, authToken } = useWalletStore.getState();
    const r = await rpcPost<RawSubmitProofResponse>(rpcUrl, authToken, '/rpc/submitproof', { proof });
    const result: ProofSubmitResult = {
      proof_id: String(r.proof_id ?? ''),
      agreement_hash: String(r.agreement_hash ?? ''),
      accepted: !!r.accepted,
      duplicate: !!r.duplicate,
      message: String(r.message ?? ''),
      tip_height: Number(r.tip_height ?? 0),
    };
    return result;
  },

  async inspectAgreement(agreementJson) {
    let agreement: unknown;
    try {
      agreement = JSON.parse(agreementJson);
    } catch (e: any) {
      throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
    }
    const { rpcUrl, authToken } = useWalletStore.getState();
    const r = await rpcPost<RawAgreementInspectResponse2>(rpcUrl, authToken, '/rpc/inspectagreement', { agreement });
    const s = r.summary ?? {};
    const result: AgreementInspectResult = {
      agreement_hash: String(r.agreement_hash ?? ''),
      summary: {
        agreement_hash: String(s.agreement_hash ?? r.agreement_hash ?? ''),
        total_amount: Number(s.total_amount ?? 0),
        template_type: String(s.template_type ?? ''),
        milestone_count: Number(s.milestone_count ?? 0),
        uses_htlc_timeout: !!s.uses_htlc_timeout,
        has_deposit_rule: !!s.has_deposit_rule,
      },
    };
    return result;
  },
};

async function spendBuild(
  agreementJson: string,
  fundingTxid: string,
  branch: 'release' | 'refund',
  broadcast: boolean,
  secretHex?: string,
): Promise<SpendBuildResult> {
  let agreement: unknown;
  try {
    agreement = JSON.parse(agreementJson);
  } catch (e: any) {
    throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
  }
  const path =
    branch === 'release'
      ? '/rpc/buildagreementrelease'
      : '/rpc/buildagreementrefund';
  const body: Record<string, unknown> = {
    agreement,
    funding_txid: fundingTxid,
    broadcast,
  };
  if (secretHex) body.secret_hex = secretHex;
  const { rpcUrl, authToken } = useWalletStore.getState();
  const r = await rpcPost<RawSpendBuildResponse>(rpcUrl, authToken, path, body);
  return {
    agreement_hash: String(r.agreement_hash ?? ''),
    agreement_id: String(r.agreement_id ?? ''),
    funding_txid: String(r.funding_txid ?? fundingTxid),
    htlc_vout: Number(r.htlc_vout ?? 0),
    branch: String(r.branch ?? branch),
    destination_address: String(r.destination_address ?? ''),
    txid: String(r.txid ?? ''),
    accepted: !!r.accepted,
    raw_tx_hex: String(r.raw_tx_hex ?? ''),
    fee: Number(r.fee ?? 0),
  };
}

interface RawFundAgreementResponse {
  agreement_hash?: string;
  txid?: string;
  accepted?: boolean;
  raw_tx_hex?: string;
  fee?: number;
  outputs?: Array<{
    vout?: number;
    role?: string;
    milestone_id?: string | null;
    amount?: number;
  }>;
}

interface RawSpendBuildResponse {
  agreement_hash?: string;
  agreement_id?: string;
  funding_txid?: string;
  htlc_vout?: number;
  branch?: string;
  destination_address?: string;
  txid?: string;
  accepted?: boolean;
  raw_tx_hex?: string;
  fee?: number;
}

interface RawSubmitProofResponse {
  proof_id?: string;
  agreement_hash?: string;
  accepted?: boolean;
  duplicate?: boolean;
  message?: string;
  tip_height?: number;
}

interface RawAgreementInspectResponse2 {
  agreement_hash?: string;
  summary?: {
    agreement_hash?: string;
    total_amount?: number;
    template_type?: string;
    milestone_count?: number;
    uses_htlc_timeout?: boolean;
    has_deposit_rule?: boolean;
  };
}

async function spendEligibility(
  agreementJson: string,
  fundingTxid: string,
  branch: 'release' | 'refund',
): Promise<SpendEligibility> {
  let agreement: unknown;
  try {
    agreement = JSON.parse(agreementJson);
  } catch (e: any) {
    throw new SpvError('Parse', `bad agreement JSON: ${e?.message ?? String(e)}`);
  }
  const path =
    branch === 'release'
      ? '/rpc/agreementreleaseeligibility'
      : '/rpc/agreementrefundeligibility';
  const { rpcUrl, authToken } = useWalletStore.getState();
  const r = await rpcPost<RawSpendEligibilityResponse>(rpcUrl, authToken, path, {
    agreement,
    funding_txid: fundingTxid,
  });
  return {
    agreement_hash: String(r.agreement_hash ?? ''),
    branch: String(r.branch ?? branch),
    eligible: !!r.eligible,
    reasons: Array.isArray(r.reasons) ? r.reasons.map(String) : [],
    funded: !!r.funded,
    unspent: !!r.unspent,
    timeout_height: r.timeout_height,
    timeout_reached: !!r.timeout_reached,
    expected_hash: r.expected_hash,
  };
}
