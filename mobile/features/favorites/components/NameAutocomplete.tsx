import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NamedayEntry } from '@/features/today/namedays/catalog';
import { shadow, theme } from '@/lib/ui/theme';

interface Props {
  suggestions: NamedayEntry[];
  onPick: (entry: NamedayEntry) => void;
}

function celebrationLabel(entry: NamedayEntry): string {
  if (entry.celebration.type === 'fixed') {
    return `${String(entry.celebration.day).padStart(2, '0')}/${String(entry.celebration.month).padStart(2, '0')}`;
  }
  return entry.celebration.offset === 0
    ? 'Πάσχα'
    : `Πάσχα +${entry.celebration.offset}μ`;
}

export function NameAutocomplete({ suggestions, onPick }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <View style={[styles.container, shadow.row]}>
      {suggestions.map((entry, i) => (
        <Pressable
          key={entry.nameday_key}
          onPress={() => onPick(entry)}
          style={({ pressed }) => [
            styles.row,
            i < suggestions.length - 1 && styles.rowWithDivider,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.bullet} />
          <Text style={styles.name} numberOfLines={1}>
            {entry.primary_form}
          </Text>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{celebrationLabel(entry)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowWithDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  rowPressed: { backgroundColor: theme.accentSoft },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.gold,
  },
  name: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  dateChip: {
    backgroundColor: theme.surface2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.chip,
  },
  dateChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.accent,
  },
});
