import type { SpvBridge } from './types';
import { mockBridge } from './mock';

// Expo Go / CI mode — mock bridge only, no native module bundled.
// To switch to the real native .so for production:
//   1. Set USE_MOCK = false
//   2. Replace this file's export with: require('spv-mobile')
//   3. Build a custom dev client (NOT Expo Go)
export const bridge: SpvBridge = mockBridge;

export * from './types';
