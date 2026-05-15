import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Props {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
}

export function BootingScreen({ message = 'Συνδεόμαστε…', error, onRetry }: Props) {
  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.errorTitle}>Χρειάζεται σύνδεση στο διαδίκτυο</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          {onRetry ? (
            <Text style={styles.retry} onPress={onRetry}>
              Δοκίμασε ξανά
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <ActivityIndicator />
          <Text style={styles.message}>{message}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  message: { marginTop: 12, color: '#666' },
  errorTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  errorMessage: { color: '#666', textAlign: 'center' },
  retry: { marginTop: 12, color: '#1565c0', fontWeight: '600' },
});
