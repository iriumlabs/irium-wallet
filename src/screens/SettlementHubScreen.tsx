import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettlementStore } from '../store/settlement';
import { useWalletStore } from '../store/wallet';
import { TemplateCard } from '../components/TemplateCard';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'Hub'>;

function irmStr(sats: number) {
  return (sats / 1e8).toFixed(8) + ' IRM';
}

function deadline(timeoutHeight: number, currentHeight: number): string {
  const diff = timeoutHeight - currentHeight;
  if (diff <= 0) return 'Expired';
  if (diff < 144) return `${diff} blocks (~${Math.round(diff * 2.5)}min)`;
  if (diff < 1008) return `${diff} blocks (~${Math.round(diff / 144 * 10) / 10}d)`;
  return `Block ${timeoutHeight.toLocaleString()}`;
}

const STATUS_PROGRESS: Record<string, number> = {
  draft: 0.15, funded: 0.5, complete: 1.0, expired: 0,
};

function AgreementCard({ agreement, index }: { agreement: any; index: number }) {
  const slideX  = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    const progress = STATUS_PROGRESS[agreement.status] ?? 0;
    Animated.sequence([
      Animated.delay(index * 80 + 200),
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const counterparty = agreement.counterpartyAddress;
  const truncated    = counterparty.slice(0, 10) + '…' + counterparty.slice(-6);

  const barWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barColor = agreement.status === 'complete'
    ? Colors.success
    : agreement.status === 'expired'
    ? Colors.error
    : Colors.primary;

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }], marginBottom: 10 }}>
      <Card>
        <View style={styles.agTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.counterparty}>{truncated}</Text>
            <Text style={[Typography.caption, { marginTop: 2 }]}>
              {agreement.template === 'otc' ? 'OTC Trade' : 'Freelance'} · {agreement.role}
            </Text>
          </View>
          <StatusBadge status={agreement.status} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: barWidth, backgroundColor: barColor }]} />
        </View>

        <View style={styles.agBottom}>
          <Text style={styles.amount}>{irmStr(agreement.amountSats)}</Text>
          <Text style={Typography.caption}>{deadline(agreement.timeoutHeight, 0)}</Text>
        </View>
        {agreement.paymentReference ? (
          <Text style={styles.reference}>"{agreement.paymentReference}"</Text>
        ) : null}
      </Card>
    </Animated.View>
  );
}

export function SettlementHubScreen() {
  const nav = useNavigation<Nav>();
  const { agreements, reset, loadAgreements } = useSettlementStore();

  useEffect(() => { loadAgreements(); }, []);

  function startNew() { reset(); }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={Typography.h2}>Settlements</Text>
          <Text style={[Typography.caption, { marginTop: 4 }]}>HTLC-based trustless agreements</Text>
        </View>

        {/* Active agreements */}
        {agreements.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={[Typography.h3, { marginBottom: 12 }]}>Active agreements</Text>
            {agreements.map((a, i) => (
              <AgreementCard key={a.id} agreement={a} index={i} />
            ))}
          </View>
        )}

        {/* Template picker */}
        <Text style={[Typography.h3, { marginBottom: 12 }]}>New settlement</Text>
        <TemplateCard
          id="otc"
          title="OTC Trade"
          subtitle="Atomic swap — both sides commit, exchange simultaneously"
          onPress={() => { startNew(); nav.push('OtcWizard'); }}
        />
        <TemplateCard
          id="simple-settlement"
          title="Freelance Work"
          subtitle="Pay for work — payer locks funds, released on delivery"
          onPress={() => { startNew(); nav.push('FreelanceWizard'); }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  header:  { marginBottom: 24 },
  agTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  counterparty: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: { height: 3, borderRadius: 2 },
  agBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount:    { color: Colors.text, fontSize: 15, fontFamily: Fonts.semiBold },
  reference: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.regular,
    fontStyle: 'italic',
    marginTop: 6,
  },
});
