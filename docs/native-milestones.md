# Native milestones — work to reduce custom-node dependency

The wallet today runs a fully self-custodial P2P light client for the
crypto / sign / broadcast path, but several wallet features still rely
on a user-configured custom iriumd node for balance/UTXOs/history reads
and for all settlement-layer operations (fund / release / refund / proof).

The milestones below describe the Rust + protocol work needed to remove
those dependencies one by one. Each milestone names the new native UDL
method(s) that, once landed, allow the corresponding HTTP-only methods
in `src/bridge/index.ts` to be routed to native instead of `wrappedHttp`.

The bridge composition in `src/bridge/index.ts` already has the routing
machinery in place — these milestones are about adding the native
methods that the routing will switch to.

---

## M1 — `light_client_index_addresses(seed_hex, count)`

**What it adds:** an SPV-verified UTXO scanner inside the light client.
Walks every block under the SPV header chain, indexes outputs whose
`script_pubkey` matches any of the first `count` addresses derived from
`seed_hex`, and maintains a local UTXO + history index for each.

**What it closes:** the balance / UTXOs / history gap. Without M1, a
wallet with no custom node can sign and broadcast txs but cannot see
its own balance or transaction history.

**Right approach:** BIP157/158-style compact filters. Block-by-block
download of every full block is unviable on mobile bandwidth budgets;
compact filters let the wallet request only the blocks that touch its
addresses. Reference:
[BIP157](https://github.com/bitcoin/bips/blob/master/bip-0157.mediawiki),
[BIP158](https://github.com/bitcoin/bips/blob/master/bip-0158.mediawiki).
The iriumd peer protocol will need new message types for filter
service + filter response; that's part of the M1 scope.

**Estimated effort:** 1-2 weeks of Rust work (filter index, P2P message
types, mobile-side caching, reorg-safe re-indexing).

**Routing impact when landed:**
- `rpcGetBalance` → native (no custom node required)
- `rpcGetUtxos` → native
- `rpcGetHistory` → native

---

## M2 — `build_fund_agreement_tx(...)`

**What it adds:** a client-side builder for the agreement funding tx.
Constructs the canonical funding shape iriumd's `fund_agreement` handler
produces — but signs with the mobile wallet's own seed instead of
iriumd's wallet keys.

For each funding leg (single HTLC for OTC / Deposit / Freelance, one
HTLC per milestone for milestone agreements):
- HTLC output via `encode_htlcv1_script` (already exposed in
  `rust-bridge/src/lib.rs`)
- Immediately following `agr1:f` OP_RETURN anchor via the same
  `build_agreement_anchor_output` helper iriumd uses
- P2PKH change output back to the funder

Signed with the funder's key derived from the mobile seed. Returns the
raw signed tx hex.

**What it closes:** the iriumd-wallet dependency for funding.
Currently `fund_agreement` requires iriumd to hold UTXOs of the funder's
address (else `wallet_key_map_empty`). Mobile-side signing removes this.

**Depends on M1:** the funder needs to enumerate its own UTXOs to
select inputs. Without M1, mobile has no UTXO list.

**Routing impact when landed:**
- `fundAgreement` → native + `broadcastTx` (native P2P broadcast).
  Removes both the iriumd-wallet dependency AND the `/rpc/submit_tx`
  hop. The funding tx propagates over P2P directly.

---

## M2b — Fix native `create_agreement` builder

**Status:** the native UDL `create_agreement` method exists in
`rust-bridge/src/mobile/agreement.rs` but produces a semantically
different agreement than `buildAgreementBody` in `src/bridge/http.ts`.
Until fixed, `createAgreement` stays HTTP-routed in the bridge
composition (see `src/bridge/index.ts` `HTTP_ONLY_METHODS` list).

**Five bugs to fix in `rust-bridge/src/mobile/agreement.rs`:**

1. **Wrong mode string.** Native sets
   `AgreementReleaseCondition.mode = "htlc_preimage"`.
   Every canonical builder in `irium-source/src/settlement.rs` (lines
   1348, 1417, 1492, 1564) uses `"secret_preimage"`. The native value
   exists nowhere in irium-source; it passes validation only because
   the validator just requires `mode` to be non-empty unless it equals
   `"secret_preimage"`.

2. **Missing `release_authorizer`.** Native sets
   `release_authorizer: None`. Canonical builders set
   `Some("payer".to_string())` for non-OTC templates and
   `Some("seller".to_string())` for OTC. The wallet's HTTP path
   already does this correctly; native does not.

3. **Missing `deposit_rule` plumbing in `AgreementParams`.** The
   `AgreementParams` UDL struct in `rust-bridge/src/spv_mobile.udl` and
   `rust-bridge/src/mobile/agreement.rs` has no fields for
   `deposit_rule` (`amount`, `beneficiary_address`, `refund_address`,
   `timeout_height`, `notes`). Native always emits
   `deposit_rule: None` even for the `refundable_deposit` template —
   producing a deposit agreement with no deposit rule. The HTTP path
   includes the rule when `template_type === 'deposit'`.

4. **Missing `purpose_reference` field in `AgreementParams`.** Same
   pattern as #3 — the field exists on the agreement struct but the
   wallet-side UDL params don't carry it, so native always emits
   `purpose_reference: None`. The HTTP path threads it through when
   the caller supplies it.

5. **Wrong `deadlines.settlement_deadline`.** Native hardcodes
   `Some(params.timeout_height)`, equating it to the refund deadline.
   Canonical builders take the value from the caller, defaulting to
   `None`. The HTTP path emits `null`.

**Routing impact when all 5 fixes land:**
- `createAgreement` → native. Removes one HTTP dependency. Note that
  iriumd's `/rpc/createagreement` handler is a 4-line alias for
  `/rpc/inspectagreement` and does not persist anything — it's just a
  hash + validate helper, so moving the call client-side is pure win.

---

## M3 — `build_agreement_release_tx` + `build_agreement_refund_tx`

**What they add:** client-side HTLC spend tx builders carrying the
appropriate agreement anchor OP_RETURN (`agr1:l` for release,
`agr1:r` for refund, `agr1:m` for per-milestone release).

The existing UDL methods `build_htlc_claim_tx` and `build_htlc_refund_tx`
already produce the correct script_sig (they use the same
`encode_htlcv1_claim_witness` / `encode_htlcv1_refund_witness` helpers
iriumd uses), but they do NOT add an anchor OP_RETURN — without that,
iriumd's `scan_agreement_linked_txs` won't classify the resulting tx as
a release / refund of any agreement and `derive_lifecycle` won't update.

The new M3 builders are thin wrappers around the existing HTLC builders
plus the anchor output.

**What it closes:** the iriumd-wallet dependency for release / refund.
Currently `build_agreement_spend_internal` in iriumd looks up the
matching `recipient_pkh` or `refund_pkh` in iriumd's own wallet keys
and returns `403 FORBIDDEN` if iriumd doesn't hold the key. For mobile
self-custody, iriumd will almost never hold the key — making the
endpoint useless without M3.

**Depends on M1:** the spender needs to know about the funding UTXO
(its txid, vout, value, scriptcode) before it can build the spend.
Without M1, mobile would need to fetch the UTXO via
`/rpc/utxos` which still requires a custom node.

**Routing impact when landed:**
- `buildAgreementRelease` → native
- `buildAgreementRefund` → native

---

## M4 — On-chain proof anchoring (upstream irium-source change)

**What it adds:** an upstream change to `irium-source` so settlement
proof hashes are anchored on-chain via a new OP_RETURN prefix (e.g.
`prf1:<proof_hash_hex>:<agreement_hash_hex>`), rather than living only
in iriumd's `proofs.json` DB.

**What it closes:** the last remaining iriumd-DB dependency after M1,
M2, M2b, M3 land. Currently `submitProof` writes to iriumd's local
DB; `getAgreementStatus` and the eligibility endpoints read proof
finality from that DB. With on-chain anchoring, the mobile wallet can
verify proof finality via SPV (same way it already verifies HTLC funding
+ spend txs) instead of querying iriumd.

**Scope:** this is the largest change of the milestones because it
spans both the irium-source consensus layer (new OP_RETURN format +
parser + lifecycle derivation from chain state) and the mobile wallet
(local proof submission via P2P broadcast + SPV verification of proof
finality). Not feasible as a single PR.

**Routing impact when landed:**
- `submitProof` → native (P2P broadcast of the proof-anchoring tx)
- `getAgreementStatus` → native (derive lifecycle from SPV-verified
  chain state)
- `getReleaseEligibility` → native (verify HTLC unspent + preimage hash
  match + proof finality via SPV)
- `getRefundEligibility` → native (verify HTLC unspent + timeout
  reached via SPV header height)

After M4, the wallet has zero hard dependency on any custom node for
any wallet feature. `inspectAgreement` (the only remaining HTTP-only
method) is a pure client-side helper and can also route to native
trivially.

---

## Summary

| Milestone | Native method(s) added | HTTP method(s) it replaces | Removes dependency on |
|---|---|---|---|
| M1 | `light_client_index_addresses` | `rpcGetBalance`, `rpcGetUtxos`, `rpcGetHistory` | custom node for chain reads |
| M2 | `build_fund_agreement_tx` | `fundAgreement` | iriumd wallet for funding |
| M2b | (fix existing `create_agreement`) | `createAgreement` | iriumd `/rpc/createagreement` round-trip |
| M3 | `build_agreement_release_tx`, `build_agreement_refund_tx` | `buildAgreementRelease`, `buildAgreementRefund` | iriumd wallet for HTLC spends |
| M4 | (upstream on-chain proof anchoring) | `submitProof`, `getAgreementStatus`, `getReleaseEligibility`, `getRefundEligibility`, `inspectAgreement` | iriumd DB entirely |
