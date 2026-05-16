import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { Card } from '../components/Card';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';
import { LinearGradient } from 'expo-linear-gradient';

export function ReceiveScreen() {
  const { seedHex, address, setAddress, addressIndex, setAddressIndex } = useWalletStore();
  const [currentAddr, setCurrentAddr] = useState(address ?? '');
  const [loading, setLoading]         = useState(!address);
  const [error, setError]             = useState<string | null>(null);
  const [copyFlash, setCopyFlash]     = useState(false);

  // QR fade+scale animation
  const qrScale   = useRef(new Animated.Value(0.85)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;

  // Copy button spring
  const copyScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!seedHex) return;
    setLoading(true);
    setError(null);
    // Reset QR animation
    qrScale.setValue(0.85);
    qrOpacity.setValue(0);

    bridge
      .deriveAddress(seedHex, addressIndex)
      .then((a) => {
        setCurrentAddr(a);
        if (addressIndex === 0) setAddress(a);
        // Fade+scale QR in
        Animated.parallel([
          Animated.spring(qrScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.timing(qrOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]).start();
      })
      .catch((e: any) => setError(e.message ?? 'Failed to derive address'))
      .finally(() => setLoading(false));
  }, [seedHex, addressIndex]);

  async function copy() {
    if (!currentAddr) return;
    await Clipboard.setStringAsync(currentAddr);
    // Flash feedback
    copyScale.setValue(0.92);
    Animated.spring(copyScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 1200);
  }

  function nextAddress() {
    setAddressIndex(addressIndex + 1);
  }

  const pressCopy  = () => Animated.spring(copyScale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start();
  const releaseCopy = () => Animated.spring(copyScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Text style={[Typography.h2, styles.title]}>Receive IRM</Text>

      {/* QR card */}
      <Card style={styles.qrCard}>
        {loading ? (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.qrPlaceholder}>
            <Text style={{ color: Colors.error, textAlign: 'center', fontSize: 13 }}>{error}</Text>
          </View>
        ) : currentAddr ? (
          <Animated.View style={{ transform: [{ scale: qrScale }], opacity: qrOpacity }}>
            <QRCode value={currentAddr} size={220} color="#FFFFFF" backgroundColor={Colors.card} />
          </Animated.View>
        ) : (
          <View style={styles.qrPlaceholder} />
        )}
      </Card>

      {/* Address display */}
      <Card style={styles.addrCard}>
        <Text style={styles.addrLabel}>Address #{addressIndex}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 6 }} />
        ) : (
          <Text style={styles.addrText} selectable>
            {currentAddr}
          </Text>
        )}
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={copy}
          onPressIn={pressCopy}
          onPressOut={releaseCopy}
          disabled={loading || !currentAddr}
          style={{ flex: 1 }}
        >
          <Animated.View style={{ transform: [{ scale: copyScale }], borderRadius: 12, overflow: 'hidden' }}>
            <LinearGradient
              colors={copyFlash ? ['#10B981', '#10B981'] : GradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGrad}
            >
              <Text style={styles.btnText}>
                {copyFlash ? 'Copied!' : 'Copy address'}
              </Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={nextAddress}
          style={styles.btnSecondary}
        >
          <Text style={styles.btnSecondaryText}>Next address</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { margin: 24, marginBottom: 16 },
  qrCard: { alignItems: 'center', marginHorizontal: 24, padding: 24 },
  qrPlaceholder: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  addrCard: { marginHorizontal: 24, marginTop: 16, gap: 6 },
  addrLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  addrText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 20,
    gap: 12,
  },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 15 },
  btnSecondary: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: Colors.textMuted,
    fontFamily: Fonts.semiBold,
    fontSize: 15,
  },
});
