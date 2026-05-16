export * from './src/SpvMobile.types';

import { requireNativeModule } from 'expo-modules-core';
import type { SpvBridge } from './src/SpvMobile.types';

const SpvMobileNative = requireNativeModule<SpvBridge>('SpvMobileModule');
export default SpvMobileNative;
