use bip39::{Language, Mnemonic};
use hmac::{Hmac, Mac};
use k256::{
    ecdsa::{signature::hazmat::PrehashSigner, Signature, SigningKey},
    elliptic_curve::sec1::ToEncodedPoint,
    SecretKey,
};
use num_bigint::BigUint;
use num_traits::Zero;
use ripemd::Ripemd160;
use sha2::{Digest, Sha256, Sha512};

use irium_node_rs::tx::{
    encode_htlcv1_claim_witness, encode_htlcv1_refund_witness, encode_htlcv1_script,
    p2pkh_script, parse_htlcv1_script, HtlcV1Output, Transaction, TxInput, TxOutput,
};

const IRIUM_VERSION: u8 = 0x39;
const SIGHASH_ALL: u32 = 1;

const SECP256K1_N: [u8; 32] = [
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE,
    0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B,
    0xBF, 0xD2, 0x5E, 0x8C, 0xD0, 0x36, 0x41, 0x41,
];

// ─── Public API ─────────────────────────────────────────────────────────────

pub fn generate_mnemonic() -> Result<String, String> {
    // Desktop (irium-wallet.rs) uses Mnemonic::generate(24) — 256-bit entropy, 24 words.
    Mnemonic::generate_in(Language::English, 24)
        .map(|m| m.to_string())
        .map_err(|e| e.to_string())
}

/// Returns the full 64-byte BIP39 seed as a 128-char hex string.
/// Pass `passphrase = ""` for the standard empty-passphrase derivation.
pub fn mnemonic_to_seed(mnemonic: &str, passphrase: &str) -> Result<String, String> {
    let m = Mnemonic::parse_in_normalized(Language::English, mnemonic.trim())
        .map_err(|e| e.to_string())?;
    let seed = m.to_seed(passphrase); // 64 bytes PBKDF2-HMAC-SHA512
    Ok(hex::encode(seed))
}

/// Derive the Irium address for the given seed and index.
/// seed_hex = 64 chars (32 B) → legacy SHA256-LE path
/// seed_hex = 128 chars (64 B) → BIP32 m/44'/1'/0'/0/<index>
pub fn derive_address(seed_hex: &str, index: u32) -> Result<String, String> {
    let secret = route_derive_secret(seed_hex, index)?;
    Ok(address_from_secret(&secret))
}

pub fn derive_privkey_hex(seed_hex: &str, index: u32) -> Result<String, String> {
    let secret = route_derive_secret(seed_hex, index)?;
    Ok(hex::encode(secret.to_bytes()))
}

/// Export a WIF-encoded private key for the given seed and index.
/// Version byte 0x80, compression flag 0x01 — matches desktop wallet exactly.
pub fn export_wif(seed_hex: &str, index: u32) -> Result<String, String> {
    let secret = route_derive_secret(seed_hex, index)?;
    let mut body = Vec::with_capacity(34);
    body.push(0x80u8);
    body.extend_from_slice(&secret.to_bytes());
    body.push(0x01u8); // compressed
    Ok(base58check_encode(&body))
}

pub struct WifImported {
    pub address: String,
    pub pubkey_hex: String,
}

/// Import a WIF private key, returning the corresponding address and compressed pubkey.
pub fn import_wif(wif: &str) -> Result<WifImported, String> {
    let data = base58check_decode(wif).ok_or_else(|| "invalid WIF checksum".to_string())?;
    if data.len() != 33 && data.len() != 34 {
        return Err(format!("invalid WIF length: {}", data.len()));
    }
    if data[0] != 0x80 {
        return Err("unsupported WIF version byte".to_string());
    }
    if data.len() == 34 && data[33] != 0x01 {
        return Err("invalid WIF compression flag".to_string());
    }
    let mut privkey = [0u8; 32];
    privkey.copy_from_slice(&data[1..33]);
    let secret = SecretKey::from_slice(&privkey).map_err(|e| e.to_string())?;
    let pubkey = secret.public_key().to_encoded_point(true);
    Ok(WifImported {
        address: address_from_secret(&secret),
        pubkey_hex: hex::encode(pubkey.as_bytes()),
    })
}

pub fn validate_address(address: &str) -> bool {
    address_to_pkh(address).is_some()
}

/// Build and sign a P2PKH send transaction.
/// Returns the signed transaction as a hex string.
pub fn build_send_tx(
    utxo_txids: &[String],
    utxo_indices: &[u32],
    utxo_values: &[u64],
    to_address: &str,
    amount_sats: u64,
    fee_sats: u64,
    seed_hex: &str,
    from_index: u32,
) -> Result<String, String> {
    if utxo_txids.len() != utxo_indices.len() || utxo_txids.len() != utxo_values.len() {
        return Err("utxo arrays length mismatch".to_string());
    }

    let to_pkh = address_to_pkh(to_address).ok_or("invalid destination address")?;
    let secret = route_derive_secret(seed_hex, from_index)?;
    let pubkey_bytes = secret.public_key().to_encoded_point(true).as_bytes().to_vec();
    let from_pkh = hash160(&pubkey_bytes);
    let from_locking = p2pkh_script(&from_pkh);

    let total_in: u64 = utxo_values.iter().sum();
    let total_needed = amount_sats + fee_sats;
    if total_in < total_needed {
        return Err(format!(
            "insufficient funds: have {total_in} sats, need {total_needed}"
        ));
    }

    let inputs: Vec<TxInput> = utxo_txids
        .iter()
        .zip(utxo_indices.iter())
        .map(|(txid_hex, &idx)| {
            let mut txid = [0u8; 32];
            if let Ok(bytes) = hex::decode(txid_hex) {
                if bytes.len() == 32 {
                    txid.copy_from_slice(&bytes);
                    txid.reverse(); // display → internal byte order
                }
            }
            TxInput {
                prev_txid: txid,
                prev_index: idx,
                script_sig: Vec::new(),
                sequence: 0xffffffff,
            }
        })
        .collect();

    let mut outputs = vec![TxOutput {
        value: amount_sats,
        script_pubkey: p2pkh_script(&to_pkh),
    }];
    let change = total_in - total_needed;
    if change > 0 {
        outputs.push(TxOutput {
            value: change,
            script_pubkey: from_locking.clone(),
        });
    }

    let unsigned = Transaction {
        version: 1,
        inputs: inputs.clone(),
        outputs: outputs.clone(),
        locktime: 0,
    };

    let signing_key = SigningKey::from_bytes(&secret.to_bytes()).map_err(|e| e.to_string())?;
    let mut signed_inputs = inputs;

    for i in 0..signed_inputs.len() {
        let sighash = p2pkh_sighash(&unsigned, i, &from_locking);
        let sig: Signature = signing_key.sign_prehash(&sighash).map_err(|e| e.to_string())?;
        let mut sig_der = sig.to_der().to_bytes().to_vec();
        sig_der.push(SIGHASH_ALL as u8);

        let mut script_sig = Vec::new();
        script_sig.push(sig_der.len() as u8);
        script_sig.extend_from_slice(&sig_der);
        script_sig.push(pubkey_bytes.len() as u8);
        script_sig.extend_from_slice(&pubkey_bytes);

        signed_inputs[i].script_sig = script_sig;
    }

    let signed_tx = Transaction {
        version: 1,
        inputs: signed_inputs,
        outputs,
        locktime: 0,
    };
    Ok(hex::encode(signed_tx.serialize()))
}

/// Build and sign an HTLCv1 claim transaction (reveals preimage to unlock funds).
pub fn build_htlc_claim_tx(
    htlc_txid_hex: &str,
    htlc_index: u32,
    htlc_value: u64,
    htlc_script_hex: &str,
    preimage_hex: &str,
    seed_hex: &str,
    key_index: u32,
    to_address: &str,
    fee_sats: u64,
) -> Result<String, String> {
    let htlc_script = hex::decode(htlc_script_hex).map_err(|e| e.to_string())?;
    let preimage = hex::decode(preimage_hex).map_err(|e| e.to_string())?;
    let to_pkh = address_to_pkh(to_address).ok_or("invalid destination address")?;

    let mut txid = [0u8; 32];
    let txid_bytes = hex::decode(htlc_txid_hex).map_err(|e| e.to_string())?;
    if txid_bytes.len() != 32 {
        return Err("htlc_txid must be 32 bytes hex".to_string());
    }
    txid.copy_from_slice(&txid_bytes);
    txid.reverse();

    let secret = route_derive_secret(seed_hex, key_index)?;
    let pubkey_bytes = secret.public_key().to_encoded_point(true).as_bytes().to_vec();
    let out_value = htlc_value.checked_sub(fee_sats).ok_or("fee exceeds htlc value")?;

    let input = TxInput {
        prev_txid: txid,
        prev_index: htlc_index,
        script_sig: Vec::new(),
        sequence: 0xffffffff,
    };
    let output = TxOutput {
        value: out_value,
        script_pubkey: p2pkh_script(&to_pkh),
    };
    let unsigned = Transaction {
        version: 1,
        inputs: vec![input],
        outputs: vec![output],
        locktime: 0,
    };

    let signing_key = SigningKey::from_bytes(&secret.to_bytes()).map_err(|e| e.to_string())?;
    let sighash = p2pkh_sighash(&unsigned, 0, &htlc_script);
    let sig: Signature = signing_key.sign_prehash(&sighash).map_err(|e| e.to_string())?;
    let mut sig_der = sig.to_der().to_bytes().to_vec();
    sig_der.push(SIGHASH_ALL as u8);

    let script_sig = encode_htlcv1_claim_witness(&sig_der, &pubkey_bytes, &preimage)
        .ok_or("failed to encode htlc claim witness")?;

    let signed_tx = Transaction {
        version: 1,
        inputs: vec![TxInput {
            prev_txid: txid,
            prev_index: htlc_index,
            script_sig,
            sequence: 0xffffffff,
        }],
        outputs: unsigned.outputs,
        locktime: 0,
    };
    Ok(hex::encode(signed_tx.serialize()))
}

/// Build and sign an HTLCv1 refund transaction (reclaims funds after timeout).
pub fn build_htlc_refund_tx(
    htlc_txid_hex: &str,
    htlc_index: u32,
    htlc_value: u64,
    htlc_script_hex: &str,
    seed_hex: &str,
    key_index: u32,
    to_address: &str,
    fee_sats: u64,
    timeout_height: u64,
) -> Result<String, String> {
    let htlc_script = hex::decode(htlc_script_hex).map_err(|e| e.to_string())?;
    let to_pkh = address_to_pkh(to_address).ok_or("invalid destination address")?;

    let mut txid = [0u8; 32];
    let txid_bytes = hex::decode(htlc_txid_hex).map_err(|e| e.to_string())?;
    if txid_bytes.len() != 32 {
        return Err("htlc_txid must be 32 bytes hex".to_string());
    }
    txid.copy_from_slice(&txid_bytes);
    txid.reverse();

    let secret = route_derive_secret(seed_hex, key_index)?;
    let pubkey_bytes = secret.public_key().to_encoded_point(true).as_bytes().to_vec();
    let out_value = htlc_value.checked_sub(fee_sats).ok_or("fee exceeds htlc value")?;

    let input = TxInput {
        prev_txid: txid,
        prev_index: htlc_index,
        script_sig: Vec::new(),
        sequence: 0xffffffff,
    };
    let output = TxOutput {
        value: out_value,
        script_pubkey: p2pkh_script(&to_pkh),
    };
    let unsigned = Transaction {
        version: 1,
        inputs: vec![input],
        outputs: vec![output],
        locktime: timeout_height as u32,
    };

    let signing_key = SigningKey::from_bytes(&secret.to_bytes()).map_err(|e| e.to_string())?;
    let sighash = p2pkh_sighash(&unsigned, 0, &htlc_script);
    let sig: Signature = signing_key.sign_prehash(&sighash).map_err(|e| e.to_string())?;
    let mut sig_der = sig.to_der().to_bytes().to_vec();
    sig_der.push(SIGHASH_ALL as u8);

    let script_sig = encode_htlcv1_refund_witness(&sig_der, &pubkey_bytes)
        .ok_or("failed to encode htlc refund witness")?;

    let signed_tx = Transaction {
        version: 1,
        inputs: vec![TxInput {
            prev_txid: txid,
            prev_index: htlc_index,
            script_sig,
            sequence: 0xffffffff,
        }],
        outputs: unsigned.outputs,
        locktime: timeout_height as u32,
    };
    Ok(hex::encode(signed_tx.serialize()))
}

/// Encode an HTLCv1 locking script given a secret hash and addresses.
pub fn encode_htlcv1(
    secret_hash_hex: &str,
    recipient_address: &str,
    refund_address: &str,
    timeout_height: u64,
) -> Result<String, String> {
    let mut expected_hash = [0u8; 32];
    let hash_bytes = hex::decode(secret_hash_hex).map_err(|e| e.to_string())?;
    if hash_bytes.len() != 32 {
        return Err("secret_hash_hex must be 32 bytes".to_string());
    }
    expected_hash.copy_from_slice(&hash_bytes);

    let recipient_pkh = address_to_pkh(recipient_address).ok_or("invalid recipient address")?;
    let refund_pkh = address_to_pkh(refund_address).ok_or("invalid refund address")?;

    let output = HtlcV1Output {
        expected_hash,
        recipient_pkh,
        refund_pkh,
        timeout_height,
    };
    Ok(hex::encode(encode_htlcv1_script(&output)))
}

pub struct HtlcDecoded {
    pub secret_hash_hex: String,
    pub recipient_address: String,
    pub refund_address: String,
    pub timeout_height: u64,
}

/// Decode an HTLCv1 locking script.
pub fn decode_htlcv1(script_hex: &str) -> Result<HtlcDecoded, String> {
    let script = hex::decode(script_hex).map_err(|e| e.to_string())?;
    let output = parse_htlcv1_script(&script).ok_or("not a valid HTLCv1 script")?;
    Ok(HtlcDecoded {
        secret_hash_hex: hex::encode(output.expected_hash),
        recipient_address: pkh_to_address(&output.recipient_pkh),
        refund_address: pkh_to_address(&output.refund_pkh),
        timeout_height: output.timeout_height,
    })
}

// ─── Key derivation ──────────────────────────────────────────────────────────

/// Dispatch based on seed length:
///   64 hex chars (32 B) → legacy SHA256-LE derivation
///   128 hex chars (64 B) → BIP32 m/44'/1'/0'/0/<index>
fn route_derive_secret(seed_hex: &str, index: u32) -> Result<SecretKey, String> {
    let trimmed = seed_hex.trim();
    match trimmed.len() {
        64 => derive_secret_from_seed_hex(trimmed, index),
        128 => {
            let seed_bytes = hex::decode(trimmed).map_err(|_| "invalid BIP32 seed hex")?;
            bip32_derive_irium(&seed_bytes, index)
        }
        n => Err(format!(
            "seed_hex must be 64 chars (32B legacy) or 128 chars (64B BIP32), got {n}"
        )),
    }
}

/// Legacy derivation: SHA256(seed_32 || index_LE || ctr_LE).
/// Matches wallet_store.rs WalletStore::derive_key exactly.
fn derive_secret_from_seed_hex(seed_hex: &str, index: u32) -> Result<SecretKey, String> {
    let seed = hex::decode(seed_hex.trim()).map_err(|_| "invalid seed hex")?;
    let mut material = Vec::with_capacity(36);
    material.extend_from_slice(&seed);
    material.extend_from_slice(&index.to_le_bytes());
    for ctr in 0u32..1024 {
        let mut data = material.clone();
        data.extend_from_slice(&ctr.to_le_bytes());
        let digest = Sha256::digest(&data);
        if let Ok(secret) = SecretKey::from_slice(&digest) {
            return Ok(secret);
        }
    }
    Err("failed to derive valid key from seed".to_string())
}

fn bip32_master_key(seed: &[u8]) -> ([u8; 32], [u8; 32]) {
    type HmacSha512 = Hmac<Sha512>;
    let mut mac = HmacSha512::new_from_slice(b"Bitcoin seed").expect("HMAC accepts any key length");
    mac.update(seed);
    let result = mac.finalize().into_bytes();
    let mut key = [0u8; 32];
    let mut chain_code = [0u8; 32];
    key.copy_from_slice(&result[..32]);
    chain_code.copy_from_slice(&result[32..]);
    (key, chain_code)
}

fn bip32_ckd_priv(
    parent_key: &[u8; 32],
    chain_code: &[u8; 32],
    index: u32,
) -> Result<([u8; 32], [u8; 32]), String> {
    type HmacSha512 = Hmac<Sha512>;
    let mut mac = HmacSha512::new_from_slice(chain_code).map_err(|e| e.to_string())?;
    if index >= 0x8000_0000 {
        mac.update(&[0x00]);
        mac.update(parent_key);
    } else {
        let secret = SecretKey::from_slice(parent_key).map_err(|e| e.to_string())?;
        let ep = secret.public_key().to_encoded_point(true);
        mac.update(ep.as_bytes());
    }
    mac.update(&index.to_be_bytes());
    let result = mac.finalize().into_bytes();
    let il = &result[..32];
    let cc: [u8; 32] = result[32..]
        .try_into()
        .map_err(|_| "chain code slice".to_string())?;
    let n = BigUint::from_bytes_be(&SECP256K1_N);
    let il_int = BigUint::from_bytes_be(il);
    let pk_int = BigUint::from_bytes_be(parent_key);
    if il_int >= n {
        return Err("IL >= n, invalid key".to_string());
    }
    let child_int = (il_int + pk_int) % &n;
    if child_int.is_zero() {
        return Err("child key is zero, invalid".to_string());
    }
    let cb = child_int.to_bytes_be();
    let mut child_key = [0u8; 32];
    let start = 32usize.saturating_sub(cb.len());
    child_key[start..].copy_from_slice(&cb);
    Ok((child_key, cc))
}

/// BIP32 path m/44'/1'/0'/0/<address_index> — copied exactly from irium-wallet.rs.
fn bip32_derive_irium(seed_bytes: &[u8], address_index: u32) -> Result<SecretKey, String> {
    let (mut key, mut cc) = bip32_master_key(seed_bytes);
    (key, cc) = bip32_ckd_priv(&key, &cc, 0x8000_0000 + 44)?;
    (key, cc) = bip32_ckd_priv(&key, &cc, 0x8000_0000 + 1)?;
    (key, cc) = bip32_ckd_priv(&key, &cc, 0x8000_0000)?;
    (key, cc) = bip32_ckd_priv(&key, &cc, 0)?;
    (key, cc) = bip32_ckd_priv(&key, &cc, address_index)?;
    let _ = cc;
    SecretKey::from_slice(&key).map_err(|e| e.to_string())
}

// ─── Address helpers ─────────────────────────────────────────────────────────

fn address_from_secret(secret: &SecretKey) -> String {
    let pubkey = secret.public_key().to_encoded_point(true);
    let pkh = hash160(pubkey.as_bytes());
    pkh_to_address(&pkh)
}

pub(crate) fn address_to_pkh(address: &str) -> Option<[u8; 20]> {
    let data = base58check_decode(address)?;
    if data.len() != 21 || data[0] != IRIUM_VERSION {
        return None;
    }
    let mut pkh = [0u8; 20];
    pkh.copy_from_slice(&data[1..]);
    Some(pkh)
}

fn pkh_to_address(pkh: &[u8; 20]) -> String {
    let mut body = Vec::with_capacity(21);
    body.push(IRIUM_VERSION);
    body.extend_from_slice(pkh);
    base58check_encode(&body)
}

fn hash160(data: &[u8]) -> [u8; 20] {
    let sha = Sha256::digest(data);
    let rip = Ripemd160::digest(&sha);
    let mut out = [0u8; 20];
    out.copy_from_slice(&rip);
    out
}

fn base58check_encode(data: &[u8]) -> String {
    let checksum = Sha256::digest(Sha256::digest(data));
    let mut full = data.to_vec();
    full.extend_from_slice(&checksum[..4]);
    bs58::encode(full).into_string()
}

fn base58check_decode(input: &str) -> Option<Vec<u8>> {
    let data = bs58::decode(input).into_vec().ok()?;
    if data.len() < 5 {
        return None;
    }
    let (payload, check) = data.split_at(data.len() - 4);
    let computed = Sha256::digest(Sha256::digest(payload));
    if &computed[..4] != check {
        return None;
    }
    Some(payload.to_vec())
}

/// Standard P2PKH sighash: SHA256d(serialized_tx_with_subscript || SIGHASH_ALL_LE).
fn p2pkh_sighash(tx: &Transaction, input_index: usize, subscript: &[u8]) -> [u8; 32] {
    let modified_inputs: Vec<TxInput> = tx
        .inputs
        .iter()
        .enumerate()
        .map(|(i, inp)| TxInput {
            prev_txid: inp.prev_txid,
            prev_index: inp.prev_index,
            script_sig: if i == input_index {
                subscript.to_vec()
            } else {
                Vec::new()
            },
            sequence: inp.sequence,
        })
        .collect();

    let preimage_tx = Transaction {
        version: tx.version,
        inputs: modified_inputs,
        outputs: tx.outputs.clone(),
        locktime: tx.locktime,
    };

    let mut data = preimage_tx.serialize();
    data.extend_from_slice(&SIGHASH_ALL.to_le_bytes());

    let first = Sha256::digest(&data);
    let second = Sha256::digest(&first);
    let mut out = [0u8; 32];
    out.copy_from_slice(&second);
    out
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: Irium generates 24-word mnemonics (256-bit entropy), matching irium-wallet.rs
    // Mnemonic::generate(24). This 12-word vector is used to test BIP39/BIP32 derivation
    // logic only — it is a valid BIP39 mnemonic for that purpose even at 12 words.
    const ABANDON_MNEMONIC: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn generate_mnemonic_produces_24_words() {
        let m = generate_mnemonic().unwrap();
        let words: Vec<&str> = m.split_whitespace().collect();
        assert_eq!(words.len(), 24, "Irium mnemonics must be 24 words (256-bit entropy)");
    }

    #[test]
    fn mnemonic_to_seed_returns_128_chars() {
        let hex = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        assert_eq!(hex.len(), 128, "seed must be 64 bytes = 128 hex chars");
    }

    #[test]
    fn mnemonic_to_seed_passphrase_changes_output() {
        let s1 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let s2 = mnemonic_to_seed(ABANDON_MNEMONIC, "TREZOR").unwrap();
        assert_ne!(s1, s2, "passphrase must change the seed");
    }

    #[test]
    fn bip32_address_starts_with_q() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let addr = derive_address(&seed_128, 0).unwrap();
        assert!(addr.starts_with('Q'), "Irium address must start with Q, got: {addr}");
    }

    #[test]
    fn bip32_and_legacy_produce_different_addresses() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let seed_64 = &seed_128[..64]; // first 32 bytes as hex
        let addr_bip32 = derive_address(&seed_128, 0).unwrap();
        let addr_legacy = derive_address(seed_64, 0).unwrap();
        assert_ne!(
            addr_bip32, addr_legacy,
            "BIP32 and legacy derivation must produce different addresses"
        );
    }

    #[test]
    fn export_import_wif_round_trip() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let addr = derive_address(&seed_128, 0).unwrap();
        let wif = export_wif(&seed_128, 0).unwrap();
        let imported = import_wif(&wif).unwrap();
        assert_eq!(imported.address, addr, "WIF round-trip address must match");
        assert_eq!(imported.pubkey_hex.len(), 66, "compressed pubkey must be 33 B = 66 hex");
    }

    #[test]
    fn wif_round_trip_multiple_indices() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        for idx in [0u32, 1, 2, 9, 100] {
            let addr = derive_address(&seed_128, idx).unwrap();
            let wif = export_wif(&seed_128, idx).unwrap();
            let imported = import_wif(&wif).unwrap();
            assert_eq!(imported.address, addr, "index {idx} round-trip failed");
        }
    }

    #[test]
    fn validate_address_accepts_derived() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let addr = derive_address(&seed_128, 0).unwrap();
        assert!(validate_address(&addr), "derived address must pass validate_address");
    }

    #[test]
    fn validate_address_rejects_invalid() {
        assert!(!validate_address("not-an-address"));
        assert!(!validate_address(""));
        assert!(!validate_address("1BadChecksum00000000000000000000000")); // wrong version byte
    }

    #[test]
    fn seed_length_dispatch_legacy() {
        let legacy_seed = "deadbeef".repeat(8); // 64 hex chars
        let addr = derive_address(&legacy_seed, 0).unwrap();
        // Version byte 0x39 maps to 'Q' (~81%) or 'P' (~19%) — validate_address is the correct check
        assert!(validate_address(&addr), "legacy derived address must pass validate_address");
        // WIF round-trip also works for legacy seeds
        let wif = export_wif(&legacy_seed, 0).unwrap();
        let imported = import_wif(&wif).unwrap();
        assert_eq!(imported.address, addr, "legacy WIF round-trip must match");
    }

    #[test]
    fn bip32_deterministic_across_calls() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let addr1 = derive_address(&seed_128, 5).unwrap();
        let addr2 = derive_address(&seed_128, 5).unwrap();
        assert_eq!(addr1, addr2, "derivation must be deterministic");
    }

    #[test]
    fn different_indices_give_different_addresses() {
        let seed_128 = mnemonic_to_seed(ABANDON_MNEMONIC, "").unwrap();
        let addr0 = derive_address(&seed_128, 0).unwrap();
        let addr1 = derive_address(&seed_128, 1).unwrap();
        assert_ne!(addr0, addr1, "different indices must give different addresses");
    }

    // Cross-check against irium-wallet desktop binary output.
    // Mnemonic: 24 words (all "abandon" + "art"), empty passphrase.
    // Values confirmed by running:
    //   irium-wallet import-mnemonic "<mnemonic>"
    //   irium-wallet list-addresses          → PyRVW43Pa2bU7MVWFNWdmLPnFWjWk28Mcg
    //   irium-wallet export-wif <addr> --out → KwokacjafX9eybntZDFrSgaW36MXLMQL2v6FcM9f7arxNdPbuoug
    #[test]
    fn desktop_cross_check_address_and_wif() {
        const MNEMONIC_24: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
        const EXPECTED_ADDR: &str = "PyRVW43Pa2bU7MVWFNWdmLPnFWjWk28Mcg";
        const EXPECTED_WIF: &str = "KwokacjafX9eybntZDFrSgaW36MXLMQL2v6FcM9f7arxNdPbuoug";

        let seed = mnemonic_to_seed(MNEMONIC_24, "").unwrap();
        assert_eq!(seed.len(), 128, "BIP39 seed must be 128 hex chars");

        let addr = derive_address(&seed, 0).unwrap();
        assert_eq!(addr, EXPECTED_ADDR, "address index 0 must match desktop binary");

        let wif = export_wif(&seed, 0).unwrap();
        assert_eq!(wif, EXPECTED_WIF, "WIF index 0 must match desktop binary");

        // WIF import must recover the same address
        let imported = import_wif(&wif).unwrap();
        assert_eq!(imported.address, EXPECTED_ADDR, "WIF import must recover expected address");
    }
}
