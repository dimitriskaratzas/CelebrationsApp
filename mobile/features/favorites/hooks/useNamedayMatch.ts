import { useMemo } from 'react';

import { findByNormalized, normalize, type NamedayEntry } from '@/features/today/namedays/catalog';

export type NamedayMatchResult =
  | { kind: 'matched'; entry: NamedayEntry }
  | { kind: 'multi'; matches: NamedayEntry[] }
  | { kind: 'none' }
  | { kind: 'empty' };

export function useNamedayMatch(input: string): NamedayMatchResult {
  return useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return { kind: 'empty' };

    const normalized = normalize(trimmed);
    if (!normalized) return { kind: 'empty' };

    const matches = findByNormalized(normalized);
    if (matches.length === 0) return { kind: 'none' };
    if (matches.length === 1) return { kind: 'matched', entry: matches[0]! };
    return { kind: 'multi', matches };
  }, [input]);
}
