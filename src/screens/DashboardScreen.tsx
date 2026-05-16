import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSync } from '../hooks/useSync';
import { useBalance } from '../hooks/useBalance';
import { IriumLogo } from '../components/IriumLogo';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';
import type { MainTabParams } from '../navigation/MainNavigator';

type Nav = BottomTabNavigationProp<MainTabParams>;

function formatIrm(sats: number) {
  return (sats / 1e8).toFixed(8);
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
  delay: number;
}

function QuickAction({ label, icon, tint, onPress, delay }: QuickActionProps) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const entrance   = useRef(new Animated.Value(0)).current;
  const entranceY  = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(entrance, { toValue: 1, friction: 7, useNativeDriver: true }),
        Animated.timing(entranceY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pressIn() {
    Animated.spring(pressScale, { toValue: 0.93, friction: 8, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(pressScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.qa,
          { opacity: entrance, transform: [{ scale: pressScale }, { translateY: entranceY }] },
        ]}
      >
        <Ionicons name={icon} size={26} color={tint} />
        <Text style={[styles.qaLabel, { color: tint }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

interface TxRowProps {
  tx: { txid: string; height: number; net_sats: number; direction: string };
  delay: number;
}

function TxRow({ tx, delay }: TxRowProps) {
  const slideX  = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isIn  = tx.direction === 'in';
  const color = isIn ? Colors.success : Colors.danger;

  return (
    <Animated.View style={[styles.txRow, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={[styles.txIconCircle, { backgroundColor: color + '22' }]}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={color}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txId} numberOfLines={1}>
          {tx.txid.slice(0, 10)}…{tx.txid.slice(-6)}
        </Text>
        <Text style={styles.txBlock}>Block {tx.height.toLocaleString()}</Text>
      </View>
      <Text style={[styles.txAmount, { color }]}>
        {isIn ? '+' : '-'}{formatIrm(Math.abs(tx.net_sats))} IRM
      </Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const { address, balance, history, setBalance, setHistory, setUtxos } = useWalletStore();
  const { rpcUrl, authToken } = useWalletStore();
  const { nodeStatus, peerCount, isSyncing, lastRefresh, touchRefresh } = useNodeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Animated balance count-up
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const prevBalance = useRef(0);
  const [displaySats, setDisplaySats] = useState(0);

  useSync();
  useBalance();

  // Drive displayed integer from animation
  useEffect(() => {
    const id = balanceAnim.addListener(({ value }) => setDisplaySats(Math.round(value)));
    return () => balanceAnim.removeListener(id);
  }, [balanceAnim]);

  // Animate when balance changes
  useEffect(() => {
    const target = balance?.confirmed ?? 0;
    if (target === prevBalance.current) return;
    Animated.timing(balanceAnim, {
      toValue: target,
      duration: 700,
      useNativeDriver: false,
    }).start();
    prevBalance.current = target;
  }, [balance?.confirmed, balanceAnim]);

  const refresh = useCallback(async () => {
    if (!address || !rpcUrl) return;
    setRefreshing(true);
    setError(null);
    try {
      const [bal, utxos, hist] = await Promise.all([
        bridge.rpcGetBalance(rpcUrl, authToken, address),
        bridge.rpcGetUtxos(rpcUrl, authToken, address),
        bridge.rpcGetHistory(rpcUrl, authToken, address),
      ]);
      setBalance(bal);
      setUtxos(utxos);
      setHistory(hist);
      touchRefresh();
    } catch (e: any) {
      setError(e.message ?? 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [address, rpcUrl, authToken, setBalance, setUtxos, setHistory, touchRefresh]);

  const isLoading    = lastRefresh === 0 && !error;
  const synced       = !isSyncing && nodeStatus != null;
  const statusDot    = synced ? Colors.success : Colors.amber;
  const statusLabel  = synced
    ? `● Live #${nodeStatus!.height.toLocaleString()} · ${peerCount}p`
    : `● Syncing · ${peerCount}p`;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <IriumLogo size={28} />
        <Text style={[styles.netStatus, { color: statusDot }]}>{statusLabel}</Text>
        <Ionicons name="notifications-outline" size={22} color={Colors.text} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Balance card ── */}
        <LinearGradient
          colors={GradientColors}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>

          {isLoading ? (
            <Text style={styles.balancePlaceholder}>Loading…</Text>
          ) : (
            <Text style={styles.balanceAmount}>{formatIrm(displaySats)} IRM</Text>
          )}

          {!isLoading && balance && (
            <Text style={styles.balanceSats}>
              {balance.confirmed.toLocaleString()} sats
            </Text>
          )}
        </LinearGradient>

        {/* ── Network strip ── */}
        <View style={styles.networkStrip}>
          <View style={styles.netPill}>
            <Text style={styles.netPillText}>⚡ Block </Text>
            <Text style={[styles.netPillValue]}>
              {nodeStatus ? nodeStatus.height.toLocaleString() : '—'}
            </Text>
          </View>
          <View style={styles.netDivider} />
          <View style={styles.netPill}>
            <Text style={styles.netPillText}>🌐 </Text>
            <Text style={styles.netPillValue}>{peerCount} peers</Text>
          </View>
          <View style={styles.netDivider} />
          <View style={[styles.netPill, { gap: 6 }]}>
            <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
            <Text style={[styles.netPillValue, { color: statusDot }]}>
              {synced ? 'Live' : 'Syncing'}
            </Text>
          </View>
        </View>

        {/* ── Error banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={15} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.actions}>
          <QuickAction
            label="Send"
            icon="arrow-up-circle"
            tint={Colors.danger}
            onPress={() => nav.navigate('Send')}
            delay={0}
          />
          <QuickAction
            label="Receive"
            icon="arrow-down-circle"
            tint={Colors.success}
            onPress={() => nav.navigate('Receive')}
            delay={60}
          />
          <QuickAction
            label="History"
            icon="time-outline"
            tint="#60A5FA"
            onPress={() => nav.navigate('History')}
            delay={120}
          />
          <QuickAction
            label="Settle"
            icon="shield-checkmark-outline"
            tint={Colors.primary}
            onPress={() => nav.navigate('Settlement')}
            delay={180}
          />
        </View>

        {/* ── Recent activity ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {history.length > 0 && (
            <Pressable onPress={() => nav.navigate('History')}>
              <Text style={styles.viewAll}>View all →</Text>
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <Text style={Typography.caption}>Loading…</Text>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          history.slice(0, 10).map((tx, i) => (
            <TxRow key={tx.txid} tx={tx} delay={i * 50} />
          ))
        )}

        {history.length > 0 && (
          <Pressable onPress={() => nav.navigate('History')} style={styles.viewAllBtn}>
            <Text style={styles.viewAllBtnText}>View all transactions →</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  netStatus: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },

  content: { padding: 16, gap: 14, paddingBottom: 40 },

  // Balance card
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontFamily: Fonts.bold,
    letterSpacing: -1,
  },
  balancePlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 40,
    fontFamily: Fonts.bold,
  },
  balanceSats: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: 6,
  },

  // Network strip
  networkStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netPillText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
  },
  netPillValue: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
  },
  netDivider: { width: 1, height: 20, backgroundColor: Colors.border },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a0000',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: { color: Colors.error, fontSize: 13, fontFamily: Fonts.regular, flex: 1 },

  // Quick actions
  actions: { flexDirection: 'row', gap: 10 },
  qa: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  qaLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  viewAll: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
  },

  // Transaction row
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  txIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txId: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  txBlock: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },

  // Empty state
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },

  // View all button
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
});
