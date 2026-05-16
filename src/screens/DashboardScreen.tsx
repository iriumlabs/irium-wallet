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
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSync } from '../hooks/useSync';
import { useBalance } from '../hooks/useBalance';
import { PeerIndicator } from '../components/PeerIndicator';
import { AddressText } from '../components/AddressText';
import { Card } from '../components/Card';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';
import type { MainTabParams } from '../navigation/MainNavigator';

type Nav = BottomTabNavigationProp<MainTabParams>;

function formatIrm(sats: number) {
  return (sats / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function QuickAction({ label, glyph, onPress, delay }: {
  label: string; glyph: string; onPress: () => void; delay: number;
}) {
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
  }, []);

  const pressIn  = () => Animated.spring(pressScale, { toValue: 0.94, friction: 8, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(pressScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.qa,
          {
            opacity: entrance,
            transform: [{ scale: pressScale }, { translateY: entranceY }],
          },
        ]}
      >
        <Text style={styles.qaGlyph}>{glyph}</Text>
        <Text style={styles.qaLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function TxRow({ tx, delay }: { tx: { txid: string; height: number; net_sats: number; direction: string }; delay: number }) {
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
  }, []);

  const isIn = tx.direction === 'in';
  return (
    <Animated.View style={[styles.txRow, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={[styles.txDot, { backgroundColor: isIn ? Colors.success : Colors.error }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.txId} selectable>{tx.txid.slice(0, 14)}…</Text>
        <Text style={Typography.caption}>Block {tx.height.toLocaleString()}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? Colors.success : Colors.error }]}>
        {isIn ? '+' : '-'}{formatIrm(Math.abs(tx.net_sats))}
      </Text>
    </Animated.View>
  );
}

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const { address, balance, history, setBalance, setHistory, setUtxos } = useWalletStore();
  const { rpcUrl, authToken } = useWalletStore();
  const { nodeStatus, syncedHeight, peerCount, isSyncing, lastRefresh, touchRefresh } = useNodeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Animated balance counter
  const balanceAnim    = useRef(new Animated.Value(0)).current;
  const prevBalance    = useRef(0);
  const [displaySats, setDisplaySats] = useState(0);

  useSync();
  useBalance();

  // Listener drives the displayed integer
  useEffect(() => {
    const id = balanceAnim.addListener(({ value }) => setDisplaySats(Math.round(value)));
    return () => balanceAnim.removeListener(id);
  }, []);

  // Animate balance when it changes
  useEffect(() => {
    const target = balance?.confirmed ?? 0;
    if (target === prevBalance.current) return;
    Animated.timing(balanceAnim, {
      toValue: target,
      duration: 700,
      useNativeDriver: false,
    }).start();
    prevBalance.current = target;
  }, [balance?.confirmed]);

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
  }, [address, rpcUrl, authToken]);

  const isLoading = lastRefresh === 0 && !error;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />
        }
      >
        {/* Balance card */}
        <LinearGradient
          colors={GradientColors}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Total balance</Text>

          {isLoading ? (
            <Text style={styles.balancePlaceholder}>—</Text>
          ) : (
            <Text style={styles.balanceAmount}>
              {formatIrm(displaySats)} IRM
            </Text>
          )}

          {/* Sats sub-label */}
          {!isLoading && balance && (
            <Text style={styles.balanceSats}>
              {balance.confirmed.toLocaleString()} sats
            </Text>
          )}

          {address && (
            <View style={{ marginTop: 12 }}>
              <AddressText address={address} truncate />
            </View>
          )}
        </LinearGradient>

        {/* Chain strip */}
        <Card style={styles.strip}>
          <ChainPill
            label="RPC Block"
            value={nodeStatus ? nodeStatus.height.toLocaleString() : '—'}
          />
          <View style={styles.divider} />
          <ChainPill
            label="SPV"
            value={syncedHeight > 0 ? syncedHeight.toLocaleString() : '—'}
          />
          <View style={styles.divider} />
          <View style={styles.pill}>
            <Text style={Typography.caption}>Network</Text>
            <PeerIndicator count={peerCount} syncing={isSyncing} />
          </View>
        </Card>

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={{ color: Colors.error, fontSize: 13, fontFamily: Fonts.regular }}>
              {error}
            </Text>
          </View>
        )}

        {/* Quick actions — spring stagger */}
        <View style={styles.actions}>
          <QuickAction label="Send"    glyph="↑" onPress={() => nav.navigate('Send')}       delay={0} />
          <QuickAction label="Receive" glyph="↓" onPress={() => nav.navigate('Receive')}    delay={80} />
          <QuickAction label="Settle"  glyph="⊞" onPress={() => nav.navigate('Settlement')} delay={160} />
        </View>

        {/* Recent transactions */}
        <Text style={[Typography.h3, { marginBottom: 12 }]}>Recent transactions</Text>

        {isLoading ? (
          <Text style={Typography.caption}>Loading…</Text>
        ) : history.length === 0 ? (
          <Text style={Typography.caption}>No transactions yet</Text>
        ) : (
          history.slice(0, 5).map((tx, i) => (
            <TxRow key={tx.txid} tx={tx} delay={i * 80} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChainPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={Typography.caption}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  balanceCard: { borderRadius: 20, padding: 24, alignItems: 'center' },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 34,
    fontFamily: Fonts.bold,
  },
  balanceSats: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  balancePlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 34,
    fontFamily: Fonts.bold,
  },
  strip: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  pill: { alignItems: 'center', flex: 1, gap: 4 },
  pillValue: { color: Colors.text, fontSize: 15, fontFamily: Fonts.semiBold },
  divider: { width: 1, backgroundColor: Colors.border, alignSelf: 'stretch' },
  errorBanner: {
    backgroundColor: '#1a0000',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  actions: { flexDirection: 'row', gap: 12 },
  qa: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 18,
    alignItems: 'center',
  },
  qaGlyph: { fontSize: 22, color: Colors.primary },
  qaLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginTop: 6 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txId: { color: Colors.text, fontSize: 14, fontFamily: Fonts.semiBold },
  txAmount: { fontSize: 14, fontFamily: Fonts.semiBold },
});
