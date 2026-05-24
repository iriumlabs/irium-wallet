const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve the local spv-mobile module
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, 'modules'),
];

// Allow require('./assets/seedlist.txt') and similar .txt asset imports.
// usePeers.ts uses this to materialize the bundled P2P seedlist to a
// writable filesystem path on first boot (Rust light_client.rs reads
// it via std::fs::read_to_string).
if (!config.resolver.assetExts.includes('txt')) {
  config.resolver.assetExts.push('txt');
}

module.exports = config;
