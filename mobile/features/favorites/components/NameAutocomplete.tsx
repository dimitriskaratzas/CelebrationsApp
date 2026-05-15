import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NamedayEntry } from '@/features/today/namedays/catalog';

interface Props {
  suggestions: NamedayEntry[];
  onPick: (entry: NamedayEntry) => void;
}

function celebrationLabel(entry: NamedayEntry): string {
  if (entry.celebration.type === 'fixed') {
    return `${String(entry.celebration.day).padStart(2, '0')}/${String(entry.celebration.month).padStart(2, '0')}`;
  }
  return 'Πάσχα' + (entry.celebration.offset !== 0 ? ` +${entry.celebration.offset}μ` : '');
}

export function NameAutocomplete({ suggestions, onPick }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.container}>
      {suggestions.map((entry) => (
        <Pressable
          key={entry.nameday_key}
          onPress={() => onPick(entry)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.name}>{entry.primary_form}</Text>
          <Text style={styles.date}>{celebrationLabel(entry)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowPressed: { backgroundColor: '#eef2f6' },
  name: { fontSize: 15 },
  date: { fontSize: 13, color: '#666' },
});
