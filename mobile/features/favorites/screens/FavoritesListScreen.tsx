import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useSync } from '@/lib/sync/SyncProvider';
import { Banner } from '@/lib/ui/Banner';
import { EmptyState } from '@/lib/ui/EmptyState';

import { FavoriteRow } from '../components/FavoriteRow';
import { useFavorites } from '../hooks/useFavorites';
import { useStuckOutbox } from '../hooks/useStuckOutbox';

const FREE_TIER_CAP = 10;

export function FavoritesListScreen() {
  const router = useRouter();
  const { favorites, loading } = useFavorites();
  const { syncNow, isSyncing } = useSync();
  const stuck = useStuckOutbox();
  const [refreshing, setRefreshing] = useState(false);

  const atCap = favorites.length >= FREE_TIER_CAP;

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
          disabled={atCap}
          style={({ pressed }) => [
            styles.add,
            pressed && !atCap && styles.addPressed,
            atCap && styles.addDisabled,
          ]}
          hitSlop={8}
          accessibilityLabel="Προσθήκη αγαπημένου"
          accessibilityState={{ disabled: atCap }}
        >
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>

      {atCap || stuck.capReached ? (
        <Banner
          tone="warning"
          message="Έχεις φτάσει το όριο των 10 αγαπημένων. Διέγραψε κάποιους για να προσθέσεις νέους."
        />
      ) : stuck.totalStuck > 0 ? (
        <Banner tone="warning" message="Κάποιες αλλαγές δεν αποθηκεύτηκαν στον διακομιστή." />
      ) : null}

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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { opacity: 0.8 },
  addDisabled: { backgroundColor: '#bdbdbd' },
  addText: { color: '#fff', fontSize: 26, lineHeight: 28, fontWeight: '600' },
  emptyContainer: { flexGrow: 1 },
});
