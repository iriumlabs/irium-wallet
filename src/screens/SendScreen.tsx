import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Pressable,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { GradientButton } from '../components/GradientButton';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function irmStr(sats: number) {
  return (sats / 1e8).toFixed(8);
}

type Step = 'compose' | 'confirm' | 'done';
type FeeSpeed = 'slow' | 'normal' | 'fast';

// ─── Confirm Row ─────────────────────────────────────────────────────────────

function ConfirmRow({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={confirmRowStyles.row}>
      <Text style={Typography.caption}>{label}</Text>
      <Text
        style={[
          mono ? confirmRowStyles.mono : Typography.body,
          bold && { fontFamily: Fonts.bold },
          { color: Colors.text, flex: 1, textAlign: 'right' },
        ]}
        selectable
        numberOfLines={mono ? 1 : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

const confirmRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  mono: { fontFamily: 'monospace', fontSize: 11 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function SendScreen() {
  const { seedHex, rpcUrl, authToken, address, utxos, balance } = useWalletStore();
  const { feeRate, setFeeRate } = useNodeStore();

  const [toAddress, setToAddress] = useState('');
  const [amountIrm, setAmountIrm] = useState('');
  const [useIrm, setUseIrm]       = useState(true);   // IRM vs sats display toggle
  const [feeSpeed, setFeeSpeed]   = useState<FeeSpeed>('normal');
  const [step, setStep]           = useState<Step>('compose');
  const [txHex, setTxHex]         = useState('');
  const [txid, setTxid]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [addrValid, setAddrValid] = useState<boolean | null>(null);

  // Address focus border animation
  const addrFocus = useRef(new Animated.Value(0)).current;

  // Success screen animations
  const successScale   = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkOpacity   = useRef(new Animated.Value(0)).current;

  // ── Derived values ─────────────────────────────────────────────────────────

  const effectiveFeeRate =
    feeSpeed === 'slow' ? feeRate * 0.5 :
    feeSpeed === 'fast' ? feeRate * 2   : feeRate;

  const estimatedBytes = 250;
  const amountSats     = Math.floor(parseFloat(amountIrm || '0') * 1e8);
  const feeSats        = Math.ceil(effectiveFeeRate * estimatedBytes);
  const totalSats      = amountSats + feeSats;
  const maxSats        = balance?.confirmed ?? 0;

  // ── Address focus animations ───────────────────────────────────────────────

  function onFocusAddr() {
    Animated.timing(addrFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }
  function onBlurAddr() {
    Animated.timing(addrFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  function addrBorderColor(): string | Animated.AnimatedInterpolation<string> {
    if (addrValid === true)  return Colors.success;
    if (addrValid === false) return Colors.danger;
    return addrFocus.interpolate({
      inputRange: [0, 1],
      outputRange: [Colors.border, Colors.primary],
    });
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateAddress(addr: string) {
    if (!addr) { setAddrValid(null); return false; }
    const ok = bridge.validateAddress(addr.trim());
    setAddrValid(ok);
    return ok;
  }

  // ── Build & broadcast ──────────────────────────────────────────────────────

  async function buildTx() {
    const trimmed = toAddress.trim();
    if (!validateAddress(trimmed)) {
      Alert.alert('Invalid address', 'Enter a valid Irium Q-address');
      return;
    }
    if (amountSats <= 0) {
      Alert.alert('Invalid amount', 'Amount must be greater than zero');
      return;
    }
    if (totalSats > maxSats) {
      Alert.alert('Insufficient funds', `Max available: ${irmStr(maxSats)} IRM`);
      return;
    }
    if (!seedHex) return;

    setLoading(true);
    try {
      const [freshUtxos, freshRate] = await Promise.all([
        bridge.rpcGetUtxos(rpcUrl, authToken, address ?? ''),
        bridge.rpcGetFeeRate(rpcUrl, authToken),
      ]);
      setFeeRate(freshRate);

      const hex = await bridge.buildSendTx(
        freshUtxos,
        trimmed,
        amountSats,
        Math.ceil((feeSpeed === 'slow' ? freshRate * 0.5 : feeSpeed === 'fast' ? freshRate * 2 : freshRate) * estimatedBytes),
        seedHex,
        0,
      );
      setTxHex(hex);
      setStep('confirm');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to build transaction');
    } finally {
      setLoading(false);
    }
  }

  async function broadcast() {
    setLoading(true);
    try {
      const id = await bridge.broadcastTx(txHex);
      await bridge.rpcSubmitTx(rpcUrl, authToken, txHex).catch(() => {});
      setTxid(id);
      setStep('done');
      Animated.parallel([
        Animated.spring(successScale,   { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      Alert.alert('Broadcast failed', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function paste() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      const trimmed = text.trim();
      setToAddress(trimmed);
      validateAddress(trimmed);
    }
  }

  async function copyTxid() {
    await Clipboard.setStringAsync(txid);
    Alert.alert('Copied', 'Transaction ID copied to clipboard');
  }

  function scanQr() {
    Alert.alert('Coming soon', 'QR scanner coming soon');
  }

  function reset() {
    setToAddress('');
    setAmountIrm('');
    setTxHex('');
    setTxid('');
    setAddrValid(null);
    setFeeSpeed('normal');
    setStep('compose');
    successScale.setValue(0);
    successOpacity.setValue(0);
    checkOpacity.setValue(0);
  }

  // ── Fee speed pills ────────────────────────────────────────────────────────

  function FeePill({ speed, label, rate }: { speed: FeeSpeed; label: string; rate: number }) {
    const active = feeSpeed === speed;
    return (
      <Pressable
        onPress={() => setFeeSpeed(speed)}
        style={[styles.feePill, active && styles.feePillActive]}
      >
        <Text style={[styles.feePillLabel, active && styles.feePillLabelActive]}>{label}</Text>
        <Text style={[styles.feePillRate, active && styles.feePillLabelActive]}>
          {Math.ceil(rate)} sat/B
        </Text>
      </Pressable>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={styles.successBox}>
          <Animated.View
            style={[
              styles.successCircle,
              { opacity: successOpacity, transform: [{ scale: successScale }] },
            ]}
          >
            <Animated.Text style={[styles.checkmark, { opacity: checkOpacity }]}>✓</Animated.Text>
          </Animated.View>

          <Text style={[Typography.h2, { marginTop: 28, color: Colors.success }]}>Sent!</Text>
          <Text style={[Typography.caption, { marginTop: 8, textAlign: 'center' }]}>
            Transaction ID
          </Text>

          <View style={styles.txidCard}>
            <Text style={styles.txidText} selectable numberOfLines={2}>
              {txid}
            </Text>
            <Pressable onPress={copyTxid} style={styles.copyTxidBtn}>
              <Ionicons name="copy-outline" size={16} color={Colors.primary} />
              <Text style={styles.copyTxidTxt}>Copy</Text>
            </Pressable>
          </View>

          <GradientButton
            label="New transaction"
            onPress={reset}
            style={{ marginTop: 32, width: 220 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Compose / Confirm screen ───────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[Typography.h2, { marginBottom: 20 }]}>Send IRM</Text>

          {/* ── Compose ── */}
          {step === 'compose' && (
            <>
              {/* Amount section */}
              <View style={styles.card}>
                <View style={styles.amountSection}>
                  <TextInput
                    style={styles.amountInput}
                    value={amountIrm}
                    onChangeText={setAmountIrm}
                    placeholder="0.00"
                    placeholderTextColor={Colors.border}
                    keyboardType="decimal-pad"
                    textAlign="center"
                  />
                  <Pressable
                    onPress={() => setUseIrm(!useIrm)}
                    style={styles.unitToggle}
                  >
                    <Text style={styles.unitToggleTxt}>
                      {useIrm ? 'IRM' : 'sats'} ⇄
                    </Text>
                  </Pressable>
                  {balance != null && (
                    <Text style={styles.availableText}>
                      Available: {irmStr(maxSats)} IRM
                    </Text>
                  )}
                </View>
              </View>

              {/* Fee speed */}
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Transaction speed</Text>
                <View style={styles.feeRow}>
                  <FeePill speed="slow"   label="🐢 Slow"   rate={feeRate * 0.5} />
                  <FeePill speed="normal" label="⚡ Normal"  rate={feeRate} />
                  <FeePill speed="fast"   label="🚀 Fast"   rate={feeRate * 2} />
                </View>
                <View style={styles.feeSummary}>
                  <Text style={Typography.caption}>
                    Fee: {irmStr(feeSats)} IRM ({feeSats.toLocaleString()} sats)
                  </Text>
                  <Text style={Typography.caption}>
                    Total: {irmStr(totalSats)} IRM
                  </Text>
                </View>
              </View>

              {/* Address */}
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Recipient address</Text>
                <Animated.View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor:
                        addrValid === true  ? Colors.success :
                        addrValid === false ? Colors.danger  :
                        addrFocus.interpolate({
                          inputRange: [0, 1],
                          outputRange: [Colors.border, Colors.primary],
                        }),
                    },
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={toAddress}
                    onChangeText={(v) => { setToAddress(v); validateAddress(v); }}
                    onFocus={onFocusAddr}
                    onBlur={onBlurAddr}
                    placeholder="Q…"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.inputActions}>
                    <Pressable onPress={paste} style={styles.inputIconBtn}>
                      <Ionicons name="clipboard-outline" size={20} color={Colors.primary} />
                    </Pressable>
                    <Pressable onPress={scanQr} style={styles.inputIconBtn}>
                      <Ionicons name="qr-code-outline" size={20} color={Colors.primary} />
                    </Pressable>
                  </View>
                </Animated.View>
                {addrValid === true && (
                  <Text style={styles.addrValid}>✓ Valid address</Text>
                )}
                {addrValid === false && (
                  <Text style={styles.addrInvalid}>✗ Invalid Q-address</Text>
                )}
              </View>

              <GradientButton
                label="Preview transaction"
                onPress={buildTx}
                loading={loading}
              />
            </>
          )}

          {/* ── Confirm ── */}
          {step === 'confirm' && (
            <>
              <View style={[styles.card, { gap: 14 }]}>
                <ConfirmRow label="To"     value={toAddress}             mono />
                <ConfirmRow label="Amount" value={`${irmStr(amountSats)} IRM`} />
                <ConfirmRow label="Fee"    value={`${irmStr(feeSats)} IRM`} />
                <View style={styles.divider} />
                <ConfirmRow label="Total"  value={`${irmStr(totalSats)} IRM`} bold />
              </View>
              <GradientButton
                label="Confirm & broadcast"
                onPress={broadcast}
                loading={loading}
                style={{ marginBottom: 12 }}
              />
              <GradientButton
                label="Go back"
                onPress={() => setStep('compose')}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 60, gap: 14 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },

  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Amount section
  amountSection: { alignItems: 'center', paddingVertical: 8 },
  amountInput: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: Colors.text,
    minWidth: 160,
    textAlign: 'center',
    paddingVertical: 4,
  },
  unitToggle: {
    marginTop: 8,
    backgroundColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  unitToggleTxt: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
  },
  availableText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 8,
  },

  // Fee speed
  feeRow: { flexDirection: 'row', gap: 8 },
  feePill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bg,
  },
  feePillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  feePillLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  feePillLabelActive: { color: Colors.primary },
  feePillRate: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  feeSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  // Address input
  inputWrap: {
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 13,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  inputActions: {
    flexDirection: 'row',
    paddingRight: 8,
    gap: 4,
    backgroundColor: Colors.bg,
  },
  inputIconBtn: { padding: 6 },
  addrValid: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  addrInvalid: {
    color: Colors.danger,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },

  divider: { height: 1, backgroundColor: Colors.border },

  // Success screen
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 0,
  },
  checkmark: { fontSize: 44, color: Colors.success, fontFamily: Fonts.bold },
  txidCard: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  txidText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  copyTxidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyTxidTxt: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
});

// Suppress unused import warning — Share is available but used conditionally
void Share;
