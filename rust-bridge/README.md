# spv-mobile Rust Bridge

Rust library that compiles to native binaries consumed by the Expo native module
(`modules/spv-mobile`). Exposes wallet, SPV, HTLC, RPC, and P2P light-client
functions via UniFFI.

---

## Android build (Windows or Mac)

Prerequisites:
- Rust + cargo-ndk (`cargo install cargo-ndk`)
- Android NDK 26 at `$ANDROID_NDK_ROOT`

```bash
export ANDROID_NDK_ROOT="$HOME/AppData/Local/Android/Sdk/ndk/26.1.10909125"  # Windows
# export ANDROID_NDK_ROOT="$HOME/Library/Android/sdk/ndk/26.1.10909125"      # Mac

# Add targets (one-time)
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Build all three Android ABIs
cargo ndk \
  -t aarch64-linux-android \
  -t armv7-linux-androideabi \
  -t x86_64-linux-android \
  build --release

# Copy to jniLibs
JNILIBS=../modules/spv-mobile/android/src/main/jniLibs
cp target/aarch64-linux-android/release/libspv_mobile.so  $JNILIBS/arm64-v8a/
cp target/armv7-linux-androideabi/release/libspv_mobile.so $JNILIBS/armeabi-v7a/
cp target/x86_64-linux-android/release/libspv_mobile.so   $JNILIBS/x86_64/
```

---

## iOS build (requires Mac with Xcode)

Prerequisites:
- Mac running macOS 13+ with Xcode 15+
- Xcode command-line tools: `xcode-select --install`
- `lipo` (included with Xcode)

```bash
# Add targets (one-time)
rustup target add aarch64-apple-ios aarch64-apple-ios-sim

# Build real device (arm64)
cargo build --target aarch64-apple-ios --release

# Build simulator (arm64 — Apple Silicon Mac)
cargo build --target aarch64-apple-ios-sim --release
```

### Package as XCFramework

```bash
XCFW=../modules/spv-mobile/ios/SpvMobile.xcframework

# Remove old framework if present
rm -rf "$XCFW"

xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libspv_mobile.a \
  -headers ./include \
  -library target/aarch64-apple-ios-sim/release/libspv_mobile.a \
  -headers ./include \
  -output "$XCFW"

echo "XCFramework written to $XCFW"
```

The `./include` directory must contain the UniFFI-generated C header.
Generate it before running xcodebuild:

```bash
# Requires uniffi-bindgen installed:
# cargo install uniffi-bindgen

uniffi-bindgen generate src/spv_mobile.udl \
  --language swift \
  --out-dir ../modules/spv-mobile/ios/
```

This produces:
- `spv_mobile.swift` — Swift bindings (add to Xcode project)
- `spv_mobileFFI.h` — C header (referenced by XCFramework)
- `spv_mobileFFI.modulemap` — module map

### Wire up in Expo iOS module

1. Copy `SpvMobile.xcframework` to `modules/spv-mobile/ios/`
2. Add `spv_mobile.swift` alongside the existing `SpvMobileModule.swift`
3. In `SpvMobileModule.swift` call the generated Swift functions directly
   (no JNI layer needed — UniFFI generates native Swift bindings)
4. Run `pod install` in the `ios/` directory of the Expo app

### Simulator note

The simulator target (`aarch64-apple-ios-sim`) only applies to Apple Silicon
Macs. Intel Mac simulators use `x86_64-apple-ios`:

```bash
rustup target add x86_64-apple-ios
cargo build --target x86_64-apple-ios --release

# Then lipo the two simulator slices together before packaging:
lipo -create \
  target/aarch64-apple-ios-sim/release/libspv_mobile.a \
  target/x86_64-apple-ios/release/libspv_mobile.a \
  -output target/universal-sim/libspv_mobile.a
```

---

## UniFFI interface

See `src/spv_mobile.udl` for the full interface definition.

Key types:

| Function | Input | Output |
|---|---|---|
| `mnemonic_to_seed(mnemonic, passphrase)` | BIP39 mnemonic, passphrase (use `""`) | 128-char hex (64-byte BIP39 seed) |
| `derive_address(seed_hex, index)` | 128-char seed → BIP32 path; 64-char → legacy SHA256-LE | Irium address |
| `export_wif(seed_hex, index)` | seed + index | WIF private key (version 0x80, compressed) |
| `import_wif(wif)` | WIF string | `WifKey { address, pubkey_hex }` |
| `start_light_client(config)` | `LightClientConfig` | void (starts P2P sync) |
| `broadcast_tx(tx_hex)` | signed tx hex | txid string |
