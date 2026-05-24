import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { SecurityNoticeScreen } from '../screens/onboarding/SecurityNoticeScreen';
import { MnemonicScreen } from '../screens/onboarding/MnemonicScreen';
import { VerifyMnemonicScreen } from '../screens/onboarding/VerifyMnemonicScreen';
import { ImportWalletScreen } from '../screens/onboarding/ImportWalletScreen';
// ConnectingScreen removed from the onboarding flow (UX cleanup):
// the light client starts silently in WalletApp via usePeers() after
// onboarding completes, so the user no longer waits through a fake
// "connecting" step. The component file remains in src/screens/onboarding/
// for now in case any re-enable is needed.
import { ReadyScreen } from '../screens/onboarding/ReadyScreen';
import { SecureWalletScreen } from '../screens/onboarding/SecureWalletScreen';

export type OnboardingStackParams = {
  Welcome: undefined;
  SecurityNotice: { mode: 'create' | 'import' };
  Mnemonic: { mode: 'create' | 'import' };
  VerifyMnemonic: undefined;
  ImportWallet: undefined;
  SecureWallet: undefined;
  Ready: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParams>();

export function OnboardingNavigator({ onComplete }: { onComplete: () => void }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="Welcome"        component={WelcomeScreen} />
      <Stack.Screen name="SecurityNotice" component={SecurityNoticeScreen} />
      <Stack.Screen name="Mnemonic"       component={MnemonicScreen} />
      <Stack.Screen name="VerifyMnemonic" component={VerifyMnemonicScreen} />
      <Stack.Screen name="ImportWallet"   component={ImportWalletScreen} />
      <Stack.Screen name="SecureWallet"   component={SecureWalletScreen} />
      <Stack.Screen name="Ready">
        {(props) => <ReadyScreen {...props} onComplete={onComplete} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
