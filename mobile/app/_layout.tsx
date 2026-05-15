import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/features/auth/hooks/useAuth';
import { SyncProvider } from '@/lib/sync/SyncProvider';
import { BootingScreen } from '@/lib/ui/BootingScreen';

export const unstable_settings = {
  anchor: '(tabs)',
};

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
