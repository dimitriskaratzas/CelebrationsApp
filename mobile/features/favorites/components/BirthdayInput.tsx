import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

const YEAR_UNKNOWN = '0001';

function parse(value: string | null): { day: string; month: string; year: string; unknown: boolean } {
  if (!value) return { day: '', month: '', year: '', unknown: false };
  const [y, m, d] = value.split('-');
  return {
    day: d ?? '',
    month: m ?? '',
    year: y === YEAR_UNKNOWN ? '' : y ?? '',
    unknown: y === YEAR_UNKNOWN,
  };
}

function format(day: string, month: string, year: string, unknown: boolean): string | null {
  if (!day || !month) return null;
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  const y = unknown ? YEAR_UNKNOWN : year.padStart(4, '0');
  if (!unknown && !year) return null;
  if (Number(d) < 1 || Number(d) > 31) return null;
  if (Number(m) < 1 || Number(m) > 12) return null;
  return `${y}-${m}-${d}`;
}

export function BirthdayInput({ value, onChange }: Props) {
  const initial = parse(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [unknownYear, setUnknownYear] = useState(initial.unknown);

  useEffect(() => {
    onChange(format(day, month, year, unknownYear));
  }, [day, month, year, unknownYear, onChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Γενέθλια (προαιρετικά)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Ημ."
          keyboardType="number-pad"
          maxLength={2}
          value={day}
          onChangeText={setDay}
        />
        <TextInput
          style={styles.input}
          placeholder="Μήν."
          keyboardType="number-pad"
          maxLength={2}
          value={month}
          onChangeText={setMonth}
        />
        <TextInput
          style={[styles.input, styles.yearInput, unknownYear && styles.inputDisabled]}
          placeholder="Έτος"
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
          editable={!unknownYear}
        />
      </View>
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
  yearInput: { flex: 2 },
  inputDisabled: { backgroundColor: '#f5f5f5', color: '#aaa' },
  unknownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unknownLabel: { color: '#444' },
});
