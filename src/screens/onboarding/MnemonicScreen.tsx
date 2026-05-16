import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Typography, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Mnemonic'>;

// One entrance anim per cell slot (max 24 words)
const CELL_COUNT = 24;

export function MnemonicScreen({ navigation, route }: Props) {
  const { mode } = route.params;
  const isCreate = mode === 'create';

  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [wifPreview, setWifPreview] = useState('');
  const [seedPreview, setSeedPreview] = useState('');

  const { setSeedHex, setWif, setAddress } = useWalletStore();

  // Per-cell staggered entrance (opacity + translateY)
  const cellAnims = useRef(
    Array.from({ length: CELL_COUNT }, () => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(14),
    }))
  ).current;

  // Single value driving the "fog" overlay: 0 = hidden (overlay visible), 1 = revealed (overlay gone)
  const revealAnim = useRef(new Animated.Value(0)).current;

  // WIF section entrance
  const wifAnim = useRef({ opacity: new Animated.Value(0), y: new Animated.Value(14) }).current;

  // Generate mnemonic + pre-derive seed/WIF on create mode
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

  // Stagger word cells in once mnemonic is ready
  useEffect(() => {
    const words = mnemonic.trim().split(/\s+/).filter(Boolean);
    if (words.length < 12) return;

    const entrance = cellAnims.slice(0, words.length).map((anim) =>
      Animated.parallel([
        Animated.timing(anim.opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(anim.y,       { toValue: 0,  duration: 220, useNativeDriver: true }),
      ])
    );
    Animated.stagger(28, entrance).start();

    // WIF section follows last cell
    const delay = words.length * 28 + 100;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(wifAnim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(wifAnim.y,       { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, [mnemonic]);

  function toggleReveal() {
    const next = !revealed;
    setRevealed(next);
    Animated.timing(revealAnim, {
      toValue: next ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }

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

  // Overlay opacity: 1 when hidden, 0 when revealed
  const overlayOpacity = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

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

      {/* 24-word grid with staggered entrance */}
      {isCreate && words.length >= 12 && (
        <View>
          <View style={styles.grid}>
            {words.map((w, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.wordCell,
                  {
                    opacity: cellAnims[i].opacity,
                    transform: [{ translateY: cellAnims[i].y }],
                  },
                ]}
              >
                <Text style={styles.wordNum}>{i + 1}</Text>
                <Text style={styles.wordText}>{w}</Text>
                {/* Fog overlay per cell */}
                <Animated.View
                  style={[styles.cellFog, { opacity: overlayOpacity }]}
                  pointerEvents="none"
                />
              </Animated.View>
            ))}
          </View>

          {/* WIF section */}
          <Animated.View
            style={[
              styles.wifSection,
              {
                opacity: wifAnim.opacity,
                transform: [{ translateY: wifAnim.y }],
              },
            ]}
          >
            <Text style={styles.wifLabel}>Private key (WIF)</Text>
            <Text style={styles.wifWarning}>
              Import this into any Irium-compatible wallet. Never share it.
            </Text>
            <View style={styles.wifBox}>
              <Text style={styles.wifText} selectable>
                {wifPreview || '…'}
              </Text>
              {/* Fog overlay on WIF */}
              <Animated.View
                style={[styles.wifFog, { opacity: overlayOpacity }]}
                pointerEvents="none"
              />
            </View>
          </Animated.View>

          <TouchableOpacity style={styles.revealBtn} onPress={toggleReveal}>
            <Text style={styles.revealText}>
              {revealed ? 'Hide phrase & key' : 'Tap to reveal phrase & key'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Import mode: text input */}
      {!isCreate && (
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
    width: '30%',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  wordNum: {
    color: Colors.textMuted,
    fontSize: 11,
    width: 16,
    fontFamily: Fonts.regular,
  },
  wordText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  // Fog overlay covers the cell content
  cellFog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.card,
    borderRadius: 8,
  },
  wifSection: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.warning,
    marginBottom: 8,
  },
  wifLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  wifWarning: {
    color: Colors.warning,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginBottom: 10,
    lineHeight: 17,
  },
  wifBox: {
    backgroundColor: Colors.bg,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  wifText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  wifFog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    borderRadius: 8,
  },
  revealBtn: { alignItems: 'center', paddingVertical: 14 },
  revealText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 15,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
