import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSync } from '@/lib/sync/SyncProvider';
import { EmptyState } from '@/lib/ui/EmptyState';

import { FavoriteRow } from '../components/FavoriteRow';
import { useFavorites } from '../hooks/useFavorites';

export function FavoritesListScreen() {
  const router = useRouter();
  const { favorites, loading } = useFavorites();
  const { syncNow, isSyncing } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Αγαπημένα</Text>
        <Pressable
          onPress={() => router.push('/favorite/new' as never)}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
          accessibilityLabel="Προσθήκη αγαπημένου"
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => <FavoriteRow favorite={item} />}
        contentContainerStyle={favorites.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing || isSyncing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="Δεν έχεις αγαπημένα ακόμα"
              message="Πρόσθεσε τον πρώτο σου αγαπημένο για να ξεκινήσεις."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700' },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { opacity: 0.8 },
  addText: { color: '#fff', fontSize: 22, lineHeight: 24, fontWeight: '600' },
  emptyContainer: { flexGrow: 1 },
});
