import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Typography } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Mnemonic'>;

export function MnemonicScreen({ navigation, route }: Props) {
  const { mode } = route.params;
  const isCreate = mode === 'create';

  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [wifPreview, setWifPreview] = useState('');
  const [seedPreview, setSeedPreview] = useState('');

  const { setSeedHex, setWif, setAddress } = useWalletStore();

  // For create mode: generate mnemonic and pre-derive seed + WIF so both are
  // ready to display before the user taps continue.
  useEffect(() => {
    if (!isCreate) return;
    (async () => {
      try {
        const m = await bridge.generateMnemonic();
        setMnemonic(m);
        const seed = await bridge.mnemonicToSeed(m, '');
        const wif = await bridge.exportWif(seed, 0);
        setSeedPreview(seed);
        setWifPreview(wif);
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Failed to generate wallet');
      }
    })();
  }, [isCreate]);

  async function proceed() {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      Alert.alert('Invalid mnemonic', 'Please enter 12 or 24 words.');
      return;
    }
    setLoading(true);
    try {
      let seed = seedPreview;
      let wif = wifPreview;

      // Import mode: derive now (create mode already pre-derived)
      if (!isCreate || !seed) {
        seed = await bridge.mnemonicToSeed(mnemonic.trim(), '');
        wif = await bridge.exportWif(seed, 0);
      }

      const addr = await bridge.deriveAddress(seed, 0);
      await setSeedHex(seed);
      await setWif(wif);
      setAddress(addr);
      navigation.navigate('NodeConfig');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to process mnemonic');
    } finally {
      setLoading(false);
    }
  }

  const words = mnemonic.trim().split(/\s+/).filter(Boolean);
  const canContinue = isCreate ? revealed && !!wifPreview : true;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Text style={[Typography.h2, { marginBottom: 8 }]}>
        {isCreate ? 'Your recovery phrase' : 'Import recovery phrase'}
      </Text>
      <Text style={[Typography.caption, { marginBottom: 24 }]}>
        {isCreate
          ? 'Write these 24 words and your private key down and keep them safe. They are the only way to recover your wallet.'
          : 'Enter your 12 or 24 word recovery phrase.'}
      </Text>

      {/* 24-word grid */}
      {isCreate && (words.length === 12 || words.length === 24) ? (
        <View style={styles.grid}>
          {words.map((w, i) => (
            <View key={i} style={styles.wordCell}>
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={[styles.wordText, !revealed && { color: Colors.bg }]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* WIF private key display — create mode only */}
      {isCreate && (
        <View style={styles.wifSection}>
          <Text style={[Typography.caption, { marginBottom: 6 }]}>Private key (WIF)</Text>
          <Text style={[Typography.caption, { marginBottom: 10, color: Colors.warning }]}>
            Import this into any Irium-compatible wallet. Never share it.
          </Text>
          <View style={styles.wifBox}>
            <Text
              style={[styles.wifText, !revealed && { color: Colors.card }]}
              selectable
            >
              {wifPreview || '…'}
            </Text>
          </View>
        </View>
      )}

      {isCreate ? (
        <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed((v) => !v)}>
          <Text style={{ color: Colors.primary }}>{revealed ? 'Hide phrase & key' : 'Tap to reveal'}</Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          style={styles.input}
          value={mnemonic}
          onChangeText={setMnemonic}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <GradientButton
        label={isCreate ? "I've saved both — continue" : 'Import wallet'}
        onPress={proceed}
        loading={loading}
        disabled={!canContinue}
        style={{ marginTop: 32 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  wordCell: {
    width: '30%', backgroundColor: Colors.card, borderRadius: 8, padding: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  wordNum: { color: Colors.textMuted, fontSize: 11, width: 16 },
  wordText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  wifSection: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.warning, marginBottom: 8,
  },
  wifBox: {
    backgroundColor: Colors.bg, borderRadius: 8, padding: 12,
  },
  wifText: { color: Colors.text, fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  revealBtn: { alignItems: 'center', paddingVertical: 12 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 16,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
    minHeight: 100, textAlignVertical: 'top',
  },
});
