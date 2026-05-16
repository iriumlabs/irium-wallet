import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from './theme';
import type { AgreementStatus } from '../store/settlement';

const CONFIG: Record<AgreementStatus, { label: string; bg: string; fg: string }> = {
  draft:    { label: 'Draft',    bg: '#1a1a2e', fg: Colors.textMuted },
  funded:   { label: 'Funded',   bg: '#001a10', fg: Colors.success },
  complete: { label: 'Complete', bg: '#001a1a', fg: '#00e5cc' },
  expired:  { label: 'Expired',  bg: '#1a0000', fg: Colors.error },
};

interface Props {
  status: AgreementStatus;
}

export function StatusBadge({ status }: Props) {
  const { label, bg, fg } = CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});
