import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CatalogDay } from '@/features/today/lib/upcomingCatalog';
import { spacing, theme } from '@/lib/ui/theme';

interface Props {
  day: CatalogDay | null;
  onClose: () => void;
  /** Called when the user taps a saint row — should open the Add Favorite flow prefilled. */
  onPickSaint: (displayName: string, namedayKey: string) => void;
}

export function CatalogDaySheet({ day, onClose, onPickSaint }: Props) {
  return (
    <Modal
      visible={day !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {day ? <Header date={day.date} count={day.saints.length} /> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {day?.saints.map((s) => (
              <Pressable
                key={s.nameday_key}
                onPress={() => onPickSaint(s.primary_form, s.nameday_key)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {s.primary_form}
                  </Text>
                  <Text style={styles.rowSaint} numberOfLines={2}>
                    {s.saint}
                  </Text>
                </View>
                <View style={styles.addCta}>
                  <Ionicons name="add" size={18} color={theme.accent} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Header({ date, count }: { date: Date; count: number }) {
  const weekday = format(date, 'EEEE', { locale: el });
  const long = format(date, 'd MMMM', { locale: el });
  return (
    <View style={styles.header}>
      <Text style={styles.headerWeekday}>{weekday.toUpperCase()}</Text>
      <Text style={styles.headerDate}>{long}</Text>
      <Text style={styles.headerHint}>
        {count === 1 ? '1 γιορτή' : `${count} γιορτές`} • πάτα για προσθήκη
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 34, 56, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingTop: 8,
    paddingBottom: 22,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(14, 34, 56, 0.18)',
    marginBottom: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    gap: 2,
  },
  headerWeekday: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.accent,
  },
  headerDate: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: theme.ink,
    letterSpacing: -0.3,
  },
  headerHint: {
    marginTop: 2,
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  scroll: { maxHeight: 480 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  rowPressed: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  rowText: { flex: 1, gap: 2 },
  rowPrimary: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  rowSaint: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: theme.muted,
  },
  addCta: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
