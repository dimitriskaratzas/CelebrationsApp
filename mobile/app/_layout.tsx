import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth/hooks/useAuth';
import { SyncProvider } from '@/lib/sync/SyncProvider';
import { BootingScreen } from '@/lib/ui/BootingScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Expo Router convention: exporting `ErrorBoundary` from a layout makes that boundary
// catch render errors in any descendant route, with a "retry" prop that re-renders the
// subtree instead of white-screening the whole app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Κάτι πήγε στραβά</Text>
      <Text style={styles.fallbackMessage}>{error.message}</Text>
      <Pressable style={styles.fallbackRetry} onPress={retry}>
        <Text style={styles.fallbackRetryText}>Δοκίμασε ξανά</Text>
      </Pressable>
    </View>
  );
}

function RootGate() {
  const { isReady, error, retry, user } = useAuth();

  if (!isReady) {
    return <BootingScreen />;
  }

  if (error && !user) {
    return <BootingScreen error={error} onRetry={retry} />;
  }

  return (
    <SyncProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="favorite/new" options={{ title: 'Νέο αγαπημένο' }} />
        <Stack.Screen name="favorite/[id]" options={{ title: 'Επεξεργασία' }} />
        <Stack.Screen name="auth/sign-in" options={{ title: 'Σύνδεση' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Δημιουργία λογαριασμού' }} />
      </Stack>
    </SyncProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGate />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  fallbackTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  fallbackMessage: { color: '#666', textAlign: 'center' },
  fallbackRetry: {
    marginTop: 12,
    backgroundColor: '#1565c0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  fallbackRetryText: { color: '#fff', fontWeight: '600' },
});
