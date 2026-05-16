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
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { Colors, Typography, Fonts } from '../components/theme';
import type { TxRecord } from '../bridge/types';

function formatIrm(sats: number) {
  return (Math.abs(sats) / 1e8).toFixed(8) + ' IRM';
}

function TxItem({ item, index }: { item: TxRecord; index: number }) {
  const slideX  = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(Math.min(index * 60, 500)),
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const isIn = item.direction === 'in';

  return (
    <Animated.View style={[styles.row, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={[styles.dot, { backgroundColor: isIn ? Colors.success : Colors.error }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.txId} selectable>{item.txid.slice(0, 16)}…</Text>
        <Text style={Typography.caption}>Block {item.height.toLocaleString()}</Text>
      </View>
      <Text style={[styles.amount, { color: isIn ? Colors.success : Colors.error }]}>
        {isIn ? '+' : '-'}{formatIrm(item.net_sats)}
      </Text>
    </Animated.View>
  );
}

export function HistoryScreen() {
  const { address, rpcUrl, authToken, history, setHistory } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]       = useState(history.length === 0);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<TxRecord | null>(null);

  // Bottom sheet slide animation
  const sheetY = useRef(new Animated.Value(400)).current;

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

  useEffect(() => { load(); }, []);

  function openDetail(tx: TxRecord) {
    sheetY.setValue(400);
    setSelected(tx);
    Animated.spring(sheetY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
  }

  function closeDetail() {
    Animated.timing(sheetY, { toValue: 400, duration: 220, useNativeDriver: true }).start(() =>
      setSelected(null)
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Text style={[Typography.h2, styles.title]}>History</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: Colors.error, fontFamily: Fonts.regular }}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: Colors.primary, fontFamily: Fonts.semiBold }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(t) => t.txid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={Colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[Typography.caption, { textAlign: 'center', marginTop: 60 }]}>
              No transactions found
            </Text>
          }
          renderItem={({ item, index }) => (
            <Pressable onPress={() => openDetail(item)} android_ripple={{ color: Colors.border }}>
              <TxItem item={item} index={index} />
            </Pressable>
          )}
        />
      )}

      {/* Bottom sheet detail modal */}
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
              <View style={styles.sheetHandle} />
              <Text style={[Typography.h3, { marginBottom: 20 }]}>Transaction detail</Text>
              {selected && (
                <ScrollView>
                  <DetailRow label="TXID"      value={selected.txid}                       mono />
                  <DetailRow label="Block"     value={selected.height.toLocaleString()}           />
                  <DetailRow label="Direction" value={selected.direction === 'in' ? '↓ Received' : '↑ Sent'} />
                  <DetailRow
                    label="Amount"
                    value={`${selected.direction === 'in' ? '+' : '-'}${formatIrm(selected.net_sats)}`}
                  />
                </ScrollView>
              )}
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

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[Typography.caption, { marginBottom: 4 }]}>{label}</Text>
      <Text
        style={[
          mono ? { fontFamily: 'monospace', fontSize: 12 } : Typography.body,
          { color: Colors.text },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { margin: 24, marginBottom: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  errorBox: { alignItems: 'center', marginTop: 60 },
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  txId: { color: Colors.text, fontSize: 14, fontFamily: Fonts.semiBold },
  amount: { fontSize: 13, fontFamily: Fonts.semiBold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    paddingTop: 12,
    maxHeight: '65%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
