import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { FavoriteForm } from '../components/FavoriteForm';
import * as repo from '../db/favorites.repo';
import type { Favorite } from '../db/favorites.repo';

export function EditFavoriteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [favorite, setFavorite] = useState<Favorite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const f = await repo.getById(id);
      setFavorite(f);
      setLoading(false);
    })();
  }, [id]);

  const onDelete = () => {
    if (!favorite) return;
    Alert.alert(
      'Διαγραφή αγαπημένου',
      `Διαγραφή του "${favorite.displayName}";`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            await repo.softDelete(favorite.id);
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Φόρτωση…</Text>
      </View>
    );
  }

  if (!favorite) {
    return (
      <View style={styles.center}>
        <Text>Δεν βρέθηκε.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: favorite.displayName,
          headerRight: () => (
            <Pressable onPress={onDelete} accessibilityLabel="Διαγραφή">
              <Text style={styles.delete}>Διαγραφή</Text>
            </Pressable>
          ),
        }}
      />
      <FavoriteForm
        saveLabel="Αποθήκευση"
        initial={{
          displayName: favorite.displayName,
          namedayKey: favorite.namedayKey,
          birthDate: favorite.birthDate,
          relationship: favorite.relationship,
          notes: favorite.notes,
        }}
        onSubmit={async (input) => {
          try {
            await repo.update(favorite.id, input);
            router.back();
          } catch (e) {
            Alert.alert('Σφάλμα', e instanceof Error ? e.message : String(e));
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  delete: { color: '#d32f2f', fontWeight: '600', paddingHorizontal: 12 },
});
