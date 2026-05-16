import { useEffect, useRef } from 'react';
import { bridge } from '../bridge';
import { useWalletStore } from '../store/wallet';
import { useNodeStore } from '../store/node';

const POLL_MS = 10_000;

export function useBalance() {
  const { address, rpcUrl, authToken, setBalance, setUtxos, setHistory } = useWalletStore();
  const { touchRefresh } = useNodeStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!address || !rpcUrl) return;

    async function tick() {
      if (!address || !rpcUrl) return;
      try {
        const [bal, utxos, hist] = await Promise.all([
          bridge.rpcGetBalance(rpcUrl, authToken, address),
          bridge.rpcGetUtxos(rpcUrl, authToken, address),
          bridge.rpcGetHistory(rpcUrl, authToken, address),
        ]);
        setBalance(bal);
        setUtxos(utxos);
        setHistory(hist);
        touchRefresh();
      } catch {}
    }

    tick();
    timerRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [address, rpcUrl, authToken]);
}
