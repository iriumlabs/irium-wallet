/// Prints reference derivation outputs for cross-checking with the desktop wallet.
/// Run with: cargo run --example derive_check
///
/// Compare the output against irium-core desktop wallet for the same mnemonic.
fn main() {
    use spv_mobile::mobile::wallet;

    // Standard 24-word BIP39 test vector (all "abandon" + final word).
    // Irium uses 24 words (256-bit entropy) — matches Mnemonic::generate(24) in irium-wallet.rs.
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    // BIP39 seed (empty passphrase — standard for Irium)
    let seed_128 = wallet::mnemonic_to_seed(mnemonic, "").unwrap();
    println!("=== BIP39 seed (empty passphrase) ===");
    println!("seed_hex (128 chars): {}", seed_128);
    println!();

    // BIP32 addresses m/44'/1'/0'/0/<index>
    println!("=== BIP32 addresses m/44'/1'/0'/0/<index> ===");
    for i in 0..5u32 {
        let addr = wallet::derive_address(&seed_128, i).unwrap();
        let wif  = wallet::export_wif(&seed_128, i).unwrap();
        println!("index {i}: address = {addr}");
        println!("index {i}: WIF     = {wif}");
    }
    println!();

    // Legacy derivation (first 32 bytes of seed = 64 hex chars)
    println!("=== Legacy SHA256-LE addresses (first 32 bytes of BIP39 seed) ===");
    let seed_64 = &seed_128[..64];
    for i in 0..3u32 {
        let addr = wallet::derive_address(seed_64, i).unwrap();
        println!("index {i}: address = {addr}");
    }
}
