import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSettlementStore, SettlementTemplate } from '../store/settlement';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, GradientColors, Typography } from '../components/theme';

const TEMPLATES: { id: SettlementTemplate; title: string; desc: string }[] = [
  { id: 'simple-settlement', title: 'Freelance', desc: 'Pay for work — payer locks funds, released on delivery' },
  { id: 'otc', title: 'OTC Trade', desc: 'Atomic swap — both sides commit, exchange simultaneously' },
];

function formatIrm(sats: number) { return (sats / 1e8).toFixed(8) + ' IRM'; }

export function SettlementWizardScreen() {
  const { seedHex, rpcUrl, authToken } = useWalletStore();
  const { feeRate } = useNodeStore();
  const store = useSettlementStore();
  const [loading, setLoading] = useState(false);

  // Step: template
  if (store.step === 'template') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[Typography.h2, { marginBottom: 8 }]}>Settlement wizard</Text>
          <Text style={[Typography.caption, { marginBottom: 24 }]}>
            Choose a template to start an HTLC-based settlement.
          </Text>
          {TEMPLATES.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => store.setTemplate(t.id)}>
              <Card style={styles.templateCard}>
                <LinearGradient colors={GradientColors} style={styles.templateBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t.title}</Text>
                </LinearGradient>
                <Text style={[Typography.body, { marginTop: 10 }]}>{t.title}</Text>
                <Text style={[Typography.caption, { marginTop: 4 }]}>{t.desc}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step: params
  if (store.step === 'params') {
    async function generateSecret() {
      // Derive a fresh key for the secret; use random index derived from timestamp
      if (!seedHex) return;
      const idx = Math.floor(Date.now() / 1000) % 10000 + 1000;
      const privkey = await bridge.derivePrivkeyHex(seedHex, idx);
      store.setField('secretHashHex', privkey.slice(0, 64));
    }

    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackBtn onPress={() => store.setStep('template')} />
          <Text style={[Typography.h2, { marginBottom: 20 }]}>
            {store.template === 'otc' ? 'OTC Trade' : 'Freelance'} details
          </Text>

          <Card style={{ marginBottom: 16, gap: 14 }}>
            <Field label="Payer address" value={store.payerAddress} onChangeText={(v) => store.setField('payerAddress', v)} placeholder="Q..." />
            <Field label="Payee address" value={store.payeeAddress} onChangeText={(v) => store.setField('payeeAddress', v)} placeholder="Q..." />
            <Field label="Amount (IRM)" value={store.amountSats ? (store.amountSats / 1e8).toString() : ''} onChangeText={(v) => store.setField('amountSats', Math.floor(parseFloat(v || '0') * 1e8))} placeholder="0.00" keyboard="decimal-pad" />
            <Field label="Timeout block height" value={store.timeoutHeight ? store.timeoutHeight.toString() : ''} onChangeText={(v) => store.setField('timeoutHeight', parseInt(v || '0', 10))} placeholder="e.g. 50000" keyboard="numeric" />
            <Field label="Payment reference (optional)" value={store.paymentReference} onChangeText={(v) => store.setField('paymentReference', v)} placeholder="Invoice # / description" />

            <View>
              <Text style={[Typography.caption, { marginBottom: 4 }]}>Secret hash (SHA256 of preimage)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={store.secretHashHex}
                  onChangeText={(v) => store.setField('secretHashHex', v)}
                  placeholder="64-char hex"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.genBtn} onPress={generateSecret}>
                  <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>Generate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          <GradientButton
            label="Review agreement"
            onPress={async () => {
              if (!store.payerAddress || !store.payeeAddress || !store.amountSats || !store.timeoutHeight || !store.secretHashHex) {
                Alert.alert('Incomplete', 'Fill in all required fields');
                return;
              }
              setLoading(true);
              try {
                const json = await bridge.createAgreement({
                  template_type: store.template!,
                  payer_address: store.payerAddress,
                  payee_address: store.payeeAddress,
                  total_amount_sats: store.amountSats,
                  timeout_height: store.timeoutHeight,
                  secret_hash_hex: store.secretHashHex,
                  payment_reference: store.paymentReference || undefined,
                });
                store.setField('agreementJson', json);

                // Encode HTLC script
                const script = await bridge.encodeHtlcv1(
                  store.secretHashHex,
                  store.payeeAddress,
                  store.payerAddress,
                  store.timeoutHeight,
                );
                store.setField('htlcScriptHex', script);
                store.setStep('review');
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Failed to create agreement');
              } finally {
                setLoading(false);
              }
            }}
            loading={loading}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step: review
  if (store.step === 'review') {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackBtn onPress={() => store.setStep('params')} />
          <Text style={[Typography.h2, { marginBottom: 16 }]}>Review</Text>

          <Card style={{ marginBottom: 16, gap: 10 }}>
            <ReviewRow label="Template" value={store.template === 'otc' ? 'OTC Trade' : 'Freelance'} />
            <ReviewRow label="Payer" value={store.payerAddress} mono />
            <ReviewRow label="Payee" value={store.payeeAddress} mono />
            <ReviewRow label="Amount" value={formatIrm(store.amountSats)} />
            <ReviewRow label="Timeout" value={`Block ${store.timeoutHeight.toLocaleString()}`} />
            <ReviewRow label="Secret hash" value={store.secretHashHex.slice(0, 16) + '…'} mono />
          </Card>

          {store.htlcScriptHex && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={Typography.caption}>HTLC script</Text>
              <Text style={[Typography.mono, { fontSize: 11, marginTop: 4 }]} selectable numberOfLines={3}>
                {store.htlcScriptHex}
              </Text>
            </Card>
          )}

          <GradientButton label="Fund HTLC →" onPress={() => store.setStep('fund')} style={{ marginBottom: 12 }} />
          <TouchableOpacity style={styles.cancelBtn} onPress={store.reset}>
            <Text style={{ color: Colors.error }}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step: fund
  if (store.step === 'fund') {
    async function fundHtlc() {
      if (!seedHex || !store.htlcScriptHex) return;
      setLoading(true);
      try {
        const myAddr = await bridge.deriveAddress(seedHex, 0);
        const utxos = await bridge.rpcGetUtxos(rpcUrl, authToken, myAddr);
        const feeSats = feeRate * 300;
        const txHex = await bridge.buildSendTx(
          utxos, store.payerAddress, store.amountSats, feeSats, seedHex, 0,
        );
        const txid = await bridge.broadcastTx(txHex);
        await bridge.rpcSubmitTx(rpcUrl, authToken, txHex).catch(() => {});
        store.setField('fundingTxid', txid);
        store.setStep('status');
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Funding failed');
      } finally {
        setLoading(false);
      }
    }

    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.content}>
          <BackBtn onPress={() => store.setStep('review')} />
          <Text style={[Typography.h2, { marginBottom: 20 }]}>Fund HTLC</Text>
          <Card style={{ marginBottom: 24, gap: 10 }}>
            <ReviewRow label="Send to HTLC" value={formatIrm(store.amountSats)} />
            <ReviewRow label="Fee (~300B)" value={formatIrm(feeRate * 300)} />
            <ReviewRow label="Total" value={formatIrm(store.amountSats + feeRate * 300)} bold />
          </Card>
          <GradientButton label="Sign & broadcast funding tx" onPress={fundHtlc} loading={loading} />
        </View>
      </SafeAreaView>
    );
  }

  // Step: status
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={[Typography.h2, { marginBottom: 20 }]}>Settlement active</Text>
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <ReviewRow label="Funding TXID" value={(store.fundingTxid ?? '').slice(0, 14) + '…'} mono />
          <ReviewRow label="Amount locked" value={formatIrm(store.amountSats)} />
          <ReviewRow label="Expires at block" value={store.timeoutHeight.toLocaleString()} />
        </Card>
        <Text style={[Typography.caption, { marginBottom: 24, textAlign: 'center' }]}>
          Payee reveals preimage → funds released.{'\n'}
          If timeout passes → you can refund.
        </Text>
        <GradientButton label="New settlement" onPress={store.reset} style={{ marginBottom: 12 }} />
      </View>
    </SafeAreaView>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 16 }}>
      <Text style={{ color: Colors.primary }}>← Back</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboard }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboard?: 'decimal-pad' | 'numeric';
}) {
  return (
    <View>
      <Text style={[Typography.caption, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function ReviewRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={Typography.caption}>{label}</Text>
      <Text style={[mono ? { fontFamily: 'monospace', fontSize: 12 } : Typography.body, bold && { fontWeight: '700' }, { color: Colors.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60 },
  templateCard: { marginBottom: 12 },
  templateBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  input: {
    backgroundColor: '#0a0a14', borderRadius: 10, padding: 14,
    color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  genBtn: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary,
    paddingHorizontal: 12, justifyContent: 'center',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
});
