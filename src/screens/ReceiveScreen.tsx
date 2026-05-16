import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Pressable,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Colour first 6 and last 6 chars purple, middle white */
function AddressHighlight({ addr }: { addr: string }) {
  if (addr.length < 13) {
    return <Text style={styles.addrText}>{addr}</Text>;
  }
  const head   = addr.slice(0, 6);
  const middle = addr.slice(6, addr.length - 6);
  const tail   = addr.slice(addr.length - 6);
  return (
    <Text style={styles.addrText}>
      <Text style={styles.addrAccent}>{head}</Text>
      {middle}
      <Text style={styles.addrAccent}>{tail}</Text>
    </Text>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ReceiveScreen() {
  const { seedHex, address, setAddress, addressIndex, setAddressIndex } = useWalletStore();
  const [currentAddr, setCurrentAddr] = useState(address ?? '');
  const [loading, setLoading]         = useState(!address);
  const [error, setError]             = useState<string | null>(null);
  const [copyFlash, setCopyFlash]     = useState(false);

  // QR fade + scale
  const qrScale   = useRef(new Animated.Value(0.85)).current;
  const qrOpacity = useRef(new Animated.Value(0)).current;

  // Scan line animation
  const scanY = useRef(new Animated.Value(0)).current;

  // Copy button spring
  const copyScale = useRef(new Animated.Value(1)).current;

  // ── Derive address ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!seedHex) return;
    setLoading(true);
    setError(null);
    qrScale.setValue(0.85);
    qrOpacity.setValue(0);

    bridge
      .deriveAddress(seedHex, addressIndex)
      .then((a) => {
        setCurrentAddr(a);
        if (addressIndex === 0) setAddress(a);
        Animated.parallel([
          Animated.spring(qrScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.timing(qrOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]).start();
      })
      .catch((e: any) => setError(e.message ?? 'Failed to derive address'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedHex, addressIndex]);

  // ── Scan-line animation (loops while address is ready) ────────────────────

  useEffect(() => {
    if (loading || !currentAddr) return;
    scanY.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 240, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0,   duration: 0,    useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [loading, currentAddr, scanY]);

  // ── Copy ──────────────────────────────────────────────────────────────────

  async function copy() {
    if (!currentAddr) return;
    await Clipboard.setStringAsync(currentAddr);
    copyScale.setValue(0.92);
    Animated.spring(copyScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 1200);
  }

  async function share() {
    if (!currentAddr) return;
    await Share.share({ message: currentAddr });
  }

  function nextAddress() {
    setAddressIndex(addressIndex + 1);
  }

  const pressCopy   = () => Animated.spring(copyScale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start();
  const releaseCopy = () => Animated.spring(copyScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Text style={[Typography.h2, styles.title]}>Receive IRM</Text>

      {/* ── QR card ── */}
      <View style={styles.qrCard}>
        {loading ? (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.qrPlaceholder}>
            <Text style={{ color: Colors.danger, textAlign: 'center', fontSize: 13 }}>{error}</Text>
          </View>
        ) : currentAddr ? (
          <Animated.View
            style={{ transform: [{ scale: qrScale }], opacity: qrOpacity, position: 'relative' }}
          >
            {/* White background frame for QR */}
            <View style={styles.qrFrame}>
              <QRCode
                value={currentAddr}
                size={240}
                color="#000000"
                backgroundColor="#FFFFFF"
                ecl="H"
              />
              {/* Purple scan line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanY }] },
                ]}
                pointerEvents="none"
              />
            </View>
          </Animated.View>
        ) : (
          <View style={styles.qrPlaceholder} />
        )}
      </View>

      {/* ── Address display ── */}
      <View style={styles.addrCard}>
        <Text style={styles.addrIndexLabel}>Address #{addressIndex}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 6 }} />
        ) : (
          <AddressHighlight addr={currentAddr} />
        )}
      </View>

      {/* ── Actions ── */}
      <View style={styles.actions}>
        {/* Copy — gradient button */}
        <Pressable
          onPress={copy}
          onPressIn={pressCopy}
          onPressOut={releaseCopy}
          disabled={loading || !currentAddr}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={{ transform: [{ scale: copyScale }], borderRadius: 12, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={copyFlash ? ['#10B981', '#10B981'] : GradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGrad}
            >
              <Ionicons
                name={copyFlash ? 'checkmark' : 'copy-outline'}
                size={18}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.btnText}>{copyFlash ? 'Copied!' : 'Copy'}</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Share */}
        <Pressable
          onPress={share}
          disabled={loading || !currentAddr}
          style={styles.btnSecondary}
        >
          <Ionicons name="share-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.btnSecondaryText}>Share</Text>
        </Pressable>
      </View>

      {/* ── Next address ── */}
      <Pressable onPress={nextAddress} style={styles.nextAddrBtn}>
        <Text style={styles.nextAddrText}>Next address →</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { margin: 24, marginBottom: 16 },

  // QR card
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 24,
    paddingVertical: 28,
  },
  qrPlaceholder: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  qrFrame: {
    width: 240,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: 2,
    backgroundColor: '#7B2FFF',
    opacity: 0.7,
  },

  // Address display
  addrCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 24,
    marginTop: 16,
    padding: 14,
    gap: 6,
  },
  addrIndexLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addrText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  addrAccent: {
    color: Colors.primary,
    fontFamily: 'monospace',
    fontSize: 13,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    gap: 10,
  },
  btnGrad: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 15 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 15,
  },

  // Next address
  nextAddrBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  nextAddrText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
});
