import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { SendScreen } from '../screens/SendScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettlementNavigator } from './SettlementNavigator';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MarketplaceNavigator, MarketplaceStackParams } from './MarketplaceNavigator';
import { SettlementStackParams } from './SettlementNavigator';
import { CustomTabBar } from './CustomTabBar';

export type MainTabParams = {
  Dashboard: undefined;
  Send: undefined;
  Receive: undefined;
  History: undefined;
  Settlement: NavigatorScreenParams<SettlementStackParams> | undefined;
  Marketplace: NavigatorScreenParams<MarketplaceStackParams> | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParams>();

export function MainNavigator({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Send"        component={SendScreen} />
      <Tab.Screen name="Receive"     component={ReceiveScreen} />
      <Tab.Screen name="History"     component={HistoryScreen} />
      <Tab.Screen name="Settlement"  component={SettlementNavigator} />
      <Tab.Screen name="Marketplace" component={MarketplaceNavigator} />
      {/* Settings is reachable via Dashboard gear icon; not shown in tab bar */}
      <Tab.Screen name="Settings">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
