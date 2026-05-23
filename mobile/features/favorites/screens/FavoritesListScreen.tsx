import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSync } from '@/lib/sync/SyncProvider';
import { Avatar } from '@/lib/ui/Avatar';
import { Banner } from '@/lib/ui/Banner';
import { EmptyState } from '@/lib/ui/EmptyState';
import { shadow, spacing, theme, typography } from '@/lib/ui/theme';

import type { Favorite } from '../db/favorites.repo';
import { useFavorites } from '../hooks/useFavorites';
import { useStuckOutbox } from '../hooks/useStuckOutbox';
import { nextCelebrationFor, type CelebrationDate } from '@/features/today/lib/nextCelebration';

const FREE_TIER_CAP = 10;

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: 'Γονέας',
  child: 'Παιδί',
  sibling: 'Αδέρφι',
  spouse: 'Σύζυγος',
  grandparent: 'Παππούς/Γιαγιά',
  friend: 'Φίλος',
  colleague: 'Συνάδελφος',
  other: 'Άλλο',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function relativeLabel(date: Date, today: Date): string {
  const ms = date.getTime() - today.getTime();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return 'Σήμερα';
  if (days === 1) return 'Αύριο';
  if (days <= 7) return `σε ${days} ${days === 1 ? 'μέρα' : 'μέρες'}`;
  if (days <= 30) return `σε ${days} μέρες`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `σε ${months} ${months === 1 ? 'μήνα' : 'μήνες'}`;
  }
  return `σε ${Math.floor(days / 365)} χρόνια`;
}

interface RowProps {
  favorite: Favorite;
  next: CelebrationDate | null;
  today: Date;
  onPress: () => void;
}

function FavoriteRow({ favorite, next, today, onPress }: RowProps) {
  const isNameday = next?.kind === 'nameday' || Boolean(favorite.namedayKey);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Avatar name={favorite.displayName} ringed={isNameday} size={44} />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {favorite.displayName}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {favorite.relationship
            ? RELATIONSHIP_LABELS[favorite.relationship] ?? favorite.relationship
            : 'Χωρίς σχέση'}
          {next?.kind === 'birthday' && next.ageThisYear && next.ageThisYear > 0
            ? ` · κλείνει ${next.ageThisYear}`
            : null}
        </Text>
      </View>
      {next ? (
        <View style={styles.rowRight}>
          <Text style={styles.rowDate}>{format(next.date, 'd MMM', { locale: el })}</Text>
          <Text style={styles.rowRelative}>{relativeLabel(next.date, today)}</Text>
        </View>
      ) : (
        <Text style={styles.rowMissing}>—</Text>
      )}
      {favorite.dirty ? <View style={styles.dirtyDot} /> : null}
    </Pressable>
  );
}

export function FavoritesListScreen() {
  const router = useRouter();
  const { favorites, loading } = useFavorites();
  const { syncNow, isSyncing } = useSync();
  const stuck = useStuckOutbox();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const atCap = favorites.length >= FREE_TIER_CAP;
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const enriched = favorites.map((f) => ({
      favorite: f,
      next: nextCelebrationFor(f, today),
    }));

    const q = normalize(search.trim());
    const filtered = q
      ? enriched.filter(({ favorite }) => normalize(favorite.displayName).includes(q))
      : enriched;

    filtered.sort((a, b) => {
      // Favorites with an upcoming celebration sort earlier (closest first); the
      // ones without dates fall to the bottom alphabetically.
      if (a.next && b.next) return a.next.date.getTime() - b.next.date.getTime();
      if (a.next) return -1;
      if (b.next) return 1;
      return a.favorite.displayName.localeCompare(b.favorite.displayName, 'el');
    });

    return filtered;
  }, [favorites, search, today]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bgTop} />
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <FlatList
        data={rows}
        keyExtractor={({ favorite }) => favorite.id}
        renderItem={({ item }) => (
          <FavoriteRow
            favorite={item.favorite}
            next={item.next}
            today={today}
            onPress={() => router.push({ pathname: '/favorite/[id]', params: { id: item.favorite.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.titleEyebrow}>ΤΑ ΑΓΑΠΗΜΕΝΑ ΣΟΥ</Text>
                <Text style={styles.title}>Αγαπημένα</Text>
              </View>
              <Pressable
                onPress={() => router.push('/favorite/new')}
                disabled={atCap}
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && !atCap && styles.pressedSubtle,
                  atCap && styles.addBtnDisabled,
                ]}
                hitSlop={8}
                accessibilityLabel="Προσθήκη αγαπημένου"
                accessibilityState={{ disabled: atCap }}
              >
                <Text style={styles.addBtnGlyph}>＋</Text>
              </Pressable>
            </View>

            {/* Free-tier meter card */}
            <View style={[styles.meterCard, shadow.row]}>
              <View style={styles.meterRow}>
                <Text style={styles.meterCount}>
                  {favorites.length} / {FREE_TIER_CAP} αγαπημένα
                </Text>
                <Text style={styles.meterTeaser}>Premium: 1.99€/μήνα</Text>
              </View>
              <View style={styles.meterTrack}>
                <LinearGradient
                  colors={[theme.gold, theme.goldDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.meterFill,
                    { width: `${Math.min(100, (favorites.length / FREE_TIER_CAP) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={theme.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Αναζήτηση…"
                placeholderTextColor={theme.muted}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.muted} />
                </Pressable>
              ) : null}
            </View>

            {/* Banners */}
            {atCap || stuck.capReached ? (
              <View style={styles.banner}>
                <Banner
                  tone="warning"
                  message="Έχεις φτάσει το όριο των 10 αγαπημένων. Διέγραψε κάποιους για να προσθέσεις νέους."
                />
              </View>
            ) : stuck.totalStuck > 0 ? (
              <View style={styles.banner}>
                <Banner tone="warning" message="Κάποιες αλλαγές δεν αποθηκεύτηκαν στον διακομιστή." />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title={search ? 'Δεν βρέθηκε αγαπημένο' : 'Δεν έχεις προσθέσει αγαπημένα ακόμη'}
              message={
                search
                  ? 'Δοκίμασε άλλη αναζήτηση ή πρόσθεσε καινούργιο αγαπημένο.'
                  : 'Πρόσθεσε τον πρώτο σου αγαπημένο για να ξεκινήσεις.'
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  list: {
    paddingTop: spacing.statusBarOffset,
    paddingBottom: spacing.xxl + spacing.tabBarHeight,
  },
  separator: { height: 10 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  titleEyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1.6,
    color: theme.accent,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display.title,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.ink,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.icon,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnGlyph: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 22,
    color: theme.accent,
  },

  // Meter
  meterCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.screen,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.card,
    borderColor: theme.line,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meterCount: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: theme.ink,
  },
  meterTeaser: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: theme.goldDark,
  },
  meterTrack: {
    height: 6,
    backgroundColor: theme.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 3 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginHorizontal: spacing.screen,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.input,
    borderColor: theme.line,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: theme.ink,
    padding: 0,
  },

  banner: {
    marginTop: spacing.md,
    marginHorizontal: spacing.screen,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: spacing.screen,
  },
  rowPressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 3 },
  rowName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  rowMeta: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowDate: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: theme.ink,
  },
  rowRelative: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: theme.muted,
  },
  rowMissing: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: theme.muted,
  },
  dirtyDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.gold,
  },

  pressedSubtle: { opacity: 0.7 },
});
