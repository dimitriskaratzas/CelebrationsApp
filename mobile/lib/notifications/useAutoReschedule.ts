import { useEffect } from 'react';

import { on } from '@/lib/events';

import { rescheduleAllAsync } from './scheduler';

/**
 * Subscribes to favorite mutations and triggers a notification reschedule. Also
 * reschedules once on mount, so a fresh app launch re-arms notifications without
 * the user having to open Settings.
 *
 * Failures are swallowed — notifications are a best-effort enhancement; nothing
 * about the core sync flow depends on them.
 */
export function useAutoReschedule(): void {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      rescheduleAllAsync().catch(() => {
        // ignored — see header comment
      });
    };

    run();
    const off = on('favorites:changed', () => {
      if (!cancelled) run();
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);
}
