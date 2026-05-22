import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import type { Favorite } from '@/features/favorites/db/favorites.repo';

import { CATALOG } from '../namedays/catalog';
import {
  namedayDateForYear,
  nextNamedayDate,
  nextOccurrenceOf,
  parseBirthDate,
  prevNamedayDate,
  prevOccurrenceOf,
  type CelebrationKind,
} from '../lib/nextCelebration';

export type { CelebrationKind };

export interface TodayItem {
  id: string;
  favorite: Favorite;
  kind: CelebrationKind;
  date: Date;
  primaryForm?: string;
  saint?: string;
  ageThisYear?: number;
}

export interface SaintOfDay {
  nameday_key: string;
  primary_form: string;
  saint: string;
}

interface UseTodayList {
  loading: boolean;
  today: TodayItem[];
  upcoming: TodayItem[];
  recent: TodayItem[];
  saintsToday: SaintOfDay[];
}

const UPCOMING_DAYS = 14;
const UPCOMING_CAP = 12;
const RECENT_DAYS = 7;
const RECENT_CAP = 8;

export function useTodayList(today: Date): UseTodayList {
  const { favorites, loading } = useFavorites();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return useMemo(() => {
    const todayStart = startOfDay(today);

    const saintsToday: SaintOfDay[] = [];
    for (const entry of CATALOG) {
      const date = namedayDateForYear(entry, today.getFullYear());
      if (!date) continue;
      if (differenceInCalendarDays(startOfDay(date), todayStart) === 0) {
        saintsToday.push({
          nameday_key: entry.nameday_key,
          primary_form: entry.primary_form,
          saint: entry.saint,
        });
      }
    }

    const futureItems: TodayItem[] = [];
    const pastItems: TodayItem[] = [];

    for (const fav of favorites) {
      if (fav.namedayKey) {
        const entry = CATALOG.find((e) => e.nameday_key === fav.namedayKey);
        if (entry) {
          const nextDate = nextNamedayDate(entry, todayStart);
          if (nextDate) {
            futureItems.push({
              id: `${fav.id}:nameday`,
              favorite: fav,
              kind: 'nameday',
              date: startOfDay(nextDate),
              primaryForm: entry.primary_form,
              saint: entry.saint,
            });
          }
          const prevDate = prevNamedayDate(entry, todayStart);
          if (prevDate) {
            pastItems.push({
              id: `${fav.id}:nameday:prev`,
              favorite: fav,
              kind: 'nameday',
              date: startOfDay(prevDate),
              primaryForm: entry.primary_form,
              saint: entry.saint,
            });
          }
        }
      }

      if (fav.birthDate) {
        const parsed = parseBirthDate(fav.birthDate);
        if (parsed) {
          const yearKnown = parsed.year !== 1;
          const nextDate = nextOccurrenceOf({ month: parsed.month, day: parsed.day }, todayStart);
          futureItems.push({
            id: `${fav.id}:birthday`,
            favorite: fav,
            kind: 'birthday',
            date: startOfDay(nextDate),
            ageThisYear: yearKnown ? nextDate.getFullYear() - parsed.year : undefined,
          });
          const prevDate = prevOccurrenceOf({ month: parsed.month, day: parsed.day }, todayStart);
          pastItems.push({
            id: `${fav.id}:birthday:prev`,
            favorite: fav,
            kind: 'birthday',
            date: startOfDay(prevDate),
            ageThisYear: yearKnown ? prevDate.getFullYear() - parsed.year : undefined,
          });
        }
      }
    }

    const todayList: TodayItem[] = [];
    const upcomingList: TodayItem[] = [];
    const recentList: TodayItem[] = [];

    for (const item of futureItems) {
      const delta = differenceInCalendarDays(item.date, todayStart);
      if (delta === 0) todayList.push(item);
      else if (delta > 0 && delta <= UPCOMING_DAYS) upcomingList.push(item);
    }

    for (const item of pastItems) {
      const delta = differenceInCalendarDays(item.date, todayStart);
      if (delta < 0 && delta >= -RECENT_DAYS) recentList.push(item);
    }

    upcomingList.sort((a, b) => a.date.getTime() - b.date.getTime());
    // Most recent first — the "just missed yesterday" card belongs at the top.
    recentList.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      loading: loading && !ready,
      today: todayList,
      upcoming: upcomingList.slice(0, UPCOMING_CAP),
      recent: recentList.slice(0, RECENT_CAP),
      saintsToday,
    };
  }, [favorites, loading, ready, today]);
}
