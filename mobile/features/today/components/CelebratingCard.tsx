import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { relationshipLabel } from '@/features/favorites/components/RelationshipPicker';

import type { TodayItem } from '../hooks/useTodayList';

interface Props {
  item: TodayItem;
  showDate?: boolean;
}

export function CelebratingCard({ item, showDate = false }: Props) {
  const router = useRouter();
  const { favorite, kind, date, primaryForm, ageThisYear } = item;

  const kindLabel =
    kind === 'nameday'
      ? primaryForm
        ? `Ονομαστική • ${primaryForm}`
        : 'Ονομαστική γιορτή'
      : ageThisYear !== undefined
        ? `Γενέθλια • κλείνει ${ageThisYear}`
        : 'Γενέθλια';

  return (
    <Pressable
      onPress={() => router.push(`/favorite/${favorite.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.name}>{favorite.displayName}</Text>
        <Text style={styles.kind}>{kindLabel}</Text>
        {favorite.relationship ? (
          <Text style={styles.relationship}>{relationshipLabel(favorite.relationship)}</Text>
        ) : null}
      </View>
      {showDate ? (
        <View style={styles.dateBox}>
          <Text style={styles.dayName}>{format(date, 'EEEE', { locale: el })}</Text>
          <Text style={styles.dateText}>{format(date, 'dd/MM', { locale: el })}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 12,
  },
  pressed: { backgroundColor: '#f5f5f5' },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  kind: { fontSize: 13, color: '#1565c0' },
  relationship: { fontSize: 12, color: '#888' },
  dateBox: { alignItems: 'flex-end' },
  dayName: { fontSize: 12, color: '#666', textTransform: 'capitalize' },
  dateText: { fontSize: 16, fontWeight: '600' },
});
