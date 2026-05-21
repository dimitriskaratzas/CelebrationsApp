import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RelationshipDef {
  value: string;
  label: string;
  icon: IoniconName;
}

export const RELATIONSHIPS: readonly RelationshipDef[] = [
  { value: 'parent',      label: 'Γονέας',          icon: 'home-outline' },
  { value: 'child',       label: 'Παιδί',           icon: 'happy-outline' },
  { value: 'sibling',     label: 'Αδέρφι',          icon: 'people-outline' },
  { value: 'spouse',      label: 'Σύζυγος',         icon: 'heart-outline' },
  { value: 'grandparent', label: 'Παππούς/Γιαγιά',  icon: 'flower-outline' },
  { value: 'friend',      label: 'Φίλος',           icon: 'hand-right-outline' },
  { value: 'colleague',   label: 'Συνάδελφος',      icon: 'briefcase-outline' },
  { value: 'other',       label: 'Άλλο',            icon: 'ellipsis-horizontal' },
] as const;

export type RelationshipValue = typeof RELATIONSHIPS[number]['value'];

export function relationshipLabel(value: string | null): string {
  if (!value) return 'Δεν έχει οριστεί';
  return RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;
}

export function relationshipIcon(value: string | null): IoniconName {
  if (!value) return 'help-outline';
  return RELATIONSHIPS.find((r) => r.value === value)?.icon ?? 'help-outline';
}

interface Props {
  visible: boolean;
  value: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

export function RelationshipPicker({ visible, value, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ΣΧΕΣΗ</Text>
              <Text style={styles.title}>Τι σχέση έχετε;</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.muted} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {RELATIONSHIPS.map((r) => {
              const selected = value === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => {
                    onSelect(r.value);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.tile,
                    selected && styles.tileSelected,
                    pressed && !selected && styles.tilePressed,
                  ]}
                >
                  <View style={[styles.tileIcon, selected && styles.tileIconSelected]}>
                    <Ionicons
                      name={r.icon}
                      size={20}
                      color={selected ? theme.heroAccentInk : theme.accent}
                    />
                  </View>
                  <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
          >
            <Text style={styles.clearText}>Καμία σχέση</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const TILE_GAP = 10;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14, 34, 56, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 22,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(14, 34, 56, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  headerText: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: theme.accent,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: theme.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    width: `${(100 - 3 * (TILE_GAP / 3.6)) / 4}%`,
    flexGrow: 1,
    flexBasis: '22%',
    aspectRatio: 1,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
  },
  tilePressed: { backgroundColor: theme.accentSoft },
  tileSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconSelected: {
    backgroundColor: theme.gold,
  },
  tileLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: theme.ink,
    textAlign: 'center',
  },
  tileLabelSelected: { color: '#fff' },

  clear: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  clearPressed: { opacity: 0.6 },
  clearText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: theme.muted,
  },
});
