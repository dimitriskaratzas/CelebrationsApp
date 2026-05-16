import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

const YEAR_UNKNOWN = '0001';
const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear();

interface Parsed {
  day: string;
  month: string;
  year: string;
  unknown: boolean;
}

function parse(value: string | null): Parsed {
  if (!value) return { day: '', month: '', year: '', unknown: false };
  const [y, m, d] = value.split('-');
  return {
    day: d ?? '',
    month: m ?? '',
    year: y === YEAR_UNKNOWN ? '' : y ?? '',
    unknown: y === YEAR_UNKNOWN,
  };
}

// Returns a valid ISO date string or null. Rejects:
//   - missing day/month
//   - missing year unless explicit "year unknown"
//   - out-of-range numerics (day 32, month 13, year 1899)
//   - calendar-impossible dates (31/02, 29/02 in non-leap years) by round-tripping through Date.
function format(day: string, month: string, year: string, unknown: boolean): string | null {
  if (!day || !month) return null;
  const dn = Number(day);
  const mn = Number(month);
  if (!Number.isInteger(dn) || dn < 1 || dn > 31) return null;
  if (!Number.isInteger(mn) || mn < 1 || mn > 12) return null;

  let yn: number;
  let y: string;
  if (unknown) {
    yn = 2000; // probe year for calendar validation (leap year, so 29/02 passes)
    y = YEAR_UNKNOWN;
  } else {
    if (!year) return null;
    yn = Number(year);
    if (!Number.isInteger(yn) || yn < MIN_YEAR || yn > MAX_YEAR) return null;
    y = String(yn).padStart(4, '0');
  }

  // Calendar-impossible dates round-trip differently through Date.
  const probe = new Date(yn, mn - 1, dn);
  if (probe.getFullYear() !== yn || probe.getMonth() !== mn - 1 || probe.getDate() !== dn) {
    return null;
  }

  return `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
}

export function BirthdayInput({ value, onChange }: Props) {
  // Local mutable state seeded from the prop. We treat `value` as the initial-only
  // source — the parent's update of `value` after mount is ignored (uncontrolled
  // from the user's POV). The parent receives changes via `onChange`.
  const initial = parse(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [unknownYear, setUnknownYear] = useState(initial.unknown);

  const monthRef = useRef<TextInput | null>(null);
  const yearRef = useRef<TextInput | null>(null);

  // Capture onChange in a ref so the format-effect doesn't re-fire whenever the
  // parent re-renders with a new function identity.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(format(day, month, year, unknownYear));
  }, [day, month, year, unknownYear]);

  const hasInput = Boolean(day || month || year);
  const isValid = format(day, month, year, unknownYear) !== null;
  const showError = hasInput && !isValid;

  const focusMonth = useCallback(() => monthRef.current?.focus(), []);
  const focusYear = useCallback(() => yearRef.current?.focus(), []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Γενέθλια (προαιρετικά)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, showError && styles.inputError]}
          placeholder="Ημ."
          keyboardType="number-pad"
          maxLength={2}
          value={day}
          onChangeText={(t) => {
            setDay(t);
            if (t.length === 2) focusMonth();
          }}
          returnKeyType="next"
          onSubmitEditing={focusMonth}
          blurOnSubmit={false}
        />
        <TextInput
          ref={monthRef}
          style={[styles.input, showError && styles.inputError]}
          placeholder="Μήν."
          keyboardType="number-pad"
          maxLength={2}
          value={month}
          onChangeText={(t) => {
            setMonth(t);
            if (t.length === 2 && !unknownYear) focusYear();
          }}
          returnKeyType={unknownYear ? 'done' : 'next'}
          onSubmitEditing={unknownYear ? undefined : focusYear}
          blurOnSubmit={unknownYear}
        />
        <TextInput
          ref={yearRef}
          style={[styles.input, styles.yearInput, unknownYear && styles.inputDisabled, showError && styles.inputError]}
          placeholder="Έτος"
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
          editable={!unknownYear}
          returnKeyType="done"
        />
      </View>
      {showError ? (
        <Text style={styles.errorText}>
          Μη έγκυρη ημερομηνία. Έλεγξε ημέρα, μήνα ή έτος ({MIN_YEAR}–{MAX_YEAR}).
        </Text>
      ) : null}
      <View style={styles.unknownRow}>
        <Switch value={unknownYear} onValueChange={setUnknownYear} />
        <Text style={styles.unknownLabel}>Δεν ξέρω το έτος</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 14, color: '#444' },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: '#d32f2f' },
  yearInput: { flex: 2 },
  inputDisabled: { backgroundColor: '#f5f5f5', color: '#aaa' },
  errorText: { color: '#d32f2f', fontSize: 12 },
  unknownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unknownLabel: { color: '#444' },
});
