import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from './theme';

interface Props {
  sats: number;
  large?: boolean;
  light?: boolean;
}

function irmString(sats: number): string {
  return (Math.abs(sats) / 1e8).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function AmountDisplay({ sats, large = false, light = false }: Props) {
  const textColor = light ? 'rgba(255,255,255,0.9)' : Colors.text;
  const subColor = light ? 'rgba(255,255,255,0.6)' : Colors.textMuted;

  return (
    <View style={styles.container}>
      <Text style={[large ? styles.large : styles.normal, { color: textColor }]}>
        {irmString(sats)} IRM
      </Text>
      <Text style={[styles.sub, { color: subColor }]}>
        {Math.abs(sats).toLocaleString()} sats
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  large: { fontSize: 34, fontWeight: '800' },
  normal: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});
