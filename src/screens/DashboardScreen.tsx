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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { useSync } from '../hooks/useSync';
import { useBalance } from '../hooks/useBalance';
import { IriumLogo } from '../components/IriumLogo';
import { AddressPicker } from '../components/AddressPicker';
import { Colors, GradientColors, Typography, Fonts } from '../components/theme';
import type { MainTabParams } from '../navigation/MainNavigator';

type Nav = BottomTabNavigationProp<MainTabParams>;

function formatIrm(sats: number) {
  return (sats / 1e8).toFixed(8);
}

function timeAgo(blockHeight: number, currentHeight: number) {
  const blocksOld = Math.max(0, currentHeight - blockHeight);
  if (blocksOld < 1) return 'just now';
  if (blocksOld < 6) return `${blocksOld} block${blocksOld === 1 ? '' : 's'} ago`;
  const mins = blocksOld * 2; // assume ~2 min blocks
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Transaction row (polished) ──────────────────────────────────────────────

interface TxRowProps {
  tx: { txid: string; height: number; net_sats: number; direction: string };
  currentHeight: number;
  delay: number;
}

function TxRow({ tx, currentHeight, delay }: TxRowProps) {
  const slideX  = useRef(new Animated.Value(20)).current;
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
  const typeLabel = isIn ? 'Received' : 'Sent';
  const confirmations = Math.max(0, currentHeight - tx.height);

  return (
    <Animated.View style={[txStyles.row, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={[txStyles.iconCircle, { backgroundColor: color + '22' }]}>
        <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={16} color={color} />
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
    </Animated.View>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  type: { color: Colors.textPrimary, fontSize: 14, fontFamily: Fonts.semiBold },
  meta: { color: Colors.textSecondary, fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
  amount: { fontSize: 14, fontFamily: Fonts.bold },
  time: { color: Colors.textMuted, fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const {
    address, balance, history, seedHex, addressIndex,
    setAddress, setAddressIndex, setBalance, setHistory, setUtxos,
    rpcUrl, authToken,
  } = useWalletStore();
  const { nodeStatus, peerCount, isSyncing, lastRefresh, touchRefresh } = useNodeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [copyFlash, setCopyFlash]         = useState(false);

  // Entrance animation — staggered fade+slide for each major block
  const sectionAnims = useRef(
    [0, 1, 2, 3].map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(20) })),
  ).current;

  useEffect(() => {
    Animated.stagger(
      60,
      sectionAnims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(a.y,       { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ),
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated balance count-up
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const prevBalance = useRef(0);
  const [displaySats, setDisplaySats] = useState(0);

  useSync();
  useBalance();

  // Derive address on first mount if missing
  useEffect(() => {
    if (address || !seedHex) return;
    bridge.deriveAddress(seedHex, addressIndex).then(setAddress).catch(() => {});
  }, [address, seedHex, addressIndex, setAddress]);

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
      duration: 900,
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
  const synced    = !isSyncing && nodeStatus != null;
  const statusDot = synced ? Colors.success : Colors.warning;
  const currentHeight = nodeStatus?.height ?? 0;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header: logo / status / bell + gear ── */}
      <Animated.View
        style={[
          styles.header,
          { opacity: sectionAnims[0].opacity, transform: [{ translateY: sectionAnims[0].y }] },
        ]}
      >
        <View style={styles.headerLogoWrap}>
          <View style={styles.headerLogoGlow} pointerEvents="none" />
          <IriumLogo size={32} />
        </View>
        <View style={styles.headerStatus}>
          <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
          <Text style={[styles.statusLabel, { color: statusDot }]} numberOfLines={1}>
            {synced ? `LIVE #${currentHeight.toLocaleString()}` : 'SYNCING'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => nav.navigate('Settings')}>
            <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ── Balance hero card ── */}
        <Animated.View
          style={{
            opacity: sectionAnims[1].opacity,
            transform: [{ translateY: sectionAnims[1].y }],
          }}
        >
          <View style={styles.balanceCard}>
            {/* Top gradient border */}
            <LinearGradient
              colors={GradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.balanceTopBorder}
            />
            {/* Subtle tint background */}
            <LinearGradient
              colors={['rgba(123,47,255,0.10)', 'rgba(0,212,255,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>

            {isLoading ? (
              <Text style={styles.balancePlaceholder}>—</Text>
            ) : (
              <Text style={styles.balanceAmount}>{formatIrm(displaySats)}</Text>
            )}
            <Text style={styles.balanceUnit}>IRM</Text>

            {!isLoading && balance && (
              <Text style={styles.balanceSats}>
                {balance.confirmed.toLocaleString()} sats
              </Text>
            )}

            {/* Address row */}
            {address && (
              <View style={styles.addrRow}>
                <Pressable onPress={copyAddress} hitSlop={6} style={styles.addrPress}>
                  <Text style={styles.addrIndexLabel}>#{addressIndex}</Text>
                  <Text style={styles.addrFull} numberOfLines={1}>{address}</Text>
                  <Ionicons
                    name={copyFlash ? 'checkmark' : 'copy-outline'}
                    size={13}
                    color={copyFlash ? Colors.success : Colors.textSecondary}
                  />
                </Pressable>
                <Pressable onPress={() => setPickerVisible(true)} style={styles.changePill}>
                  <Text style={styles.changePillText}>Change</Text>
                  <Ionicons name="chevron-down" size={11} color={Colors.primary} />
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Error banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={15} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Quick actions (Send + Receive) ── */}
        <Animated.View
          style={[
            styles.actions,
            {
              opacity: sectionAnims[2].opacity,
              transform: [{ translateY: sectionAnims[2].y }],
            },
          ]}
        >
          <SendButton onPress={() => nav.navigate('Send')} />
          <ReceiveButton onPress={() => nav.navigate('Receive')} />
        </Animated.View>

        {/* ── Recent activity ── */}
        <Animated.View
          style={{
            opacity: sectionAnims[3].opacity,
            transform: [{ translateY: sectionAnims[3].y }],
            gap: 10,
          }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {history.length > 0 && (
              <Pressable onPress={() => nav.navigate('History')} hitSlop={6}>
                <Text style={styles.viewAllInline}>View all →</Text>
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <Text style={Typography.caption}>Loading…</Text>
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptyHint}>Receive some IRM to see activity here.</Text>
            </View>
          ) : (
            history.slice(0, 6).map((tx, i) => (
              <TxRow key={tx.txid} tx={tx} currentHeight={currentHeight} delay={i * 50} />
            ))
          )}
        </Animated.View>
      </ScrollView>

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

// ─── Quick-action pill buttons ───────────────────────────────────────────────

function SendButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start()}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale }], borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={['#7B2FFF', '#3B5BDB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={qaStyles.btn}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          <Text style={qaStyles.label}>Send</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function ReceiveButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start()}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={qaStyles.borderWrap}
        >
          <View style={qaStyles.glass}>
            <Ionicons name="arrow-down" size={20} color={Colors.accent} />
            <Text style={qaStyles.labelGlass}>Receive</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const qaStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  label: {
    color: '#FFFFFF',
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  borderWrap: {
    padding: 1.5,
    borderRadius: 16,
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14.5,
    paddingHorizontal: 18,
    borderRadius: 14.5,
    backgroundColor: 'rgba(10,10,26,0.85)',
  },
  labelGlass: {
    color: Colors.textPrimary,
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});

// ─── Screen styles ───────────────────────────────────────────────────────────

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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '30',
    shadowColor: Colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  headerStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: { padding: 4 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Balance hero card
  balanceCard: {
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  balanceTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 44,
    fontFamily: Fonts.bold,
    letterSpacing: -1,
    lineHeight: 52,
  },
  balanceUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    letterSpacing: 2,
    marginTop: -4,
  },
  balancePlaceholder: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 44,
    fontFamily: Fonts.bold,
    lineHeight: 52,
  },
  balanceSats: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 6,
  },

  // Address row inside balance card
  addrRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  addrPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addrIndexLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  addrFull: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6B7280',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  changePillText: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,68,102,0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.regular, flex: 1 },

  // Quick actions
  actions: { flexDirection: 'row', gap: 12 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  viewAllInline: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },

  // Empty state
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
});
