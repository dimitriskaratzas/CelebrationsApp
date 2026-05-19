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
  saintsToday: SaintOfDay[];
}

const UPCOMING_DAYS = 7;
const UPCOMING_CAP = 10;

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

    const allItems: TodayItem[] = [];

    for (const fav of favorites) {
      if (fav.namedayKey) {
        const entry = CATALOG.find((e) => e.nameday_key === fav.namedayKey);
        if (entry) {
          const date = nextNamedayDate(entry, todayStart);
          if (date) {
            allItems.push({
              id: `${fav.id}:nameday`,
              favorite: fav,
              kind: 'nameday',
              date: startOfDay(date),
              primaryForm: entry.primary_form,
              saint: entry.saint,
            });
          }
        }
      }

      if (fav.birthDate) {
        const parsed = parseBirthDate(fav.birthDate);
        if (parsed) {
          const date = nextOccurrenceOf({ month: parsed.month, day: parsed.day }, todayStart);
          const yearKnown = parsed.year !== 1;
          const ageThisYear = yearKnown ? date.getFullYear() - parsed.year : undefined;
          allItems.push({
            id: `${fav.id}:birthday`,
            favorite: fav,
            kind: 'birthday',
            date: startOfDay(date),
            ageThisYear,
          });
        }
      }
    }

    const todayList: TodayItem[] = [];
    const upcomingList: TodayItem[] = [];

    for (const item of allItems) {
      const delta = differenceInCalendarDays(item.date, todayStart);
      if (delta === 0) todayList.push(item);
      else if (delta > 0 && delta <= UPCOMING_DAYS) upcomingList.push(item);
    }

    upcomingList.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      loading: loading && !ready,
      today: todayList,
      upcoming: upcomingList.slice(0, UPCOMING_CAP),
      saintsToday,
    };
  }, [favorites, loading, ready, today]);
}
