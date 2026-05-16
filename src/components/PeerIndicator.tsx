import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from './theme';

interface Props {
  count: number;
  syncing?: boolean;
}

function dotColor(count: number, syncing: boolean): string {
  if (syncing) return Colors.warning;
  if (count === 0) return Colors.error;
  if (count < 3) return Colors.warning;
  return Colors.success;
}

export function PeerIndicator({ count, syncing = false }: Props) {
  const color = dotColor(count, syncing);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {syncing ? 'Syncing' : `${count} peer${count !== 1 ? 's' : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
