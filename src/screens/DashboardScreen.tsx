import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar,
  Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSync } from '../hooks/useSync';
import { useBalance } from '../hooks/useBalance';
import { AddressPicker } from '../components/AddressPicker';
import { Colors, Typography, Fonts } from '../components/theme';
import type { MainTabParams } from '../navigation/MainNavigator';

type Nav = BottomTabNavigationProp<MainTabParams>;

function formatIrm(sats: number) {
  return (sats / 1e8).toFixed(8);
}

function timeAgo(blockHeight: number, currentHeight: number) {
  const blocksOld = Math.max(0, currentHeight - blockHeight);
  if (blocksOld < 1) return 'just now';
  const mins = blocksOld * 2; // ~2 min blocks
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Transaction row ─────────────────────────────────────────────────────────

interface TxRowProps {
  tx: { txid: string; height: number; net_sats: number; direction: string };
  currentHeight: number;
}

function TxRow({ tx, currentHeight }: TxRowProps) {
  const isIn  = tx.direction === 'in';
  const color = isIn ? Colors.success : Colors.danger;
  const typeLabel = isIn ? 'Received' : 'Sent';
  const confirmations = Math.max(0, currentHeight - tx.height);

  return (
    <View style={txStyles.row}>
      <View style={txStyles.iconWrap}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={isIn ? Colors.success : Colors.danger}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={txStyles.type}>{typeLabel}</Text>
        <Text style={txStyles.meta} numberOfLines={1}>
          Block #{tx.height.toLocaleString()} · {confirmations} conf
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[txStyles.amount, { color }]}>
          {isIn ? '+' : '-'}{formatIrm(Math.abs(tx.net_sats))}
        </Text>
        <Text style={txStyles.time}>{timeAgo(tx.height, currentHeight)}</Text>
      </View>
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardElevated,
  },
  type:   { color: Colors.textPrimary, fontSize: 14, fontFamily: Fonts.semiBold },
  meta:   { color: Colors.textSecondary, fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
  amount: { fontSize: 14, fontFamily: Fonts.semiBold },
  time:   { color: Colors.textMuted, fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const {
    address, balance, history, seedHex, addressIndex,
    setAddress, setAddressIndex, setBalance, setHistory, setUtxos,
    rpcUrl, authToken,
  } = useWalletStore();
  const { peerCount, isSyncing, syncedHeight, lastRefresh, touchRefresh } = useNodeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [copyFlash, setCopyFlash]         = useState(false);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade]);

  // Animated balance count-up
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const prevBalance = useRef(0);
  const [displaySats, setDisplaySats] = useState(0);

  useSync();
  useBalance();

  useEffect(() => {
    if (address || !seedHex) return;
    bridge.deriveAddress(seedHex, addressIndex).then(setAddress).catch(() => {});
  }, [address, seedHex, addressIndex, setAddress]);

  useEffect(() => {
    const id = balanceAnim.addListener(({ value }) => setDisplaySats(Math.round(value)));
    return () => balanceAnim.removeListener(id);
  }, [balanceAnim]);

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

  async function copyAddress() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 1100);
  }

  async function selectAddress(idx: number) {
    if (!seedHex) return;
    setAddressIndex(idx);
    const addr = await bridge.deriveAddress(seedHex, idx);
    setAddress(addr);
    setPickerVisible(false);
  }

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

  const isLoading = lastRefresh === 0 && !error;

  // Header status sources from the NATIVE P2P light client (peerCount,
  // isSyncing, syncedHeight from useNodeStore — all populated by the
  // native module via useSync). It does NOT read nodeStatus.height,
  // which is rpc-derived and only populates when a custom node is
  // configured. This makes the header honest for wallets with no
  // custom node: it shows what the light client actually knows.
  const currentHeight = syncedHeight;
  const connectionState: 'connecting' | 'syncing' | 'live' =
    peerCount === 0 ? 'connecting' :
    isSyncing      ? 'syncing'    :
                     'live';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLogoWrap}>
            <Ionicons name="cube-outline" size={20} color={Colors.primary} />
          </View>
          <View style={styles.headerStatus}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    connectionState === 'live'    ? Colors.success  :
                    connectionState === 'syncing' ? Colors.warning  :
                                                    Colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.statusLabel,
                {
                  color:
                    connectionState === 'live'    ? Colors.success  :
                    connectionState === 'syncing' ? Colors.warning  :
                                                    Colors.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {connectionState === 'live'
                ? `Live · #${currentHeight.toLocaleString()}`
                : connectionState === 'syncing'
                  ? 'Syncing'
                  : 'Connecting…'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
            </Pressable>
            <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => nav.navigate('Settings')}>
              <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />
          }
        >
          {/* Balance card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <View style={styles.balanceLine}>
              {isLoading ? (
                <Text style={styles.balancePlaceholder}>—</Text>
              ) : (
                <Text style={styles.balanceAmount}>{formatIrm(displaySats)}</Text>
              )}
              <Text style={styles.balanceUnit}>IRM</Text>
            </View>
            {!isLoading && balance && (
              <Text style={styles.balanceSats}>{balance.confirmed.toLocaleString()} sats</Text>
            )}

            {address && (
              <View style={styles.addrRow}>
                <Pressable onPress={copyAddress} style={styles.addrPress} hitSlop={6}>
                  <Text style={styles.addrFull} numberOfLines={1}>{address}</Text>
                  <Ionicons
                    name={copyFlash ? 'checkmark' : 'copy-outline'}
                    size={12}
                    color={copyFlash ? Colors.success : Colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={() => setPickerVisible(true)} style={styles.changeBtn} hitSlop={6}>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              </View>
            )}
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
            </View>
          )}

          {/* Send / Receive */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('Send'); }}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              <Text style={styles.primaryLabel}>Send</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('Receive'); }}
              style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="arrow-down" size={18} color={Colors.primary} />
              <Text style={styles.outlineLabel}>Receive</Text>
            </Pressable>
          </View>

          {/* Activity */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {history.length > 0 && (
              <Pressable onPress={() => nav.navigate('History')} hitSlop={6}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <Text style={Typography.caption}>Loading…</Text>
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {history.slice(0, 6).map((tx) => (
                <TxRow key={tx.txid} tx={tx} currentHeight={currentHeight} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <AddressPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={selectAddress}
        currentIndex={addressIndex}
        seedHex={seedHex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  headerLogoWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: { padding: 4 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Balance card
  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  balanceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  balanceAmount: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  balanceUnit: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  balancePlaceholder: {
    color: Colors.textMuted,
    fontSize: 36,
    fontFamily: Fonts.bold,
  },
  balanceSats: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },

  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  addrPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addrFull: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.textMuted,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: { color: Colors.danger, fontSize: 12, fontFamily: Fonts.regular, flex: 1 },

  // Send / Receive
  actions: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  outlineLabel: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
  },
  viewAll: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },

  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.regular,
  },
});
