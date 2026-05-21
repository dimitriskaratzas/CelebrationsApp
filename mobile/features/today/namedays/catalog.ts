import stub from './stub-namedays.json';

export type CelebrationType = 'fixed' | 'easter_offset';

export interface FixedCelebration {
  type: 'fixed';
  month: number;
  day: number;
}

export interface EasterOffsetCelebration {
  type: 'easter_offset';
  offset: number;
}

export type Celebration = FixedCelebration | EasterOffsetCelebration;

export interface NamedayEntry {
  nameday_key: string;
  primary_form: string;
  all_forms_normalized: string[];
  celebration: Celebration;
  saint: string;
}

export const CATALOG: NamedayEntry[] = stub as NamedayEntry[];

const ACCENT_MAP: Record<string, string> = {
  ά: 'α',
  έ: 'ε',
  ή: 'η',
  ί: 'ι',
  ϊ: 'ι',
  ΐ: 'ι',
  ό: 'ο',
  ύ: 'υ',
  ϋ: 'υ',
  ΰ: 'υ',
  ώ: 'ω',
  ς: 'σ',
};

export function normalize(input: string): string {
  const lowered = input.toLowerCase().trim();
  const firstToken = lowered.split(/\s+/)[0] ?? '';
  let out = '';
  for (const ch of firstToken) {
    out += ACCENT_MAP[ch] ?? ch;
  }
  return out;
}

const INDEX: Map<string, NamedayEntry[]> = (() => {
  const map = new Map<string, NamedayEntry[]>();
  for (const entry of CATALOG) {
    for (const form of entry.all_forms_normalized) {
      const arr = map.get(form) ?? [];
      arr.push(entry);
      map.set(form, arr);
    }
  }
  return map;
})();

export function findByNormalized(normalized: string): NamedayEntry[] {
  return INDEX.get(normalized) ?? [];
}

export function findByKey(key: string): NamedayEntry | null {
  return CATALOG.find((e) => e.nameday_key === key) ?? null;
}

export function suggestByPrefix(input: string, limit = 5): NamedayEntry[] {
  const normalized = normalize(input);
  if (!normalized || normalized.length < 1) return [];

  const seen = new Set<string>();
  const out: NamedayEntry[] = [];

  for (const entry of CATALOG) {
    if (out.length >= limit) break;
    if (seen.has(entry.nameday_key)) continue;
    const hit = entry.all_forms_normalized.some((form) => form.startsWith(normalized));
    if (hit) {
      out.push(entry);
      seen.add(entry.nameday_key);
    }
  }
  return out;
}
