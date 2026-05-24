import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  StatusBar, TouchableOpacity, Animated,
} from 'react-native';
import { useScreenEnter } from '../hooks/useScreenEnter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bridge } from '../bridge';
import { generateSecretAndHash, savePreimage } from '../bridge/secret';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSettlementStore, SavedAgreement } from '../store/settlement';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import { useToast } from '../components/Toast';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'FreelanceWizard'>;
type Role = 'hiring' | 'contractor';
type Step = 1 | 2 | 3 | 4;

function irmStr(sats: number) { return (sats / 1e8).toFixed(8); }

export function FreelanceWizardScreen() {
  const toast = useToast();
  const nav = useNavigation<Nav>();
  const enterStyle = useScreenEnter();
  const { seedHex, address } = useWalletStore();
  const { nodeStatus } = useNodeStore();
  const { addAgreement, updateAgreementStatus } = useSettlementStore();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>('hiring');
  const [funding, setFunding] = useState(false);
  const [fundingTxid, setFundingTxid] = useState<string | null>(null);
  const [fundingError, setFundingError] = useState<string | null>(null);

  const [counterpartyAddr, setCounterpartyAddr] = useState('');
  const [amountIrm, setAmountIrm] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [deadlineBlocks, setDeadlineBlocks] = useState('2016');

  const [secretHashHex, setSecretHashHex] = useState('');
  const [htlcScriptHex, setHtlcScriptHex] = useState('');
  const [agreementId, setAgreementId] = useState('');
  const [preimageHex, setPreimageHex] = useState('');
  const [agreementJson, setAgreementJson] = useState('');

  const amountSats = Math.floor(parseFloat(amountIrm || '0') * 1e8);
  const timeoutHeight = (nodeStatus?.height ?? 45000) + parseInt(deadlineBlocks || '2016', 10);
  const clientAddress = role === 'hiring' ? (address ?? '') : counterpartyAddr;
  const freelancerAddress = role === 'contractor' ? (address ?? '') : counterpartyAddr;

  function goBack() {
    if (step > 1) setStep((step - 1) as Step);
    else nav.goBack();
  }

  async function proceedToStep3() {
    if (!counterpartyAddr || !bridge.validateAddress(counterpartyAddr.trim())) {
      toast.show('Enter a valid Q-address', 'error'); return;
    }
    if (amountSats <= 0) { toast.show('Enter a positive amount', 'error'); return; }
    if (!workDescription.trim()) { toast.show('Enter a work description', 'error'); return; }
    if (!seedHex) return;

    setLoading(true);
    try {
      const { preimageHex: pre, secretHashHex: hash } = await generateSecretAndHash();
      setPreimageHex(pre);
      setSecretHashHex(hash);

      const script = await bridge.encodeHtlcv1(
        hash,
        freelancerAddress.trim(),
        clientAddress.trim(),
        timeoutHeight,
      );
      setHtlcScriptHex(script);
      setStep(3);
    } catch (e: any) {
      toast.show(e?.message ?? 'Failed to prepare agreement', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!seedHex || !address) return;
    setLoading(true);
    try {
      const ref = `${workDescription.slice(0, 40)}${deliverables ? ' | ' + deliverables.slice(0, 30) : ''}`;
      const json = await bridge.createAgreement({
        template_type: 'simple-settlement',
        payer_address: clientAddress.trim(),
        payee_address: freelancerAddress.trim(),
        total_amount_sats: amountSats,
        timeout_height: timeoutHeight,
        secret_hash_hex: secretHashHex,
        payment_reference: ref,
      });
      setAgreementJson(json);
      const id = await bridge.computeAgreementHash(json);
      setAgreementId(id);

      if (id && preimageHex) {
        await savePreimage(id, preimageHex);
      }

      const saved: SavedAgreement = {
        id,
        template: 'simple-settlement',
        role: role === 'hiring' ? 'payer' : 'payee',
        myAddress: address,
        counterpartyAddress: counterpartyAddr.trim(),
        amountSats,
        timeoutHeight,
        secretHashHex,
        htlcScriptHex,
        fundingTxid: null,
        status: 'draft',
        paymentReference: ref,
        createdAt: Date.now(),
        agreementJson: json,
      };
      addAgreement(saved);
      setStep(4);
    } catch (e: any) {
      toast.show(e?.message ?? 'Failed to create agreement', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Animated.View style={enterStyle}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { marginBottom: 4 }]}>Freelance Work</Text>
        <Text style={[Typography.caption, { marginBottom: 8 }]}>Step {step} of 4</Text>
        <ProgressBar current={step} total={4} />

        {/* Step 1: Role */}
        {step === 1 && (
          <View style={{ gap: 16, marginTop: 8 }}>
            <Text style={Typography.body}>What is your role?</Text>
            <RoleCard
              label="Hiring"
              desc="You're paying for work to be done"
              icon="person-add-outline"
              active={role === 'hiring'}
              onPress={() => setRole('hiring')}
            />
            <RoleCard
              label="Contractor"
              desc="You're completing work for payment"
              icon="construct-outline"
              active={role === 'contractor'}
              onPress={() => setRole('contractor')}
            />
            <GradientButton label="Next →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* Step 2: Work details */}
        {step === 2 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Field
              label={`${role === 'hiring' ? "Contractor's" : "Client's"} Q-address`}
              value={counterpartyAddr}
              onChange={setCounterpartyAddr}
              placeholder="Q..."
            />
            <Field
              label="Work description"
              value={workDescription}
              onChange={setWorkDescription}
              placeholder="Describe the work to be done..."
              multiline
            />
            <Field
              label="Deliverables"
              value={deliverables}
              onChange={setDeliverables}
              placeholder="List specific deliverables..."
              multiline
            />
            <Field
              label="Amount (IRM)"
              value={amountIrm}
              onChange={setAmountIrm}
              placeholder="0.00000000"
              keyboard="decimal-pad"
            />
            <Field
              label="Deadline (block height, ~2.5 min per block)"
              value={deadlineBlocks}
              onChange={setDeadlineBlocks}
              placeholder="2016 ≈ 7 days"
              keyboard="numeric"
            />
            <GradientButton label="Review →" onPress={proceedToStep3} loading={loading} />
          </View>
        )}

        {/* Step 3: Review summary */}
        {step === 3 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Card style={{ gap: 12 }}>
              <ReviewRow label="Role" value={role === 'hiring' ? 'Hiring (Payer)' : 'Contractor (Payee)'} />
              <ReviewRow
                label="Counterparty"
                value={counterpartyAddr.slice(0, 8) + '…' + counterpartyAddr.slice(-6)}
                mono
              />
              <ReviewRow label="Amount" value={`${irmStr(amountSats)} IRM`} bold />
              <ReviewRow label="Expires at block" value={timeoutHeight.toLocaleString()} />
              {workDescription ? (
                <ReviewRow label="Work" value={workDescription.slice(0, 60) + (workDescription.length > 60 ? '…' : '')} />
              ) : null}
              {deliverables ? (
                <ReviewRow label="Deliverables" value={deliverables.slice(0, 60) + (deliverables.length > 60 ? '…' : '')} />
              ) : null}
            </Card>
            <GradientButton label="Confirm Agreement →" onPress={confirm} loading={loading} />
            <TouchableOpacity style={styles.editBtn} onPress={() => setStep(2)}>
              <Text style={{ color: Colors.textSecondary }}>← Edit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
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
            {fundingTxid ? (
              <Card style={{ width: '100%', gap: 10 }}>
                <Text style={[Typography.caption, { color: Colors.success }]}>Funded</Text>
                <Text style={[Typography.mono, { fontSize: 11, lineHeight: 16 }]} selectable>
                  txid: {fundingTxid}
                </Text>
              </Card>
            ) : null}
            {fundingError ? (
              <Card style={{ width: '100%', gap: 6 }}>
                <Text style={[Typography.caption, { color: Colors.danger }]}>Funding failed</Text>
                <Text style={[Typography.caption]} selectable>{fundingError}</Text>
              </Card>
            ) : null}
            <Text style={[Typography.caption, { textAlign: 'center' }]}>
              {role === 'hiring'
                ? 'Fund the HTLC to lock your payment. The contractor can claim once work is delivered.'
                : "Ask the client to fund the HTLC. You'll claim it upon delivery."}
            </Text>
            {role === 'hiring' && !fundingTxid ? (
              <GradientButton
                label={funding ? 'Funding…' : 'Fund Agreement (via iriumd)'}
                onPress={async () => {
                  if (!agreementJson || !agreementId) return;
                  setFunding(true);
                  setFundingError(null);
                  try {
                    const r = await bridge.fundAgreement(agreementJson, true);
                    if (!r.accepted) {
                      setFundingError(
                        `iriumd did not accept the funding tx. txid: ${r.txid || '<empty>'}`,
                      );
                    } else {
                      setFundingTxid(r.txid);
                      updateAgreementStatus(agreementId, 'funded', r.txid);
                    }
                  } catch (e: any) {
                    setFundingError(e?.message ?? 'Unknown error');
                  } finally {
                    setFunding(false);
                  }
                }}
                loading={funding}
                style={{ width: '100%' }}
              />
            ) : null}
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
