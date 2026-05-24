import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { Colors, Fonts, GradientColors } from '../../components/theme';
import { useToast } from '../../components/Toast';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { StepDots } from '../../components/onboarding/StepDots';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Mnemonic'>;

// Temporary module-level store for mnemonic, so VerifyMnemonic can access it
// without navigation params (VerifyMnemonic: undefined in the type).
export let tempMnemonicWords: string[] = [];

function GradientBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled || loading}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          borderRadius: 14,
          overflow: 'hidden',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <LinearGradient
          colors={GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btnGradient}
        >
          <Text style={styles.btnLabel}>{loading ? 'Processing…' : label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function MnemonicScreen({ navigation, route }: Props) {
  const toast = useToast();
  const { mode } = route.params;
  const isCreate = mode === 'create';

  const [mnemonic, setMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [wifRevealed, setWifRevealed] = useState(false);
  const [wifPreview, setWifPreview] = useState('');
  const [seedPreview, setSeedPreview] = useState('');
  const [checked, setChecked] = useState(false);

  const { setSeedHex, setWif, setAddress } = useWalletStore();

  // Overlay opacity: 0 = full fog, 1 = clear
  const revealAnim = useRef(new Animated.Value(0)).current;
  const wifRevealAnim = useRef(new Animated.Value(0)).current;

  // Staggered entrance for each cell (max 24)
  const CELL_COUNT = 24;
  const cellAnims = useRef(
    Array.from({ length: CELL_COUNT }, () => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(12),
    }))
  ).current;

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
        toast.show(e?.message ?? 'Failed to generate wallet', 'error');
      }
    })();
  }, [isCreate]);

  // Stagger word cells in once mnemonic is ready
  useEffect(() => {
    const words = mnemonic.trim().split(/\s+/).filter(Boolean);
    if (words.length < 12) return;

    // Store globally so VerifyMnemonicScreen can access without params
    tempMnemonicWords = words;

    const entrance = cellAnims.slice(0, words.length).map((anim) =>
      Animated.parallel([
        Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(anim.y, { toValue: 0, duration: 200, useNativeDriver: true }),
      ])
    );
    Animated.stagger(22, entrance).start();

    const delay = words.length * 22 + 100;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(wifAnim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(wifAnim.y, { toValue: 0, duration: 300, useNativeDriver: true }),
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

  function toggleWifReveal() {
    const next = !wifRevealed;
    setWifRevealed(next);
    Animated.timing(wifRevealAnim, {
      toValue: next ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  async function copyAllWords() {
    const words = mnemonic.trim().split(/\s+/).filter(Boolean);
    await Clipboard.setStringAsync(words.join(' '));
    toast.show('Recovery phrase copied', 'success');
  }

  async function proceedImport() {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast.show('Please enter 12 or 24 words', 'error');
      return;
    }
    setLoading(true);
    try {
      const seed = await bridge.mnemonicToSeed(mnemonic.trim(), '');
      const wif = await bridge.exportWif(seed, 0);
      const addr = await bridge.deriveAddress(seed, 0);
      await setSeedHex(seed);
      await setWif(wif);
      setAddress(addr);
      navigation.push('SecureWallet');
    } catch (e: any) {
      toast.show(e?.message ?? 'Failed to process mnemonic', 'error');
    } finally {
      setLoading(false);
    }
  }

  function proceedCreate() {
    navigation.push('VerifyMnemonic');
  }

  const words = mnemonic.trim().split(/\s+/).filter(Boolean);
  const canContinueCreate = isCreate && revealed && checked && !!wifPreview;
  const canContinueImport = !isCreate && mnemonic.trim().split(/\s+/).filter(Boolean).length >= 12;

  // Fog overlay: 1 = fully fogged, 0 = clear
  const overlayOpacity = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const wifOverlayOpacity = wifRevealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <StepDots total={6} current={2} />
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {isCreate ? 'Your Recovery Phrase' : 'Import Recovery Phrase'}
        </Text>
        <Text style={styles.subtitle}>
          {isCreate
            ? 'Write these 24 words down and keep them safe. They are the only way to recover your wallet.'
            : 'Enter your 12 or 24 word recovery phrase below.'}
        </Text>

        {/* ── CREATE MODE ── */}
        {isCreate && words.length >= 12 && (
          <>
            {/* 4-column grid (6 rows × 4 cols = 24) */}
            <View style={styles.grid}>
              {words.map((w, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.wordCell,
                    {
                      opacity: cellAnims[i]?.opacity ?? 1,
                      transform: [{ translateY: cellAnims[i]?.y ?? 0 }],
                    },
                  ]}
                >
                  <Text style={styles.wordNum}>{i + 1}</Text>
                  <Text style={styles.wordText} numberOfLines={1}>
                    {w}
                  </Text>
                  {/* Per-cell fog overlay */}
                  <Animated.View
                    style={[styles.cellFog, { opacity: overlayOpacity }]}
                    pointerEvents="none"
                  />
                </Animated.View>
              ))}
            </View>

            {/* Tap to reveal / hide */}
            <TouchableOpacity style={styles.revealRow} onPress={toggleReveal}>
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.revealText}>
                {revealed ? 'Hide phrase' : 'Tap to reveal phrase'}
              </Text>
            </TouchableOpacity>

            {/* Copy button (only after reveal) */}
            {revealed && (
              <TouchableOpacity style={styles.copyRow} onPress={copyAllWords}>
                <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                <Text style={styles.copyText}>Copy all words</Text>
              </TouchableOpacity>
            )}

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
              <Text style={styles.wifLabel}>Private Key (WIF)</Text>
              <Text style={styles.wifWarning}>
                Import this into any Irium-compatible wallet. Never share it.
              </Text>
              <View style={styles.wifBox}>
                <Text style={styles.wifText} selectable>
                  {wifPreview || '…'}
                </Text>
                <Animated.View
                  style={[styles.wifFog, { opacity: wifOverlayOpacity }]}
                  pointerEvents="none"
                />
              </View>
              <TouchableOpacity style={styles.revealRow} onPress={toggleWifReveal}>
                <Ionicons
                  name={wifRevealed ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color={Colors.primary}
                />
                <Text style={styles.revealText}>
                  {wifRevealed ? 'Hide key' : 'Tap to reveal key'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Checkbox */}
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setChecked((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>
                I have written these words and my private key down
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: 24 }}>
              <GradientBtn
                label="I've saved both — continue"
                onPress={proceedCreate}
                disabled={!canContinueCreate}
              />
            </View>
          </>
        )}

        {/* ── IMPORT MODE ── */}
        {!isCreate && (
          <>
            <TextInput
              style={styles.input}
              value={mnemonic}
              onChangeText={setMnemonic}
              placeholder="word1 word2 word3 ..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={5}
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <View style={{ marginTop: 24 }}>
              <GradientBtn
                label="Confirm Import"
                onPress={proceedImport}
                disabled={!canContinueImport}
                loading={loading}
              />
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  title: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 19,
  },
  // 4-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  wordCell: {
    // 4 columns: (100% - 3*gap) / 4. Using percentage:
    width: '23.5%',
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  wordNum: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontFamily: Fonts.regular,
    marginBottom: 2,
    lineHeight: 12,
  },
  wordText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: Fonts.semibold,
  },
  cellFog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.card,
    borderRadius: 8,
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  revealText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
  },
  copyText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  // WIF
  wifSection: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.warning,
    marginTop: 8,
    marginBottom: 8,
  },
  wifLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.semibold,
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
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  wifText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  wifFog: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  // Checkbox
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  // Import input
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 110,
  },
  // Gradient button
  btnGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.semibold,
    letterSpacing: 0.3,
  },
});
