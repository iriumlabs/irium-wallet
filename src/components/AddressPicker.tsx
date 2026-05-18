import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bridge } from '../bridge';
import { Colors, Fonts } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
  currentIndex: number;
  seedHex: string | null;
  /** How many addresses to derive (default 10) */
  count?: number;
}

export function AddressPicker({
  visible, onClose, onSelect, currentIndex, seedHex, count = 10,
}: Props) {
  const [addrs, setAddrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || addrs.length > 0 || !seedHex) return;
    setLoading(true);
    Promise.all(
      Array.from({ length: count }, (_, i) => bridge.deriveAddress(seedHex, i))
    )
      .then(setAddrs)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seedHex]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Sheet — swallow taps */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Choose Address</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeX}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 28 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {addrs.map((addr, i) => (
                <Pressable
                  key={i}
                  onPress={() => onSelect(i)}
                  style={[styles.row, i === currentIndex && styles.rowActive]}
                >
                  <Text style={styles.rowIdx}>#{i}</Text>
                  <Text style={styles.rowAddr} numberOfLines={1}>{addr}</Text>
                  {i === currentIndex && (
                    <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    maxHeight: '75%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontFamily: Fonts.semiBold, color: Colors.text },
  closeX: { padding: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowActive: { backgroundColor: Colors.primary + '12', borderRadius: 8, paddingHorizontal: 4 },
  rowIdx: { color: Colors.textSecondary, fontSize: 12, fontFamily: Fonts.semiBold, width: 28, textAlign: 'center' },
  rowAddr: { flex: 1, fontFamily: 'monospace', fontSize: 11, color: Colors.text },
});
