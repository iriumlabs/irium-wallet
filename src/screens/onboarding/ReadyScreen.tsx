import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Typography, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Ready'> & { onComplete: () => void };

const MAX_ADDR_LEN = 50;

export function ReadyScreen({ onComplete }: Props) {
  const { seedHex, rpcUrl, setAddress } = useWalletStore();
  const [addr, setAddr]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Success circle springs in
  const circleScale   = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  const checkOpacity  = useRef(new Animated.Value(0)).current;

  // "Wallet ready" title slide
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(16)).current;

  // Per-character opacity for address reveal
  const charAnims = useRef(
    Array.from({ length: MAX_ADDR_LEN }, () => new Animated.Value(0))
  ).current;

  // Button entrance
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!seedHex) { setLoading(false); return; }
    bridge
      .deriveAddress(seedHex, 0)
      .then((a) => {
        setAddr(a);
        setAddress(a);
      })
      .catch((e: any) => setError(e.message ?? 'Failed to derive address'))
      .finally(() => setLoading(false));
  }, [seedHex]);

  // Trigger animations once address is ready
  useEffect(() => {
    if (loading || error) return;

    // Circle springs in
    Animated.parallel([
      Animated.spring(circleScale,   { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(circleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Checkmark fades in after circle settles
    Animated.sequence([
      Animated.delay(280),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Title slides up
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleY,       { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Address character reveal
    Animated.sequence([
      Animated.delay(600),
      Animated.stagger(
        25,
        charAnims.slice(0, MAX_ADDR_LEN).map((anim) =>
          Animated.timing(anim, { toValue: 1, duration: 40, useNativeDriver: true })
        )
      ),
    ]).start();

    // Button
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [loading, error]);

  async function copyAddress() {
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    Alert.alert('Copied', 'Address copied to clipboard');
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : error ? (
          <Text style={[Typography.caption, { color: Colors.error, textAlign: 'center' }]}>
            {error}
          </Text>
        ) : (
          <>
            {/* Animated success circle */}
            <Animated.View
              style={[
                styles.successCircle,
                {
                  opacity: circleOpacity,
                  transform: [{ scale: circleScale }],
                },
              ]}
            >
              <Animated.Text style={[styles.checkmark, { opacity: checkOpacity }]}>
                ✓
              </Animated.Text>
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={{
                opacity: titleOpacity,
                transform: [{ translateY: titleY }],
                alignItems: 'center',
                marginTop: 28,
              }}
            >
              <Text style={styles.title}>Wallet ready</Text>
              <Text style={styles.subtitle}>Your first address</Text>
            </Animated.View>

            {/* Address character reveal */}
            {addr.length > 0 && (
              <TouchableOpacity onPress={copyAddress} style={styles.addrWrap} activeOpacity={0.7}>
                <View style={styles.addrChars}>
                  {addr.split('').map((ch, i) => (
                    <Animated.Text
                      key={i}
                      style={[styles.addrChar, { opacity: charAnims[i] ?? 1 }]}
                    >
                      {ch}
                    </Animated.Text>
                  ))}
                </View>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.rpcLabel}>
              RPC: {rpcUrl}
            </Text>
          </>
        )}
      </View>

      <Animated.View style={{ opacity: btnOpacity }}>
        <GradientButton
          label="Open wallet"
          onPress={onComplete}
          disabled={loading || !!error}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 24,
    paddingBottom: 60,
    justifyContent: 'space-between',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft glow
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 0,
  },
  checkmark: {
    fontSize: 44,
    color: Colors.success,
    fontFamily: Fonts.bold,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginBottom: 16,
    marginTop: 4,
  },
  addrWrap: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    maxWidth: '100%',
    marginTop: 4,
  },
  addrChars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  addrChar: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.primary,
  },
  copyHint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  rpcLabel: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
