import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isoDateKey, upcomingCatalogDays, type CatalogDay } from '@/features/today/lib/upcomingCatalog';
import { spacing, theme } from '@/lib/ui/theme';

import { CatalogDaySheet } from './CatalogDaySheet';

interface Props {
  today: Date;
  /** Number of forward days to scan (today is excluded — the Hero already shows it). */
  days?: number;
}

const NAMES_ON_CARD = 2;

export function UpcomingCatalogCarousel({ today, days = 14 }: Props) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<CatalogDay | null>(null);

  const items = useMemo(() => upcomingCatalogDays(today, days), [today, days]);

  if (items.length === 0) return null;

  const onPickSaint = (displayName: string, namedayKey: string) => {
    setOpenDay(null);
    router.push({
      pathname: '/favorite/new',
      params: { prefillName: displayName, prefillNamedayKey: namedayKey },
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Επόμενες γιορτές στον κατάλογο</Text>
        <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'μέρα' : 'μέρες'} με γιορτή</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
      >
        {items.map((day) => (
          <DayCard key={isoDateKey(day.date)} day={day} onPress={() => setOpenDay(day)} />
        ))}
      </ScrollView>

      <CatalogDaySheet
        day={openDay}
        onClose={() => setOpenDay(null)}
        onPickSaint={onPickSaint}
      />
    </View>
  );
}

function DayCard({ day, onPress }: { day: CatalogDay; onPress: () => void }) {
  const weekday = format(day.date, 'EEE', { locale: el }).toUpperCase();
  const dayNum = format(day.date, 'd', { locale: el });
  const monthShort = format(day.date, 'MMM', { locale: el }).toUpperCase();

  const visible = day.saints.slice(0, NAMES_ON_CARD);
  const overflow = day.saints.length - visible.length;
  const namesLine = visible.map((s) => s.primary_form).join(', ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.cardWeekday}>{weekday}</Text>
      <View style={styles.cardDateRow}>
        <Text style={styles.cardDay}>{dayNum}</Text>
        <Text style={styles.cardMonth}>{monthShort}</Text>
      </View>
      <View style={styles.cardSpacer} />
      <Text style={styles.cardNames} numberOfLines={2}>
        {namesLine}
      </Text>
      {overflow > 0 ? (
        <Text style={styles.cardOverflow}>+{overflow} ακόμη</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
  },
  headerRow: {
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    gap: 2,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.ink,
  },
  subtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  scroll: {
    paddingHorizontal: spacing.screen,
    gap: 10,
  },
  card: {
    width: 140,
    minHeight: 140,
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardPressed: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  cardWeekday: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.accent,
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  cardDay: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    lineHeight: 32,
    color: theme.ink,
    letterSpacing: -0.5,
  },
  cardMonth: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: theme.muted,
    letterSpacing: 1,
  },
  cardSpacer: { flex: 1 },
  cardNames: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: theme.ink,
  },
  cardOverflow: {
    marginTop: 3,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: theme.muted,
  },
});
