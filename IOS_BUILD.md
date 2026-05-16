# iOS Build Guide — Irium Wallet (TestFlight)

This guide covers the complete iOS build process from a Mac.
All Rust compilation and Xcode steps must be performed on macOS.

---

## Prerequisites

### Mac hardware
- Apple Silicon (M1/M2/M3) or Intel Mac
- macOS 13 Ventura or later
- At least 20 GB free disk space

### Required software

| Tool | Version | Install |
|------|---------|---------|
| Xcode | 15.0+ | App Store |
| Xcode Command Line Tools | latest | `xcode-select --install` |
| Homebrew | latest | https://brew.sh |
| Node.js | 22+ | `brew install node` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| CocoaPods | 1.14+ | `sudo gem install cocoapods` |

### Apple Developer account
- Enrolled in Apple Developer Program ($99/yr)
- App ID registered: `com.irium.wallet`
- Distribution certificate + provisioning profile for TestFlight

---

## Step 1 — Clone and install dependencies

```bash
git clone <your-repo-url> irium-wallet
cd irium-wallet
npm install
```

---

## Step 2 — Add iOS Rust targets

```bash
rustup target add aarch64-apple-ios          # physical devices (arm64)
rustup target add aarch64-apple-ios-sim      # simulator on Apple Silicon
rustup target add x86_64-apple-ios           # simulator on Intel Mac
```

Verify:
```bash
rustup target list --installed | grep ios
# Expected output:
# aarch64-apple-ios
# aarch64-apple-ios-sim
# x86_64-apple-ios
```

---

## Step 3 — Build Rust library for iOS

```bash
cd rust-bridge
```

### Build for physical device (arm64)
```bash
cargo build --target aarch64-apple-ios --release
```

### Build for simulator
```bash
# Apple Silicon Mac:
cargo build --target aarch64-apple-ios-sim --release

# Intel Mac:
cargo build --target x86_64-apple-ios --release
```

### Create XCFramework (device + simulator combined)

```bash
# Simulator slice — use the correct target for your Mac:
# Apple Silicon:
SIMULATOR_TARGET=aarch64-apple-ios-sim
# Intel:
# SIMULATOR_TARGET=x86_64-apple-ios

xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libspv_mobile.a \
  -headers include/ \
  -library target/${SIMULATOR_TARGET}/release/libspv_mobile.a \
  -headers include/ \
  -output SpvMobile.xcframework
```

Copy the XCFramework into the iOS module:
```bash
cp -r SpvMobile.xcframework ../modules/spv-mobile/ios/
cd ..
```

---

## Step 4 — Generate UniFFI Swift bindings

```bash
# Install uniffi-bindgen if not present
cargo install uniffi-bindgen

cd rust-bridge
uniffi-bindgen generate src/spv_mobile.udl --language swift --out-dir ../modules/spv-mobile/ios/
cd ..
```

This produces `spv_mobile.swift` and `spv_mobileFFI.h` in the iOS module.

---

## Step 5 — Prebuild Expo iOS project

```bash
npx expo prebuild --platform ios --clean
```

This generates the `ios/` directory with the Xcode project.

---

## Step 6 — Install CocoaPods dependencies

```bash
cd ios
pod install
cd ..
```

If pod install fails with signing issues:
```bash
cd ios
pod install --repo-update
cd ..
```

---

## Step 7 — Configure signing in Xcode

1. Open `ios/IriumWallet.xcworkspace` (not `.xcodeproj`)
2. Select the `IriumWallet` target → **Signing & Capabilities**
3. Set **Team** to your Apple Developer team
4. Ensure **Bundle Identifier** is `com.irium.wallet`
5. Set **Provisioning Profile** to your App Store distribution profile

---

## Step 8 — Archive for TestFlight

### Via Xcode UI
1. Set scheme to **IriumWallet** and destination to **Any iOS Device (arm64)**
2. **Product → Archive**
3. In the Organizer, click **Distribute App**
4. Choose **TestFlight & App Store** → **App Store Connect**
5. Follow the upload wizard

### Via command line
```bash
cd ios

# Build archive
xcodebuild archive \
  -workspace IriumWallet.xcworkspace \
  -scheme IriumWallet \
  -configuration Release \
  -archivePath build/IriumWallet.xcarchive \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="<your-profile-name>" \
  CODE_SIGN_IDENTITY="Apple Distribution: <Your Name> (<TEAM_ID>)"

# Export IPA for TestFlight
xcodebuild -exportArchive \
  -archivePath build/IriumWallet.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ExportOptions.plist
```

**ExportOptions.plist** template:
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

---

## Step 9 — Upload to App Store Connect

### Via Xcode Organizer (recommended)
After export, Xcode Organizer offers **Upload to App Store Connect** directly.

### Via command line (xcrun altool / notarytool)
```bash
xcrun altool --upload-app \
  --type ios \
  --file build/IriumWallet.ipa \
  --apiKey <your-api-key> \
  --apiIssuer <your-issuer-id>
```

Or with `xcrun notarytool` for newer Xcode:
```bash
xcrun notarytool submit build/IriumWallet.ipa \
  --apple-id <your-apple-id> \
  --password <app-specific-password> \
  --team-id <your-team-id> \
  --wait
```

---

## Step 10 — Enable TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **Irium Wallet** → **TestFlight**
3. Wait for build processing (~10-15 min)
4. Add internal testers or create a public TestFlight link
5. Submit for Beta App Review if using external testers

---

## Known differences from Android build

| Item | Android | iOS |
|------|---------|-----|
| Rust lib format | `.so` (JNI) | `.a` static lib in XCFramework |
| Bindings | Kotlin (UniFFI) | Swift (UniFFI) |
| Native module | `SpvMobileModule.kt` | `SpvMobileModule.swift` |
| Secure storage | `expo-secure-store` | Keychain (same expo module) |
| P2P networking | TCP via tokio | TCP via tokio (same Rust code) |
| Font loading | `@expo-google-fonts/space-grotesk` | Same |
| Min OS | Android 10 (API 29) | iOS 16.0 |

---

## Troubleshooting

**`cargo build` fails with linker errors**
```bash
# Ensure Xcode CLT is active
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**`pod install` fails**
```bash
sudo gem update cocoapods
pod repo update
pod install
```

**Build fails: "No such module 'SpvMobile'"**
- Confirm `SpvMobile.xcframework` is in `modules/spv-mobile/ios/`
- In Xcode: Target → Build Phases → Link Binary → add the XCFramework

**App crashes on launch in simulator**
- Simulator uses `aarch64-apple-ios-sim` (Apple Silicon) or `x86_64-apple-ios` (Intel)
- Ensure the XCFramework includes the correct simulator slice

**TestFlight upload rejected: "Missing compliance"**
- Add to `ios/IriumWallet/Info.plist`:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```
(Irium uses standard TLS, no proprietary encryption)
