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
      // Cap signal across two backend wire formats:
      //   - Legacy:        HTTP 402 + "{error: ...}" → last_error like "402:http_402: ..."
      //   - Hardened:      HTTP 403 + ProblemDetails code="FREE_TIER_CAP" → last_error contains the code
      const capReached = rows.some((r) => {
        const e = r.last_error;
        if (!e) return false;
        return e.startsWith('402') || e.includes('FREE_TIER_CAP');
      });
      setSummary({ capReached, totalStuck: rows.length });
    })();
  }, [pendingCount, isSyncing]);

  return summary;
}
