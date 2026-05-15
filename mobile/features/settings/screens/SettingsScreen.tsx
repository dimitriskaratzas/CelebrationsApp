import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSync } from '@/lib/sync/SyncProvider';

export function SettingsScreen() {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  const { lastSyncedAt, pendingCount, isSyncing, syncNow } = useSync();

  const lastSyncLabel = lastSyncedAt
    ? format(new Date(lastSyncedAt), "EEEE d MMMM, HH:mm", { locale: el })
    : 'Ποτέ';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Section title="Λογαριασμός">
        <Row
          label={
            isAnonymous
              ? 'Συνδεδεμένος ανώνυμα'
              : user?.email ?? 'Συνδεδεμένος'
          }
          secondary={
            user?.id ? `id: ${user.id.slice(0, 8)}…` : undefined
          }
        />
        <ActionRow
          label="Σύνδεση"
          onPress={() => router.push('/auth/sign-in' as never)}
        />
        <ActionRow
          label="Δημιουργία λογαριασμού"
          onPress={() => router.push('/auth/register' as never)}
        />
      </Section>

      <Section title="Συγχρονισμός">
        <Row label="Τελευταίος συγχρονισμός" secondary={lastSyncLabel} />
        <Row label="Εκκρεμή" secondary={String(pendingCount)} />
        <ActionRow
          label={isSyncing ? 'Συγχρονισμός…' : 'Συγχρονισμός τώρα'}
          onPress={() => {
            void syncNow();
          }}
          disabled={isSyncing}
        />
      </Section>

      <Section title="Σχετικά">
        <Row label="Έκδοση" secondary={Application.nativeApplicationVersion ?? '—'} />
        <Row label="Build" secondary={Application.nativeBuildVersion ?? '—'} />
        <Row label="Κανάλι" secondary={Updates.channel ?? 'development'} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, secondary }: { label: string; secondary?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {secondary ? <Text style={styles.rowSecondary}>{secondary}</Text> : null}
    </View>
  );
}

function ActionRow({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={[styles.action, disabled && styles.actionDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f9' },
  scroll: { padding: 16, gap: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: { paddingBottom: 4 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  rowPressed: { backgroundColor: '#f0f0f0' },
  rowLabel: { fontSize: 15, color: '#222' },
  rowSecondary: { fontSize: 14, color: '#666' },
  action: { fontSize: 15, color: '#1565c0', fontWeight: '500' },
  actionDisabled: { color: '#999' },
});
