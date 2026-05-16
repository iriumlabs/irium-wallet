import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  StatusBar, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'DepositWizard'>;
type Role = 'depositor' | 'recipient';
type Step = 1 | 2 | 3 | 4;

function irmStr(sats: number) { return (sats / 1e8).toFixed(8); }

export function DepositWizardScreen() {
  const nav = useNavigation<Nav>();

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>('depositor');
  const [purpose, setPurpose] = useState('');
  const [amountIrm, setAmountIrm] = useState('');
  const [holdPeriod, setHoldPeriod] = useState('');
  const [returnConditions, setReturnConditions] = useState('');
  const agreementId = 'd'.repeat(64);

  const amountSats = Math.floor(parseFloat(amountIrm || '0') * 1e8);

  function goBack() {
    if (step > 1) setStep((step - 1) as Step);
    else nav.goBack();
  }

  function validateStep2(): boolean {
    if (!purpose.trim()) {
      Alert.alert('Required', 'Enter the deposit purpose'); return false;
    }
    if (amountSats <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount'); return false;
    }
    if (!holdPeriod.trim() || isNaN(parseInt(holdPeriod, 10))) {
      Alert.alert('Required', 'Enter a valid hold period (block height)'); return false;
    }
    if (!returnConditions.trim()) {
      Alert.alert('Required', 'Enter the conditions for returning the deposit'); return false;
    }
    return true;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { marginBottom: 4 }]}>Deposit Protection</Text>
        <Text style={[Typography.caption, { marginBottom: 8 }]}>Step {step} of 4</Text>
        <ProgressBar current={step} total={4} />

        {/* Step 1: Role */}
        {step === 1 && (
          <View style={{ gap: 16, marginTop: 8 }}>
            <Text style={Typography.body}>What is your role in this agreement?</Text>
            <RoleCard
              label="Depositor"
              desc="You're locking IRM as a security deposit"
              icon="arrow-up-circle-outline"
              active={role === 'depositor'}
              onPress={() => setRole('depositor')}
            />
            <RoleCard
              label="Recipient"
              desc="You're holding a deposit as security"
              icon="shield-checkmark-outline"
              active={role === 'recipient'}
              onPress={() => setRole('recipient')}
            />
            <GradientButton label="Next →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Field
              label="Deposit purpose"
              value={purpose}
              onChange={setPurpose}
              placeholder="e.g. Rental security deposit, service guarantee..."
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
              label="Hold period (block height when deposit unlocks)"
              value={holdPeriod}
              onChange={setHoldPeriod}
              placeholder="e.g. 50000"
              keyboard="numeric"
            />
            <Field
              label="Return conditions"
              value={returnConditions}
              onChange={setReturnConditions}
              placeholder="Describe when and how the deposit should be returned..."
              multiline
            />
            <GradientButton
              label="Review →"
              onPress={() => { if (validateStep2()) setStep(3); }}
            />
          </View>
        )}

        {/* Step 3: Review summary */}
        {step === 3 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Card style={{ gap: 12 }}>
              <ReviewRow
                label="Role"
                value={role === 'depositor' ? 'Depositor' : 'Recipient'}
              />
              <ReviewRow label="Purpose" value={purpose.slice(0, 60) + (purpose.length > 60 ? '…' : '')} />
              <ReviewRow label="Amount" value={`${irmStr(amountSats)} IRM`} bold />
              <ReviewRow label="Unlocks at block" value={holdPeriod} />
              <ReviewRow
                label="Return conditions"
                value={returnConditions.slice(0, 60) + (returnConditions.length > 60 ? '…' : '')}
              />
            </Card>
            <GradientButton label="Create Agreement →" onPress={() => setStep(4)} />
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
            <Text style={[Typography.caption, { textAlign: 'center' }]}>
              {role === 'depositor'
                ? 'Fund the HTLC to lock your deposit. It will be held until the agreed conditions are met.'
                : 'Share this agreement with the depositor. Once funded, the deposit is held in escrow.'}
            </Text>
            <GradientButton
              label="Back to Hub"
              onPress={() => nav.navigate('Hub')}
              style={{ width: '100%' }}
            />
          </View>
        )}
      </ScrollView>
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

function ReviewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <Text style={[Typography.caption, { flexShrink: 0 }]}>{label}</Text>
      <Text style={[
        Typography.body,
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
