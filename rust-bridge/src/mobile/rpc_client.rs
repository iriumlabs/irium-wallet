use reqwest::blocking::Client;
use serde::Deserialize;

// ─── Wire types (iriumd JSON responses) ─────────────────────────────────────

#[derive(Deserialize)]
struct StatusResponse {
    height: u64,
    peer_count: u32,
    best_header_tip: String,
    anchor_loaded: bool,
}

#[derive(Deserialize)]
struct BalanceResponse {
    balance: u64,
    utxo_count: u32,
    height: u64,
}

#[derive(Deserialize)]
struct UtxoEntry {
    txid: String,
    index: u32,
    value: u64,
    height: u64,
    is_coinbase: bool,
    script_pubkey: String,
}

#[derive(Deserialize)]
struct UtxosResponse {
    utxos: Vec<UtxoEntry>,
    height: u64,
}

#[derive(Deserialize)]
struct TxEntry {
    txid: String,
    height: u64,
    net: i64,
}

#[derive(Deserialize)]
struct HistoryResponse {
    txs: Vec<TxEntry>,
}

#[derive(Deserialize)]
struct FeeResponse {
    min_fee_per_byte: u64,
}

#[derive(Deserialize)]
struct SubmitResponse {
    txid: String,
}

// ─── Output types (returned to ffi.rs) ─────────────────────────────────────

pub struct NodeStatus {
    pub height: u64,
    pub peer_count: u32,
    pub tip_hash: String,
    pub anchor_loaded: bool,
}

pub struct BalanceInfo {
    pub confirmed: u64,
    pub utxo_count: u32,
    pub height: u64,
}

pub struct Utxo {
    pub txid: String,
    pub index: u32,
    pub value: u64,
    pub height: u64,
    pub is_coinbase: bool,
    pub script_pubkey_hex: String,
}

pub struct TxRecord {
    pub txid: String,
    pub height: u64,
    pub net_sats: i64,
    pub direction: String,
}

// ─── Client helpers ──────────────────────────────────────────────────────────

fn get(url: &str, auth_token: Option<&str>) -> Result<reqwest::blocking::Response, String> {
    let c = Client::new();
    let mut req = c.get(url);
    if let Some(token) = auth_token {
        req = req.bearer_auth(token);
    }
    req.send().map_err(|e| e.to_string())
}

fn post_json(url: &str, auth_token: Option<&str>, body: &str) -> Result<reqwest::blocking::Response, String> {
    let c = Client::new();
    let mut req = c
        .post(url)
        .header("Content-Type", "application/json")
        .body(body.to_owned());
    if let Some(token) = auth_token {
        req = req.bearer_auth(token);
    }
    req.send().map_err(|e| e.to_string())
}

// ─── Public API ──────────────────────────────────────────────────────────────

pub fn rpc_get_status(rpc_url: &str, auth_token: Option<&str>) -> Result<NodeStatus, String> {
    let url = format!("{}/status", rpc_url.trim_end_matches('/'));
    let resp = get(&url, auth_token)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let s: StatusResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(NodeStatus {
        height: s.height,
        peer_count: s.peer_count,
        tip_hash: s.best_header_tip,
        anchor_loaded: s.anchor_loaded,
    })
}

pub fn rpc_get_balance(rpc_url: &str, auth_token: Option<&str>, address: &str) -> Result<BalanceInfo, String> {
    let url = format!("{}/rpc/balance?address={}", rpc_url.trim_end_matches('/'), address);
    let resp = get(&url, auth_token)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let b: BalanceResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(BalanceInfo {
        confirmed: b.balance,
        utxo_count: b.utxo_count,
        height: b.height,
    })
}

pub fn rpc_get_utxos(rpc_url: &str, auth_token: Option<&str>, address: &str) -> Result<Vec<Utxo>, String> {
    let url = format!("{}/rpc/utxos?address={}", rpc_url.trim_end_matches('/'), address);
    let resp = get(&url, auth_token)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let r: UtxosResponse = resp.json().map_err(|e| e.to_string())?;
    let _ = r.height; // available if needed later
    Ok(r.utxos
        .into_iter()
        .map(|u| Utxo {
            txid: u.txid,
            index: u.index,
            value: u.value,
            height: u.height,
            is_coinbase: u.is_coinbase,
            script_pubkey_hex: u.script_pubkey,
        })
        .collect())
}

pub fn rpc_get_history(rpc_url: &str, auth_token: Option<&str>, address: &str) -> Result<Vec<TxRecord>, String> {
    let url = format!("{}/rpc/history?address={}", rpc_url.trim_end_matches('/'), address);
    let resp = get(&url, auth_token)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let r: HistoryResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(r.txs
        .into_iter()
        .map(|t| TxRecord {
            txid: t.txid,
            height: t.height,
            net_sats: t.net,
            direction: if t.net >= 0 { "in".to_string() } else { "out".to_string() },
        })
        .collect())
}

pub fn rpc_get_fee_rate(rpc_url: &str, auth_token: Option<&str>) -> Result<u64, String> {
    let url = format!("{}/rpc/fee_estimate", rpc_url.trim_end_matches('/'));
    let resp = get(&url, auth_token)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let f: FeeResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(f.min_fee_per_byte)
}

pub fn rpc_submit_tx(rpc_url: &str, auth_token: Option<&str>, tx_hex: &str) -> Result<String, String> {
    let url = format!("{}/rpc/submit_tx", rpc_url.trim_end_matches('/'));
    let body = format!(r#"{{"tx_hex":"{}"}}"#, tx_hex);
    let resp = post_json(&url, auth_token, &body)?;
    if !resp.status().is_success() {
        return Err(format!("status {}", resp.status()));
    }
    let s: SubmitResponse = resp.json().map_err(|e| e.to_string())?;
    Ok(s.txid)
}
