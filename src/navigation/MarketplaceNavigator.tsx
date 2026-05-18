import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../components/theme';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { OfferDetailScreen } from '../screens/marketplace/OfferDetailScreen';

export interface MarketOfferData {
  offer_id: string;
  seller_address: string;
  seller_pubkey?: string;
  amount_irm: number;      // satoshis (despite the name in the /offers/feed API)
  payment_method: string;
  status: string;          // open | taken | settled
  timeout_height: number;
  created_at: number;
  price_note?: string;
  payment_instructions?: string;
}

export type MarketplaceStackParams = {
  Feed: undefined;
  OfferDetail: { offer: MarketOfferData };
};

const Stack = createNativeStackNavigator<MarketplaceStackParams>();

export function MarketplaceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Feed"        component={MarketplaceScreen} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} />
    </Stack.Navigator>
  );
}
