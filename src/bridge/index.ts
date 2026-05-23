import type { SpvBridge } from './types';
import { mockBridge } from './mock';
import { httpBridge } from './http';

// Hybrid: real HTTP calls to iriumd for RPC reads + broadcastTx, mock for the
// crypto/HTLC/signing methods until the native spv-mobile module is plumbed.
// To swap the mock half for the native module:
//   export const bridge: SpvBridge = { ...require('spv-mobile'), ...httpBridge };
export const bridge: SpvBridge = { ...mockBridge, ...httpBridge };

export * from './types';
