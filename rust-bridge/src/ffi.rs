use crate::mobile::{
    agreement::{self, AgreementParams as AgreementParamsInner},
    light_client::{self, LightClientConfig as LightClientConfigInner},
    rpc_client,
    wallet,
};

// UniFFI expects these types in scope.  The UDL dictionaries are generated as
// plain Rust structs by the scaffolding; we just need to map between them and
// our internal types where signatures differ.

// ─── Error ───────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum SpvError {
    #[error("{0}")]
    InvalidArgument(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    Rpc(String),
    #[error("{0}")]
    Wallet(String),
    #[error("{0}")]
    Parse(String),
    #[error("{0}")]
    Internal(String),
}

fn wallet_err(e: String) -> SpvError {
    SpvError::Wallet(e)
}
fn rpc_err(e: String) -> SpvError {
    SpvError::Rpc(e)
}
fn net_err(e: String) -> SpvError {
    SpvError::Network(e)
}
fn arg_err(e: &str) -> SpvError {
    SpvError::InvalidArgument(e.to_string())
}
fn internal_err(e: String) -> SpvError {
    SpvError::Internal(e)
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

pub fn generate_mnemonic() -> Result<String, SpvError> {
    wallet::generate_mnemonic().map_err(wallet_err)
}

pub fn mnemonic_to_seed(mnemonic: &str, passphrase: &str) -> Result<String, SpvError> {
    wallet::mnemonic_to_seed(mnemonic, passphrase).map_err(wallet_err)
}

pub fn derive_address(seed_hex: &str, index: u32) -> Result<String, SpvError> {
    wallet::derive_address(seed_hex, index).map_err(wallet_err)
}

pub fn derive_privkey_hex(seed_hex: &str, index: u32) -> Result<String, SpvError> {
    wallet::derive_privkey_hex(seed_hex, index).map_err(wallet_err)
}

pub fn validate_address(address: &str) -> bool {
    wallet::validate_address(address)
}

pub fn export_wif(seed_hex: &str, index: u32) -> Result<String, SpvError> {
    wallet::export_wif(seed_hex, index).map_err(wallet_err)
}

pub fn import_wif(wif: &str) -> Result<WifKey, SpvError> {
    let imported = wallet::import_wif(wif).map_err(wallet_err)?;
    Ok(WifKey {
        address: imported.address,
        pubkey_hex: imported.pubkey_hex,
    })
}

// ─── Transaction building ────────────────────────────────────────────────────

pub fn build_send_tx(
    utxos: Vec<Utxo>,
    to_address: &str,
    amount_sats: u64,
    fee_sats: u64,
    seed_hex: &str,
    from_index: u32,
) -> Result<String, SpvError> {
    let txids: Vec<String> = utxos.iter().map(|u| u.txid.clone()).collect();
    let indices: Vec<u32> = utxos.iter().map(|u| u.index).collect();
    let values: Vec<u64> = utxos.iter().map(|u| u.value).collect();

    wallet::build_send_tx(&txids, &indices, &values, to_address, amount_sats, fee_sats, seed_hex, from_index)
        .map_err(wallet_err)
}

// ─── HTLC ────────────────────────────────────────────────────────────────────

pub fn encode_htlcv1(
    secret_hash_hex: &str,
    recipient_address: &str,
    refund_address: &str,
    timeout_height: u64,
) -> Result<String, SpvError> {
    wallet::encode_htlcv1(secret_hash_hex, recipient_address, refund_address, timeout_height)
        .map_err(wallet_err)
}

pub fn decode_htlcv1(script_hex: &str) -> Result<HtlcInfo, SpvError> {
    let decoded = wallet::decode_htlcv1(script_hex).map_err(wallet_err)?;
    Ok(HtlcInfo {
        secret_hash_hex: decoded.secret_hash_hex,
        recipient_address: decoded.recipient_address,
        refund_address: decoded.refund_address,
        timeout_height: decoded.timeout_height,
    })
}

pub fn build_htlc_claim_tx(
    htlc_txid: &str,
    htlc_index: u32,
    htlc_value: u64,
    htlc_script_hex: &str,
    preimage_hex: &str,
    seed_hex: &str,
    key_index: u32,
    to_address: &str,
    fee_sats: u64,
) -> Result<String, SpvError> {
    wallet::build_htlc_claim_tx(
        htlc_txid, htlc_index, htlc_value, htlc_script_hex,
        preimage_hex, seed_hex, key_index, to_address, fee_sats,
    )
    .map_err(wallet_err)
}

pub fn build_htlc_refund_tx(
    htlc_txid: &str,
    htlc_index: u32,
    htlc_value: u64,
    htlc_script_hex: &str,
    seed_hex: &str,
    key_index: u32,
    to_address: &str,
    fee_sats: u64,
    timeout_height: u64,
) -> Result<String, SpvError> {
    wallet::build_htlc_refund_tx(
        htlc_txid, htlc_index, htlc_value, htlc_script_hex,
        seed_hex, key_index, to_address, fee_sats, timeout_height,
    )
    .map_err(wallet_err)
}

// ─── Agreement ───────────────────────────────────────────────────────────────

pub fn compute_agreement_hash(agreement_json: &str) -> Result<String, SpvError> {
    agreement::compute_agreement_hash(agreement_json).map_err(internal_err)
}

pub fn create_agreement(params: AgreementParams) -> Result<String, SpvError> {
    let inner = AgreementParamsInner {
        template_type: params.template_type,
        payer_address: params.payer_address,
        payee_address: params.payee_address,
        total_amount_sats: params.total_amount_sats,
        timeout_height: params.timeout_height,
        secret_hash_hex: params.secret_hash_hex,
        asset_reference: params.asset_reference,
        payment_reference: params.payment_reference,
        document_hash: params.document_hash,
    };
    agreement::create_agreement(inner).map_err(internal_err)
}

// ─── SPV ─────────────────────────────────────────────────────────────────────

pub fn verify_merkle_proof(
    txid_hex: &str,
    merkle_root_hex: &str,
    proof_hex_nodes: Vec<String>,
    index: u64,
) -> Result<bool, SpvError> {
    let txid_bytes = hex::decode(txid_hex).map_err(|e| SpvError::Parse(e.to_string()))?;
    if txid_bytes.len() != 32 {
        return Err(arg_err("txid_hex must be 32 bytes"));
    }
    let root_bytes = hex::decode(merkle_root_hex).map_err(|e| SpvError::Parse(e.to_string()))?;
    if root_bytes.len() != 32 {
        return Err(arg_err("merkle_root_hex must be 32 bytes"));
    }

    let proof: Result<Vec<[u8; 32]>, _> = proof_hex_nodes
        .iter()
        .map(|h| {
            hex::decode(h).and_then(|b| {
                if b.len() == 32 {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&b);
                    Ok(arr)
                } else {
                    Err(hex::FromHexError::InvalidStringLength)
                }
            })
        })
        .collect();
    let proof = proof.map_err(|e| SpvError::Parse(e.to_string()))?;

    let mut txid = [0u8; 32];
    txid.copy_from_slice(&txid_bytes);
    let mut root = [0u8; 32];
    root.copy_from_slice(&root_bytes);

    Ok(irium_node_rs::spv::verify_merkle_proof(&txid, &root, proof, index as usize))
}

pub fn get_synced_height() -> u64 {
    light_client::get_synced_height()
}

pub fn get_tip_hash() -> String {
    light_client::get_tip_hash()
}

// ─── RPC client ──────────────────────────────────────────────────────────────

pub fn rpc_get_status(rpc_url: &str, auth_token: Option<String>) -> Result<NodeStatus, SpvError> {
    let s = rpc_client::rpc_get_status(rpc_url, auth_token.as_deref()).map_err(rpc_err)?;
    Ok(NodeStatus {
        height: s.height,
        peer_count: s.peer_count,
        tip_hash: s.tip_hash,
        anchor_loaded: s.anchor_loaded,
    })
}

pub fn rpc_get_balance(rpc_url: &str, auth_token: Option<String>, address: &str) -> Result<BalanceInfo, SpvError> {
    let b = rpc_client::rpc_get_balance(rpc_url, auth_token.as_deref(), address).map_err(rpc_err)?;
    Ok(BalanceInfo {
        confirmed: b.confirmed,
        utxo_count: b.utxo_count,
        height: b.height,
    })
}

pub fn rpc_get_utxos(rpc_url: &str, auth_token: Option<String>, address: &str) -> Result<Vec<Utxo>, SpvError> {
    let list = rpc_client::rpc_get_utxos(rpc_url, auth_token.as_deref(), address).map_err(rpc_err)?;
    Ok(list
        .into_iter()
        .map(|u| Utxo {
            txid: u.txid,
            index: u.index,
            value: u.value,
            height: u.height,
            is_coinbase: u.is_coinbase,
            script_pubkey_hex: u.script_pubkey_hex,
        })
        .collect())
}

pub fn rpc_get_history(rpc_url: &str, auth_token: Option<String>, address: &str) -> Result<Vec<TxRecord>, SpvError> {
    let list = rpc_client::rpc_get_history(rpc_url, auth_token.as_deref(), address).map_err(rpc_err)?;
    Ok(list
        .into_iter()
        .map(|t| TxRecord {
            txid: t.txid,
            height: t.height,
            net_sats: t.net_sats,
            direction: t.direction,
        })
        .collect())
}

pub fn rpc_get_fee_rate(rpc_url: &str, auth_token: Option<String>) -> Result<u64, SpvError> {
    rpc_client::rpc_get_fee_rate(rpc_url, auth_token.as_deref()).map_err(rpc_err)
}

pub fn rpc_submit_tx(rpc_url: &str, auth_token: Option<String>, tx_hex: &str) -> Result<String, SpvError> {
    rpc_client::rpc_submit_tx(rpc_url, auth_token.as_deref(), tx_hex).map_err(rpc_err)
}

// ─── P2P light client ────────────────────────────────────────────────────────

pub fn start_light_client(config: LightClientConfig) -> Result<(), SpvError> {
    light_client::start_light_client(LightClientConfigInner {
        seedlist_path: config.seedlist_path,
        extra_peer: config.extra_peer,
        start_height: config.start_height,
        start_hash: config.start_hash,
    })
    .map_err(net_err)
}

pub fn stop_light_client() {
    light_client::stop_light_client()
}

pub fn is_syncing() -> bool {
    light_client::is_syncing()
}

pub fn peer_count() -> u32 {
    light_client::peer_count()
}

pub fn broadcast_tx(tx_hex: &str) -> Result<String, SpvError> {
    light_client::broadcast_tx(tx_hex).map_err(net_err)
}

// ─── UDL dictionary structs (generated by UniFFI scaffolding) ─────────────────
// These are declared here so Rust knows about them; UniFFI's proc-macro derives
// the actual FFI glue from the .udl file via include_scaffolding!.

pub struct Utxo {
    pub txid: String,
    pub index: u32,
    pub value: u64,
    pub height: u64,
    pub is_coinbase: bool,
    pub script_pubkey_hex: String,
}

pub struct BalanceInfo {
    pub confirmed: u64,
    pub utxo_count: u32,
    pub height: u64,
}

pub struct NodeStatus {
    pub height: u64,
    pub peer_count: u32,
    pub tip_hash: String,
    pub anchor_loaded: bool,
}

pub struct TxRecord {
    pub txid: String,
    pub height: u64,
    pub net_sats: i64,
    pub direction: String,
}

pub struct WifKey {
    pub address: String,
    pub pubkey_hex: String,
}

pub struct HtlcInfo {
    pub secret_hash_hex: String,
    pub recipient_address: String,
    pub refund_address: String,
    pub timeout_height: u64,
}

pub struct AgreementParams {
    pub template_type: String,
    pub payer_address: String,
    pub payee_address: String,
    pub total_amount_sats: u64,
    pub timeout_height: u64,
    pub secret_hash_hex: String,
    pub asset_reference: Option<String>,
    pub payment_reference: Option<String>,
    pub document_hash: Option<String>,
}

pub struct LightClientConfig {
    pub seedlist_path: String,
    pub extra_peer: Option<String>,
    pub start_height: u64,
    pub start_hash: Option<String>,
}
