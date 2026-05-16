import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../components/theme';
import { SettlementHubScreen } from '../screens/SettlementHubScreen';
import { OtcWizardScreen } from '../screens/OtcWizardScreen';
import { FreelanceWizardScreen } from '../screens/FreelanceWizardScreen';
import { MilestoneWizardScreen } from '../screens/MilestoneWizardScreen';
import { DepositWizardScreen } from '../screens/DepositWizardScreen';
import { AgreementDetailScreen } from '../screens/AgreementDetailScreen';

export type SettlementStackParams = {
  Hub: undefined;
  OtcWizard: undefined;
  FreelanceWizard: undefined;
  MilestoneWizard: undefined;
  DepositWizard: undefined;
  AgreementDetail: { agreementId: string };
};

const Stack = createNativeStackNavigator<SettlementStackParams>();

export function SettlementNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Hub" component={SettlementHubScreen} />
      <Stack.Screen name="OtcWizard" component={OtcWizardScreen} />
      <Stack.Screen name="FreelanceWizard" component={FreelanceWizardScreen} />
      <Stack.Screen name="MilestoneWizard" component={MilestoneWizardScreen} />
      <Stack.Screen name="DepositWizard" component={DepositWizardScreen} />
      <Stack.Screen name="AgreementDetail" component={AgreementDetailScreen} />
    </Stack.Navigator>
  );
}
