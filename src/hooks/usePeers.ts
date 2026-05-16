import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';

const POLL_MS = 10_000;

export function usePeers() {
  const { extraPeer } = useWalletStore();
  const { syncedHeight, setPeerCount } = useNodeStore();
  const [started, setStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function start() {
      try {
        await bridge.startLightClient({
          seedlist_path: 'assets/seedlist.txt',
          extra_peer: extraPeer,
          start_height: syncedHeight,
        });
        setStarted(true);
      } catch {}
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

  return { started };
}
