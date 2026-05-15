import { addDays } from 'date-fns';

import { CATALOG } from './catalog';

const JULIAN_GREGORIAN_OFFSET_DAYS = 13;

export function orthodoxPascha(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  const julian = new Date(year, month - 1, day);
  return addDays(julian, JULIAN_GREGORIAN_OFFSET_DAYS);
}

const yearCache = new Map<number, Map<string, Date>>();

export function resolveEasterOffsetCelebrations(year: number): Map<string, Date> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const pascha = orthodoxPascha(year);
  const map = new Map<string, Date>();
  for (const entry of CATALOG) {
    if (entry.celebration.type === 'easter_offset') {
      map.set(entry.nameday_key, addDays(pascha, entry.celebration.offset));
    }
  }
  yearCache.set(year, map);
  return map;
}
