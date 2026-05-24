import { useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';

const POLL_MS = 10_000;

/**
 * Materialize the bundled assets/seedlist.txt onto a writable filesystem
 * path the Rust light client can use.
 *
 * Why this exists: Expo asset files are bundled INSIDE the APK, not on the
 * device filesystem. The Rust light_client.rs calls
 * std::fs::read_to_string(seedlist_path) which fails silently on the
 * bundled-asset URI. We copy the asset's content into the app's document
 * directory once, then pass that real path to Rust.
 *
 * Bonus: Rust's derive_runtime_path() takes the PARENT of seedlist_path
 * and writes seedlist.runtime there (gossip-discovered peers). By
 * materializing into documentDirectory, the runtime file lands at
 * documentDirectory + 'seedlist.runtime' — also writable, also persists
 * across app launches.
 */
async function materializeSeedlist(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/seedlist.txt'));
  await asset.downloadAsync();
  const docDir =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  if (!docDir) {
    throw new Error('no writable directory available');
  }
  const targetUri = `${docDir}seedlist.txt`;
  if (asset.localUri && asset.localUri !== targetUri) {
    const content = await FileSystem.readAsStringAsync(asset.localUri);
    await FileSystem.writeAsStringAsync(targetUri, content);
  }
  // Strip file:// — std::fs::read_to_string expects a plain filesystem
  // path, not a URI. Native platform paths like
  // /data/user/0/com.iriumlabs.wallet/files/seedlist.txt are what Rust
  // needs.
  return targetUri.replace(/^file:\/\//, '');
}

export function usePeers() {
  const { extraPeer } = useWalletStore();
  const { syncedHeight, setPeerCount } = useNodeStore();
  const [started, setStarted] = useState(false);
  // Surfaced (instead of swallowed) so the UI can show "P2P client failed
  // to start" with the actual reason instead of an indefinite "connecting"
  // spinner. Consumed by SettingsScreen / PeerIndicator in a follow-up.
  const [startError, setStartError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function start() {
      let seedlistPath: string;
      try {
        seedlistPath = await materializeSeedlist();
      } catch (e: any) {
        setStartError(`seedlist materialize failed: ${String(e?.message ?? e)}`);
        return;
      }
      try {
        await bridge.startLightClient({
          seedlist_path: seedlistPath,
          extra_peer: extraPeer,
          start_height: syncedHeight,
        });
        setStarted(true);
        setStartError(null);
      } catch (e: any) {
        // "already running" is not a real error: it just means another
        // mount already started the client (e.g. useEffect re-firing
        // when extraPeer changes via Settings, or PeersHost re-mounting
        // across splash → onboarding → main). Treat as success.
        const msg = String(e?.message ?? e);
        if (msg.toLowerCase().includes('already running')) {
          setStarted(true);
          setStartError(null);
        } else {
          setStartError(`light client failed to start: ${msg}`);
        }
      }
    }

    start();

    timerRef.current = setInterval(() => {
      try {
        setPeerCount(bridge.peerCount());
      } catch {}
    }, POLL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [extraPeer]);

  return { started, startError };
}
