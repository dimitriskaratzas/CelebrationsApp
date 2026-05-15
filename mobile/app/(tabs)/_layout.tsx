import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Σήμερα' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Αγαπημένα' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ρυθμίσεις' }} />
    </Tabs>
  );
}
