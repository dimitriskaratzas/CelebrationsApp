import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/lib/ui/EmptyState';

import { CelebratingCard } from '../components/CelebratingCard';
import { useTodayList, type TodayItem } from '../hooks/useTodayList';

interface Section {
  title: string;
  data: TodayItem[];
  showDate: boolean;
  empty?: string;
}

export function TodayScreen() {
  const today = useMemo(() => new Date(), []);
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
          <CelebratingCard item={item} showDate={section.showDate} />
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
});
