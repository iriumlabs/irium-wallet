import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../theme';

interface Props {
  total: number;
  current: number; // 1-indexed
}

export function StepDots({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        const done = i + 1 <= current;
        return (
          <View
            key={i}
            style={[styles.dot, done && styles.dotDone]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotDone: {
    backgroundColor: Colors.primary,
  },
});
