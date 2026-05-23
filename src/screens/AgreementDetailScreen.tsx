import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, Alert, TouchableOpacity, Animated,
} from 'react-native';
import { useScreenEnter } from '../hooks/useScreenEnter';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSettlementStore } from '../store/settlement';
import { bridge } from '../bridge';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Props = NativeStackScreenProps<SettlementStackParams, 'AgreementDetail'>;

const STATUS_COLORS: Record<string, string> = {
  draft: '#F59E0B',
  funded: '#3B5BDB',
  complete: '#10B981',
  expired: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Pending',
  funded: 'Funded',
  complete: 'Released',
  expired: 'Refunded',
};

const TYPE_LABELS: Record<string, string> = {
  otc: 'OTC',
  'simple-settlement': 'Freelance',
};

interface TimelineStep {
  label: string;
  done: boolean;
}

export function AgreementDetailScreen({ route, navigation }: Props) {
  const { agreementId } = route.params;
  const enterStyle = useScreenEnter();
  const agreements = useSettlementStore((s) => s.agreements);
  const agreement = agreements.find((a) => a.id === agreementId);

  if (!agreement) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={styles.notFoundWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
            <Text style={[Typography.h3, { marginTop: 16, color: Colors.textSecondary }]}>
              Agreement not found
            </Text>
            <Text style={[Typography.caption, { marginTop: 8, textAlign: 'center' }]}>
              ID: {agreementId.slice(0, 16)}…
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Capture into a const so TypeScript narrows through async closures
  const ag = agreement!;
  const statusColor = STATUS_COLORS[ag.status] ?? Colors.textSecondary;
  const statusLabel = STATUS_LABELS[ag.status] ?? ag.status;
  const typeLabel = TYPE_LABELS[ag.template] ?? ag.template;

  const completedSteps = ag.status === 'draft' ? 0
    : ag.status === 'funded' ? 1
    : 2;

  const timelineSteps: TimelineStep[] = [
    { label: 'Created', done: true },
    { label: 'Funded', done: completedSteps >= 1 },
    { label: ag.status === 'expired' ? 'Refunded' : 'Released', done: completedSteps >= 2 },
  ];

  async function copyHash() {
    await Clipboard.setStringAsync(ag.id);
    Alert.alert('Copied', 'Agreement hash copied to clipboard');
  }

  async function checkEligibility(agreement: typeof ag, branch: 'release' | 'refund') {
    if (!agreement.agreementJson) {
      Alert.alert(
        'Cannot check',
        'This agreement was created before the JSON-saving update; no canonical agreement body to query.',
      );
      return;
    }
    const fundingTxid = agreement.fundingTxid ?? '';
    try {
      const r = branch === 'release'
        ? await bridge.getReleaseEligibility(agreement.agreementJson, fundingTxid)
        : await bridge.getRefundEligibility(agreement.agreementJson, fundingTxid);
      const headline = r.eligible ? `${branch}: eligible` : `${branch}: NOT eligible`;
      const body = r.reasons.length > 0
        ? r.reasons.join('\n')
        : (r.eligible ? 'No blocking conditions reported by iriumd.' : 'No reasons returned.');
      Alert.alert(headline, body);
    } catch (e: any) {
      Alert.alert(`${branch} check failed`, e?.message ?? 'Unknown error');
    }
  }

  function truncateAddr(addr: string) {
    if (addr.length <= 14) return addr;
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Animated.View style={enterStyle}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={[Typography.h2, { marginBottom: 4 }]}>Agreement Detail</Text>

        {/* Agreement hash */}
        <Card style={{ marginBottom: 14, gap: 8 }}>
          <Text style={Typography.caption}>Agreement Hash</Text>
          <View style={styles.hashRow}>
            <Text style={[Typography.mono, { fontSize: 11, flex: 1 }]} selectable numberOfLines={2}>
              {ag.id.slice(0, 32)}…
            </Text>
            <TouchableOpacity onPress={copyHash} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="copy-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Type + status badges */}
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Amount */}
        <Text style={styles.amount}>
          {(ag.amountSats / 1e8).toFixed(8)} IRM
        </Text>

        {/* Parties */}
        <Card style={{ marginBottom: 14, gap: 10 }}>
          <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 4 }]}>
            Parties
          </Text>
          <DetailRow label="Party A (Payer)" value={truncateAddr(ag.myAddress)} mono />
          <DetailRow label="Party B (Counterparty)" value={truncateAddr(ag.counterpartyAddress)} mono />
          <DetailRow label="Role" value={ag.role === 'payer' ? 'Payer' : 'Payee'} />
        </Card>

        {/* Terms */}
        <Card style={{ marginBottom: 14, gap: 10 }}>
          <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 4 }]}>
            Terms
          </Text>
          <DetailRow label="Timeout block" value={ag.timeoutHeight.toLocaleString()} />
          {ag.paymentReference ? (
            <DetailRow label="Reference" value={ag.paymentReference} />
          ) : null}
        </Card>

        {/* Status section */}
        <Card style={{ marginBottom: 14, gap: 8 }}>
          <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 4 }]}>
            Current status
          </Text>
          <View style={[styles.currentStatusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.currentStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </Card>

        {/* Timeline */}
        <Card style={{ marginBottom: 14 }}>
          <Text style={[Typography.caption, { fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 14 }]}>
            Timeline
          </Text>
          {timelineSteps.map((ts, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                {ts.done ? (
                  <View style={styles.timelineDotDone}>
                    <Ionicons name="checkmark" size={12} color={Colors.success} />
                  </View>
                ) : (
                  <View style={styles.timelineDotEmpty} />
                )}
                {i < timelineSteps.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    { backgroundColor: timelineSteps[i + 1].done ? Colors.success : Colors.border },
                  ]} />
                )}
              </View>
              <Text style={[
                styles.timelineLabel,
                ts.done && { color: Colors.textPrimary, fontFamily: Fonts.medium },
              ]}>
                {ts.label}
              </Text>
            </View>
          ))}
        </Card>

        {/* Action buttons — only if funded */}
        {ag.status === 'funded' && (
          <View style={{ gap: 10 }}>
            <GradientButton
              label="Check Release Eligibility"
              onPress={() => checkEligibility(ag, 'release')}
            />
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => checkEligibility(ag, 'refund')}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerBtnText}>Check Refund Eligibility</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Text style={Typography.caption}>{label}</Text>
      <Text style={[
        mono ? { fontFamily: 'monospace', fontSize: 12 } : Typography.body,
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
  notFoundWrap: { flex: 1, padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { color: Colors.primary, fontSize: 15, fontFamily: Fonts.medium },

  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  typeBadgeText: { color: Colors.primary, fontSize: 12, fontFamily: Fonts.semibold },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontFamily: Fonts.semibold },

  amount: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },

  currentStatusBadge: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  currentStatusText: { fontSize: 14, fontFamily: Fonts.semibold },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: 14 },
  timelineDotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success + '22',
    borderWidth: 1.5,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  timelineLine: { width: 2, flex: 1, minHeight: 20, marginVertical: 3 },
  timelineLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    paddingTop: 3,
    paddingBottom: 16,
  },

  dangerBtn: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dangerBtnText: { color: Colors.danger, fontSize: 16, fontFamily: Fonts.semibold },
});
