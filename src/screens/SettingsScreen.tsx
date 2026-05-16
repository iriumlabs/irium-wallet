import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';
import { GradientButton } from '../components/GradientButton';
import { Card } from '../components/Card';
import { AddressText } from '../components/AddressText';
import { PeerIndicator } from '../components/PeerIndicator';
import { Colors, Typography } from '../components/theme';

const APP_VERSION = '0.1.0';

export function SettingsScreen({ onLogout }: { onLogout: () => void }) {
  const { rpcUrl, authToken, extraPeer, address, seedHex, wif, setRpcUrl, setAuthToken, setExtraPeer, clear } = useWalletStore();
  const { nodeStatus, syncedHeight, peerCount, isSyncing } = useNodeStore();

  const [url, setUrl] = useState(rpcUrl);
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

  async function testRpc() {
    setTesting(true);
    setTestResult(null);
    try {
      const s = await bridge.rpcGetStatus(url.trim(), token.trim() || undefined);
      setTestResult(`Connected — block ${s.height.toLocaleString()}, ${s.peer_count} peers`);
      setTestOk(true);
    } catch (e: any) {
      setTestResult(`Failed: ${e.message ?? 'connection error'}`);
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setRpcUrl(url.trim());
    setAuthToken(token.trim() || undefined);
    setExtraPeer(peer.trim() || undefined);
    Alert.alert('Saved', 'Settings updated');
  }

  function confirmRevealSeed() {
    Alert.alert(
      'View recovery phrase',
      'Your 24-word recovery phrase gives full access to your wallet. Only view this in a private place.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Show phrase', onPress: () => { setPinTarget('seed'); setPinVisible(true); } },
      ],
    );
  }

  function confirmRevealWif() {
    Alert.alert(
      'View private key (WIF)',
      'Your WIF private key controls address #0. Keep it secret.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Show key', onPress: () => { setPinTarget('wif'); setPinVisible(true); } },
      ],
    );
  }

  function submitPin() {
    if (!pinInput.trim()) {
      Alert.alert('PIN required', 'Enter your PIN to continue');
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
    Alert.alert('Copied', 'Seed hex copied — keep it safe!');
  }

  async function copyWif() {
    if (!wif) return;
    await Clipboard.setStringAsync(wif);
    Alert.alert('Copied', 'WIF key copied — keep it secret!');
  }

  function confirmLogout() {
    Alert.alert(
      'Delete wallet',
      'This will erase your seed from this device. Make sure you have your recovery phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This action cannot be undone. Your funds will be unrecoverable without the phrase.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete permanently',
                  style: 'destructive',
                  onPress: async () => {
                    bridge.stopLightClient();
                    await clear();
                    onLogout();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[Typography.h2, { marginBottom: 20 }]}>Settings</Text>

        {/* Node status */}
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <Text style={[Typography.h3, { marginBottom: 4 }]}>Node status</Text>
          <StatusRow label="RPC height" value={nodeStatus ? nodeStatus.height.toLocaleString() : '—'} />
          <StatusRow label="SPV height" value={syncedHeight > 0 ? syncedHeight.toLocaleString() : '—'} />
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

        {/* RPC config */}
        <Card style={{ marginBottom: 16, gap: 14 }}>
          <Text style={Typography.h3}>RPC endpoint</Text>
          <LabeledInput label="URL" value={url} onChangeText={setUrl} placeholder="http://..." keyboardType="url" />
          <LabeledInput label="Auth token (optional)" value={token} onChangeText={setToken} placeholder="Bearer token" secure />
          <LabeledInput label="Extra P2P peer (optional)" value={peer} onChangeText={setPeer} placeholder="/ip4/1.2.3.4/tcp/38291" />

          {testResult !== null && (
            <View style={[styles.testResult, { backgroundColor: testOk ? '#001a10' : '#1a0000' }]}>
              <Text style={{ color: testOk ? Colors.success : Colors.error, fontSize: 13 }}>{testResult}</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.halfBtn, { borderColor: Colors.primary }]} onPress={testRpc} disabled={testing}>
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

        {/* Danger zone */}
        <Card style={{ borderColor: Colors.error }}>
          <Text style={[Typography.h3, { color: Colors.error, marginBottom: 8 }]}>Danger zone</Text>
          <Text style={[Typography.caption, { marginBottom: 16 }]}>
            Deleting the wallet removes your seed from this device. You need your 24-word phrase to recover.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmLogout}>
            <Text style={{ color: Colors.error, fontWeight: '700' }}>Delete wallet from device</Text>
          </TouchableOpacity>
        </Card>

        {/* Version */}
        <Text style={[Typography.caption, { textAlign: 'center', marginTop: 24 }]}>
          Irium Wallet v{APP_VERSION}
        </Text>
      </ScrollView>

      {/* Seed phrase modal */}
      {showSeed && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSeed(false)}>
          <View style={styles.seedOverlay}>
            <View style={styles.seedSheet}>
              <Text style={[Typography.h3, { marginBottom: 8 }]}>Recovery phrase (seed hex)</Text>
              <Text style={[Typography.caption, { marginBottom: 16, color: Colors.warning }]}>
                Never share this with anyone. Store offline.
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
    </SafeAreaView>
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
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60 },
  input: {
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14,
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
    backgroundColor: '#111111', borderRadius: 20, borderWidth: 1,
    borderColor: '#1F1F1F', padding: 24,
  },
  seedBox: {
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: Colors.warning,
  },
  pinInput: {
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14,
    color: Colors.text, fontSize: 20, borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', letterSpacing: 8,
  },
});
