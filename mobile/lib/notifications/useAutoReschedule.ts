import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { on } from '@/lib/events';

import { rescheduleAllAsync } from './scheduler';

/**
 * Reschedules notifications:
 *   - once on mount (after auth/db is ready — caller is responsible for gating
 *     the mount; this hook does not poll readiness),
 *   - on every `favorites:changed` event,
 *   - on every AppState 'active' (foreground) transition.
 *
 * The third trigger is the year-rollover safety net: a user who keeps the app
 * installed but only foregrounds it occasionally still gets their next-year
 * celebrations armed on every return to the app, without needing to mutate
 * favorites first.
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

    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active' && !cancelled) run();
    });

    return () => {
      cancelled = true;
      off();
      sub.remove();
    };
  }, []);
}
