import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { FavoriteForm } from '../components/FavoriteForm';
import * as repo from '../db/favorites.repo';

const FREE_TIER_CAP = 10;

export function AddFavoriteScreen() {
  const router = useRouter();
  return (
    <FavoriteForm
      eyebrow="ΝΕΟ ΑΓΑΠΗΜΕΝΟ"
      title="Πες μας ποιον/ποιαν να θυμάμαστε"
      saveLabel="Αποθήκευση"
      onSubmit={async (input) => {
        const count = await repo.countLive();
        if (count >= FREE_TIER_CAP) {
          Alert.alert(
            'Όριο 10 αγαπημένων',
            'Έχεις φτάσει το όριο των 10 αγαπημένων στη δωρεάν έκδοση.',
          );
          return;
        }
        try {
          await repo.create(input);
          router.back();
        } catch (e) {
          Alert.alert('Σφάλμα', e instanceof Error ? e.message : String(e));
        }
      }}
    />
  );
}
