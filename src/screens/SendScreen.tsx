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
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';

function irmStr(sats: number) {
  return (sats / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

type Step = 'compose' | 'confirm' | 'done';

export function SendScreen() {
  const { seedHex, rpcUrl, authToken, address, utxos, balance } = useWalletStore();
  const { feeRate, setFeeRate } = useNodeStore();

  const [toAddress, setToAddress] = useState('');
  const [amountIrm, setAmountIrm] = useState('');
  const [step, setStep]           = useState<Step>('compose');
  const [txHex, setTxHex]         = useState('');
  const [txid, setTxid]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  // Focus border animations
  const addrFocus   = useRef(new Animated.Value(0)).current;

  // Success screen animations
  const successScale   = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const checkOpacity   = useRef(new Animated.Value(0)).current;

  const amountSats   = Math.floor(parseFloat(amountIrm || '0') * 1e8);
  const estimatedBytes = 250;
  const feeSats      = feeRate * estimatedBytes;
  const totalSats    = amountSats + feeSats;
  const maxSats      = balance?.confirmed ?? 0;

  function onFocusAddr()  { Animated.timing(addrFocus,  { toValue: 1, duration: 200, useNativeDriver: false }).start(); }
  function onBlurAddr()   { Animated.timing(addrFocus,  { toValue: 0, duration: 200, useNativeDriver: false }).start(); }

  function addrBorderColor() {
    return addrFocus.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, addrError ? Colors.error : Colors.primary] });
  }

  function validateAddress(addr: string) {
    const ok = bridge.validateAddress(addr.trim());
    setAddrError(ok || !addr ? null : 'Invalid Q-address');
    return ok;
  }

  async function buildTx() {
    const trimmed = toAddress.trim();
    if (!validateAddress(trimmed)) {
      Alert.alert('Invalid address', 'Enter a valid Irium Q-address');
      return;
    }
    if (amountSats <= 0) { Alert.alert('Invalid amount', 'Amount must be greater than zero'); return; }
    if (totalSats > maxSats) { Alert.alert('Insufficient funds', `Max available: ${irmStr(maxSats)} IRM`); return; }
    if (!seedHex) return;

    setLoading(true);
    try {
      const [freshUtxos, freshRate] = await Promise.all([
        bridge.rpcGetUtxos(rpcUrl, authToken, address ?? ''),
        bridge.rpcGetFeeRate(rpcUrl, authToken),
      ]);
      setFeeRate(freshRate);

      const hex = await bridge.buildSendTx(
        freshUtxos, trimmed, amountSats, freshRate * estimatedBytes, seedHex, 0,
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
      // Animate success circle
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
    if (text) setToAddress(text.trim());
  }

  function reset() {
    setToAddress(''); setAmountIrm(''); setTxHex(''); setTxid('');
    setAddrError(null); setStep('compose');
    successScale.setValue(0);
    successOpacity.setValue(0);
    checkOpacity.setValue(0);
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.root}>
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
          <Text style={[Typography.caption, { marginTop: 12, textAlign: 'center' }]}>Transaction ID</Text>
          <Text style={styles.txidText} selectable>{txid}</Text>
          <GradientButton label="New transaction" onPress={reset} style={{ marginTop: 40, width: 220 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[Typography.h2, { marginBottom: 20 }]}>Send IRM</Text>

          {step === 'compose' && (
            <>
              <Card style={{ marginBottom: 16, gap: 16 }}>
                {/* Recipient address */}
                <View>
                  <Text style={styles.fieldLabel}>Recipient address</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Animated.View style={[styles.inputWrap, { flex: 1, borderColor: addrBorderColor() }]}>
                      <TextInput
                        style={styles.input}
                        value={toAddress}
                        onChangeText={(v) => { setToAddress(v); validateAddress(v); }}
                        onFocus={onFocusAddr}
                        onBlur={onBlurAddr}
                        placeholder="Q..."
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </Animated.View>
                    <TouchableOpacity style={styles.pasteBtn} onPress={paste}>
                      <Text style={styles.pasteTxt}>Paste</Text>
                    </TouchableOpacity>
                  </View>
                  {addrError && <Text style={styles.fieldError}>{addrError}</Text>}
                </View>

                {/* Amount — large numeric display */}
                <View style={styles.amountSection}>
                  <Text style={styles.fieldLabel}>Amount (IRM)</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountIrm}
                    onChangeText={setAmountIrm}
                    placeholder="0.00"
                    placeholderTextColor={Colors.border}
                    keyboardType="decimal-pad"
                    textAlign="center"
                  />
                  {balance && (
                    <Text style={styles.availableText}>
                      Available: {irmStr(balance.confirmed)} IRM
                    </Text>
                  )}
                </View>

                {/* Fee rows */}
                <View style={styles.feeBlock}>
                  <View style={styles.feeRow}>
                    <Text style={Typography.caption}>Estimated fee</Text>
                    <Text style={styles.feeValue}>{irmStr(feeSats)} IRM</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeDetail}>{feeRate} sat/byte × {estimatedBytes}B</Text>
                    <Text style={styles.feeDetail}>Total: {irmStr(totalSats)} IRM</Text>
                  </View>
                </View>
              </Card>

              <GradientButton label="Preview transaction" onPress={buildTx} loading={loading} />
            </>
          )}

          {step === 'confirm' && (
            <>
              <Card style={{ marginBottom: 24, gap: 14 }}>
                <ConfirmRow label="To"     value={toAddress}             mono />
                <ConfirmRow label="Amount" value={`${irmStr(amountSats)} IRM`} />
                <ConfirmRow label="Fee"    value={`${irmStr(feeSats)} IRM`} />
                <View style={styles.divider} />
                <ConfirmRow label="Total"  value={`${irmStr(totalSats)} IRM`} bold />
              </Card>
              <GradientButton
                label="Confirm & broadcast"
                onPress={broadcast}
                loading={loading}
                style={{ marginBottom: 12 }}
              />
              <GradientButton label="Go back" onPress={() => setStep('compose')} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConfirmRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={Typography.caption}>{label}</Text>
      <Text
        style={[
          mono ? { fontFamily: 'monospace', fontSize: 12 } : Typography.body,
          bold && { fontFamily: Fonts.bold },
          { color: Colors.text, flex: 1, textAlign: 'right' },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60 },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  inputWrap: { borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  input: {
    backgroundColor: Colors.bg,
    padding: 14,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  pasteBtn: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pasteTxt: { color: Colors.primary, fontSize: 13, fontFamily: Fonts.semiBold },
  amountSection: { alignItems: 'center', paddingVertical: 8 },
  amountInput: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: Colors.text,
    minWidth: 160,
    textAlign: 'center',
    paddingVertical: 4,
  },
  availableText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 6,
  },
  feeBlock: { gap: 6 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeValue: { color: Colors.text, fontSize: 15, fontFamily: Fonts.semiBold },
  feeDetail: { color: Colors.textMuted, fontSize: 11, fontFamily: Fonts.regular },
  divider: { height: 1, backgroundColor: Colors.border },
  fieldError: { color: Colors.error, fontSize: 12, fontFamily: Fonts.regular, marginTop: 4 },
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
  txidText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});
