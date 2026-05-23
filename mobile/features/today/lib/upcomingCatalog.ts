import { addDays, startOfDay } from 'date-fns';

import { CATALOG, type NamedayEntry } from '@/features/today/namedays/catalog';

import { namedayDateForYear } from './nextCelebration';

export interface CatalogDay {
  /** Local-date keyed at midnight. */
  date: Date;
  saints: NamedayEntry[];
}

// Returns the next `days` calendar days starting from `today + 1` that have at
// least one catalog entry. Today is intentionally excluded — the Hero already
// shows it, and the carousel exists to surface what's coming.
//
// Synaxis days can produce 10+ entries; we don't cap here. Callers (carousel
// cards) decide how many names to render and what "and N more" treatment to use.
export function upcomingCatalogDays(today: Date, days: number): CatalogDay[] {
  const todayStart = startOfDay(today);

  // Pre-compute catalog dates for this year and (potentially) next year so the
  // window can cross a year boundary cheaply.
  const thisYear = today.getFullYear();
  const nextYear = thisYear + 1;
  const byDateThis = bucketByDate(thisYear);
  const byDateNext = bucketByDate(nextYear);

  const out: CatalogDay[] = [];
  for (let i = 1; i <= days; i++) {
    const day = addDays(todayStart, i);
    const key = isoDateKey(day);
    const saints = (day.getFullYear() === thisYear ? byDateThis : byDateNext).get(key);
    if (saints && saints.length > 0) {
      out.push({ date: day, saints });
    }
  }
  return out;
}

// Local-date-stable key (YYYY-MM-DD). Avoids TZ shifts from `Date.toISOString()`
// (which serializes to UTC and can land on the previous/next calendar day
// for users in non-zero offsets, breaking React list `key` stability).
export function isoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bucketByDate(year: number): Map<string, NamedayEntry[]> {
  const map = new Map<string, NamedayEntry[]>();
  for (const entry of CATALOG) {
    const date = namedayDateForYear(entry, year);
    if (!date) continue;
    const key = isoDateKey(date);
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  }
  return map;
}
