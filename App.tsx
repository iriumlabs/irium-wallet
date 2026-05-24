import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
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
import { AuthLockScreen } from './src/screens/AuthLockScreen';
import { ToastProvider } from './src/components/Toast';
import { Colors } from './src/components/theme';

const AUTH_METHOD_KEY = 'irium_auth_method';
type AuthMethod = 'none' | 'pin' | 'biometric';

function WalletApp({ onLogout }: { onLogout: () => void }) {
  return <MainNavigator onLogout={onLogout} />;
}

// Mounted at the App root once stores are loaded — keeps the light
// client running across splash → onboarding → wallet so peers are
// already connected by the time the user reaches the Dashboard. The
// "already running" path in usePeers handles re-mounts gracefully as
// the user transitions between top-level UI states.
function PeersHost() { usePeers(); return null; }

export default function App() {
  const [ready, setReady]           = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [hasWallet, setHasWallet]   = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('none');
  const [unlocked, setUnlocked]     = useState(false);

  const { loadFromStorage } = useWalletStore();
  const { loadSyncedHeight } = useNodeStore();
  const { loadAgreements } = useSettlementStore();

  useEffect(() => {
    async function init() {
      try {
        await Font.loadAsync({
          SpaceGrotesk_400Regular,
          SpaceGrotesk_500Medium,
          SpaceGrotesk_600SemiBold,
          SpaceGrotesk_700Bold,
        });
      } catch (_) {}

      await Promise.all([
        loadFromStorage(),
        loadSyncedHeight(),
        loadAgreements(),
      ]);

      const seed = useWalletStore.getState().seedHex;
      setHasWallet(!!seed);

      // Read auth method if a wallet exists
      if (seed) {
        try {
          const m = await SecureStore.getItemAsync(AUTH_METHOD_KEY);
          if (m === 'pin' || m === 'biometric') setAuthMethod(m);
        } catch {}
      }

      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return <View style={styles.root} />;
  }

  if (showSplash) {
    return (
      <View style={styles.root}>
        <PeersHost />
        <IriumSplash hasWallet={hasWallet} onDone={() => setShowSplash(false)} />
      </View>
    );
  }

  // Auth lock — returning user with a wallet AND a lock method set
  if (hasWallet && authMethod !== 'none' && !unlocked) {
    return (
      <SafeAreaProvider>
        <PeersHost />
        <ToastProvider>
          <AuthLockScreen method={authMethod} onUnlock={() => setUnlocked(true)} />
        </ToastProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PeersHost />
      <ToastProvider>
        <NavigationContainer>
          {hasWallet ? (
            <WalletApp onLogout={() => { setHasWallet(false); setUnlocked(false); setAuthMethod('none'); }} />
          ) : (
            <OnboardingNavigator
              onComplete={async () => {
                // Re-read auth method (it may have been set during onboarding)
                try {
                  const m = await SecureStore.getItemAsync(AUTH_METHOD_KEY);
                  setAuthMethod((m === 'pin' || m === 'biometric') ? m : 'none');
                } catch {}
                // Mark unlocked so we go straight to MainTabs without re-prompting
                setUnlocked(true);
                setHasWallet(true);
              }}
            />
          )}
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
