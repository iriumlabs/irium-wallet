import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from './theme';

interface Props {
  count: number;
  syncing?: boolean;
}

// Three states map to colors + human labels. The component intentionally
// does NOT expose peer counts, sync state, or any P2P/SPV terminology.
// It's the visible surface of an automatic background process — the user
// just sees "Connecting" or "Connected" without needing to think about
// network plumbing.
function dotColor(count: number, syncing: boolean): string {
  if (count === 0) return Colors.error;
  if (syncing) return Colors.warning;
  return Colors.success;
}

function statusLabel(count: number, syncing: boolean): string {
  if (count === 0) return 'Connecting…';
  if (syncing) return 'Syncing…';
  return 'Connected';
}

export function PeerIndicator({ count, syncing = false }: Props) {
  const color = dotColor(count, syncing);
  const label = statusLabel(count, syncing);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
