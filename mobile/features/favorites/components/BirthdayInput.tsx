import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { theme } from '@/lib/ui/theme';

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

// Returns a valid ISO date string or null. Rejects missing parts, out-of-range numerics,
// and calendar-impossible dates (31/02, 29/02 in non-leap years) via Date round-trip.
function format(day: string, month: string, year: string, unknown: boolean): string | null {
  if (!day || !month) return null;
  const dn = Number(day);
  const mn = Number(month);
  if (!Number.isInteger(dn) || dn < 1 || dn > 31) return null;
  if (!Number.isInteger(mn) || mn < 1 || mn > 12) return null;

  let yn: number;
  let y: string;
  if (unknown) {
    yn = 2000;
    y = YEAR_UNKNOWN;
  } else {
    if (!year) return null;
    yn = Number(year);
    if (!Number.isInteger(yn) || yn < MIN_YEAR || yn > MAX_YEAR) return null;
    y = String(yn).padStart(4, '0');
  }

  const probe = new Date(yn, mn - 1, dn);
  if (probe.getFullYear() !== yn || probe.getMonth() !== mn - 1 || probe.getDate() !== dn) {
    return null;
  }

  return `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
}

interface CellProps {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChangeText: (t: string) => void;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done';
  blurOnSubmit?: boolean;
  editable?: boolean;
  flex?: number;
  hasError?: boolean;
  innerRef?: (ref: TextInput | null) => void;
}

function Cell({
  label,
  value,
  placeholder,
  maxLength,
  onChangeText,
  onSubmitEditing,
  returnKeyType,
  blurOnSubmit,
  editable = true,
  flex = 1,
  hasError = false,
  innerRef,
}: CellProps) {
  return (
    <View style={[styles.cell, { flex }, hasError && styles.cellError, !editable && styles.cellDisabled]}>
      <Text style={[styles.cellLabel, !editable && styles.cellLabelDisabled]}>{label}</Text>
      <TextInput
        ref={innerRef}
        style={[styles.cellInput, !editable && styles.cellInputDisabled]}
        placeholder={placeholder}
        placeholderTextColor={editable ? 'rgba(14, 34, 56, 0.30)' : 'rgba(14, 34, 56, 0.18)'}
        keyboardType="number-pad"
        maxLength={maxLength}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        editable={editable}
      />
    </View>
  );
}

export function BirthdayInput({ value, onChange }: Props) {
  const initial = parse(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [unknownYear, setUnknownYear] = useState(initial.unknown);

  const monthRef = useRef<TextInput | null>(null);
  const yearRef = useRef<TextInput | null>(null);

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
    <View>
      <View style={styles.row}>
        <Cell
          label="ΗΜ"
          placeholder="—"
          value={day}
          maxLength={2}
          onChangeText={(t) => {
            setDay(t);
            if (t.length === 2) focusMonth();
          }}
          onSubmitEditing={focusMonth}
          returnKeyType="next"
          blurOnSubmit={false}
          hasError={showError}
        />
        <View style={styles.separator}>
          <Text style={styles.separatorGlyph}>/</Text>
        </View>
        <Cell
          label="ΜΗΝ"
          placeholder="—"
          value={month}
          maxLength={2}
          onChangeText={(t) => {
            setMonth(t);
            if (t.length === 2 && !unknownYear) focusYear();
          }}
          onSubmitEditing={unknownYear ? undefined : focusYear}
          returnKeyType={unknownYear ? 'done' : 'next'}
          blurOnSubmit={unknownYear}
          innerRef={(ref) => (monthRef.current = ref)}
          hasError={showError}
        />
        <View style={styles.separator}>
          <Text style={styles.separatorGlyph}>/</Text>
        </View>
        <Cell
          label="ΕΤΟΣ"
          placeholder="—"
          value={year}
          maxLength={4}
          onChangeText={setYear}
          returnKeyType="done"
          editable={!unknownYear}
          flex={1.8}
          innerRef={(ref) => (yearRef.current = ref)}
          hasError={showError}
        />
      </View>
      {showError ? (
        <Text style={styles.errorText}>
          Μη έγκυρη ημερομηνία. Έλεγξε ημέρα, μήνα ή έτος ({MIN_YEAR}–{MAX_YEAR}).
        </Text>
      ) : null}
      <Pressable
        onPress={() => setUnknownYear((v) => !v)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Switch
          value={unknownYear}
          onValueChange={setUnknownYear}
          trackColor={{ false: theme.surface2, true: theme.accent }}
          thumbColor="#fff"
        />
        <Text style={styles.toggleLabel}>Δεν ξέρω το έτος γέννησης</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    overflow: 'hidden',
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minHeight: 56,
  },
  cellError: { backgroundColor: 'rgba(224, 79, 106, 0.06)' },
  cellDisabled: { backgroundColor: 'rgba(14, 34, 56, 0.03)' },
  cellLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: theme.muted,
  },
  cellLabelDisabled: { color: 'rgba(92, 115, 144, 0.5)' },
  cellInput: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
    color: theme.ink,
    padding: 0,
    margin: 0,
  },
  cellInputDisabled: { color: 'rgba(14, 34, 56, 0.35)' },
  separator: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorGlyph: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 22,
    color: 'rgba(14, 34, 56, 0.18)',
  },
  errorText: {
    marginTop: 8,
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.destructive,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 4,
  },
  togglePressed: { opacity: 0.7 },
  toggleLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: theme.muted,
  },
});
