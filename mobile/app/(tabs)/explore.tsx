import { StyleSheet, Text, View } from 'react-native';

export default function FavoritesPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Αγαπημένα</Text>
      <Text style={styles.subtitle}>Placeholder — Plan 3 T12</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: '600' },
  subtitle: { marginTop: 8, color: '#666' },
});
