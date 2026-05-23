import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG, type NamedayEntry } from '@/features/today/namedays/catalog';
import { spacing, theme } from '@/lib/ui/theme';

import type { NamedayMatchResult } from '../hooks/useNamedayMatch';

const NO_NAMEDAY = '__none__';

interface Props {
  match: NamedayMatchResult;
  selectedKey: string | null;
  onChange: (key: string | null) => void;
}

function celebrationDateLabel(entry: NamedayEntry): string {
  if (entry.celebration.type === 'fixed') {
    return `${String(entry.celebration.day).padStart(2, '0')}/${String(entry.celebration.month).padStart(2, '0')}`;
  }
  return entry.celebration.offset === 0
    ? 'Πάσχα'
    : `Πάσχα + ${entry.celebration.offset} ${entry.celebration.offset === 1 ? 'μέρα' : 'μέρες'}`;
}

interface CardProps {
  tone?: 'info' | 'gold' | 'muted';
  children: React.ReactNode;
}

function Card({ tone = 'info', children }: CardProps) {
  const palette =
    tone === 'gold'
      ? { bg: 'rgba(255, 201, 60, 0.10)', border: 'rgba(255, 201, 60, 0.40)' }
      : tone === 'muted'
        ? { bg: theme.surface2, border: theme.line }
        : { bg: theme.accentSoft, border: 'rgba(15, 76, 129, 0.20)' };
  return (
    <View style={[styles.card, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {children}
    </View>
  );
}

interface MatchedDisplayProps {
  entry: NamedayEntry;
  onChangePick: () => void;
  onNone: () => void;
}

function MatchedDisplay({ entry, onChangePick, onNone }: MatchedDisplayProps) {
  return (
    <Card tone="gold">
      <View style={styles.matchedHead}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles-outline" size={18} color={theme.goldDark} />
        </View>
        <View style={styles.matchedText}>
          <Text style={styles.matchedEyebrow}>ΘΑ ΓΙΟΡΤΑΖΕΙ ΩΣ</Text>
          <Text style={styles.matchedName}>{entry.primary_form}</Text>
        </View>
        <View style={styles.matchedDateChip}>
          <Text style={styles.matchedDateText}>{celebrationDateLabel(entry)}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={onChangePick} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.actionLink}>Αλλαγή ονόματος γιορτής</Text>
        </Pressable>
        <Text style={styles.actionDivider}>·</Text>
        <Pressable onPress={onNone} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.actionLink}>Καμία γιορτή</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export function NamedayConfirm({ match, selectedKey, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (match.kind === 'empty') return null;

  if (selectedKey === NO_NAMEDAY) {
    return (
      <Card tone="muted">
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <Ionicons name="close-circle-outline" size={18} color={theme.muted} />
          </View>
          <Text style={styles.headText}>Χωρίς γιορτή</Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.actionLink}>Επανέλεγχος</Text>
        </Pressable>
      </Card>
    );
  }

  if (selectedKey) {
    const entry = CATALOG.find((e) => e.nameday_key === selectedKey);
    if (entry) {
      return (
        <>
          <MatchedDisplay
            entry={entry}
            onChangePick={() => setPickerOpen(true)}
            onNone={() => onChange(NO_NAMEDAY)}
          />
          <CatalogPicker
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(key) => onChange(key)}
          />
        </>
      );
    }
  }

  if (match.kind === 'matched') {
    return (
      <>
        <MatchedDisplay
          entry={match.entry}
          onChangePick={() => setPickerOpen(true)}
          onNone={() => onChange(NO_NAMEDAY)}
        />
        <CatalogPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(key) => onChange(key)}
        />
      </>
    );
  }

  if (match.kind === 'multi') {
    return (
      <Card tone="info">
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <Ionicons name="git-branch-outline" size={18} color={theme.accent} />
          </View>
          <Text style={styles.headText}>Πολλές γιορτές για αυτό το όνομα. Επίλεξε:</Text>
        </View>
        <View style={styles.multiList}>
          {match.matches.map((entry) => (
            <Pressable
              key={entry.nameday_key}
              onPress={() => onChange(entry.nameday_key)}
              style={({ pressed }) => [styles.multiOption, pressed && styles.multiOptionPressed]}
            >
              <Text style={styles.multiOptionName}>{entry.primary_form}</Text>
              <View style={styles.multiOptionChip}>
                <Text style={styles.multiOptionChipText}>{celebrationDateLabel(entry)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => onChange(NO_NAMEDAY)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.actionLink}>Καμία γιορτή</Text>
        </Pressable>
      </Card>
    );
  }

  // match.kind === 'none'
  return (
    <>
      <Card tone="info">
        <View style={styles.head}>
          <View style={styles.iconWrap}>
            <Ionicons name="search-outline" size={18} color={theme.accent} />
          </View>
          <Text style={styles.headText}>Δεν βρέθηκε γιορτή για αυτό το όνομα.</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.actionLink}>Επίλεξε όνομα γιορτής</Text>
          </Pressable>
          <Text style={styles.actionDivider}>·</Text>
          <Pressable onPress={() => onChange(NO_NAMEDAY)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.actionLink}>Καμία γιορτή</Text>
          </Pressable>
        </View>
      </Card>
      <CatalogPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(key) => onChange(key)}
      />
    </>
  );
}

interface PickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
}

function CatalogPicker({ visible, onClose, onSelect }: PickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Επίλεξε γιορτή</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll}>
            {CATALOG.map((entry) => (
              <Pressable
                key={entry.nameday_key}
                style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
                onPress={() => {
                  onSelect(entry.nameday_key);
                  onClose();
                }}
              >
                <Text style={styles.sheetItemName}>{entry.primary_form}</Text>
                <View style={styles.sheetItemChip}>
                  <Text style={styles.sheetItemChipText}>{celebrationDateLabel(entry)}</Text>
                </View>
              </Pressable>
            ))}
            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headText: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 19,
    color: theme.ink,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Matched display
  matchedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  matchedText: { flex: 1, gap: 2 },
  matchedEyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.goldDark,
  },
  matchedName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.ink,
    letterSpacing: -0.2,
  },
  matchedDateChip: {
    backgroundColor: theme.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
  },
  matchedDateText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: theme.heroAccentInk,
    letterSpacing: 0.4,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionLink: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: theme.accent,
  },
  actionDivider: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: theme.muted,
  },

  // Multi
  multiList: { gap: 6 },
  multiOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  multiOptionPressed: { backgroundColor: theme.accentSoft },
  multiOptionName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: theme.ink,
  },
  multiOptionChip: {
    backgroundColor: theme.surface2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.chip,
  },
  multiOptionChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: theme.accent,
  },

  pressed: { opacity: 0.7 },

  // Bottom sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 34, 56, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 18,
    maxHeight: '78%',
    gap: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(14, 34, 56, 0.18)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.ink,
    letterSpacing: -0.3,
  },
  sheetScroll: { paddingHorizontal: 2 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sheetItemPressed: { backgroundColor: theme.accentSoft },
  sheetItemName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  sheetItemChip: {
    backgroundColor: theme.surface2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.chip,
  },
  sheetItemChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: theme.accent,
  },
});

export { NO_NAMEDAY };
