import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { Colors, Typography, Fonts } from '../components/theme';
import type { TxRecord } from '../bridge/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIrm(sats: number) {
  return (Math.abs(sats) / 1e8).toFixed(8) + ' IRM';
}

type FilterTab = 'All' | 'Sent' | 'Received';

const TABS: FilterTab[] = ['All', 'Sent', 'Received'];

// ─── Transaction Item ─────────────────────────────────────────────────────────

function TxItem({
  item,
  index,
  onPress,
}: {
  item: TxRecord;
  index: number;
  onPress: () => void;
}) {
  const slideX  = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(Math.min(index * 55, 400)),
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isIn  = item.direction === 'in';
  const color = isIn ? Colors.success : Colors.danger;

  return (
    <Pressable onPress={onPress} android_ripple={{ color: Colors.border }}>
      <Animated.View style={[styles.row, { opacity, transform: [{ translateX: slideX }] }]}>
        {/* Direction icon */}
        <View style={[styles.iconCircle, { backgroundColor: color + '22' }]}>
          <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={16} color={color} />
        </View>

        {/* Main content */}
        <View style={{ flex: 1 }}>
          <Text style={styles.txId} numberOfLines={1}>
            {item.txid.slice(0, 10)}…
          </Text>
          <Text style={styles.blockLabel}>Block {item.height.toLocaleString()}</Text>
        </View>

        {/* Amount */}
        <Text style={[styles.amount, { color }]}>
          {isIn ? '+' : '-'}{formatIrm(item.net_sats)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[Typography.caption, { marginBottom: 4 }]}>{label}</Text>
      <Text
        style={[
          mono ? styles.detailMono : Typography.body,
          { color: Colors.text },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function HistoryScreen() {
  const { address, rpcUrl, authToken, history, setHistory } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]       = useState(history.length === 0);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<TxRecord | null>(null);
  const [activeTab, setActiveTab]   = useState<FilterTab>('All');
  const [copyFlash, setCopyFlash]   = useState(false);

  // Bottom sheet slide animation
  const sheetY = useRef(new Animated.Value(500)).current;

  // ── Load history ──────────────────────────────────────────────────────────

  async function load() {
    if (!address || !rpcUrl) return;
    setRefreshing(true);
    setError(null);
    try {
      const hist = await bridge.rpcGetHistory(rpcUrl, authToken, address);
      setHistory(hist);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load history');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered: TxRecord[] = history.filter((tx) => {
    if (activeTab === 'Sent')     return tx.direction === 'out';
    if (activeTab === 'Received') return tx.direction === 'in';
    return true;
  });

  // ── Bottom sheet ──────────────────────────────────────────────────────────

  function openDetail(tx: TxRecord) {
    sheetY.setValue(500);
    setSelected(tx);
    Animated.spring(sheetY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  }

  function closeDetail() {
    Animated.timing(sheetY, { toValue: 500, duration: 220, useNativeDriver: true }).start(() =>
      setSelected(null)
    );
  }

  async function copyTxid() {
    if (!selected) return;
    await Clipboard.setStringAsync(selected.txid);
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 1200);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Text style={[Typography.h2, styles.title]}>History</Text>

      {/* ── Filter tabs ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={styles.tabItem}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab}
              </Text>
              {active && <View style={styles.tabUnderline} />}
            </Pressable>
          );
        })}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: Colors.danger, fontFamily: Fonts.regular }}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: Colors.primary, fontFamily: Fonts.semiBold }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.txid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[Typography.caption, { textAlign: 'center', marginTop: 60 }]}>
              No transactions found
            </Text>
          }
          renderItem={({ item, index }) => (
            <TxItem item={item} index={index} onPress={() => openDetail(item)} />
          )}
        />
      )}

      {/* ── Bottom sheet modal ── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="none"
        onRequestClose={closeDetail}
      >
        <Pressable style={styles.overlay} onPress={closeDetail}>
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
          >
            <Pressable>
              {/* Handle */}
              <View style={styles.sheetHandle} />

              <Text style={[Typography.h3, { marginBottom: 20 }]}>Transaction detail</Text>

              {selected && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <DetailRow label="TXID"      value={selected.txid}                                          mono />
                  <DetailRow label="Block"     value={selected.height.toLocaleString()} />
                  <DetailRow label="Direction" value={selected.direction === 'in' ? '↓ Received' : '↑ Sent'} />
                  <DetailRow
                    label="Amount"
                    value={`${selected.direction === 'in' ? '+' : '-'}${formatIrm(selected.net_sats)}`}
                  />

                  {/* Copy TXID */}
                  <TouchableOpacity
                    onPress={copyTxid}
                    style={[
                      styles.copyBtn,
                      copyFlash && { borderColor: Colors.success },
                    ]}
                  >
                    <Ionicons
                      name={copyFlash ? 'checkmark' : 'copy-outline'}
                      size={16}
                      color={copyFlash ? Colors.success : Colors.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.copyBtnTxt,
                        copyFlash && { color: Colors.success },
                      ]}
                    >
                      {copyFlash ? 'Copied!' : 'Copy TXID'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* Close */}
              <TouchableOpacity style={styles.closeBtn} onPress={closeDetail}>
                <Text style={{ color: Colors.text, fontFamily: Fonts.semiBold }}>Close</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { margin: 24, marginBottom: 8 },

  // Filter tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    marginRight: 24,
    paddingBottom: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.text },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  errorBox: { alignItems: 'center', marginTop: 60 },

  // Transaction row
  row: {
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
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txId: { color: Colors.text, fontSize: 13, fontFamily: Fonts.semiBold },
  blockLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
  amount: { fontSize: 13, fontFamily: Fonts.semiBold },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    paddingTop: 12,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailRow: { marginBottom: 16 },
  detailMono: { fontFamily: 'monospace', fontSize: 12 },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    marginBottom: 8,
  },
  copyBtnTxt: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
