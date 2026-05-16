// Expo config plugin for spv-mobile native module
// Applied during `expo prebuild` to wire the Kotlin module into the Android project.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withSpvMobile(config) {
  return withAndroidManifest(config, (c) => c);  // no-op for now; permissions added here when needed
};
