import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG, type NamedayEntry } from '@/features/today/namedays/catalog';

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
  return 'Πάσχα' + (entry.celebration.offset !== 0 ? ` +${entry.celebration.offset}μ` : '');
}

export function NamedayConfirm({ match, selectedKey, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (match.kind === 'empty') return null;

  if (selectedKey === NO_NAMEDAY) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>Δεν θα γιορτάζει.</Text>
        <Pressable onPress={() => onChange(null)}>
          <Text style={styles.link}>Επανέλεγχος</Text>
        </Pressable>
      </View>
    );
  }

  if (selectedKey) {
    const entry = CATALOG.find((e) => e.nameday_key === selectedKey);
    if (entry) {
      return (
        <>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Θα γιορτάζει ως <Text style={styles.bold}>{entry.primary_form}</Text>{' '}
              ({celebrationDateLabel(entry)}).
            </Text>
            <Pressable onPress={() => setPickerOpen(true)}>
              <Text style={styles.link}>Αλλαγή ονόματος γιορτής</Text>
            </Pressable>
          </View>
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
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Θα γιορτάζει ως <Text style={styles.bold}>{match.entry.primary_form}</Text>{' '}
            ({celebrationDateLabel(match.entry)}).
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={() => onChange(match.entry.nameday_key)}>
              <Text style={styles.link}>Επιβεβαίωση</Text>
            </Pressable>
            <Pressable onPress={() => setPickerOpen(true)}>
              <Text style={styles.link}>Αλλαγή</Text>
            </Pressable>
            <Pressable onPress={() => onChange(NO_NAMEDAY)}>
              <Text style={styles.link}>Καμία γιορτή</Text>
            </Pressable>
          </View>
        </View>
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
      <View style={styles.card}>
        <Text style={styles.cardText}>Πολλές γιορτές για αυτό το όνομα. Επίλεξε:</Text>
        {match.matches.map((entry) => (
          <Pressable
            key={entry.nameday_key}
            style={styles.choice}
            onPress={() => onChange(entry.nameday_key)}
          >
            <Text style={styles.choiceText}>
              {entry.primary_form} ({celebrationDateLabel(entry)})
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onChange(NO_NAMEDAY)}>
          <Text style={styles.link}>Καμία γιορτή</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardText}>Δεν βρέθηκε γιορτή για αυτό το όνομα.</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => setPickerOpen(true)}>
            <Text style={styles.link}>Επίλεξε όνομα γιορτής</Text>
          </Pressable>
          <Pressable onPress={() => onChange(NO_NAMEDAY)}>
            <Text style={styles.link}>Καμία γιορτή</Text>
          </Pressable>
        </View>
      </View>
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
        <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.pickerTitle}>Επίλεξε γιορτή</Text>
          <ScrollView>
            {CATALOG.map((entry) => (
              <Pressable
                key={entry.nameday_key}
                style={styles.pickerItem}
                onPress={() => {
                  onSelect(entry.nameday_key);
                  onClose();
                }}
              >
                <Text style={styles.pickerItemPrimary}>{entry.primary_form}</Text>
                <Text style={styles.pickerItemSecondary}>{celebrationDateLabel(entry)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  cardText: { fontSize: 14, color: '#333' },
  bold: { fontWeight: '600' },
  link: { color: '#1565c0', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  choice: { paddingVertical: 8 },
  choiceText: { fontSize: 14, color: '#1565c0' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    maxHeight: '70%',
  },
  pickerTitle: { paddingHorizontal: 12, paddingVertical: 8, fontWeight: '600', fontSize: 16 },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  pickerItemPrimary: { fontSize: 15 },
  pickerItemSecondary: { fontSize: 13, color: '#666' },
});

export { NO_NAMEDAY };
