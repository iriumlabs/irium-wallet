import { useEffect, useRef } from 'react';
import { bridge } from '../bridge';
import { useNodeStore } from '../store/node';
import { useWalletStore } from '../store/wallet';

const POLL_MS = 10_000;

export function useSync() {
  const { rpcUrl, authToken } = useWalletStore();
  const { setSyncedHeight, setPeerCount, setIsSyncing, setNodeStatus, setFeeRate } = useNodeStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function tick() {
      try {
        setSyncedHeight(bridge.getSyncedHeight());
        setPeerCount(bridge.peerCount());
        setIsSyncing(bridge.isSyncing());
      } catch {}

      if (rpcUrl) {
        try {
          const [status, rate] = await Promise.all([
            bridge.rpcGetStatus(rpcUrl, authToken),
            bridge.rpcGetFeeRate(rpcUrl, authToken),
          ]);
          setNodeStatus(status);
          setFeeRate(rate);
        } catch {}
      }
    }

    tick();
    timerRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rpcUrl, authToken]);
}
