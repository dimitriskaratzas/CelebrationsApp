import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Favorite } from '../db/favorites.repo';

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: 'Γονέας',
  child: 'Παιδί',
  sibling: 'Αδέρφι',
  spouse: 'Σύζυγος',
  grandparent: 'Παππούς/Γιαγιά',
  friend: 'Φίλος',
  colleague: 'Συνάδελφος',
  other: 'Άλλο',
};

interface Props {
  favorite: Favorite;
}

export function FavoriteRow({ favorite }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/favorite/[id]', params: { id: favorite.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.main}>
        <Text style={styles.name}>{favorite.displayName}</Text>
        {favorite.relationship ? (
          <Text style={styles.relationship}>
            {RELATIONSHIP_LABELS[favorite.relationship] ?? favorite.relationship}
          </Text>
        ) : null}
      </View>
      {favorite.dirty ? <View style={styles.dirtyDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { backgroundColor: '#f5f5f5' },
  main: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500' },
  relationship: { marginTop: 2, fontSize: 13, color: '#666' },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff9800' },
});
