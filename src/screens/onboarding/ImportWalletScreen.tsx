import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TextInput, Animated,
  Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { StepDots } from '../../components/onboarding/StepDots';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { Colors, Fonts, GradientColors } from '../../components/theme';
import { useToast } from '../../components/Toast';

type Props = NativeStackScreenProps<OnboardingStackParams, 'ImportWallet'>;
type Tab = 'phrase' | 'wif' | 'file';

const TABS: { key: Tab; label: string; icon: keyof typeof import('@expo/vector-icons/build/Ionicons').default.glyphMap }[] = [
  { key: 'phrase', label: 'Seed Phrase',  icon: 'key-outline' },
  { key: 'wif',    label: 'WIF Key',      icon: 'finger-print-outline' },
  { key: 'file',   label: 'Backup File',  icon: 'document-text-outline' },
];

export function ImportWalletScreen({ navigation }: Props) {
  const toast = useToast();
  const { setSeedHex, setWif, setAddress } = useWalletStore();
  const [tab, setTab]         = useState<Tab>('phrase');
  const [phrase, setPhrase]   = useState('');
  const [wifInput, setWifInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filePicked, setFilePicked] = useState<string | null>(null);

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentY      = useRef(new Animated.Value(20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 60, useNativeDriver: true }),
      Animated.timing(contentY,       { toValue: 0, duration: 400, delay: 60, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importPhrase() {
    const trimmed = phrase.trim();
    const words   = trimmed.split(/\s+/).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) {
      toast.show('Please enter 12 or 24 words', 'error');
      return;
    }
    setLoading(true);
    try {
      const seed = await bridge.mnemonicToSeed(trimmed, '');
      const wif  = await bridge.exportWif(seed, 0);
      const addr = await bridge.deriveAddress(seed, 0);
      await setSeedHex(seed);
      await setWif(wif);
      setAddress(addr);
      navigation.push('SecureWallet');
    } catch (e: any) {
      toast.show(e?.message ?? 'Could not derive wallet from phrase', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function pickBackupFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setFilePicked(result.assets[0].name);

      const response = await fetch(result.assets[0].uri);
      const content  = await response.text();
      const json     = JSON.parse(content);
      if (!json || typeof json !== 'object') throw new Error('Invalid JSON');

      const importedSeed: string | undefined = json.seed_hex ?? json.seedHex;
      if (!importedSeed) {
        throw new Error('Backup file must contain "seed_hex"');
      }

      setLoading(true);
      const wif  = await bridge.exportWif(importedSeed, 0);
      const addr = await bridge.deriveAddress(importedSeed, 0);
      await setSeedHex(importedSeed);
      await setWif(wif);
      setAddress(addr);
      navigation.push('SecureWallet');
    } catch (e: any) {
      toast.show(e?.message ?? 'Could not read or parse file', 'error');
      setFilePicked(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <StepDots total={4} current={1} />
        </View>
        <View style={styles.backBtn} />
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }], flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.subtitle}>Restore an existing wallet using one of the methods below.</Text>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Ionicons name={t.icon} size={16} color={active ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tab contents */}
          {tab === 'phrase' && (
            <View style={styles.panel}>
              <Text style={styles.panelHeader}>24 or 12 word recovery phrase</Text>
              <TextInput
                style={styles.bigInput}
                value={phrase}
                onChangeText={setPhrase}
                placeholder="word1 word2 word3 ..."
                placeholderTextColor={Colors.textMuted}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
              />
              <Text style={styles.helper}>Words separated by spaces. Order matters.</Text>
            </View>
          )}

          {tab === 'wif' && (
            <View style={styles.panel}>
              <Text style={styles.panelHeader}>WIF Private Key</Text>
              <TextInput
                style={styles.bigInput}
                value={wifInput}
                onChangeText={setWifInput}
                placeholder="5HueCGU8r..."
                placeholderTextColor={Colors.textMuted}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
              />
              <Text style={[styles.helper, { color: Colors.warning }]}>
                WIF import is not supported yet. Use your 12 or 24-word recovery phrase instead.
              </Text>
            </View>
          )}

          {tab === 'file' && (
            <View style={styles.panel}>
              <Text style={styles.panelHeader}>Backup JSON file</Text>
              <Pressable onPress={pickBackupFile} style={styles.fileDropZone}>
                <Ionicons
                  name={filePicked ? 'checkmark-circle-outline' : 'cloud-upload-outline'}
                  size={36}
                  color={filePicked ? Colors.success : Colors.primary}
                />
                <Text style={styles.fileDropText}>
                  {filePicked ?? 'Tap to choose a .json backup'}
                </Text>
                <Text style={styles.helper}>Backup must contain a "seed_hex" field.</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* CTA */}
      <View style={styles.footer}>
        {tab !== 'file' && (
          <Pressable
            onPress={tab === 'phrase' ? importPhrase : undefined}
            disabled={loading || tab === 'wif'}
            style={({ pressed }) => [styles.gradWrap, { opacity: pressed ? 0.85 : (loading || tab === 'wif') ? 0.5 : 1 }]}
          >
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.gradText}>Import</Text>
              )}
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 24 },

  title:    { fontSize: 26, fontFamily: Fonts.bold, color: '#FFFFFF', marginTop: 8 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 8, marginBottom: 24, lineHeight: 21 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,15,32,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(123,47,255,0.18)',
    borderWidth: 1,
    borderColor: Colors.primary + '60',
  },
  tabLabel: { color: Colors.textSecondary, fontFamily: Fonts.semiBold, fontSize: 12 },
  tabLabelActive: { color: Colors.primary },

  panel: {
    backgroundColor: 'rgba(10,10,26,0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    gap: 10,
  },
  panelHeader: {
    color: Colors.textSecondary,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bigInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: Fonts.regular,
    minHeight: 120,
  },
  helper: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },

  fileDropZone: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary + '60',
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  fileDropText: {
    color: Colors.textPrimary,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },

  footer: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  gradWrap: { borderRadius: 14, overflow: 'hidden' },
  gradBtn:  { paddingVertical: 16, alignItems: 'center' },
  gradText: { color: '#FFFFFF', fontFamily: Fonts.semiBold, fontSize: 16, letterSpacing: 0.3 },
});
