import { useEffect, useState } from 'react';

import { getDb } from '@/lib/db';
import { useSync } from '@/lib/sync/SyncProvider';

interface StuckSummary {
  capReached: boolean;
  totalStuck: number;
}

export function useStuckOutbox(): StuckSummary {
  const [summary, setSummary] = useState<StuckSummary>({ capReached: false, totalStuck: 0 });
  const { pendingCount, isSyncing } = useSync();

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<{ last_error: string | null }>(
        'SELECT last_error FROM outbox WHERE last_error IS NOT NULL',
      );
      const capReached = rows.some((r) => r.last_error?.startsWith('402'));
      setSummary({ capReached, totalStuck: rows.length });
    })();
  }, [pendingCount, isSyncing]);

  return summary;
}
