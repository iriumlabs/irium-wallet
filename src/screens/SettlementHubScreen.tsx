import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettlementStore, SavedAgreement } from '../store/settlement';
import { Card } from '../components/Card';
import { Colors, Typography, Fonts, GradientColors } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams, 'Hub'>;
type HubTab = 'active' | 'history' | 'templates';

function irmStr(sats: number) {
  return (sats / 1e8).toFixed(8) + ' IRM';
}

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

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function deadlineLabel(timeoutHeight: number): string {
  if (timeoutHeight <= 0) return 'Expired';
  return `Block ${timeoutHeight.toLocaleString()}`;
}

// 3-step progress: Created → Funded → Released
function getProgressStep(status: string): number {
  if (status === 'draft') return 0;
  if (status === 'funded') return 1;
  if (status === 'complete' || status === 'expired') return 2;
  return 0;
}

function AgreementCard({ agreement, index, onDetails }: {
  agreement: SavedAgreement;
  index: number;
  onDetails: () => void;
}) {
  const slideX = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    const stepFraction = getProgressStep(agreement.status) / 2;
    Animated.sequence([
      Animated.delay(index * 80 + 200),
      Animated.timing(progressAnim, {
        toValue: stepFraction,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const statusColor = STATUS_COLORS[agreement.status] ?? Colors.textSecondary;
  const statusLabel = STATUS_LABELS[agreement.status] ?? agreement.status;
  const typeLabel = TYPE_LABELS[agreement.template] ?? agreement.template;
  const progressStep = getProgressStep(agreement.status);
  const STEPS = ['Created', 'Funded', 'Released'];

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: slideX }], marginBottom: 12 }}>
      <Card>
        {/* Header row: type badge + status badge */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge]}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Amount */}
        <Text style={styles.amount}>{irmStr(agreement.amountSats)}</Text>

        {/* Counterparty */}
        <Text style={styles.counterparty}>{truncateAddress(agreement.counterpartyAddress)}</Text>

        {/* Deadline */}
        <Text style={[Typography.caption, { marginBottom: 10 }]}>
          {deadlineLabel(agreement.timeoutHeight)}
        </Text>

        {/* Progress bar with 3 steps */}
        <View style={styles.progressStepsRow}>
          {STEPS.map((label, i) => (
            <View key={i} style={styles.progressStepItem}>
              <View style={[
                styles.progressDot,
                i <= progressStep
                  ? { backgroundColor: Colors.primary }
                  : { backgroundColor: Colors.border },
              ]} />
              <Text style={[styles.progressLabel, i <= progressStep && { color: Colors.textPrimary }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: barWidth }]} />
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.success }]}
            onPress={() => Alert.alert('Release', 'Enter secret to release funds (placeholder)')}
          >
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>Release</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.danger }]}
            onPress={() => Alert.alert('Refund', 'Refund requested (placeholder)')}
          >
            <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Refund</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.primary }]}
            onPress={onDetails}
          >
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Details</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );
}

interface TemplateItem {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function TemplatePickerCard({ item }: { item: TemplateItem }) {
  return (
    <TouchableOpacity onPress={item.onPress} activeOpacity={0.8} style={{ marginBottom: 12 }}>
      <Card>
        <View style={styles.templateRow}>
          <View style={styles.templateIconWrap}>
            <Ionicons name={item.icon} size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.templateTitle}>{item.title}</Text>
            <Text style={Typography.caption}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export function SettlementHubScreen() {
  const nav = useNavigation<Nav>();
  const { agreements, reset, loadAgreements } = useSettlementStore();
  const [activeTab, setActiveTab] = useState<HubTab>('active');

  useEffect(() => { loadAgreements(); }, []);

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
    { key: 'active', label: 'Active' },
    { key: 'history', label: 'History' },
    { key: 'templates', label: 'Templates' },
  ];

  const displayList = activeTab === 'active' ? activeAgreements : historyAgreements;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={Typography.h2}>Settlements</Text>
          <Text style={[Typography.caption, { marginTop: 4 }]}>HTLC-based trustless agreements</Text>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active / History lists */}
        {(activeTab === 'active' || activeTab === 'history') && (
          <>
            {displayList.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[Typography.caption, { textAlign: 'center' }]}>
                  {activeTab === 'active'
                    ? 'No active agreements. Create one from the Templates tab.'
                    : 'No past agreements yet.'}
                </Text>
              </View>
            ) : (
              displayList.map((a, i) => (
                <AgreementCard
                  key={a.id}
                  agreement={a}
                  index={i}
                  onDetails={() => nav.push('AgreementDetail', { agreementId: a.id })}
                />
              ))
            )}
          </>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <View style={{ paddingTop: 4 }}>
            <Text style={[Typography.caption, { marginBottom: 14 }]}>
              Choose a settlement template to get started.
            </Text>
            {templates.map((t) => (
              <TemplatePickerCard key={t.title} item={t} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setActiveTab('templates')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 90 },
  header: { marginBottom: 20 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textPrimary, fontFamily: Fonts.semibold },

  emptyState: { paddingVertical: 40, alignItems: 'center' },

  // Agreement card
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  typeBadgeText: { color: Colors.primary, fontSize: 11, fontFamily: Fonts.semibold },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontFamily: Fonts.semibold },
  amount: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  counterparty: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 4,
  },

  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStepItem: { alignItems: 'center', flex: 1 },
  progressDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  progressLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: Fonts.regular },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: { height: 3, borderRadius: 2, backgroundColor: Colors.primary },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 12, fontFamily: Fonts.semibold },

  // Template cards
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  templateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary, marginBottom: 2 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabGradient: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { color: Colors.textPrimary, fontSize: 28, fontFamily: Fonts.bold, lineHeight: 32 },
});
