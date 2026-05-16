# Real Device Testing Guide — Irium Wallet

This guide covers installing and testing Irium Wallet on a real Android device and a real iPhone.
**Do not publish to GitHub Releases or the App Store until testing is confirmed.**

---

## Android — Install signed APK

### What you have
The signed release APK is already built and waiting at:
```
C:\Users\Ibrahim\Desktop\irium-wallet-v0.1.0.apk
```

### Option A — USB install (fastest)

1. **Enable Developer Options on your Android phone**
   - Settings → About phone → tap **Build number** 7 times
   - Settings → Developer options → turn on **USB debugging**

2. **Connect phone to your PC via USB**
   - Accept the "Allow USB debugging?" prompt on the phone

3. **Verify adb sees the device**
   ```powershell
   & "C:\Users\Ibrahim\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
   # Should list your device as "device" (not "unauthorized")
   ```

4. **Install the APK**
   ```powershell
   & "C:\Users\Ibrahim\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r "C:\Users\Ibrahim\Desktop\irium-wallet-v0.1.0.apk"
   ```

5. **Launch**
   ```powershell
   & "C:\Users\Ibrahim\AppData\Local\Android\Sdk\platform-tools\adb.exe" shell am start -n com.irium.wallet/.MainActivity
   ```

### Option B — Direct transfer (no PC tools)

1. Copy `irium-wallet-v0.1.0.apk` to your phone via USB, Google Drive, or email
2. On the phone: open the file in Files / Downloads
3. Android will prompt "Install unknown apps" → go to Settings → allow for Files app
4. Tap Install

---

### Android test checklist

- [ ] App launches without crash
- [ ] Welcome screen animations play (breathing logo, glow ring)
- [ ] Tapping **Create wallet** generates a 24-word mnemonic
- [ ] Words hidden by default; **Reveal** shows them with fade effect
- [ ] WIF key section visible below the word grid
- [ ] Node config screen: enter RPC URL → **Test connection** responds
- [ ] Connecting screen shows P2P light client starting
- [ ] Dashboard loads with balance (or zero if no mainnet funds)
- [ ] QR code generates on Receive screen
- [ ] Send screen: enter address → Preview transaction → Confirm & broadcast
- [ ] History screen: list loads (may be empty on fresh wallet)
- [ ] Settlement Hub: OTC Trade and Freelance Work template cards visible
- [ ] Settings screen: shows address, node info, version

---

## iOS — Sideload to iPhone via Xcode (no App Store, no $99 account)

You can install directly to your own iPhone using any free Apple ID.
This requires a **Mac** (any Intel or Apple Silicon Mac running macOS 13+).

### What you need on the Mac

| Tool | Version | How to get |
|------|---------|------------|
| Xcode | 15.0+ | Mac App Store (free, ~7 GB) |
| Node.js | 22+ | `brew install node` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| CocoaPods | 1.14+ | `sudo gem install cocoapods` |

You do **not** need the $99 Apple Developer Program for sideloading to your own device.
A free Apple ID is enough — Xcode signs with a development certificate automatically.

---

### Step-by-step: Mac setup and sideload

#### 1. Clone the repo on the Mac

```bash
git clone <your-repo-url> irium-wallet
cd irium-wallet
npm install
```

#### 2. Install iOS Rust targets

```bash
rustup target add aarch64-apple-ios          # real iPhone (arm64)
rustup target add aarch64-apple-ios-sim      # simulator on Apple Silicon
```

#### 3. Build the Rust static library for iPhone

```bash
cd rust-bridge
cargo build --target aarch64-apple-ios --release
cd ..
```

Output: `rust-bridge/target/aarch64-apple-ios/release/libspv_mobile.a`

#### 4. Create XCFramework

```bash
cd rust-bridge

# For sideload to real device only (no simulator slice needed)
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libspv_mobile.a \
  -headers include/ \
  -output SpvMobile.xcframework

cp -r SpvMobile.xcframework ../modules/spv-mobile/ios/
cd ..
```

#### 5. Generate Swift bindings

```bash
cargo install uniffi-bindgen   # one-time install
cd rust-bridge
uniffi-bindgen generate src/spv_mobile.udl --language swift --out-dir ../modules/spv-mobile/ios/
cd ..
```

#### 6. Generate the Xcode project

```bash
npx expo prebuild --platform ios --clean
```

#### 7. Install CocoaPods dependencies

```bash
cd ios
pod install
cd ..
```

#### 8. Open in Xcode

```bash
open ios/IriumWallet.xcworkspace
```

**Important:** Open the `.xcworkspace` file, not `.xcodeproj`.

#### 9. Sign with your Apple ID (free)

1. In Xcode, select the **IriumWallet** target in the left panel
2. Go to **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Set **Team** — click the dropdown → **Add an Account** → sign in with your Apple ID
5. Xcode will create a free development certificate automatically
6. Bundle ID will be set to `com.irium.wallet` — if you hit a conflict, change it to
   `com.yourappleid.iriumwallet`

#### 10. Connect your iPhone and install

1. Connect iPhone to Mac via USB (Lightning or USB-C cable)
2. Unlock the iPhone and tap **Trust** when prompted
3. In Xcode, set the destination (top bar) to your iPhone (e.g., "Ibrahim's iPhone")
4. Press **▶ Run** (or Cmd+R)
5. Xcode builds and installs — takes 2-5 min on first build

#### 11. Trust the developer on iPhone

After install, the app icon appears but tapping it shows "Untrusted Developer":

1. On iPhone: **Settings → General → VPN & Device Management**
2. Under "Developer App", tap your Apple ID email
3. Tap **Trust** → confirm

App will now open normally.

---

### Free Apple ID limitations

| Limit | Free account | Paid ($99/yr) |
|-------|-------------|----------------|
| Certificate validity | 7 days | 1 year |
| Devices per certificate | Your devices only | Up to 100 |
| App Store distribution | No | Yes |
| TestFlight | No | Yes |

After 7 days, re-run step 10 (Xcode re-signs automatically when connected).

---

### iOS test checklist

- [ ] App installs and launches on iPhone
- [ ] Welcome screen animations play
- [ ] Mnemonic generates (same words as Android for the same seed)
- [ ] Address derived matches Android wallet for same mnemonic
- [ ] Node config connects to RPC endpoint
- [ ] QR code renders on Receive screen
- [ ] Send screen keyboard behavior correct on iOS
- [ ] History screen bottom-sheet detail modal slides up
- [ ] Settlement Hub template cards spring-press correctly
- [ ] No crashes in Settings screen

---

## Cross-platform verification

Run this check after testing both platforms with the same seed phrase:

1. Generate wallet on Android, write down the mnemonic
2. Import same mnemonic on iOS (or vice versa)
3. Confirm the displayed address is **identical** on both platforms

This verifies that Rust key derivation is deterministic across Android (JNI) and iOS (Swift/UniFFI).

---

## Reporting issues

For each bug found, note:
- Platform (Android / iOS)
- Screen name
- What happened vs what was expected
- Whether it is reproducible (always / sometimes)
