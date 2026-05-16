# iOS Build Guide — Irium Wallet

Complete steps to build and sideload Irium Wallet on iPhone from a Mac.

---

## Prerequisites

### Mac hardware
- Apple Silicon (M1/M2/M3) or Intel Mac
- macOS 13 Ventura or later
- At least 20 GB free disk space

### Required software

| Tool | Version | Install |
|------|---------|---------|
| Xcode | 15.0+ | Mac App Store (free) |
| Xcode Command Line Tools | latest | `xcode-select --install` |
| Homebrew | latest | https://brew.sh |
| Node.js | 22+ | `brew install node` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| CocoaPods | 1.14+ | `sudo gem install cocoapods` |

No Apple Developer Program ($99/yr) required for sideloading to your own iPhone.
A free Apple ID is sufficient — Xcode creates a development certificate automatically.

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/iriumlabs/irium-wallet
cd irium-wallet
npm install
```

---

## Step 2 — Install iOS Rust targets

```bash
rustup target add aarch64-apple-ios
rustup target add aarch64-apple-ios-sim
```

Verify:
```bash
rustup target list --installed | grep ios
# aarch64-apple-ios
# aarch64-apple-ios-sim
```

---

## Step 3 — Build Rust bridge for iOS

```bash
cd rust-bridge
cargo build --target aarch64-apple-ios --release
cargo build --target aarch64-apple-ios-sim --release
cd ..
```

---

## Step 4 — Create XCFramework

```bash
xcodebuild -create-xcframework \
  -library rust-bridge/target/aarch64-apple-ios/release/libspv_mobile.a \
  -headers rust-bridge/src/ \
  -library rust-bridge/target/aarch64-apple-ios-sim/release/libspv_mobile.a \
  -headers rust-bridge/src/ \
  -output modules/spv-mobile/ios/SpvMobile.xcframework
```

---

## Step 5 — Generate Swift UniFFI bindings

```bash
cargo run --bin uniffi-bindgen generate \
  rust-bridge/src/spv_mobile.udl \
  --language swift \
  --out-dir modules/spv-mobile/ios/
```

This produces two files in `modules/spv-mobile/ios/`:
- `spv_mobile.swift` — Swift wrapper (called by `SpvMobileModule.swift`)
- `spv_mobileFFI.h` — C bridging header (referenced by the podspec)

---

## Step 6 — Generate the Xcode project

```bash
npx expo prebuild --platform ios --clean
```

This generates the `ios/` directory containing the Xcode project, AppDelegate,
Info.plist, and all native module wiring. (This step requires macOS — it was
skipped on the Windows build machine.)

---

## Step 7 — Install CocoaPods dependencies

```bash
cd ios
pod install
cd ..
```

If pod install fails:
```bash
cd ios
pod install --repo-update
cd ..
```

---

## Step 8 — Open in Xcode and sign

```bash
open ios/IriumWallet.xcworkspace
```

In Xcode:
1. Select the **IriumWallet** target in the left panel
2. Go to **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Set **Team** → Add Account → sign in with your Apple ID (free account works)
5. Bundle ID is `com.irium.wallet` — change to `com.yourname.iriumwallet` if there is a conflict

---

## Step 9 — Connect iPhone and sideload

1. Connect iPhone to Mac via USB
2. Unlock the iPhone and tap **Trust** when prompted
3. In Xcode, set the destination (top bar) to your iPhone
4. Press **Run** (▶) or Cmd+R
5. Build and install — first build takes 3–5 minutes

After install, open **Settings → General → VPN & Device Management** on the iPhone,
tap your Apple ID, and tap **Trust** to allow the app to run.

---

## Step 10 — Archive for TestFlight (optional, requires $99 Developer account)

```bash
cd ios

xcodebuild archive \
  -workspace IriumWallet.xcworkspace \
  -scheme IriumWallet \
  -configuration Release \
  -archivePath build/IriumWallet.xcarchive \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="<your-profile-name>" \
  CODE_SIGN_IDENTITY="Apple Distribution: <Your Name> (<TEAM_ID>)"

xcodebuild -exportArchive \
  -archivePath build/IriumWallet.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ExportOptions.plist
```

**ExportOptions.plist:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
</dict>
</plist>
```

Add to `ios/IriumWallet/Info.plist` before upload:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

---

## Troubleshooting

**`cargo build` fails with linker errors**
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**`pod install` fails**
```bash
sudo gem update cocoapods
pod repo update
pod install
```

**"No such module 'SpvMobile'"**
- Confirm `SpvMobile.xcframework` is in `modules/spv-mobile/ios/`
- Xcode → Target → Build Phases → Link Binary → add the XCFramework manually

**App crashes on launch in simulator**
- Simulator uses `aarch64-apple-ios-sim`
- Confirm the XCFramework includes the simulator slice (Step 4 above builds both)

**"Untrusted Developer" on iPhone**
- Settings → General → VPN & Device Management → your Apple ID → Trust

**Free certificate expired (7-day limit)**
- Reconnect iPhone, press Run in Xcode again — Xcode re-signs automatically

---

## What was prepared on Windows

The following files are committed and ready in the repo:

| File | Description |
|------|-------------|
| `modules/spv-mobile/ios/SpvMobileModule.swift` | Expo Swift module — mirrors Kotlin module exactly |
| `modules/spv-mobile/SpvMobile.podspec` | CocoaPods spec for the iOS native module |
| `modules/spv-mobile/expo-module.config.json` | Updated to include `ios` platform |

The `ios/` Xcode project and the binary `SpvMobile.xcframework` must be generated
on the Mac (Steps 3–7 above). They are not committed because `expo prebuild`
requires macOS and the XCFramework is a compiled binary artefact.
