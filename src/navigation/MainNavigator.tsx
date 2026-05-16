import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../components/theme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { SendScreen } from '../screens/SendScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettlementNavigator } from './SettlementNavigator';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';

export type MainTabParams = {
  Dashboard: undefined;
  Receive: undefined;
  Send: undefined;
  History: undefined;
  Settlement: undefined;
  Marketplace: undefined;
  Settings: { onLogout: () => void };
};

const Tab = createBottomTabNavigator<MainTabParams>();

const ICONS: Record<string, string> = {
  Dashboard: '⬡',
  Receive: '↓',
  Send: '↑',
  History: '≡',
  Settlement: '⊞',
  Marketplace: '◈',
  Settings: '⚙',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconGlyph, { color: focused ? Colors.primary : Colors.textMuted }]}>
        {ICONS[name] ?? '·'}
      </Text>
    </View>
  );
}

export function MainNavigator({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Receive" component={ReceiveScreen} options={{ tabBarLabel: 'Receive' }} />
      <Tab.Screen name="Send" component={SendScreen} options={{ tabBarLabel: 'Send' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
      <Tab.Screen name="Settlement" component={SettlementNavigator} options={{ tabBarLabel: 'Settle' }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarLabel: 'Market' }} />
      <Tab.Screen name="Settings" options={{ tabBarLabel: 'Settings' }}>
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#0A0A0A',
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
  },
  label: { fontSize: 10, marginTop: 2 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 18 },
});
