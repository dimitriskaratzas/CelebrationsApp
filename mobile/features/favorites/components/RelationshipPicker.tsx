import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export const RELATIONSHIPS = [
  { value: 'parent', label: 'Γονέας' },
  { value: 'child', label: 'Παιδί' },
  { value: 'sibling', label: 'Αδέρφι' },
  { value: 'spouse', label: 'Σύζυγος' },
  { value: 'grandparent', label: 'Παππούς/Γιαγιά' },
  { value: 'friend', label: 'Φίλος' },
  { value: 'colleague', label: 'Συνάδελφος' },
  { value: 'other', label: 'Άλλο' },
] as const;

export type RelationshipValue = typeof RELATIONSHIPS[number]['value'];

export function relationshipLabel(value: string | null): string {
  if (!value) return 'Δεν έχει οριστεί';
  return RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;
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
          <Text style={styles.title}>Σχέση</Text>
          <Pressable
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            style={[styles.option, value === null && styles.optionSelected]}
          >
            <Text style={styles.optionText}>Δεν έχει οριστεί</Text>
          </Pressable>
          {RELATIONSHIPS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => {
                onSelect(r.value);
                onClose();
              }}
              style={[styles.option, value === r.value && styles.optionSelected]}
            >
              <Text style={styles.optionText}>{r.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  title: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600', fontSize: 16 },
  option: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  optionSelected: { backgroundColor: '#e3f2fd' },
  optionText: { fontSize: 16 },
});
