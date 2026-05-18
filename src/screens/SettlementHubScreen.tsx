import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Animated, Alert, Pressable, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SwipeableRow } from '../components/SwipeableRow';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettlementStore, SavedAgreement } from '../store/settlement';
import { useNodeStore } from '../store/node';
import { Colors, Typography, Fonts, GradientColors } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'Hub'>;
type HubTab = 'templates' | 'active' | 'history';

function irmStr(sats: number) {
  return (sats / 1e8).toFixed(8);
}

// New status colors per spec
const STATUS_COLORS: Record<string, string> = {
  draft:    '#F59E0B', // pending
  funded:   '#3B5BDB', // funded
  complete: '#10B981', // released
  expired:  '#6B7280', // refunded
};

const STATUS_LABELS: Record<string, string> = {
  draft:    'Pending',
  funded:   'Funded',
  complete: 'Released',
  expired:  'Refunded',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

// 3-step progress: Funded → Proof → Released
function getProgressStep(status: string): number {
  if (status === 'draft')    return 0; // not funded yet
  if (status === 'funded')   return 1; // funded, awaiting proof
  if (status === 'complete') return 3; // fully released
  if (status === 'expired')  return 2; // refunded (proof submitted but released back)
  return 0;
}

// Live countdown — blocks → human label updated every second.
function useLiveCountdown(timeoutHeight: number) {
  const { nodeStatus } = useNodeStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const currentHeight = nodeStatus?.height ?? 0;
  const blocksLeft = Math.max(0, timeoutHeight - currentHeight);
  if (blocksLeft <= 0) {
    return { label: 'Expired', danger: true, tick };
  }

  // ~2 min per block
  const totalSeconds = blocksLeft * 120;
  const days  = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins  = Math.floor((totalSeconds % 3600) / 60);
  // Use tick to feign "live" feel even though block height drives actual countdown.
  const secs  = (60 - (tick % 60)) % 60;

  let label: string;
  if (days > 0)    label = `${days}d ${hours}h ${mins}m`;
  else if (hours > 0) label = `${hours}h ${mins}m ${secs}s`;
  else if (mins > 0)  label = `${mins}m ${secs}s`;
  else                label = `${secs}s`;

  const danger = totalSeconds < 3600;
  return { label, danger, tick };
}

// ─── Agreement card (Active + History) ───────────────────────────────────────

function AgreementCard({ agreement, index, isHistory, onDetails }: {
  agreement: SavedAgreement;
  index: number;
  isHistory?: boolean;
  onDetails: () => void;
}) {
  const slideX  = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const { label: countdownLabel, danger: countdownDanger } = useLiveCountdown(agreement.timeoutHeight);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    const stepFraction = getProgressStep(agreement.status) / 3;
    Animated.sequence([
      Animated.delay(index * 80 + 200),
      Animated.timing(progressAnim, {
        toValue: stepFraction,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const statusColor = STATUS_COLORS[agreement.status] ?? Colors.textSecondary;
  const statusLabel = STATUS_LABELS[agreement.status] ?? agreement.status;
  const progressStep = getProgressStep(agreement.status);
  const STEPS = ['Funded', 'Proof', 'Released'];

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }] }}>
      <TouchableOpacity activeOpacity={0.85} onPress={onDetails} style={agStyles.card}>
        {/* No gradient border in clean redesign */}

        {/* Header: status badge + countdown */}
        <View style={agStyles.headerRow}>
          <View style={[agStyles.statusBadge, { borderColor: statusColor }]}>
            <View style={[agStyles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[agStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {!isHistory && (
            <View style={agStyles.countdownBox}>
              <Ionicons
                name="time-outline"
                size={12}
                color={countdownDanger ? Colors.danger : Colors.accent}
              />
              <Text style={[
                agStyles.countdownText,
                { color: countdownDanger ? Colors.danger : Colors.accent },
              ]}>
                {countdownLabel}
              </Text>
            </View>
          )}
          {isHistory && (
            <Text style={agStyles.historyTime}>
              Block #{agreement.timeoutHeight.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Amount — gradient text via overlay (no MaskedView available) */}
        <View style={agStyles.amountRow}>
          <Text style={[agStyles.amountValue, isHistory && agStyles.faded]}>
            {irmStr(agreement.amountSats)}
          </Text>
          <Text style={[agStyles.amountUnit, isHistory && agStyles.faded]}>IRM</Text>
        </View>

        {/* Counterparty */}
        <View style={agStyles.cpRow}>
          <Ionicons name="person-circle-outline" size={13} color={Colors.textMuted} />
          <Text style={agStyles.cpText} selectable>
            {truncateAddress(agreement.counterpartyAddress)}
          </Text>
        </View>

        {/* Progress bar with 3 steps */}
        <View style={agStyles.progressStepsRow}>
          {STEPS.map((label, i) => {
            const filled = i < progressStep;
            return (
              <View key={i} style={agStyles.progressStepItem}>
                <View style={[
                  agStyles.progressDot,
                  filled ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.border },
                  isHistory && { opacity: 0.5 },
                ]} />
                <Text style={[
                  agStyles.progressLabel,
                  filled && { color: Colors.textPrimary },
                  isHistory && { opacity: 0.55 },
                ]}>{label}</Text>
              </View>
            );
          })}
        </View>
        <View style={[agStyles.progressTrack, isHistory && { opacity: 0.5 }]}>
          <Animated.View style={[
            agStyles.progressBar,
            { width: barWidth, backgroundColor: isHistory ? Colors.textMuted : Colors.primary },
          ]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const agStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1.5,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: Fonts.semiBold, letterSpacing: 0.6 },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdownText: { fontSize: 12, fontFamily: Fonts.semiBold, letterSpacing: 0.3 },
  historyTime: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  amountUnit: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  faded: { opacity: 0.55 },

  cpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  cpText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },

  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStepItem: { alignItems: 'center', flex: 1 },
  progressDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 4 },
  progressLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: Fonts.regular },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: { height: 3, borderRadius: 2 },
});

// ─── Template card ───────────────────────────────────────────────────────────

interface TemplateItem {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function TemplateCard({ item, index }: { item: TemplateItem; index: number }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const y       = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(y,       { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onPress();
  }

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: y }, { scale }], marginBottom: 12 }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, friction: 7, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()}
      >
        <View style={tplStyles.card}>
          <View style={tplStyles.row}>
            <View style={tplStyles.iconBox}>
              <Ionicons name={item.icon} size={22} color={Colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={tplStyles.title}>{item.title}</Text>
              <Text style={tplStyles.subtitle}>{item.subtitle}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const tplStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export function SettlementHubScreen() {
  const nav = useNavigation<Nav>();
  const { agreements, reset, loadAgreements } = useSettlementStore();
  const [activeTab, setActiveTab] = useState<HubTab>('templates');
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  // Top-level screen entrance
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadAgreements();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAgreements = agreements.filter(
    (a) => a.status === 'draft' || a.status === 'funded',
  );
  const historyAgreements = agreements.filter(
    (a) => a.status === 'complete' || a.status === 'expired',
  );

  const templates: TemplateItem[] = [
    {
      title: 'OTC Trade',
      subtitle: 'Secure peer-to-peer exchange',
      icon: 'swap-horizontal',
      onPress: () => { reset(); nav.push('OtcWizard'); },
    },
    {
      title: 'Freelance Work',
      subtitle: 'Pay when work is delivered',
      icon: 'briefcase-outline',
      onPress: () => { reset(); nav.push('FreelanceWizard'); },
    },
    {
      title: 'Milestone Payment',
      subtitle: 'Release funds in stages',
      icon: 'bar-chart-outline',
      onPress: () => { reset(); nav.push('MilestoneWizard'); },
    },
    {
      title: 'Deposit Protection',
      subtitle: 'Protect deposits with escrow',
      icon: 'shield-outline',
      onPress: () => { reset(); nav.push('DepositWizard'); },
    },
  ];

  const tabs: { key: HubTab; label: string }[] = [
    { key: 'templates', label: 'Templates' },
    { key: 'active',    label: 'Active' },
    { key: 'history',   label: 'History' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          flex: 1,
        }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          bounces={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!openRowKey}
          onScrollBeginDrag={() => setOpenRowKey(null)}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={Typography.h2}>Settlements</Text>
            <Text style={[Typography.caption, { marginTop: 4 }]}>HTLC-based trustless agreements</Text>
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveTab(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Templates */}
          {activeTab === 'templates' && (
            <View style={{ paddingTop: 4 }}>
              <Text style={[Typography.caption, { marginBottom: 14 }]}>
                Choose a settlement template to get started.
              </Text>
              {templates.map((t, i) => (
                <TemplateCard key={t.title} item={t} index={i} />
              ))}
            </View>
          )}

          {/* Active list */}
          {activeTab === 'active' && (
            <View style={{ gap: 12 }}>
              {activeAgreements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No active agreements</Text>
                  <Text style={styles.emptyHint}>Create one from the Templates tab.</Text>
                </View>
              ) : (
                activeAgreements.map((a, i) => (
                  <SwipeableRow
                    key={a.id}
                    rowKey={a.id}
                    openRowKey={openRowKey}
                    setOpenRowKey={setOpenRowKey}
                    actionLabel="Archive"
                    actionIcon="archive-outline"
                    actionColor="#374151"
                    onAction={() => Alert.alert('Archive', 'Archive agreement?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Archive', style: 'destructive', onPress: () => {} },
                    ])}
                  >
                    <AgreementCard
                      agreement={a}
                      index={i}
                      onDetails={() => nav.push('AgreementDetail', { agreementId: a.id })}
                    />
                  </SwipeableRow>
                ))
              )}
            </View>
          )}

          {/* History list */}
          {activeTab === 'history' && (
            <View style={{ gap: 12 }}>
              {historyAgreements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No history yet</Text>
                  <Text style={styles.emptyHint}>Completed and refunded agreements appear here.</Text>
                </View>
              ) : (
                historyAgreements.map((a, i) => (
                  <AgreementCard
                    key={a.id}
                    agreement={a}
                    index={i}
                    isHistory
                    onDetails={() => nav.push('AgreementDetail', { agreementId: a.id })}
                  />
                ))
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 90 },
  header: { marginBottom: 20 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 20,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabLabel:       { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.primary, fontFamily: Fonts.semiBold },

  emptyState: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText:  { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  emptyHint:  { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center' },
});
