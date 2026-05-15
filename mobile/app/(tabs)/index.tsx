import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/lib/db';

export default function TodayScreen() {
  const [tables, setTables] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const rows = await db.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        );
        setTables(rows.map((r) => r.name));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Σήμερα</Text>
      <Text style={styles.subtitle}>Placeholder — Plan 3 T18</Text>
      <Text style={styles.debug}>DB tables (T5 check):</Text>
      {error ? (
        <Text style={styles.error}>Error: {error}</Text>
      ) : tables ? (
        tables.map((t) => (
          <Text key={t} style={styles.tableRow}>
            • {t}
          </Text>
        ))
      ) : (
        <Text style={styles.subtitle}>Loading…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: '600' },
  subtitle: { marginTop: 8, color: '#666' },
  debug: { marginTop: 24, fontWeight: '600' },
  tableRow: { marginTop: 4, fontFamily: 'monospace' },
  error: { marginTop: 8, color: 'crimson' },
});
