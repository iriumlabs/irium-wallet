import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Modal, ActivityIndicator,
  FlatList, Pressable, Animated,
} from 'react-native';
import { useScreenEnter } from '../hooks/useScreenEnter';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { AddressText } from '../components/AddressText';
import { PeerIndicator } from '../components/PeerIndicator';
import { Colors, Typography, Fonts } from '../components/theme';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

const AUTH_METHOD_KEY = 'irium_auth_method';
const AUTH_PIN_KEY    = 'irium_auth_pin';
const THEME_KEY       = 'irium_theme';

type AuthMethod = 'none' | 'pin' | 'biometric';
type ThemeKey   = 'dark' | 'darker' | 'purple';

const APP_VERSION = '0.1.0';
const NETWORK = 'Mainnet';
const TOTAL_SUPPLY = '100,000,000 IRM';
const NEXT_HALVING = 'Block #50,000';

export function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const enterStyle = useScreenEnter();
  const { rpcUrl, authToken, extraPeer, address, seedHex, wif, balance, setRpcUrl, setAuthToken, setExtraPeer, clear } = useWalletStore();
  const { nodeStatus, syncedHeight, peerCount, isSyncing } = useNodeStore();

  const [url, setUrl] = useState(rpcUrl ?? '');
  const [token, setToken] = useState(authToken ?? '');
  const [peer, setPeer] = useState(extraPeer ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showWif, setShowWif] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinVisible, setPinVisible] = useState(false);
  const [pinTarget, setPinTarget] = useState<'seed' | 'wif'>('seed');

  // Wallet management state
  const [allAddresses, setAllAddresses]       = useState<string[]>([]);
  const [derivingAll, setDerivingAll]         = useState(false);
  const [addrSheetVisible, setAddrSheetVisible] = useState(false);
  const [importMode, setImportMode]           = useState<'seed' | 'wif' | null>(null);
  const [importInput, setImportInput]         = useState('');
  const [importLoading, setImportLoading]     = useState(false);

  // Create-new-address modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createIndex, setCreateIndex]               = useState(0);
  const [createAddr, setCreateAddr]                 = useState('');
  const [createWif, setCreateWif]                   = useState('');
  const [createWifRevealed, setCreateWifRevealed]   = useState(false);
  const [createSavedConfirmed, setCreateSavedConfirmed] = useState(false);
  const [createLoading, setCreateLoading]           = useState(false);

  // Import-from-file state
  const [importingFile, setImportingFile] = useState(false);

  // Security state
  const [authMethod, setAuthMethodState]      = useState<AuthMethod>('none');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [changePinVisible, setChangePinVisible] = useState(false);
  const [newPin, setNewPin]                   = useState('');
  const [confirmPin, setConfirmPin]           = useState('');
  const [pinStep, setPinStep]                 = useState<'new' | 'confirm'>('new');

  // Theme state
  const [activeTheme, setActiveTheme]         = useState<ThemeKey>('dark');

  // Category C confirmation modals
  const [confirmSeedVisible, setConfirmSeedVisible]     = useState(false);
  const [confirmWifVisible, setConfirmWifVisible]       = useState(false);
  const [removeAddressTarget, setRemoveAddressTarget]   = useState<number | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  useEffect(() => {
    // Load auth method
    SecureStore.getItemAsync(AUTH_METHOD_KEY).then((v) => {
      if (v === 'pin' || v === 'biometric') setAuthMethodState(v);
    }).catch(() => {});

    // Load theme
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'darker' || v === 'purple') setActiveTheme(v as ThemeKey);
    }).catch(() => {});

    // Check biometric hardware
    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (!has) return;
      LocalAuthentication.isEnrolledAsync().then((enrolled) => setBiometricAvailable(enrolled));
    }).catch(() => {});
  }, []);

  async function testRpc() {
    setTesting(true);
    setTestResult(null);
    try {
      const s = await bridge.rpcGetStatus(url.trim(), token.trim() || undefined);
      setTestResult(`Node reachable · block ${s.height.toLocaleString()}`);
      setTestOk(true);
    } catch (e: any) {
      setTestResult(`Failed: ${e.message ?? 'connection error'}`);
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setRpcUrl(url.trim() || null);
    setAuthToken(token.trim() || undefined);
    setExtraPeer(peer.trim() || undefined);
    toast.show(
      url.trim() ? 'Node saved' : 'Node settings removed',
      'success',
    );
  }

  function confirmRevealSeed() {
    setConfirmSeedVisible(true);
  }

  function confirmRevealWif() {
    setConfirmWifVisible(true);
  }

  function submitPin() {
    if (!pinInput.trim()) {
      toast.show('Enter your PIN to continue', 'error');
      return;
    }
    setPinVisible(false);
    setPinInput('');
    if (pinTarget === 'seed') setShowSeed(true);
    else setShowWif(true);
  }

  async function copySeed() {
    if (!seedHex) return;
    await Clipboard.setStringAsync(seedHex);
    toast.show('Seed hex copied — keep it safe', 'success');
  }

  async function copyWif() {
    if (!wif) return;
    await Clipboard.setStringAsync(wif);
    toast.show('WIF key copied — keep it secret', 'success');
  }

  // ── Wallet management ──────────────────────────────────────────────────────

  async function openAllAddresses() {
    if (!seedHex) return;
    setAddrSheetVisible(true);
    if (allAddresses.length > 0) return;
    setDerivingAll(true);
    try {
      // Limit to 20 addresses max
      const addrs = await Promise.all(
        Array.from({ length: 20 }, (_, i) => bridge.deriveAddress(seedHex, i))
      );
      setAllAddresses(addrs);
    } catch (e: any) {
      toast.show(e?.message ?? 'Failed to derive addresses', 'error');
    } finally {
      setDerivingAll(false);
    }
  }

  function confirmDeleteAddress(index: number) {
    if (index === 0) {
      toast.show('Primary address (#0) cannot be deleted', 'error');
      return;
    }
    const { addressIndex } = useWalletStore.getState();
    const isActive = index === addressIndex;
    const activeHasBalance = isActive && (balance?.confirmed ?? 0) > 0;
    if (activeHasBalance) {
      toast.show(
        `Address has a balance of ${((balance?.confirmed ?? 0) / 1e8).toFixed(8)} IRM — move funds out first`,
        'error',
      );
      return;
    }
    setRemoveAddressTarget(index);
  }

  async function openCreateNewAddress() {
    if (!seedHex) return;
    const { addressIndex } = useWalletStore.getState();
    const nextIndex = addressIndex + 1;
    setCreateIndex(nextIndex);
    setCreateAddr('');
    setCreateWif('');
    setCreateWifRevealed(false);
    setCreateSavedConfirmed(false);
    setCreateLoading(true);
    setCreateModalVisible(true);
    try {
      const [addr, wifKey] = await Promise.all([
        bridge.deriveAddress(seedHex, nextIndex),
        bridge.exportWif(seedHex, nextIndex),
      ]);
      setCreateAddr(addr);
      setCreateWif(wifKey);
    } catch (e: any) {
      toast.show(e?.message ?? 'Failed to derive address', 'error');
      setCreateModalVisible(false);
    } finally {
      setCreateLoading(false);
    }
  }

  function confirmAddNewAddress() {
    if (!createSavedConfirmed || !createAddr) return;
    const { setAddressIndex, setAddress } = useWalletStore.getState();
    setAddressIndex(createIndex);
    setAddress(createAddr);
    setCreateModalVisible(false);
    // Reset cached list so the next "View All" re-derives
    setAllAddresses([]);
    toast.show(`Address #${createIndex} is now active`, 'success');
  }

  async function importFromBackupFile() {
    setImportingFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      // Read the file via fetch on the file:// URI
      const response = await fetch(result.assets[0].uri);
      const content = await response.text();
      const json = JSON.parse(content);
      if (!json || typeof json !== 'object') throw new Error('Invalid JSON');
      const importedSeed: string | undefined = json.seed_hex ?? json.seedHex;
      const importedAddresses: string[] = Array.isArray(json.addresses) ? json.addresses : [];
      if (!importedSeed && importedAddresses.length === 0) {
        throw new Error('No seed_hex or addresses found in file');
      }
      if (importedSeed) {
        const { setSeedHex, setAddress } = useWalletStore.getState();
        await setSeedHex(importedSeed);
        const addr = await bridge.deriveAddress(importedSeed, 0);
        setAddress(addr);
      }
      toast.show(
        importedSeed
          ? `Wallet restored${importedAddresses.length > 0 ? ` — ${importedAddresses.length} addresses found` : ''}`
          : `${importedAddresses.length} addresses found in backup`,
        'success',
      );
      setAllAddresses([]);
    } catch (e: any) {
      toast.show(e?.message ?? 'Could not read or parse file', 'error');
    } finally {
      setImportingFile(false);
    }
  }

  async function submitImport() {
    if (!importInput.trim()) return;
    setImportLoading(true);
    try {
      if (importMode === 'seed') {
        // Treat input as seed hex (64 chars) or mnemonic
        const trimmed = importInput.trim();
        const { setSeedHex } = useWalletStore.getState();
        await setSeedHex(trimmed);
        const addr = await bridge.deriveAddress(trimmed, 0);
        useWalletStore.getState().setAddress(addr);
        toast.show('Wallet imported via seed hex', 'success');
      } else {
        toast.show('WIF import coming soon', 'info');
      }
      setImportMode(null);
      setImportInput('');
    } catch (e: any) {
      toast.show(e?.message ?? 'Invalid input', 'error');
    } finally {
      setImportLoading(false);
    }
  }

  // ── Security ───────────────────────────────────────────────────────────────

  async function enableBiometric() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable biometric lock',
    });
    if (result.success) {
      await SecureStore.setItemAsync(AUTH_METHOD_KEY, 'biometric');
      setAuthMethodState('biometric');
      toast.show('Biometric lock enabled', 'success');
    } else {
      toast.show('Authentication failed — biometric lock not enabled', 'error');
    }
  }

  async function selectAuthMethod(method: AuthMethod) {
    if (method === 'biometric') {
      await enableBiometric();
      return;
    }
    if (method === 'pin') {
      setPinStep('new');
      setNewPin('');
      setConfirmPin('');
      setChangePinVisible(true);
      return;
    }
    // none
    await SecureStore.deleteItemAsync(AUTH_METHOD_KEY);
    await SecureStore.deleteItemAsync(AUTH_PIN_KEY);
    setAuthMethodState('none');
    toast.show('App lock removed', 'info');
  }

  async function savePin() {
    if (pinStep === 'new') {
      if (newPin.length < 4) { toast.show('PIN must be at least 4 digits', 'error'); return; }
      setPinStep('confirm');
      return;
    }
    if (confirmPin !== newPin) {
      toast.show('PINs do not match', 'error');
      setConfirmPin('');
      return;
    }
    await SecureStore.setItemAsync(AUTH_PIN_KEY, newPin);
    await SecureStore.setItemAsync(AUTH_METHOD_KEY, 'pin');
    setAuthMethodState('pin');
    setChangePinVisible(false);
    setNewPin('');
    setConfirmPin('');
    setPinStep('new');
    toast.show('PIN lock enabled', 'success');
  }

  // ── Themes ─────────────────────────────────────────────────────────────────

  async function selectTheme(t: ThemeKey) {
    setActiveTheme(t);
    await AsyncStorage.setItem(THEME_KEY, t);
    toast.show('Theme saved — restart to apply', 'info');
  }

  function confirmLogout() {
    setConfirmDeleteVisible(true);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <Animated.View style={enterStyle}>
      <ScrollView contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.h2, { marginBottom: 20 }]}>Settings</Text>

        {/* Node status */}
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <Text style={[Typography.h3, { marginBottom: 4 }]}>Node status</Text>
          <StatusRow label="Node height" value={nodeStatus ? nodeStatus.height.toLocaleString() : '—'} />
          <StatusRow label="Network height" value={syncedHeight > 0 ? syncedHeight.toLocaleString() : '—'} />
          <StatusRow label="Tip" value={nodeStatus ? nodeStatus.tip_hash.slice(0, 16) + '…' : '—'} mono />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Typography.caption}>Network</Text>
            <PeerIndicator count={peerCount} syncing={isSyncing} />
          </View>
        </Card>

        {/* My address */}
        {address && (
          <Card style={{ marginBottom: 16, gap: 8 }}>
            <Text style={[Typography.h3, { marginBottom: 4 }]}>My address</Text>
            <AddressText address={address} truncate={false} />
          </Card>
        )}

        {/* Advanced */}
        <Card style={{ marginBottom: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={Typography.h3}>Advanced</Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: rpcUrl ? Colors.success + '22' : Colors.textMuted + '22',
              }}
            >
              <Text
                style={{
                  color: rpcUrl ? Colors.success : Colors.textMuted,
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                {rpcUrl ? 'Active' : 'Not configured'}
              </Text>
            </View>
          </View>
          <Text style={[Typography.caption, { marginTop: -4 }]}>
            The wallet connects to the Irium network automatically. Only configure this
            if you run your own node.
          </Text>
          <LabeledInput
            label="Node URL (optional)"
            value={url}
            onChangeText={setUrl}
            placeholder="http://my-node.example.com:38300"
            keyboardType="url"
          />
          <LabeledInput label="Auth token (optional)" value={token} onChangeText={setToken} placeholder="Bearer token" secure />
          <LabeledInput
            label="Extra P2P peer (optional)"
            value={peer}
            onChangeText={setPeer}
            placeholder="/ip4/1.2.3.4/tcp/38291"
          />

          {testResult !== null && (
            <View style={[styles.testResult, { backgroundColor: testOk ? '#001a10' : '#1a0000' }]}>
              <Text style={{ color: testOk ? Colors.success : Colors.error, fontSize: 13 }}>{testResult}</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.halfBtn, { borderColor: Colors.primary }, !url.trim() && { opacity: 0.4 }]}
              onPress={testRpc}
              disabled={testing || !url.trim()}
            >
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>{testing ? 'Testing…' : 'Test'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={save}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Security */}
        <Card style={{ marginBottom: 16, gap: 12 }}>
          <Text style={Typography.h3}>Security</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={confirmRevealSeed}>
            <Text style={{ color: Colors.warning, fontWeight: '600' }}>View recovery phrase (24 words)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={confirmRevealWif}>
            <Text style={{ color: Colors.warning, fontWeight: '600' }}>View private key (WIF)</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Wallet Management ── */}
        <Card style={{ marginBottom: 16, gap: 12 }}>
          <Text style={Typography.h3}>Wallet Management</Text>
          <SettingsRow icon="add-circle-outline" label="Create New Address" onPress={openCreateNewAddress} />
          <SettingsRow icon="list-outline" label="View All Addresses" onPress={openAllAddresses} />
          <SettingsRow
            icon="document-text-outline"
            label={importingFile ? 'Reading file…' : 'Import from Backup File'}
            onPress={importFromBackupFile}
          />
          <SettingsRow icon="key-outline" label="Import via Seed Hex" onPress={() => { setImportMode('seed'); setImportInput(''); }} color={Colors.warning} />
          <SettingsRow icon="log-in-outline" label="Import via WIF Key" onPress={() => { setImportMode('wif'); setImportInput(''); }} color={Colors.warning} />
        </Card>

        {/* ── Security ── */}
        <Card style={{ marginBottom: 16, gap: 12 }}>
          <Text style={Typography.h3}>App Lock</Text>
          <View style={styles.authRow}>
            {(['none', 'pin', 'biometric'] as AuthMethod[]).map((m) => {
              const labels: Record<AuthMethod, string> = { none: 'None', pin: 'PIN', biometric: 'Biometric' };
              const icons: Record<AuthMethod, keyof typeof Ionicons.glyphMap> = {
                none: 'lock-open-outline', pin: 'keypad-outline', biometric: 'finger-print-outline',
              };
              const active = authMethod === m;
              const disabled = m === 'biometric' && !biometricAvailable;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.authOption, active && styles.authOptionActive, disabled && { opacity: 0.4 }]}
                  onPress={() => !disabled && selectAuthMethod(m)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={icons[m]} size={18} color={active ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.authOptionText, active && { color: Colors.primary }]}>{labels[m]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {authMethod === 'pin' && (
            <SettingsRow icon="create-outline" label="Change PIN" onPress={() => { setPinStep('new'); setNewPin(''); setConfirmPin(''); setChangePinVisible(true); }} />
          )}
        </Card>

        {/* ── Themes ── */}
        <Card style={{ marginBottom: 16, gap: 12 }}>
          <Text style={Typography.h3}>Theme</Text>
          <Text style={[Typography.caption, { marginTop: -4 }]}>Changes take effect on restart</Text>
          <View style={styles.themeRow}>
            {([
              { key: 'dark',   label: 'Dark',   dot: '#141414' },
              { key: 'darker', label: 'Darker',  dot: '#000000' },
              { key: 'purple', label: 'Purple',  dot: '#5B00CC' },
            ] as { key: ThemeKey; label: string; dot: string }[]).map((t) => {
              const active = activeTheme === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  onPress={() => selectTheme(t.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.themeDot, { backgroundColor: t.dot }]} />
                  <Text style={[styles.themeLabel, active && { color: Colors.primary }]}>{t.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Danger zone */}
        <Card style={{ borderColor: Colors.error, marginBottom: 16 }}>
          <Text style={[Typography.h3, { color: Colors.error, marginBottom: 8 }]}>Danger zone</Text>
          <Text style={[Typography.caption, { marginBottom: 16 }]}>
            Deleting the wallet removes your seed from this device. You need your 24-word phrase to recover.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmLogout}>
            <Text style={{ color: Colors.error, fontWeight: '700' }}>Delete wallet from device</Text>
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <Text style={[Typography.h3, { marginBottom: 4 }]}>About</Text>
          <StatusRow label="App version" value={APP_VERSION} />
          <StatusRow label="Network" value={NETWORK} />
          <StatusRow label="Total supply" value={TOTAL_SUPPLY} />
          <StatusRow label="Next halving" value={NEXT_HALVING} />
        </Card>

        {/* Version */}
        <Text style={[Typography.caption, { textAlign: 'center', marginTop: 8 }]}>
          Irium Wallet v{APP_VERSION}
        </Text>
      </ScrollView>
      </Animated.View>

      {/* Seed phrase modal */}
      {showSeed && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSeed(false)}>
          <View style={styles.seedOverlay}>
            <View style={styles.seedSheet}>
              <Text style={[Typography.h3, { marginBottom: 8 }]}>Recovery seed (hex)</Text>
              <Text style={[Typography.caption, { marginBottom: 4, color: Colors.warning }]}>
                Store this hex safely — never share it.
              </Text>
              <Text style={[Typography.caption, { marginBottom: 16, color: Colors.textSecondary }]}>
                This is your raw seed entropy. Keep it offline.
              </Text>
              <View style={styles.seedBox}>
                <Text style={[Typography.mono, { fontSize: 11, lineHeight: 18 }]} selectable>
                  {seedHex ?? 'No seed found'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.warning, flex: 1 }]} onPress={copySeed}>
                  <Text style={{ color: Colors.warning, fontWeight: '600' }}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.border, flex: 1 }]} onPress={() => setShowSeed(false)}>
                  <Text style={{ color: Colors.text, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* WIF key modal */}
      {showWif && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowWif(false)}>
          <View style={styles.seedOverlay}>
            <View style={styles.seedSheet}>
              <Text style={[Typography.h3, { marginBottom: 8 }]}>Private key (WIF)</Text>
              <Text style={[Typography.caption, { marginBottom: 16, color: Colors.warning }]}>
                This key controls address #0. Never share it. Store offline.
              </Text>
              <View style={styles.seedBox}>
                <Text style={[Typography.mono, { fontSize: 11, lineHeight: 18 }]} selectable>
                  {wif ?? 'No WIF key found'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.warning, flex: 1 }]} onPress={copyWif}>
                  <Text style={{ color: Colors.warning, fontWeight: '600' }}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.border, flex: 1 }]} onPress={() => setShowWif(false)}>
                  <Text style={{ color: Colors.text, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Create New Address modal */}
      <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.seedOverlay}>
          <View style={[styles.seedSheet, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
              <Text style={Typography.h3}>New Address</Text>
            </View>
            <Text style={Typography.caption}>
              This will derive address #{createIndex} from your seed phrase.
            </Text>

            {createLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
            ) : (
              <>
                {/* Amber warning box */}
                <View style={styles.warnBox}>
                  <Ionicons name="warning-outline" size={18} color={Colors.warning} style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.warnText}>
                    Save both your address and WIF key. If you lose your seed phrase, you will need the WIF key to recover funds sent to this address.
                  </Text>
                </View>

                {/* Address section */}
                <View style={styles.kvSection}>
                  <Text style={styles.kvLabel}>ADDRESS</Text>
                  <Text style={styles.kvValue} selectable numberOfLines={1}>{createAddr}</Text>
                  <TouchableOpacity
                    style={styles.copyChip}
                    onPress={async () => { await Clipboard.setStringAsync(createAddr); toast.show('Address copied', 'success'); }}
                  >
                    <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                    <Text style={styles.copyChipText}>Copy</Text>
                  </TouchableOpacity>
                </View>

                {/* WIF section */}
                <View style={styles.kvSection}>
                  <Text style={styles.kvLabel}>WIF KEY</Text>
                  <Text style={[styles.kvValue, !createWifRevealed && styles.kvBlurred]} selectable numberOfLines={1}>
                    {createWifRevealed ? createWif : '•'.repeat(Math.max(20, createWif.length))}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.copyChip}
                      onPress={() => setCreateWifRevealed((v) => !v)}
                    >
                      <Ionicons name={createWifRevealed ? 'eye-off-outline' : 'eye-outline'} size={14} color={Colors.primary} />
                      <Text style={styles.copyChipText}>{createWifRevealed ? 'Hide' : 'Reveal'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.copyChip}
                      onPress={async () => { await Clipboard.setStringAsync(createWif); toast.show('WIF key copied — keep it secret', 'success'); }}
                    >
                      <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                      <Text style={styles.copyChipText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setCreateSavedConfirmed((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, createSavedConfirmed && styles.checkboxChecked]}>
                    {createSavedConfirmed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkText}>I have saved both my address and WIF key</Text>
                </TouchableOpacity>

                {/* Action buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.halfBtn, { borderColor: Colors.border }]}
                    onPress={() => setCreateModalVisible(false)}
                  >
                    <Text style={{ color: Colors.text, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.halfBtn,
                      {
                        backgroundColor: createSavedConfirmed ? Colors.primary : Colors.border,
                        borderColor: createSavedConfirmed ? Colors.primary : Colors.border,
                        opacity: createSavedConfirmed ? 1 : 0.5,
                      },
                    ]}
                    onPress={confirmAddNewAddress}
                    disabled={!createSavedConfirmed}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Add to Wallet</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* All addresses sheet */}
      <Modal visible={addrSheetVisible} transparent animationType="slide" onRequestClose={() => setAddrSheetVisible(false)}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={styles.sheetOverlay} onPress={() => setAddrSheetVisible(false)}>
          {/* Sheet — swallow taps so they don't propagate to backdrop */}
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={Typography.h3}>All Addresses</Text>
              <TouchableOpacity
                onPress={() => setAddrSheetVisible(false)}
                style={styles.sheetCloseX}
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[Typography.caption, { marginBottom: 12 }]}>
              Showing first {allAddresses.length} addresses
            </Text>
            {derivingAll ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
            ) : (
              <FlatList
                data={allAddresses}
                keyExtractor={(_, i) => `addr-${i}`}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 420 }}
                bounces={false}
                renderItem={({ item: addr, index: i }) => {
                  const isPrimary = i === 0;
                  return (
                    <View style={styles.addrSheetRow}>
                      <Text style={styles.addrSheetIdx}>#{i}</Text>
                      <Text style={styles.addrSheetText} numberOfLines={1}>{addr}</Text>
                      <TouchableOpacity
                        onPress={async () => { await Clipboard.setStringAsync(addr); toast.show(`Address #${i} copied`, 'success'); }}
                        style={styles.addrRowIconBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDeleteAddress(i)}
                        style={[styles.addrRowIconBtn, isPrimary && { opacity: 0.3 }]}
                        hitSlop={8}
                        disabled={isPrimary}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Import modal */}
      <Modal visible={importMode !== null} transparent animationType="fade" onRequestClose={() => setImportMode(null)}>
        <View style={styles.seedOverlay}>
          <View style={[styles.seedSheet, { gap: 16 }]}>
            <Text style={Typography.h3}>
              {importMode === 'seed' ? 'Import via Seed Hex' : 'Import via WIF Key'}
            </Text>
            <Text style={Typography.caption}>
              {importMode === 'seed'
                ? 'Paste your 64-character seed hex (entropy). This will replace your current wallet.'
                : 'Paste your WIF private key.'}
            </Text>
            <TextInput
              style={styles.input}
              value={importInput}
              onChangeText={setImportInput}
              placeholder={importMode === 'seed' ? '64-char hex…' : 'WIF key…'}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            {importLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.border }]} onPress={() => { setImportMode(null); setImportInput(''); }}>
                  <Text style={{ color: Colors.text, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.halfBtn, { backgroundColor: Colors.warning, borderColor: Colors.warning }]} onPress={submitImport}>
                  <Text style={{ color: '#000', fontWeight: '700' }}>Import</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Change PIN modal */}
      <Modal visible={changePinVisible} transparent animationType="fade" onRequestClose={() => setChangePinVisible(false)}>
        <View style={styles.seedOverlay}>
          <View style={[styles.seedSheet, { gap: 16 }]}>
            <Text style={Typography.h3}>{pinStep === 'new' ? 'Set PIN' : 'Confirm PIN'}</Text>
            <Text style={Typography.caption}>
              {pinStep === 'new' ? 'Enter a 4-6 digit PIN' : 'Enter the same PIN again'}
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinStep === 'new' ? newPin : confirmPin}
              onChangeText={pinStep === 'new' ? setNewPin : setConfirmPin}
              placeholder="••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
            <GradientButton label={pinStep === 'new' ? 'Next' : 'Confirm'} onPress={savePin} />
            <TouchableOpacity onPress={() => setChangePinVisible(false)} style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN modal */}
      <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={() => setPinVisible(false)}>
        <View style={styles.seedOverlay}>
          <View style={[styles.seedSheet, { gap: 16 }]}>
            <Text style={Typography.h3}>Confirm identity</Text>
            <Text style={Typography.caption}>
              {pinTarget === 'seed' ? 'Enter your PIN to view the recovery phrase' : 'Enter your PIN to view the private key'}
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="PIN"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              keyboardType="numeric"
              autoFocus
            />
            <GradientButton label="Confirm" onPress={submitPin} />
            <TouchableOpacity onPress={() => setPinVisible(false)} style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Category C confirmation modals ── */}
      <ConfirmModal
        visible={confirmSeedVisible}
        title="View recovery phrase"
        body="Your recovery phrase gives full access to your wallet. Only view this in a private place."
        confirmLabel="Show phrase"
        warning
        onConfirm={() => {
          setConfirmSeedVisible(false);
          setPinTarget('seed');
          setPinVisible(true);
        }}
        onCancel={() => setConfirmSeedVisible(false)}
      />

      <ConfirmModal
        visible={confirmWifVisible}
        title="View private key (WIF)"
        body="Your private key gives full control of your funds. Only view this in a private place."
        confirmLabel="Show key"
        warning
        onConfirm={() => {
          setConfirmWifVisible(false);
          setPinTarget('wif');
          setPinVisible(true);
        }}
        onCancel={() => setConfirmWifVisible(false)}
      />

      <ConfirmModal
        visible={removeAddressTarget !== null}
        title="Remove address"
        body={
          removeAddressTarget !== null
            ? `Remove address #${removeAddressTarget}? This address will no longer appear in your wallet.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          const idx = removeAddressTarget;
          if (idx === null) return;
          const { addressIndex, setAddressIndex, setAddress } = useWalletStore.getState();
          const wasActive = idx === addressIndex;
          setAllAddresses((prev) => prev.filter((_, i) => i !== idx));
          if (wasActive) {
            setAddressIndex(0);
            if (allAddresses[0]) setAddress(allAddresses[0]);
          }
          setRemoveAddressTarget(null);
        }}
        onCancel={() => setRemoveAddressTarget(null)}
      />

      <ConfirmModal
        visible={confirmDeleteVisible}
        title="Delete wallet"
        body="This permanently removes your wallet from this device. You will need your recovery phrase to restore it."
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        destructive
        checkConfirm
        checkLabel="I have saved my recovery phrase"
        dismissOnBackdrop={false}
        onConfirm={async () => {
          bridge.stopLightClient();
          await clear();
          setConfirmDeleteVisible(false);
          onLogout();
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </SafeAreaView>
  );
}

function SettingsRow({
  icon, label, onPress, color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={color ?? Colors.textSecondary} style={{ marginRight: 10 }} />
      <Text style={[styles.settingsRowText, color ? { color } : {}]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function LabeledInput({
  label, value, onChangeText, placeholder, secure, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; secure?: boolean; keyboardType?: 'url';
}) {
  return (
    <View>
      <Text style={[Typography.caption, { marginBottom: 4 }]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        placeholderTextColor={Colors.textMuted}
        placeholder={placeholder}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

function StatusRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={Typography.caption}>{label}</Text>
      <Text style={[mono ? { fontFamily: 'monospace', fontSize: 11 } : Typography.body, { color: Colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingBottom: 60 },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, padding: 14,
    color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  halfBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: 'center',
  },
  testResult: { borderRadius: 8, padding: 10 },
  actionBtn: {
    borderWidth: 1, borderColor: Colors.warning, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtn: {
    borderWidth: 1, borderColor: Colors.error, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  seedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  seedSheet: {
    backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1,
    borderColor: Colors.border, padding: 24,
  },
  seedBox: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: Colors.warning,
  },
  pinInput: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 14,
    color: Colors.text, fontSize: 20, borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', letterSpacing: 8,
  },

  // Settings rows
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingsRowText: {
    flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text,
  },

  // Auth method selector
  authRow: { flexDirection: 'row', gap: 8 },
  authOption: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.background,
  },
  authOptionActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + '14',
  },
  authOptionText: {
    fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary,
  },

  // Theme selector
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 6,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.background,
  },
  themeOptionActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + '14',
  },
  themeDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  themeLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary },

  // Address sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, padding: 20,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  addrSheetRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  addrSheetIdx: {
    color: Colors.textSecondary, fontSize: 12, fontFamily: Fonts.semiBold, width: 28, textAlign: 'center',
  },
  addrSheetText: {
    flex: 1, fontFamily: 'monospace', fontSize: 11, color: Colors.text,
  },
  addrRowIconBtn: { padding: 6 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetCloseX: {
    padding: 4,
  },

  // Create New Address modal pieces
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a1a00',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warnText: {
    flex: 1,
    color: Colors.warning,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  kvSection: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  kvLabel: {
    color: Colors.textSecondary,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  kvValue: {
    color: Colors.text,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  kvBlurred: {
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primary + '14',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignSelf: 'flex-start',
  },
  copyChipText: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkText: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
});
