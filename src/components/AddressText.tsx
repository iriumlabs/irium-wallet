import React, { useCallback } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from './theme';
import { useToast } from './Toast';

interface Props {
  address: string;
  truncate?: boolean;
}

function truncateAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return addr.slice(0, 10) + '…' + addr.slice(-8);
}

export function AddressText({ address, truncate = true }: Props) {
  const toast = useToast();
  const copy = useCallback(async () => {
    await Clipboard.setStringAsync(address);
    toast.show('Address copied', 'success');
  }, [address, toast]);

  return (
    <TouchableOpacity onPress={copy} activeOpacity={0.7}>
      <Text style={styles.text} selectable>
        {truncate ? truncateAddr(address) : address}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
