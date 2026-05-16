import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { SecurityNoticeScreen } from '../screens/onboarding/SecurityNoticeScreen';
import { MnemonicScreen } from '../screens/onboarding/MnemonicScreen';
import { VerifyMnemonicScreen } from '../screens/onboarding/VerifyMnemonicScreen';
import { NodeConfigScreen } from '../screens/onboarding/NodeConfigScreen';
import { ConnectingScreen } from '../screens/onboarding/ConnectingScreen';
import { ReadyScreen } from '../screens/onboarding/ReadyScreen';

export type OnboardingStackParams = {
  Welcome: undefined;
  SecurityNotice: { mode: 'create' | 'import' };
  Mnemonic: { mode: 'create' | 'import' };
  VerifyMnemonic: undefined;
  NodeConfig: undefined;
  Connecting: undefined;
  Ready: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParams>();

export function OnboardingNavigator({ onComplete }: { onComplete: () => void }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SecurityNotice" component={SecurityNoticeScreen} />
      <Stack.Screen name="Mnemonic" component={MnemonicScreen} />
      <Stack.Screen name="VerifyMnemonic" component={VerifyMnemonicScreen} />
      <Stack.Screen name="NodeConfig" component={NodeConfigScreen} />
      <Stack.Screen name="Connecting" component={ConnectingScreen} />
      <Stack.Screen name="Ready">{(props) => <ReadyScreen {...props} onComplete={onComplete} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
