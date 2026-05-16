import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useWalletStore } from './src/store/wallet';
import { useNodeStore } from './src/store/node';
import { useSettlementStore } from './src/store/settlement';
import { usePeers } from './src/hooks/usePeers';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { MainNavigator } from './src/navigation/MainNavigator';
import { IriumSplash } from './src/screens/SplashScreen';
import { Colors } from './src/components/theme';

function WalletApp({ onLogout }: { onLogout: () => void }) {
  usePeers();
  return <MainNavigator onLogout={onLogout} />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);

  const { loadFromStorage } = useWalletStore();
  const { loadSyncedHeight } = useNodeStore();
  const { loadAgreements } = useSettlementStore();

  useEffect(() => {
    async function init() {
      // Load fonts — never block startup if fonts fail
      try {
        await Font.loadAsync({
          SpaceGrotesk_400Regular,
          SpaceGrotesk_600SemiBold,
          SpaceGrotesk_700Bold,
        });
      } catch (_) {}

      // Load persisted state — all have try/catch internally
      await Promise.all([
        loadFromStorage(),
        loadSyncedHeight(),
        loadAgreements(),
      ]);

      const seed = useWalletStore.getState().seedHex;
      setHasWallet(!!seed);
      setReady(true);
    }
    init();
  }, []);

  // Show black screen while loading (native splash covers this briefly)
  if (!ready) {
    return <View style={styles.root} />;
  }

  // Show animated JS splash once data is loaded
  if (showSplash) {
    return (
      <View style={styles.root}>
        <IriumSplash hasWallet={hasWallet} onDone={() => setShowSplash(false)} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {hasWallet ? (
          <WalletApp onLogout={() => setHasWallet(false)} />
        ) : (
          <OnboardingNavigator onComplete={() => setHasWallet(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
});
