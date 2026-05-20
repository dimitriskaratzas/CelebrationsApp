import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/lib/ui/theme';

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
        <LinearGradient
          colors={[theme.bgTop, theme.bgBottom]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator color={theme.accent} />
        <Text style={styles.centerText}>Φόρτωση…</Text>
      </View>
    );
  }

  if (!favorite) {
    return (
      <View style={styles.center}>
        <LinearGradient
          colors={[theme.bgTop, theme.bgBottom]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.centerText}>Δεν βρέθηκε.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: favorite.displayName,
          headerRight: () => (
            <Pressable
              onPress={onDelete}
              accessibilityLabel="Διαγραφή"
              hitSlop={8}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.destructive} />
              <Text style={styles.deleteText}>Διαγραφή</Text>
            </Pressable>
          ),
        }}
      />
      <FavoriteForm
        eyebrow="ΕΠΕΞΕΡΓΑΣΙΑ"
        title={favorite.displayName}
        saveLabel="Αποθήκευση αλλαγών"
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.bgTop },
  centerText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: theme.muted },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(224, 79, 106, 0.10)',
    marginRight: 8,
  },
  deleteBtnPressed: { opacity: 0.7 },
  deleteText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: theme.destructive,
  },
});
