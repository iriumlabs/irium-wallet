import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  StatusBar, Alert, TouchableOpacity, Animated,
} from 'react-native';
import { useScreenEnter } from '../hooks/useScreenEnter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'MilestoneWizard'>;
type Role = 'client' | 'contractor';
type Step = 1 | 2 | 3 | 4;

interface Milestone {
  name: string;
  amount: string;
  deadline: string;
}

function irmStr(sats: number) { return (sats / 1e8).toFixed(8); }

function parseSats(irmValue: string): number {
  return Math.floor(parseFloat(irmValue || '0') * 1e8);
}

export function MilestoneWizardScreen() {
  const nav = useNavigation<Nav>();
  const enterStyle = useScreenEnter();

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>('client');
  const [projectName, setProjectName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { name: '', amount: '', deadline: '' },
  ]);
  const agreementId = 'm'.repeat(64);

  function goBack() {
    if (step > 1) setStep((step - 1) as Step);
    else nav.goBack();
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, { name: '', amount: '', deadline: '' }]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof Milestone, value: string) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }

  function validateStep2(): boolean {
    if (!projectName.trim()) {
      Alert.alert('Required', 'Enter a project name'); return false;
    }
    if (milestones.length === 0) {
      Alert.alert('Required', 'Add at least one milestone'); return false;
    }
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.name.trim()) {
        Alert.alert('Required', `Enter a name for milestone ${i + 1}`); return false;
      }
      if (parseSats(m.amount) <= 0) {
        Alert.alert('Required', `Enter a valid amount for milestone ${i + 1}`); return false;
      }
      if (!m.deadline.trim() || isNaN(parseInt(m.deadline, 10))) {
        Alert.alert('Required', `Enter a valid deadline block for milestone ${i + 1}`); return false;
      }
    }
    return true;
  }

  const totalSats = milestones.reduce((sum, m) => sum + parseSats(m.amount), 0);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Animated.View style={enterStyle}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { marginBottom: 4 }]}>Milestone Payment</Text>
        <Text style={[Typography.caption, { marginBottom: 8 }]}>Step {step} of 4</Text>
        <ProgressBar current={step} total={4} />

        {/* Step 1: Role */}
        {step === 1 && (
          <View style={{ gap: 16, marginTop: 8 }}>
            <Text style={Typography.body}>What is your role?</Text>
            <RoleCard
              label="Client"
              desc="You're funding milestone payments"
              icon="briefcase-outline"
              active={role === 'client'}
              onPress={() => setRole('client')}
            />
            <RoleCard
              label="Contractor"
              desc="You complete work and claim milestones"
              icon="construct-outline"
              active={role === 'contractor'}
              onPress={() => setRole('contractor')}
            />
            <GradientButton label="Next →" onPress={() => setStep(2)} />
          </View>
        )}

        {/* Step 2: Project details + milestones */}
        {step === 2 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Field
              label="Project name"
              value={projectName}
              onChange={setProjectName}
              placeholder="e.g. Website redesign"
            />
            <Field
              label="Total budget (IRM) — for reference"
              value={totalAmount}
              onChange={setTotalAmount}
              placeholder="0.00000000"
              keyboard="decimal-pad"
            />

            <Text style={[Typography.h3, { marginTop: 4 }]}>Milestones</Text>
            <Text style={Typography.caption}>
              Total from milestones: {irmStr(totalSats)} IRM
            </Text>

            {milestones.map((m, i) => (
              <Card key={i} style={{ gap: 10 }}>
                <View style={styles.milestoneHeader}>
                  <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary }]}>
                    Milestone {i + 1}
                  </Text>
                  {milestones.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeMilestone(i)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <Field
                  label="Milestone name"
                  value={m.name}
                  onChange={(v) => updateMilestone(i, 'name', v)}
                  placeholder="e.g. Design mockups"
                />
                <Field
                  label="Amount (IRM)"
                  value={m.amount}
                  onChange={(v) => updateMilestone(i, 'amount', v)}
                  placeholder="0.00000000"
                  keyboard="decimal-pad"
                />
                <Field
                  label="Deadline (block height)"
                  value={m.deadline}
                  onChange={(v) => updateMilestone(i, 'deadline', v)}
                  placeholder="e.g. 46000"
                  keyboard="numeric"
                />
              </Card>
            ))}

            <TouchableOpacity style={styles.addMilestoneBtn} onPress={addMilestone} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addMilestoneText}>Add milestone</Text>
            </TouchableOpacity>

            <GradientButton
              label="Review →"
              onPress={() => { if (validateStep2()) setStep(3); }}
            />
          </View>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <Card style={{ gap: 12 }}>
              <ReviewRow label="Role" value={role === 'client' ? 'Client (Payer)' : 'Contractor (Payee)'} />
              <ReviewRow label="Project" value={projectName} />
              <ReviewRow label="Total" value={`${irmStr(totalSats)} IRM`} bold />
              <ReviewRow label="Milestones" value={`${milestones.length}`} />
            </Card>

            <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary }]}>
              Milestone breakdown
            </Text>
            {milestones.map((m, i) => (
              <Card key={i} style={{ gap: 8 }}>
                <ReviewRow label={`#${i + 1} ${m.name}`} value={`${irmStr(parseSats(m.amount))} IRM`} bold />
                <ReviewRow label="Deadline block" value={m.deadline} />
              </Card>
            ))}

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
              {role === 'client'
                ? 'Share this agreement hash with your contractor to begin the project.'
                : 'The client will fund each milestone as you complete the work.'}
            </Text>
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

function ReviewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Text style={Typography.caption}>{label}</Text>
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

  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  addMilestoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  addMilestoneText: { color: Colors.primary, fontSize: 14, fontFamily: Fonts.medium },

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
