#![allow(non_snake_case)]

use jni::objects::{JClass, JString};
use jni::sys::{jbyte, jint, jlong, jstring};
use jni::JNIEnv;
use serde::Deserialize;

// ── helpers ───────────────────────────────────────────────────────────────────

fn get_str(env: &mut JNIEnv, s: &JString) -> String {
    match env.get_string(s) {
        Ok(js) => js.to_str().unwrap_or("").to_string(),
        Err(_) => String::new(),
    }
}

fn ret_str(env: &mut JNIEnv, s: String) -> jstring {
    env.new_string(s)
        .map(|j| j.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

fn ret_ok(env: &mut JNIEnv, result: Result<String, impl std::fmt::Display>) -> jstring {
    ret_str(
        env,
        match result {
            Ok(v) => v,
            Err(e) => format!("ERROR:{}", e),
        },
    )
}

fn none_if_empty(s: String) -> Option<String> {
    if s.is_empty() { None } else { Some(s) }
}

// ── P2P light client ──────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativePeerCount(
    _env: JNIEnv,
    _class: JClass,
) -> jint {
    crate::ffi::peer_count() as jint
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeGetSyncedHeight(
    _env: JNIEnv,
    _class: JClass,
) -> jlong {
    crate::ffi::get_synced_height() as jlong
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeIsSyncing(
    _env: JNIEnv,
    _class: JClass,
) -> jbyte {
    if crate::ffi::is_syncing() { 1 } else { 0 }
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeGetTipHash(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    ret_str(&mut env, crate::ffi::get_tip_hash())
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeStartLightClient(
    mut env: JNIEnv,
    _class: JClass,
    seedlist_path: JString,
    extra_peer: JString,
    start_height: jlong,
    start_hash: JString,
) -> jstring {
    let config = crate::ffi::LightClientConfig {
        seedlist_path: get_str(&mut env, &seedlist_path),
        extra_peer: none_if_empty(get_str(&mut env, &extra_peer)),
        start_height: start_height as u64,
        start_hash: none_if_empty(get_str(&mut env, &start_hash)),
    };
    let result = crate::ffi::start_light_client(config)
        .map(|_| String::new())
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeStopLightClient(
    _env: JNIEnv,
    _class: JClass,
) {
    crate::ffi::stop_light_client();
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeBroadcastTx(
    mut env: JNIEnv,
    _class: JClass,
    tx_hex: JString,
) -> jstring {
    let tx = get_str(&mut env, &tx_hex);
    ret_ok(&mut env, crate::ffi::broadcast_tx(&tx).map_err(|e| e.to_string()))
}

// ── Wallet ────────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeGenerateMnemonic(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    ret_ok(&mut env, crate::ffi::generate_mnemonic().map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeMnemonicToSeed(
    mut env: JNIEnv,
    _class: JClass,
    mnemonic: JString,
    passphrase: JString,
) -> jstring {
    let m = get_str(&mut env, &mnemonic);
    let p = get_str(&mut env, &passphrase);
    ret_ok(&mut env, crate::ffi::mnemonic_to_seed(&m, &p).map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeDeriveAddress(
    mut env: JNIEnv,
    _class: JClass,
    seed_hex: JString,
    index: jint,
) -> jstring {
    let s = get_str(&mut env, &seed_hex);
    ret_ok(&mut env, crate::ffi::derive_address(&s, index as u32).map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeDerivePrivkeyHex(
    mut env: JNIEnv,
    _class: JClass,
    seed_hex: JString,
    index: jint,
) -> jstring {
    let s = get_str(&mut env, &seed_hex);
    ret_ok(&mut env, crate::ffi::derive_privkey_hex(&s, index as u32).map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeValidateAddress(
    mut env: JNIEnv,
    _class: JClass,
    address: JString,
) -> jbyte {
    let a = get_str(&mut env, &address);
    if crate::ffi::validate_address(&a) { 1 } else { 0 }
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeExportWif(
    mut env: JNIEnv,
    _class: JClass,
    seed_hex: JString,
    index: jint,
) -> jstring {
    let s = get_str(&mut env, &seed_hex);
    ret_ok(&mut env, crate::ffi::export_wif(&s, index as u32).map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeImportWif(
    mut env: JNIEnv,
    _class: JClass,
    wif: JString,
) -> jstring {
    let w = get_str(&mut env, &wif);
    let result = crate::ffi::import_wif(&w)
        .map(|k| {
            format!(
                r#"{{"address":"{}","pubkey_hex":"{}"}}"#,
                k.address, k.pubkey_hex
            )
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

// ── Transaction building ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UtxoJson {
    txid: String,
    index: u32,
    value: u64,
    height: u64,
    is_coinbase: bool,
    script_pubkey_hex: String,
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeBuildSendTx(
    mut env: JNIEnv,
    _class: JClass,
    utxos_json: JString,
    to_address: JString,
    amount_sats: jlong,
    fee_sats: jlong,
    seed_hex: JString,
    from_index: jint,
) -> jstring {
    let utxos_str = get_str(&mut env, &utxos_json);
    let to = get_str(&mut env, &to_address);
    let seed = get_str(&mut env, &seed_hex);

    let result = match serde_json::from_str::<Vec<UtxoJson>>(&utxos_str) {
        Err(e) => Err(format!("parse utxos: {}", e)),
        Ok(raw) => {
            let utxos: Vec<crate::ffi::Utxo> = raw
                .into_iter()
                .map(|u| crate::ffi::Utxo {
                    txid: u.txid,
                    index: u.index,
                    value: u.value,
                    height: u.height,
                    is_coinbase: u.is_coinbase,
                    script_pubkey_hex: u.script_pubkey_hex,
                })
                .collect();
            crate::ffi::build_send_tx(
                utxos,
                &to,
                amount_sats as u64,
                fee_sats as u64,
                &seed,
                from_index as u32,
            )
            .map_err(|e| e.to_string())
        }
    };
    ret_ok(&mut env, result)
}

// ── HTLC ──────────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeEncodeHtlcv1(
    mut env: JNIEnv,
    _class: JClass,
    secret_hash_hex: JString,
    recipient_address: JString,
    refund_address: JString,
    timeout_height: jlong,
) -> jstring {
    let sh = get_str(&mut env, &secret_hash_hex);
    let ra = get_str(&mut env, &recipient_address);
    let rfa = get_str(&mut env, &refund_address);
    ret_ok(
        &mut env,
        crate::ffi::encode_htlcv1(&sh, &ra, &rfa, timeout_height as u64)
            .map_err(|e| e.to_string()),
    )
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeDecodeHtlcv1(
    mut env: JNIEnv,
    _class: JClass,
    script_hex: JString,
) -> jstring {
    let s = get_str(&mut env, &script_hex);
    let result = crate::ffi::decode_htlcv1(&s)
        .map(|h| {
            format!(
                r#"{{"secret_hash_hex":"{}","recipient_address":"{}","refund_address":"{}","timeout_height":{}}}"#,
                h.secret_hash_hex, h.recipient_address, h.refund_address, h.timeout_height
            )
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeBuildHtlcClaimTx(
    mut env: JNIEnv,
    _class: JClass,
    htlc_txid: JString,
    htlc_index: jint,
    htlc_value: jlong,
    htlc_script_hex: JString,
    preimage_hex: JString,
    seed_hex: JString,
    key_index: jint,
    to_address: JString,
    fee_sats: jlong,
) -> jstring {
    let txid = get_str(&mut env, &htlc_txid);
    let script = get_str(&mut env, &htlc_script_hex);
    let preimage = get_str(&mut env, &preimage_hex);
    let seed = get_str(&mut env, &seed_hex);
    let to = get_str(&mut env, &to_address);
    ret_ok(
        &mut env,
        crate::ffi::build_htlc_claim_tx(
            &txid,
            htlc_index as u32,
            htlc_value as u64,
            &script,
            &preimage,
            &seed,
            key_index as u32,
            &to,
            fee_sats as u64,
        )
        .map_err(|e| e.to_string()),
    )
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeBuildHtlcRefundTx(
    mut env: JNIEnv,
    _class: JClass,
    htlc_txid: JString,
    htlc_index: jint,
    htlc_value: jlong,
    htlc_script_hex: JString,
    seed_hex: JString,
    key_index: jint,
    to_address: JString,
    fee_sats: jlong,
    timeout_height: jlong,
) -> jstring {
    let txid = get_str(&mut env, &htlc_txid);
    let script = get_str(&mut env, &htlc_script_hex);
    let seed = get_str(&mut env, &seed_hex);
    let to = get_str(&mut env, &to_address);
    ret_ok(
        &mut env,
        crate::ffi::build_htlc_refund_tx(
            &txid,
            htlc_index as u32,
            htlc_value as u64,
            &script,
            &seed,
            key_index as u32,
            &to,
            fee_sats as u64,
            timeout_height as u64,
        )
        .map_err(|e| e.to_string()),
    )
}

// ── Agreement ─────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeComputeAgreementHash(
    mut env: JNIEnv,
    _class: JClass,
    agreement_json: JString,
) -> jstring {
    let j = get_str(&mut env, &agreement_json);
    ret_ok(&mut env, crate::ffi::compute_agreement_hash(&j).map_err(|e| e.to_string()))
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeCreateAgreement(
    mut env: JNIEnv,
    _class: JClass,
    template_type: JString,
    payer_address: JString,
    payee_address: JString,
    total_amount_sats: jlong,
    timeout_height: jlong,
    secret_hash_hex: JString,
    asset_reference: JString,
    payment_reference: JString,
    document_hash: JString,
) -> jstring {
    let params = crate::ffi::AgreementParams {
        template_type: get_str(&mut env, &template_type),
        payer_address: get_str(&mut env, &payer_address),
        payee_address: get_str(&mut env, &payee_address),
        total_amount_sats: total_amount_sats as u64,
        timeout_height: timeout_height as u64,
        secret_hash_hex: get_str(&mut env, &secret_hash_hex),
        asset_reference: none_if_empty(get_str(&mut env, &asset_reference)),
        payment_reference: none_if_empty(get_str(&mut env, &payment_reference)),
        document_hash: none_if_empty(get_str(&mut env, &document_hash)),
    };
    ret_ok(&mut env, crate::ffi::create_agreement(params).map_err(|e| e.to_string()))
}

// ── SPV ───────────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeVerifyMerkleProof(
    mut env: JNIEnv,
    _class: JClass,
    txid_hex: JString,
    merkle_root_hex: JString,
    proof_hex_nodes_json: JString,
    index: jlong,
) -> jbyte {
    let txid = get_str(&mut env, &txid_hex);
    let root = get_str(&mut env, &merkle_root_hex);
    let nodes_json = get_str(&mut env, &proof_hex_nodes_json);

    match serde_json::from_str::<Vec<String>>(&nodes_json) {
        Err(_) => -1,
        Ok(nodes) => match crate::ffi::verify_merkle_proof(&txid, &root, nodes, index as u64) {
            Ok(true) => 1,
            Ok(false) => 0,
            Err(_) => -1,
        },
    }
}

// ── RPC client ────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcGetStatus(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
) -> jstring {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    let result = crate::ffi::rpc_get_status(&url, token)
        .map(|s| {
            format!(
                r#"{{"height":{},"peer_count":{},"tip_hash":"{}","anchor_loaded":{}}}"#,
                s.height, s.peer_count, s.tip_hash, s.anchor_loaded
            )
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcGetBalance(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
    address: JString,
) -> jstring {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    let addr = get_str(&mut env, &address);
    let result = crate::ffi::rpc_get_balance(&url, token, &addr)
        .map(|b| {
            format!(
                r#"{{"confirmed":{},"utxo_count":{},"height":{}}}"#,
                b.confirmed, b.utxo_count, b.height
            )
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcGetUtxos(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
    address: JString,
) -> jstring {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    let addr = get_str(&mut env, &address);
    let result = crate::ffi::rpc_get_utxos(&url, token, &addr)
        .map(|list| {
            let items: Vec<String> = list
                .into_iter()
                .map(|u| {
                    format!(
                        r#"{{"txid":"{}","index":{},"value":{},"height":{},"is_coinbase":{},"script_pubkey_hex":"{}"}}"#,
                        u.txid, u.index, u.value, u.height, u.is_coinbase, u.script_pubkey_hex
                    )
                })
                .collect();
            format!("[{}]", items.join(","))
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcGetHistory(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
    address: JString,
) -> jstring {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    let addr = get_str(&mut env, &address);
    let result = crate::ffi::rpc_get_history(&url, token, &addr)
        .map(|list| {
            let items: Vec<String> = list
                .into_iter()
                .map(|t| {
                    format!(
                        r#"{{"txid":"{}","height":{},"net_sats":{},"direction":"{}"}}"#,
                        t.txid, t.height, t.net_sats, t.direction
                    )
                })
                .collect();
            format!("[{}]", items.join(","))
        })
        .map_err(|e| e.to_string());
    ret_ok(&mut env, result)
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcGetFeeRate(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
) -> jlong {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    crate::ffi::rpc_get_fee_rate(&url, token).unwrap_or(10) as jlong
}

#[no_mangle]
pub extern "C" fn Java_expo_modules_spvmobile_SpvNative_nativeRpcSubmitTx(
    mut env: JNIEnv,
    _class: JClass,
    rpc_url: JString,
    auth_token: JString,
    tx_hex: JString,
) -> jstring {
    let url = get_str(&mut env, &rpc_url);
    let token = none_if_empty(get_str(&mut env, &auth_token));
    let tx = get_str(&mut env, &tx_hex);
    ret_ok(
        &mut env,
        crate::ffi::rpc_submit_tx(&url, token, &tx).map_err(|e| e.to_string()),
    )
}
