import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { el } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { useTodayList, type TodayItem } from '@/features/today/hooks/useTodayList';
import { shadow, spacing, theme, typography } from '@/lib/ui/theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

// Stable, deterministic palette pair for an Avatar gradient. Same name → same colors.
const AVATAR_COLORS: [string, string][] = [
  ['#C9A961', '#8E6E2A'], // gold
  ['#3F6BAA', '#1F3D6E'], // aegean
  ['#C26A4A', '#7E3E25'], // terracotta
  ['#6F8E5F', '#3F5836'], // olive
  ['#B6588E', '#7A2F5A'], // hibiscus
  ['#5C8FA3', '#34616F'], // sea
  ['#A87049', '#6C4226'], // cinnamon
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function avatarColors(name: string): [string, string] {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length]!;
}

function monogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

function relativeDayLabel(date: Date, today: Date): string {
  const delta = differenceInCalendarDays(startOfDay(date), startOfDay(today));
  if (delta === 0) return 'Σήμερα';
  if (delta === 1) return 'Αύριο';
  if (delta < 0) return `Πριν ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'μέρα' : 'μέρες'}`;
  if (delta === 7) return 'Σε 1 εβδομάδα';
  return `Σε ${delta} ${delta === 1 ? 'μέρα' : 'μέρες'}`;
}

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

// ─── subcomponents ────────────────────────────────────────────────────────────

function Avatar({ name, ringed = false, size = 44 }: { name: string; ringed?: boolean; size?: number }) {
  const colors = avatarColors(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        },
        ringed && styles.avatarRing,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{monogram(name)}</Text>
      </LinearGradient>
    </View>
  );
}

interface CelebrantRowProps {
  item: TodayItem;
  onSend: () => void;
  onPress: () => void;
}

function CelebrantRow({ item, onSend, onPress }: CelebrantRowProps) {
  const subtitle =
    item.kind === 'nameday'
      ? item.saint ?? 'Ονομαστική'
      : item.ageThisYear !== undefined && item.ageThisYear > 0
        ? `Γενέθλια • κλείνει ${item.ageThisYear}`
        : 'Γενέθλια';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.celebrantRow, pressed && styles.pressed]}>
      <Avatar name={item.favorite.displayName} size={40} ringed={item.kind === 'nameday'} />
      <View style={styles.celebrantText}>
        <Text style={styles.celebrantName} numberOfLines={1}>
          {item.favorite.displayName}
        </Text>
        <Text style={styles.celebrantSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onSend}
        hitSlop={8}
        style={({ pressed }) => [styles.sendPill, pressed && styles.sendPillPressed]}
      >
        <Text style={styles.sendPillText}>Στείλε →</Text>
      </Pressable>
    </Pressable>
  );
}

interface UpcomingRowProps {
  item: TodayItem;
  today: Date;
  onPress: () => void;
}

function UpcomingRow({ item, today, onPress }: UpcomingRowProps) {
  const isToday = differenceInCalendarDays(startOfDay(item.date), startOfDay(today)) === 0;
  const monthLabel = format(item.date, 'MMM', { locale: el }).toUpperCase();
  const dayLabel = format(item.date, 'd', { locale: el });
  const typeLabel = item.kind === 'nameday' ? 'Ονομαστική' : 'Γενέθλια';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressedSubtle]}>
      <View style={[styles.dateChip, isToday && styles.dateChipToday]}>
        <Text style={[styles.dateChipMonth, isToday && styles.dateChipMonthToday]}>{monthLabel}</Text>
        <Text style={[styles.dateChipDay, isToday && styles.dateChipDayToday]}>{dayLabel}</Text>
      </View>
      <View style={styles.upcomingText}>
        <Text style={styles.upcomingName} numberOfLines={1}>
          {item.favorite.displayName}
        </Text>
        <View style={styles.upcomingMeta}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{typeLabel}</Text>
          </View>
          <Text style={styles.upcomingRelative}>{relativeDayLabel(item.date, today)}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function TodayScreenAegean() {
  const router = useRouter();
  const { favorites } = useFavorites();
  const [today, setToday] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { today: todayItems, upcoming } = useTodayList(today);

  const weekdayLabel = useMemo(
    () => format(today, 'EEEE', { locale: el }).toUpperCase(),
    [today],
  );
  const dateLabel = useMemo(() => format(today, 'd MMMM', { locale: el }), [today]);

  const openNew = () => router.push('/favorite/new');
  const openFavorite = (id: string) =>
    router.push({ pathname: '/favorite/[id]', params: { id } });

  // True first-launch empty state — no favorites yet, both lists empty.
  const isFirstLaunch = favorites.length === 0 && todayItems.length === 0 && upcoming.length === 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bgTop} />
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.weekday}>{weekdayLabel}</Text>
            <Text style={styles.date} numberOfLines={1}>{dateLabel}</Text>
          </View>
          <Pressable
            onPress={openNew}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressedSubtle]}
            accessibilityLabel="Προσθήκη αγαπημένου"
            hitSlop={8}
          >
            <Text style={styles.addButtonGlyph}>＋</Text>
          </Pressable>
        </View>

        {/* Hero card */}
        <LinearGradient
          colors={[theme.heroBgTop, theme.heroBgBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.hero, shadow.card]}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroCount}>{todayItems.length}</Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {todayItems.length === 1 ? 'ΣΗΜΕΡΑ ΓΙΟΡΤΑΖΕΙ' : 'ΣΗΜΕΡΑ ΓΙΟΡΤΑΖΟΥΝ'}
              </Text>
            </View>
          </View>
          {todayItems.length > 0 ? (
            <View style={styles.celebrantList}>
              {todayItems.map((item) => (
                <CelebrantRow
                  key={item.id}
                  item={item}
                  onPress={() => openFavorite(item.favorite.id)}
                  onSend={() => openFavorite(item.favorite.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.heroEmpty}>
              {isFirstLaunch
                ? 'Πρόσθεσε αγαπημένα για να δεις τις γιορτές τους εδώ.'
                : 'Κανείς δεν γιορτάζει σήμερα. Δες παρακάτω τις επερχόμενες γιορτές.'}
            </Text>
          )}
        </LinearGradient>

        {/* Upcoming section */}
        {upcoming.length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Επόμενες</Text>
              <View style={styles.wave} />
            </View>
            <View style={styles.upcomingList}>
              {upcoming.map((item) => (
                <UpcomingRow
                  key={item.id}
                  item={item}
                  today={today}
                  onPress={() => openFavorite(item.favorite.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        {isFirstLaunch ? (
          <Pressable
            onPress={openNew}
            style={({ pressed }) => [styles.firstCta, pressed && styles.pressedSubtle]}
          >
            <Text style={styles.firstCtaText}>Προσθήκη αγαπημένου</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  scroll: {
    paddingTop: spacing.statusBarOffset,
    paddingBottom: spacing.xxl + spacing.tabBarHeight,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  weekday: {
    ...typography.body.caption,
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1.6,
    color: theme.accent,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.display.title,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.ink,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.icon,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonGlyph: {
    fontSize: 22,
    lineHeight: 22,
    color: theme.accent,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Hero card
  hero: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.xl,
    marginBottom: 14,
    padding: 22,
    borderRadius: theme.radius.hero,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroCount: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 80,
    lineHeight: 84,
    letterSpacing: -2,
    color: theme.heroAccent,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
  },
  heroPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: theme.heroInk,
  },
  heroEmpty: {
    marginTop: spacing.md,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
  },
  celebrantList: { marginTop: spacing.lg, gap: spacing.sm },

  // Celebrant row
  celebrantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  celebrantText: { flex: 1, gap: 2 },
  celebrantName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.heroInk,
  },
  celebrantSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  sendPill: {
    backgroundColor: theme.heroAccent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.chip,
  },
  sendPillPressed: { opacity: 0.85 },
  sendPillText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13,
    color: theme.heroAccentInk,
  },

  // Section header
  sectionHeaderRow: {
    paddingHorizontal: spacing.screen,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: 6,
  },
  sectionHeader: {
    ...typography.display.section,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.ink,
  },
  wave: {
    height: 1.4,
    backgroundColor: theme.accent,
    opacity: 0.18,
    borderRadius: 1,
  },

  // Upcoming list
  upcomingList: {
    paddingHorizontal: spacing.screen,
    gap: 10,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateChip: {
    width: 50,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dateChipToday: { backgroundColor: theme.accent },
  dateChipMonth: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: theme.muted,
    opacity: 0.85,
  },
  dateChipMonthToday: { color: '#FFFFFFCC' },
  dateChipDay: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 24,
    color: theme.ink,
  },
  dateChipDayToday: { color: '#FFFFFF' },
  upcomingText: { flex: 1, gap: 4 },
  upcomingName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  upcomingMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeChip: {
    backgroundColor: theme.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.chip,
  },
  typeChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: theme.chipInk,
  },
  upcomingRelative: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  chevron: {
    fontSize: 22,
    color: theme.muted,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // First-launch CTA
  firstCta: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    backgroundColor: theme.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: theme.radius.chip,
  },
  firstCtaText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14,
    color: '#fff',
  },

  // Shared interaction styles
  pressed: { opacity: 0.9 },
  pressedSubtle: { opacity: 0.7 },
  avatarRing: {
    borderWidth: 2,
    borderColor: theme.gold,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
});
