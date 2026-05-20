import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth/hooks/useAuth';
import { SyncProvider } from '@/lib/sync/SyncProvider';
import { BootingScreen } from '@/lib/ui/BootingScreen';
import { theme } from '@/lib/ui/theme';

// Keep the splash visible until fonts are loaded so the first render doesn't flash
// system-font glyphs in place of the design's Plus Jakarta Sans / Manrope.
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op if the splash has already been hidden by another caller.
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Κάτι πήγε στραβά</Text>
      <Text style={styles.fallbackMessage}>{error.message}</Text>
      <Pressable style={({ pressed }) => [styles.fallbackRetry, pressed && styles.fallbackPressed]} onPress={retry}>
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
      <Stack
        screenOptions={{
          // Aegean Noon header chrome — matches the screens' gradient top, so the
          // header reads as part of the page rather than a separate Material bar.
          headerStyle: { backgroundColor: theme.bgTop },
          headerShadowVisible: false,
          headerTintColor: theme.accent,
          headerTitleStyle: {
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 17,
            color: theme.ink,
          },
          headerBackTitle: '',
        }}
      >
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
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    // Hide the splash once fonts have either loaded or hard-errored — don't block boot forever
    // on a font fetch failure on first install.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <RootGate />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: theme.bgTop,
  },
  fallbackTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.ink,
    textAlign: 'center',
  },
  fallbackMessage: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  fallbackRetry: {
    marginTop: 12,
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 99,
  },
  fallbackPressed: { opacity: 0.85 },
  fallbackRetryText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14,
    color: '#fff',
  },
});
