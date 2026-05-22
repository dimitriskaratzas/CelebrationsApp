import { differenceInCalendarDays, isAfter, startOfDay } from 'date-fns';

import type { Favorite } from '@/features/favorites/db/favorites.repo';
import { findByKey, type NamedayEntry } from '@/features/today/namedays/catalog';
import { resolveEasterOffsetCelebrations } from '@/features/today/namedays/easter';

export type CelebrationKind = 'nameday' | 'birthday';

export interface CelebrationDate {
  date: Date;
  kind: CelebrationKind;
  /** Greek primary form ("Γιώργος") for nameday matches, otherwise undefined. */
  primaryForm?: string;
  /** Saint name for nameday matches. */
  saint?: string;
  /** Age the favorite turns this year, if birth year is known. */
  ageThisYear?: number;
}

export function namedayDateForYear(entry: NamedayEntry, year: number): Date | null {
  if (entry.celebration.type === 'fixed') {
    return new Date(year, entry.celebration.month - 1, entry.celebration.day);
  }
  const map = resolveEasterOffsetCelebrations(year);
  return map.get(entry.nameday_key) ?? null;
}

export function nextOccurrenceOf(monthDay: { month: number; day: number }, today: Date): Date {
  const thisYear = new Date(today.getFullYear(), monthDay.month - 1, monthDay.day);
  if (isAfter(today, thisYear) && differenceInCalendarDays(thisYear, today) < 0) {
    return new Date(today.getFullYear() + 1, monthDay.month - 1, monthDay.day);
  }
  return thisYear;
}

export function nextNamedayDate(entry: NamedayEntry, today: Date): Date | null {
  const thisYear = namedayDateForYear(entry, today.getFullYear());
  if (!thisYear) return null;
  if (differenceInCalendarDays(thisYear, today) >= 0) return thisYear;
  return namedayDateForYear(entry, today.getFullYear() + 1);
}

// Mirror of nextOccurrenceOf for the "recent" rail — returns the most recent
// past occurrence (strictly before `today`). If this-year's date hasn't happened
// yet (or is today), we fall back to last year.
export function prevOccurrenceOf(monthDay: { month: number; day: number }, today: Date): Date {
  const thisYear = new Date(today.getFullYear(), monthDay.month - 1, monthDay.day);
  if (differenceInCalendarDays(thisYear, today) < 0) return thisYear;
  return new Date(today.getFullYear() - 1, monthDay.month - 1, monthDay.day);
}

export function prevNamedayDate(entry: NamedayEntry, today: Date): Date | null {
  const thisYear = namedayDateForYear(entry, today.getFullYear());
  if (!thisYear) return null;
  if (differenceInCalendarDays(thisYear, today) < 0) return thisYear;
  return namedayDateForYear(entry, today.getFullYear() - 1);
}

export function parseBirthDate(value: string): { month: number; day: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Returns the earlier of (next nameday, next birthday) for a favorite, or null if
 * the favorite has neither. Used by lists that show "next celebration" per row.
 */
export function nextCelebrationFor(fav: Favorite, today: Date): CelebrationDate | null {
  const candidates: CelebrationDate[] = [];

  if (fav.namedayKey) {
    const entry = findByKey(fav.namedayKey);
    if (entry) {
      const date = nextNamedayDate(entry, today);
      if (date) {
        candidates.push({
          date: startOfDay(date),
          kind: 'nameday',
          primaryForm: entry.primary_form,
          saint: entry.saint,
        });
      }
    }
  }

  if (fav.birthDate) {
    const parsed = parseBirthDate(fav.birthDate);
    if (parsed) {
      const date = nextOccurrenceOf({ month: parsed.month, day: parsed.day }, today);
      const yearKnown = parsed.year !== 1;
      candidates.push({
        date: startOfDay(date),
        kind: 'birthday',
        ageThisYear: yearKnown ? date.getFullYear() - parsed.year : undefined,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return candidates[0]!;
}
