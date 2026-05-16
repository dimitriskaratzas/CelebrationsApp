import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { EmptyState } from '@/lib/ui/EmptyState';

import { CelebratingCard } from '../components/CelebratingCard';
import { useTodayList, type TodayItem } from '../hooks/useTodayList';

interface Section {
  title: string;
  data: TodayItem[];
  showDate: boolean;
  empty?: string;
}

// Returns ms until the *start* of the next local day. Used to schedule a
// re-render when midnight ticks over while the app stays foregrounded.
function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function TodayScreen() {
  const router = useRouter();
  const { favorites } = useFavorites();
  const [today, setToday] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh `today` (a) at the next local midnight and (b) whenever the app
  // becomes active. Both paths reschedule the midnight timer.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setToday((prev) => (isSameDay(prev, now) ? prev : now));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, msUntilMidnight(now));
    };
    timerRef.current = setTimeout(tick, msUntilMidnight(new Date()));

    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tick();
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, []);

  const { today: todayItems, upcoming, saintsToday, loading } = useTodayList(today);

  const sections: Section[] = useMemo(() => {
    const out: Section[] = [
      {
        title: 'Γιορτάζουν σήμερα',
        data: todayItems,
        showDate: false,
        empty: 'Κανείς δεν γιορτάζει σήμερα.',
      },
    ];
    if (upcoming.length > 0) {
      out.push({
        title: 'Έρχονται αυτή την εβδομάδα',
        data: upcoming,
        showDate: true,
      });
    }
    return out;
  }, [todayItems, upcoming]);

  if (loading && todayItems.length === 0 && upcoming.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState message="Φόρτωση…" />
      </View>
    );
  }

  // First-launch empty state — no favorites yet, nudge towards adding one.
  if (favorites.length === 0 && todayItems.length === 0 && upcoming.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {`Σήμερα, ${format(today, 'EEEE d MMMM', { locale: el })}`}
          </Text>
        </View>
        <EmptyState
          title="Δεν υπάρχουν αγαπημένα ακόμα"
          message="Πρόσθεσε το πρώτο σου αγαπημένο για να δεις τις γιορτές του εδώ."
        >
          <Pressable
            style={styles.cta}
            onPress={() => router.push('/favorite/new')}
          >
            <Text style={styles.ctaText}>Προσθήκη αγαπημένου</Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {`Σήμερα, ${format(today, 'EEEE d MMMM', { locale: el })}`}
        </Text>
        {saintsToday.length > 0 ? (
          <Text style={styles.saints}>{saintsToday.map((s) => s.saint).join(' · ')}</Text>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, section }) => (
          <CelebratingCard item={item} showDate={section.showDate} today={today} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 && section.empty ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>{section.empty}</Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '700', textTransform: 'capitalize' },
  saints: { fontSize: 13, color: '#666' },
  sectionHeader: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyRow: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyText: { color: '#888' },
  cta: {
    marginTop: 12,
    backgroundColor: '#1565c0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  ctaText: { color: '#fff', fontWeight: '600' },
});
