import type { SpvBridge } from './types';
import { mockBridge } from './mock';
import { httpBridge } from './http';

// Three-way composition, applied in this order:
//   1. mockBridge      — throws on every method (`SpvError('Internal', ...)`)
//                        so the SpvBridge type contract is satisfied without
//                        returning fake data. The throw is reached only when
//                        a method is called that neither native nor http
//                        overrides — i.e. a real misconfiguration, not normal
//                        operation. Surfacing this loudly is the point.
//   2. nativeBridge    — Rust-backed crypto / HTLC / tx-signing via the
//                        spv-mobile Expo native module (modules/spv-mobile).
//                        Loaded via try/catch because requireNativeModule
//                        throws synchronously in Expo Go (which has no custom
//                        native modules); in that mode the 13 crypto methods
//                        will throw from mockBridge — by design — so users
//                        cannot complete onboarding with fake addresses.
//   3. httpBridge      — real HTTP calls to iriumd for RPC reads, broadcast,
//                        and settlement endpoints. Overrides any overlap with
//                        the native module's own RPC client methods.
let nativeBridge: Partial<SpvBridge> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('spv-mobile');
  if (mod && typeof mod === 'object') {
    nativeBridge = (mod.default ?? mod) as Partial<SpvBridge>;
  }
} catch {
  // No native module bundled (Expo Go / Jest / CI). Composition falls
  // through to mockBridge for crypto and HTLC methods. App still boots
  // and HTTP-backed features continue to work.
}

export const bridge: SpvBridge = {
  ...mockBridge,
  ...nativeBridge,
  ...httpBridge,
};

export * from './types';
