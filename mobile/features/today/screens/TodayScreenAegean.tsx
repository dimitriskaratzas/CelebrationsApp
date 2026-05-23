import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { el } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { UpcomingCatalogCarousel } from '@/features/today/components/UpcomingCatalogCarousel';
import { useTodayList, type SaintOfDay, type TodayItem } from '@/features/today/hooks/useTodayList';
import { Avatar } from '@/lib/ui/Avatar';
import { shadow, spacing, theme, typography } from '@/lib/ui/theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

function relativeDayLabel(date: Date, today: Date): string {
  const delta = differenceInCalendarDays(startOfDay(date), startOfDay(today));
  if (delta === 0) return 'Σήμερα';
  if (delta === 1) return 'Αύριο';
  if (delta < 0) return `Πριν ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'μέρα' : 'μέρες'}`;
  if (delta === 7) return 'Σε 1 εβδομάδα';
  return `Σε ${delta} ${delta === 1 ? 'μέρα' : 'μέρες'}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Joins primary forms naturally: "Γιώργος", "Γιώργος, Γεωργία", "Γιώργος, Γεωργία και Αλέξανδρος".
// Caps at MAX visible names; surfaces the remainder as "και X ακόμη" to keep the hero
// from blowing up on synaxis days that list 8+ celebrating names.
function joinPrimaryForms(saints: SaintOfDay[], max = 5): string {
  const names = saints.map((s) => s.primary_form);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length <= max) {
    if (names.length === 2) return `${names[0]} και ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} και ${names[names.length - 1]}`;
  }
  const head = names.slice(0, max).join(', ');
  const rest = names.length - max;
  return `${head} και ${rest} ${rest === 1 ? 'ακόμη' : 'ακόμη'}`;
}

// Picks a font size for the primary saint title that doesn't truncate ugly. Long
// synaxis names ("Σύναξις της Υπεραγίας Θεοτόκου των Βλαχερνών") get a smaller size
// so they fit in 3 lines instead of getting cut off mid-word.
function heroTitleSize(text: string): { fontSize: number; lineHeight: number } {
  const len = text.length;
  if (len > 50) return { fontSize: 20, lineHeight: 26 };
  if (len > 30) return { fontSize: 24, lineHeight: 29 };
  return { fontSize: 28, lineHeight: 32 };
}

const MAX_EXTRA_SAINTS = 3;

// Subtitle for today's favorites row, accounting for the rare same-day
// nameday+birthday collision (e.g. Μαρία born on Δεκαπενταύγουστο).
function todaySubtitle(item: TodayItem): string {
  if (item.also) {
    const both = item.kind === 'birthday'
      ? 'Γενέθλια + Ονομαστική'
      : 'Ονομαστική + Γενέθλια';
    if (item.ageThisYear !== undefined && item.ageThisYear > 0) {
      return `${both} • κλείνει ${item.ageThisYear}`;
    }
    return both;
  }
  if (item.kind === 'nameday') return item.saint ?? 'Ονομαστική';
  return item.ageThisYear !== undefined && item.ageThisYear > 0
    ? `Γενέθλια • κλείνει ${item.ageThisYear}`
    : 'Γενέθλια';
}

function kindLabel(item: TodayItem): string {
  if (item.also) {
    return item.kind === 'birthday'
      ? 'Γενέθλια + Ονομαστική'
      : 'Ονομαστική + Γενέθλια';
  }
  return item.kind === 'nameday' ? 'Ονομαστική' : 'Γενέθλια';
}

// ─── subcomponents ────────────────────────────────────────────────────────────

interface HeroProps {
  saintsToday: SaintOfDay[];
}

function Hero({ saintsToday }: HeroProps) {
  const hasSaints = saintsToday.length > 0;
  const primary = saintsToday[0];
  const allExtras = saintsToday.slice(1);
  const visibleExtras = allExtras.slice(0, MAX_EXTRA_SAINTS);
  const hiddenExtras = allExtras.length - visibleExtras.length;
  const formsLine = hasSaints ? joinPrimaryForms(saintsToday) : '';
  const titleSizing = primary ? heroTitleSize(primary.saint) : null;

  return (
    <LinearGradient
      colors={[theme.heroBgTop, theme.heroBgBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, shadow.card]}
    >
      {/* Decorative arc — subtle gold corner curve */}
      <View style={styles.heroArc} pointerEvents="none" />

      <View style={styles.heroEyebrowRow}>
        <View style={styles.heroEyebrowDot} />
        <Text style={styles.heroEyebrow}>
          {hasSaints ? 'Η ΓΙΟΡΤΗ ΣΗΜΕΡΑ' : 'ΣΗΜΕΡΑ'}
        </Text>
      </View>

      {hasSaints ? (
        <>
          <Text style={[styles.heroSaint, titleSizing]} numberOfLines={3}>
            {primary!.saint}
          </Text>
          {visibleExtras.length > 0 ? (
            <Text style={styles.heroSaintExtra} numberOfLines={2}>
              {visibleExtras.map((s) => s.saint).join(' · ')}
              {hiddenExtras > 0 ? ` · και ${hiddenExtras} ακόμη` : ''}
            </Text>
          ) : null}

          <View style={styles.heroFormsRow}>
            <Text style={styles.heroFormsLead}>Γιορτάζει:</Text>
            <Text style={styles.heroFormsValue} numberOfLines={2}>
              {formsLine}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heroSaint}>Ήσυχη μέρα.</Text>
          <Text style={styles.heroQuietSub}>
            Καμία γιορτή σήμερα. Δες ποιοι γιορτάζουν τις επόμενες μέρες.
          </Text>
        </>
      )}
    </LinearGradient>
  );
}

interface FavoriteTodayRowProps {
  item: TodayItem;
  onPress: () => void;
  onSend: () => void;
}

function FavoriteTodayRow({ item, onPress, onSend }: FavoriteTodayRowProps) {
  const subtitle = todaySubtitle(item);
  const ringed = item.kind === 'nameday' || item.also === 'nameday';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.favRow, pressed && styles.favRowPressed]}>
      <Avatar name={item.favorite.displayName} size={44} ringed={ringed} />
      <View style={styles.favText}>
        <Text style={styles.favName} numberOfLines={1}>
          {item.favorite.displayName}
        </Text>
        <Text style={styles.favSub} numberOfLines={1}>
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

interface RecentRowProps {
  item: TodayItem;
  today: Date;
  onPress: () => void;
  onSend: () => void;
}

function RecentRow({ item, today, onPress, onSend }: RecentRowProps) {
  const delta = differenceInCalendarDays(startOfDay(today), startOfDay(item.date));
  const daysAgoLabel =
    delta === 1 ? 'Χθες' : delta === 2 ? 'Προχθές' : `Πριν ${delta} μέρες`;
  const typeLabel = kindLabel(item);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.favRow, pressed && styles.favRowPressed]}>
      <Avatar name={item.favorite.displayName} size={44} />
      <View style={styles.favText}>
        <Text style={styles.favName} numberOfLines={1}>
          {item.favorite.displayName}
        </Text>
        <Text style={styles.favSub} numberOfLines={1}>
          {daysAgoLabel} • {typeLabel}
        </Text>
      </View>
      <Pressable
        onPress={onSend}
        hitSlop={8}
        style={({ pressed }) => [styles.sendPillLate, pressed && styles.sendPillPressed]}
      >
        <Text style={styles.sendPillLateText}>Ευχήσου →</Text>
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
  const typeLabel = kindLabel(item);

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

// Open the OS share sheet with a Greek wishes message for the given favorite.
// The favorite's nameday/birthday already happened or is happening; this is the
// "Στείλε →" CTA on the Today screen.
function shareWishesFor(item: TodayItem): void {
  const name = item.favorite.displayName.trim();
  const message =
    item.kind === 'nameday'
      ? `Χρόνια πολλά ${name}! Να χαίρεσαι το όνομά σου.`
      : `Χρόνια πολλά ${name}! Να τα εκατοστήσεις!`;
  Share.share({ message }).catch(() => {
    // User dismissed or the OS rejected — no-op.
  });
}

// Same as shareWishesFor but for celebrations that have already passed (Recent rail).
// The message acknowledges the lateness so the user doesn't have to draft it themselves.
function shareLateWishesFor(item: TodayItem): void {
  const name = item.favorite.displayName.trim();
  const message =
    item.kind === 'nameday'
      ? `Χρόνια πολλά ${name}, έστω και καθυστερημένα! Να χαίρεσαι το όνομά σου.`
      : `Χρόνια πολλά ${name}, έστω και καθυστερημένα! Να τα εκατοστήσεις!`;
  Share.share({ message }).catch(() => {});
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function TodayScreenAegean() {
  const router = useRouter();
  const { favorites } = useFavorites();
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setToday((prev) => (isSameDay(prev, now) ? prev : now));
    };
    // Light poll every 60s. Catches clock-change scenarios (user manually
    // adjusts the device clock while the app is foreground) and midnight
    // rollover without us needing to manage a precise setTimeout chain.
    const interval = setInterval(tick, 60_000);

    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const { today: todayItems, upcoming, recent, saintsToday } = useTodayList(today);

  const weekdayLabel = useMemo(
    () => format(today, 'EEEE', { locale: el }).toUpperCase(),
    [today],
  );
  const dateLabel = useMemo(() => format(today, 'd MMMM', { locale: el }), [today]);

  // Pre-emptive cap check so the user doesn't fill out the entire form just to
  // be told they're at the limit on Save. AddFavoriteScreen still enforces the
  // same cap on submit as a backstop. Keep the two limits in sync (10).
  const FREE_TIER_CAP = 10;
  const openNew = () => {
    if (favorites.length >= FREE_TIER_CAP) {
      Alert.alert(
        'Όριο 10 αγαπημένων',
        'Έχεις φτάσει το όριο των 10 αγαπημένων στη δωρεάν έκδοση.',
      );
      return;
    }
    router.push('/favorite/new');
  };
  const openFavorite = (id: string) =>
    router.push({ pathname: '/favorite/[id]', params: { id } });

  const isFirstLaunch =
    favorites.length === 0 && todayItems.length === 0 && upcoming.length === 0 && recent.length === 0;
  const showFavoritesSection = favorites.length > 0; // hide when user has no favorites at all

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bgTop} />
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        {/* Hero: the celebration of the day (saints + primary forms) */}
        <Hero saintsToday={saintsToday} />

        {/* Upcoming-catalog carousel: discoverability rail showing the next two
            weeks of the eortologio, with tap-to-add for any saint. */}
        <UpcomingCatalogCarousel today={today} />

        {/* From your favorites */}
        {showFavoritesSection ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Από τα αγαπημένα σου</Text>
              <View style={styles.wave} />
            </View>

            {todayItems.length > 0 ? (
              <View style={styles.favList}>
                {todayItems.map((item) => (
                  <FavoriteTodayRow
                    key={item.id}
                    item={item}
                    onPress={() => openFavorite(item.favorite.id)}
                    onSend={() => shareWishesFor(item)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.favEmptyCard}>
                <View style={styles.favEmptyIcon}>
                  <Ionicons name="leaf-outline" size={18} color={theme.accent} />
                </View>
                <Text style={styles.favEmptyText}>
                  Κανείς από τους αγαπημένους σου δεν γιορτάζει σήμερα.
                </Text>
              </View>
            )}
          </>
        ) : null}

        {/* Recent section — favorites whose celebration just passed. The "send late wishes"
            CTA prefills a message that acknowledges the lateness so the user doesn't have to. */}
        {recent.length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Πρόσφατες γιορτές</Text>
              <View style={styles.wave} />
            </View>
            <View style={styles.favList}>
              {recent.map((item) => (
                <RecentRow
                  key={item.id}
                  item={item}
                  today={today}
                  onPress={() => openFavorite(item.favorite.id)}
                  onSend={() => shareLateWishesFor(item)}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Upcoming section */}
        {upcoming.length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Επόμενες γιορτές</Text>
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

  // Hero card — celebration of the day
  hero: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.xl,
    marginBottom: 6,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    borderRadius: theme.radius.hero,
    overflow: 'hidden',
    minHeight: 168,
  },
  heroArc: {
    // Soft amber glow in the top-right corner of the hero — gives the cobalt depth
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -110,
    top: -110,
    backgroundColor: 'rgba(255, 201, 60, 0.16)',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.heroAccent,
  },
  heroEyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.78)',
  },
  heroSaint: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: theme.heroAccent,
  },
  heroSaintExtra: {
    marginTop: 4,
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.78)',
  },
  heroQuietSub: {
    marginTop: 6,
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
    maxWidth: 280,
  },
  heroFormsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroFormsLead: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },
  heroFormsValue: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    lineHeight: 20,
    color: '#fff',
  },

  // Section header
  sectionHeaderRow: {
    paddingHorizontal: spacing.screen,
    marginTop: spacing.xl,
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

  // Favorites today list
  favList: {
    paddingHorizontal: spacing.screen,
    gap: 10,
  },
  favRow: {
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
  favRowPressed: { backgroundColor: theme.accentSoft },
  favText: { flex: 1, gap: 2 },
  favName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  favSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  sendPill: {
    backgroundColor: theme.gold,
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
  // Outlined variant for the Recent rail — signals "secondary action, still
  // worth doing" without competing visually with today's solid amber pill.
  sendPillLate: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.chip,
    borderWidth: 1.5,
    borderColor: theme.gold,
    backgroundColor: 'transparent',
  },
  sendPillLateText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13,
    color: theme.accent,
  },

  // Empty favorites-today card
  favEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.screen,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
  },
  favEmptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favEmptyText: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 19,
    color: theme.muted,
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

  // Shared interaction
  pressedSubtle: { opacity: 0.7 },
});
