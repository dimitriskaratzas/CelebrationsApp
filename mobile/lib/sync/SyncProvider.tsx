import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getSyncState } from '@/lib/db/sync-state';

import { flushOutbox, pendingCount, pull } from './engine';

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const syncNow = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsSyncing(true);
    setLastError(null);
    try {
      await flushOutbox();
      await pull();
      if (!mountedRef.current) return;
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      if (!mountedRef.current) return;
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      const n = await pendingCount();
      if (!mountedRef.current) return;
      setPending(n);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Hydrate the displayed last-sync from the persisted cursor so the Settings
    // screen doesn't show "Ποτέ" on every cold start before sync completes.
    (async () => {
      const persisted = await getSyncState('last_synced_at');
      if (mountedRef.current && persisted) setLastSyncedAt(persisted);
    })();

    syncNow();

    const netSub = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncNow();
    });

    const appSub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') syncNow();
    });

    return () => {
      mountedRef.current = false;
      netSub();
      appSub.remove();
    };
  }, [syncNow]);

  const value: SyncState = {
    isSyncing,
    pendingCount: pending,
    lastSyncedAt,
    lastError,
    syncNow,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
