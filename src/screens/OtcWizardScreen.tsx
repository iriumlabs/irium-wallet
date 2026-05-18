import React, { useEffect, useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  StatusBar, Alert, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { useScreenEnter } from '../hooks/useScreenEnter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSettlementStore, SavedAgreement } from '../store/settlement';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'OtcWizard'>;
type RouteParams = RouteProp<SettlementStackParams, 'OtcWizard'>;
type Role = 'buyer' | 'seller';
type Step = 1 | 2 | 3 | 4 | 5;

function irmStr(sats: number) { return (sats / 1e8).toFixed(8); }

export function OtcWizardScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const prefill = route.params?.prefill;
  const enterStyle = useScreenEnter();
  const { seedHex, address } = useWalletStore();
  const { nodeStatus } = useNodeStore();
  const { addAgreement } = useSettlementStore();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [generatingHash, setGeneratingHash] = useState(false);
  const [role, setRole] = useState<Role>('buyer');

  // Form fields
  const [counterpartyAddr, setCounterpartyAddr] = useState('');
  const [amountIrm, setAmountIrm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [timeoutBlocks, setTimeoutBlocks] = useState('144');

  // Derived
  const [secretHashHex, setSecretHashHex] = useState('');
  const [htlcScriptHex, setHtlcScriptHex] = useState('');
  const [agreementId, setAgreementId] = useState('');

  // Prefill from marketplace offer
  useEffect(() => {
    if (!prefill) return;
    // Taking an offer = the user is the buyer (payer), counterparty is the seller (payee)
    setRole('buyer');
    setCounterpartyAddr(prefill.sellerAddress);
    setAmountIrm((prefill.amountSats / 1e8).toString());
    if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod);
    if (prefill.timeoutHeight && nodeStatus?.height) {
      const blocks = Math.max(1, prefill.timeoutHeight - nodeStatus.height);
      setTimeoutBlocks(String(blocks));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.offerId]);

  const amountSats = Math.floor(parseFloat(amountIrm || '0') * 1e8);
  const timeoutHeight = (nodeStatus?.height ?? 45000) + parseInt(timeoutBlocks || '144', 10);
  const payerAddress = role === 'buyer' ? (address ?? '') : counterpartyAddr;
  const payeeAddress = role === 'seller' ? (address ?? '') : counterpartyAddr;

  function goBack() {
    if (step > 1) setStep((step - 1) as Step);
    else nav.goBack();
  }

  async function proceedToStep3() {
    if (!counterpartyAddr || !bridge.validateAddress(counterpartyAddr.trim())) {
      Alert.alert('Invalid address', 'Enter a valid Q-address for the counterparty'); return;
    }
    if (amountSats <= 0) { Alert.alert('Invalid amount', 'Enter a positive amount'); return; }
    if (!seedHex) return;

    setStep(3);
    setGeneratingHash(true);
    try {
      const idx = Math.floor(Date.now() / 1000) % 9000 + 1000;
      const secret = await bridge.derivePrivkeyHex(seedHex, idx);
      setSecretHashHex(secret.slice(0, 64));

      const script = await bridge.encodeHtlcv1(
        secret.slice(0, 64),
        payeeAddress.trim(),
        payerAddress.trim(),
        timeoutHeight,
      );
      setHtlcScriptHex(script);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to generate secret hash');
      setStep(2);
    } finally {
      setGeneratingHash(false);
    }
  }

  async function confirm() {
    if (!seedHex || !address) return;
    setLoading(true);
    try {
      const json = await bridge.createAgreement({
        template_type: 'otc',
        payer_address: payerAddress.trim(),
        payee_address: payeeAddress.trim(),
        total_amount_sats: amountSats,
        timeout_height: timeoutHeight,
        secret_hash_hex: secretHashHex,
        payment_reference: paymentMethod || undefined,
      });
      const id = await bridge.computeAgreementHash(json);
      setAgreementId(id);

      const saved: SavedAgreement = {
        id,
        template: 'otc',
        role: role === 'buyer' ? 'payer' : 'payee',
        myAddress: address,
        counterpartyAddress: counterpartyAddr.trim(),
        amountSats,
        timeoutHeight,
        secretHashHex,
        htlcScriptHex,
        fundingTxid: null,
        status: 'draft',
        paymentReference: paymentMethod,
        createdAt: Date.now(),
      };
      addAgreement(saved);
      setStep(5);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create agreement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Animated.View style={enterStyle}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { marginBottom: 4 }]}>OTC Trade</Text>
        <Text style={[Typography.caption, { marginBottom: 8 }]}>Step {step} of 5</Text>
        <ProgressBar current={step} total={5} />

        {/* Step 1: Role */}
        {step === 1 && (
          <View style={{ gap: 16, marginTop: 8 }}>
            <Text style={Typography.body}>What is your role in this trade?</Text>
            <RoleCard
              label="I am the Buyer"
              desc="You send IRM payment to the seller"
              icon="arrow-up-circle-outline"
              active={role === 'buyer'}
              onPress={() => setRole('buyer')}
            />
            <RoleCard
              label="I am the Seller"
              desc="You receive IRM from the buyer"
              icon="arrow-down-circle-outline"
              active={role === 'seller'}
              onPress={() => setRole('seller')}
            />
            <GradientButton label="Next →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            {role === 'seller' ? (
              <>
                <Field
                  label="Amount (IRM)"
                  value={amountIrm}
                  onChange={setAmountIrm}
                  placeholder="0.00000000"
                  keyboard="decimal-pad"
                />
                <Field
                  label="Payment method"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  placeholder="e.g. USDT TRC20, EUR bank transfer"
                />
                <Field
                  label="Payment instructions"
                  value={paymentInstructions}
                  onChange={setPaymentInstructions}
                  placeholder="How the buyer should send payment..."
                  multiline
                />
                <Field
                  label="Timeout (blocks, ~2.5 min each)"
                  value={timeoutBlocks}
                  onChange={setTimeoutBlocks}
                  placeholder="144"
                  keyboard="numeric"
                />
                <Field
                  label="Buyer's Q-address"
                  value={counterpartyAddr}
                  onChange={setCounterpartyAddr}
                  placeholder="Q..."
                />
              </>
            ) : (
              <>
                <Field
                  label="Seller's Q-address"
                  value={counterpartyAddr}
                  onChange={setCounterpartyAddr}
                  placeholder="Q..."
                />
                <Field
                  label="Amount (IRM)"
                  value={amountIrm}
                  onChange={setAmountIrm}
                  placeholder="0.00000000"
                  keyboard="decimal-pad"
                />
                <Field
                  label="Payment method / asset description"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  placeholder="e.g. USDT TRC20, EUR bank transfer"
                />
                <Field
                  label="Timeout (blocks, ~2.5 min each)"
                  value={timeoutBlocks}
                  onChange={setTimeoutBlocks}
                  placeholder="144"
                  keyboard="numeric"
                />
              </>
            )}
            <GradientButton label="Generate Secret Hash →" onPress={proceedToStep3} />
          </View>
        )}

        {/* Step 3: Secret hash generation */}
        {step === 3 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            {generatingHash ? (
              <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 32 }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={[Typography.body, { textAlign: 'center' }]}>
                  Auto-generating secure secret hash...
                </Text>
              </Card>
            ) : (
              <>
                <Card style={{ gap: 10 }}>
                  <Text style={[Typography.caption, { marginBottom: 4 }]}>Secret hash (keep your preimage safe!)</Text>
                  <Text style={[Typography.mono, { fontSize: 11, lineHeight: 18 }]} selectable>
                    {secretHashHex}
                  </Text>
                </Card>
                <Card style={{ gap: 8 }}>
                  <Text style={Typography.caption}>HTLC script</Text>
                  <Text style={[Typography.mono, { fontSize: 10, lineHeight: 16 }]} selectable numberOfLines={4}>
                    {htlcScriptHex}
                  </Text>
                </Card>
                <GradientButton label="Review Agreement →" onPress={() => setStep(4)} />
              </>
            )}
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Card style={{ gap: 12 }}>
              <ReviewRow label="Template" value="OTC Trade" />
              <ReviewRow label="Role" value={role === 'buyer' ? 'Payer (Buyer)' : 'Payee (Seller)'} />
              <ReviewRow label="Payer address" value={payerAddress.slice(0, 8) + '…' + payerAddress.slice(-6)} mono />
              <ReviewRow label="Payee address" value={payeeAddress.slice(0, 8) + '…' + payeeAddress.slice(-6)} mono />
              <ReviewRow label="Amount" value={`${irmStr(amountSats)} IRM`} bold />
              <ReviewRow label="Expires at block" value={timeoutHeight.toLocaleString()} />
              {paymentMethod ? <ReviewRow label="Payment method" value={paymentMethod} /> : null}
              {paymentInstructions ? <ReviewRow label="Instructions" value={paymentInstructions.slice(0, 50)} /> : null}
            </Card>
            <GradientButton label="Confirm & Save →" onPress={confirm} loading={loading} />
            <TouchableOpacity style={styles.editBtn} onPress={() => setStep(3)}>
              <Text style={{ color: Colors.textSecondary }}>← Edit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <View style={{ alignItems: 'center', gap: 20, paddingTop: 20 }}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={40} color={Colors.success} />
            </View>
            <Text style={[Typography.h2, { color: Colors.success }]}>Agreement Created!</Text>
            <Card style={{ width: '100%', gap: 10 }}>
              <Text style={Typography.caption}>Agreement Hash</Text>
              <Text style={[Typography.mono, { fontSize: 11, lineHeight: 16 }]} selectable>
                {agreementId}
              </Text>
            </Card>
            <Text style={[Typography.caption, { textAlign: 'center' }]}>
              Share the HTLC script and your address with your counterparty.
              Fund the HTLC to activate the trade.
            </Text>
            <GradientButton
              label="Share Package"
              onPress={() => Alert.alert('Share', 'Share package functionality coming soon')}
              style={{ width: '100%' }}
            />
            <GradientButton
              label="Back to Hub"
              onPress={() => nav.navigate('Hub')}
              style={{ width: '100%' }}
            />
          </View>
        )}
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            { backgroundColor: i + 1 <= current ? Colors.primary : Colors.border },
          ]}
        />
      ))}
    </View>
  );
}

function RoleCard({
  label, desc, icon, active, onPress,
}: {
  label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, active && styles.roleCardActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.roleIconWrap, active && { backgroundColor: Colors.primary + '33' }]}>
        <Ionicons name={icon} size={32} color={active ? Colors.primary : Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.roleLabel, active && { color: Colors.primary }]}>{label}</Text>
        <Text style={Typography.caption}>{desc}</Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
    </TouchableOpacity>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboard?: 'decimal-pad' | 'numeric'; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={[Typography.caption, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function ReviewRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Text style={Typography.caption}>{label}</Text>
      <Text style={[
        mono ? { fontFamily: 'monospace', fontSize: 12 } : Typography.body,
        bold ? { fontFamily: Fonts.bold } : {},
        { color: Colors.textPrimary, flex: 1, textAlign: 'right' },
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { color: Colors.primary, fontSize: 15, fontFamily: Fonts.medium },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2 },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: '#1a0a3a' },
  roleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLabel: { fontSize: 16, fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 2 },

  input: {
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14,
    color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  editBtn: { alignItems: 'center', paddingVertical: 14 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success + '22',
    borderWidth: 2,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
