import type { SpvBridge } from './types';
import { mockBridge } from './mock';
import { httpBridge } from './http';
import { useWalletStore } from '../store/wallet';
import { SpvError } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Bridge composition — three layers, applied in order. Later spreads win.
//
//   1. mockBridge          — throwing stubs for every SpvBridge method.
//                            Floor: the SpvBridge type contract is
//                            satisfied without returning fake data.
//                            Reaches the throw only when neither HTTP
//                            nor native provides the method — i.e. a
//                            real misconfiguration worth surfacing.
//
//   2. wrappedHttpBridge   — httpBridge methods individually gated on
//                            useWalletStore.rpcUrl. When rpcUrl is null,
//                            the gated method throws a clear "Custom node
//                            required. Configure one in Settings → Custom
//                            Node (Advanced)." error. Without a custom
//                            node, only HTTP-only features error out;
//                            the wallet still runs P2P-only via native.
//
//   3. nativeBridge        — Rust spv-mobile UDL bindings loaded via
//                            require('spv-mobile') in try/catch (Expo Go
//                            and Jest have no native modules, so the
//                            try fails silently and the wallet falls
//                            through to wrappedHttp + mock). Wins for
//                            every method it exposes EXCEPT the methods
//                            listed in HTTP_ONLY_METHODS below — those
//                            are explicitly delegated to wrappedHttp.
//
// Method-by-method routing (the FINAL destination after the merge):
//
//   Routes to NATIVE (no custom node required):
//     - generateMnemonic, mnemonicToSeed, deriveAddress, derivePrivkeyHex,
//       validateAddress, exportWif, importWif
//     - buildSendTx, encodeHtlcv1, decodeHtlcv1, buildHtlcClaimTx,
//       buildHtlcRefundTx
//     - computeAgreementHash (native version uses agreement_canonical_bytes
//       from irium-source via path dep — byte-identical to iriumd's hash)
//     - verifyMerkleProof, getSyncedHeight, getTipHash
//     - startLightClient, stopLightClient, isSyncing, peerCount
//     - broadcastTx (P2P broadcast via the light client — NO node needed)
//
//   Routes to wrappedHttp (custom node REQUIRED — throws when rpcUrl null):
//     - createAgreement (kept HTTP until M2b — see below)
//     - rpcGetStatus, rpcGetBalance, rpcGetUtxos, rpcGetHistory,
//       rpcGetFeeRate, rpcSubmitTx (native versions also exist but they
//       just wrap HTTP and need a URL; wrappedHttp gives a clearer
//       "configure custom node" error when rpcUrl is null)
//     - getAgreementStatus, getReleaseEligibility, getRefundEligibility,
//       fundAgreement, buildAgreementRelease, buildAgreementRefund,
//       submitProof, inspectAgreement (iriumd-only — no native equivalent)
//
// === Native milestones — planned work to reduce custom-node dependency ===
//
//   M1 — light_client_index_addresses(seed_hex, count)
//        UTXO indexing via SPV-verified block scan. Closes the
//        balance/UTXOs/history gap. Once landed:
//          rpcGetBalance, rpcGetUtxos, rpcGetHistory → can drop custom-
//          node requirement; resolve from local index instead.
//
//   M2 — build_fund_agreement_tx(...)
//        Client-side agreement funding tx (HTLC + agr1: OP_RETURN anchor
//        + change), signed locally with the wallet's own seed. Once
//        landed (and M1 for UTXOs):
//          fundAgreement → can route to native + broadcastTx via P2P.
//          Removes the iriumd-wallet dependency for funding.
//
//   M2b — fix native create_agreement builder
//         Five semantic bugs in rust-bridge/src/mobile/agreement.rs that
//         make native's createAgreement produce a different canonical
//         agreement than http.ts's buildAgreementBody:
//           1. Wrong mode string: "htlc_preimage" → "secret_preimage"
//           2. Missing release_authorizer (must be "payer" for non-OTC,
//              "seller" for OTC)
//           3. Missing deposit_rule plumbing in AgreementParams for
//              the refundable_deposit template
//           4. Missing purpose_reference field in AgreementParams
//           5. Wrong deadlines.settlement_deadline (hardcoded
//              Some(timeout_height) → caller-controlled, default None)
//         After all 5 fixes land:
//           createAgreement → can route to native; removes one more HTTP
//           dependency for agreement creation (which is purely client-
//           side hashing + validation anyway — iriumd's create_agreement
//           handler is a 4-line alias for inspect_agreement that does
//           not store anything).
//
//   M3 — build_agreement_release_tx / build_agreement_refund_tx
//        Client-side HTLC spend tx builders carrying the agr1:l / agr1:r
//        anchor OP_RETURN, signed locally. Same pattern as M2 for the
//        release / refund branches. Once landed (and M1):
//          buildAgreementRelease, buildAgreementRefund → can route to
//          native. Removes iriumd-wallet dependency for spend tx
//          construction (currently iriumd returns 403 FORBIDDEN if it
//          doesn't hold the recipient/refund key).
//
//   M4 — upstream irium-source change to anchor proof hashes on-chain
//        Once landed:
//          submitProof, getAgreementStatus, getReleaseEligibility,
//          getRefundEligibility → can route to native via SPV proof
//          verification. Removes the last iriumd-DB dependency.
//
// See docs/native-milestones.md for full milestone descriptions.
// ─────────────────────────────────────────────────────────────────────────

// Per-method gate: throws if no custom node is configured.
function gateOnRpcUrl<T extends (...args: any[]) => Promise<any>>(
  methodName: string,
  fn: T,
): T {
  return (async (...args: any[]) => {
    const { rpcUrl } = useWalletStore.getState();
    if (!rpcUrl) {
      throw new SpvError(
        'Internal',
        `${methodName}: Custom node required. Configure one in Settings → Custom Node (Advanced).`,
      );
    }
    return fn(...args);
  }) as T;
}

// Wrap every httpBridge function so it errors clearly when rpcUrl is null.
const wrappedHttpBridge: Partial<SpvBridge> = Object.fromEntries(
  Object.entries(httpBridge).map(([k, v]) => [
    k,
    typeof v === 'function' ? gateOnRpcUrl(k, v as any) : v,
  ]),
) as Partial<SpvBridge>;

// Load the native module (Expo Go and Jest will silently fall back to
// wrappedHttp + mock).
let nativeBridge: Partial<SpvBridge> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('spv-mobile');
  if (mod && typeof mod === 'object') {
    nativeBridge = (mod.default ?? mod) as Partial<SpvBridge>;
  }
} catch {
  // No native module bundled.
}

// Methods where wrappedHttp MUST win even though native exposes them.
// See the milestone block above for the full rationale.
const HTTP_ONLY_METHODS = [
  'createAgreement',     // M2b — native builder has 5 semantic bugs
  'rpcGetStatus',
  'rpcGetBalance',
  'rpcGetUtxos',
  'rpcGetHistory',
  'rpcGetFeeRate',
  'rpcSubmitTx',
] as const;
const nativeFiltered: Partial<SpvBridge> = { ...nativeBridge };
for (const k of HTTP_ONLY_METHODS) {
  delete (nativeFiltered as Record<string, unknown>)[k];
}

export const bridge: SpvBridge = {
  ...mockBridge,
  ...wrappedHttpBridge,
  ...nativeFiltered,
};

export * from './types';
