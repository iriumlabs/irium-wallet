Pod::Spec.new do |s|
  s.name           = 'SpvMobile'
  s.version        = '0.1.0'
  s.summary        = 'Irium SPV light client — Expo native module for iOS'
  s.homepage       = 'https://github.com/iriumlabs/irium-wallet'
  s.license        = { :type => 'MIT' }
  s.authors        = { 'Irium Labs' => 'hello@irium.io' }
  s.platform       = :ios, '16.0'
  s.source         = { :path => '.' }
  s.swift_version  = '5.9'

  # Swift source files:
  #   SpvMobileModule.swift  — Expo module (this repo, committed)
  #   spv_mobile.swift       — UniFFI-generated bindings (produced on Mac, not committed)
  s.source_files = 'ios/**/*.swift'

  # Objective-C bridging header produced by uniffi-bindgen (spv_mobileFFI.h)
  s.private_header_files = 'ios/spv_mobileFFI.h'

  # Static library XCFramework built from rust-bridge on Mac.
  # Build command (run on Mac after cloning):
  #   xcodebuild -create-xcframework \
  #     -library rust-bridge/target/aarch64-apple-ios/release/libspv_mobile.a \
  #     -headers rust-bridge/src/ \
  #     -library rust-bridge/target/aarch64-apple-ios-sim/release/libspv_mobile.a \
  #     -headers rust-bridge/src/ \
  #     -output modules/spv-mobile/ios/SpvMobile.xcframework
  # Note: XCFramework is a binary artefact — not committed to git.
  s.vendored_frameworks = 'ios/SpvMobile.xcframework'

  s.frameworks = 'Foundation'

  s.dependency 'ExpoModulesCore'
end
