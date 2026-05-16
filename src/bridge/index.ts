import type { SpvBridge } from './types';
import { mockBridge } from './mock';

// When the real .so is linked, replace mockBridge with the native module.
// Zero JS changes needed — same SpvBridge interface.
const USE_MOCK = true; // temporary — Expo Go UI testing only

let _bridge: SpvBridge;

if (USE_MOCK) {
  _bridge = mockBridge;
} else {
  // Real native module — imported lazily so the mock path doesn't break on dev machines
  // that don't have the .so yet.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const native = require('spv-mobile');
  _bridge = (native.default ?? native) as SpvBridge;
}

export const bridge = _bridge;
export * from './types';
