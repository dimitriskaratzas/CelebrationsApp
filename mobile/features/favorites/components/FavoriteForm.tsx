import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { FavoriteInput } from '../db/favorites.repo';
import { useNamedayMatch } from '../hooks/useNamedayMatch';

import { BirthdayInput } from './BirthdayInput';
import { NamedayConfirm, NO_NAMEDAY } from './NamedayConfirm';
import { RelationshipPicker, relationshipLabel } from './RelationshipPicker';

export interface FavoriteFormInitial {
  displayName: string;
  namedayKey: string;
  birthDate: string | null;
  relationship: string | null;
  notes: string | null;
}

interface Props {
  initial?: FavoriteFormInitial;
  saveLabel: string;
  onSubmit: (input: FavoriteInput) => Promise<void> | void;
}

export function FavoriteForm({ initial, saveLabel, onSubmit }: Props) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(initial?.birthDate ?? null);
  const [relationship, setRelationship] = useState<string | null>(initial?.relationship ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [namedayKey, setNamedayKey] = useState<string | null>(
    initial?.namedayKey ? initial.namedayKey : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const match = useNamedayMatch(displayName);
  const namedayResolved = namedayKey !== null || match.kind === 'matched';
  const canSave =
    displayName.trim().length > 0 &&
    !saving &&
    (namedayResolved || birthDate !== null);

  const onSave = async () => {
    setSaving(true);
    try {
      const resolvedKey =
        namedayKey === NO_NAMEDAY
          ? ''
          : namedayKey ?? (match.kind === 'matched' ? match.entry.nameday_key : '');

      await onSubmit({
        displayName: displayName.trim(),
        namedayKey: resolvedKey,
        birthDate,
        relationship,
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Όνομα</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              setNamedayKey(null);
            }}
            placeholder="π.χ. Πατέρας, Γιώργος, …"
            maxLength={80}
            autoFocus={!initial}
          />
        </View>

        <NamedayConfirm match={match} selectedKey={namedayKey} onChange={setNamedayKey} />

        <BirthdayInput value={birthDate} onChange={setBirthDate} />

        <View style={styles.field}>
          <Text style={styles.label}>Σχέση</Text>
          <Pressable style={styles.input} onPress={() => setPickerOpen(true)}>
            <Text style={relationship ? styles.value : styles.placeholder}>
              {relationshipLabel(relationship)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Σημειώσεις (προαιρετικά)</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Π.χ. αγαπημένο φαγητό, αναμνήσεις…"
          />
        </View>

        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          disabled={!canSave}
          onPress={onSave}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Αποθήκευση…' : saveLabel}</Text>
        </Pressable>
      </ScrollView>

      <RelationshipPicker
        visible={pickerOpen}
        value={relationship}
        onSelect={setRelationship}
        onClose={() => setPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  value: { fontSize: 16, color: '#222' },
  placeholder: { fontSize: 16, color: '#999' },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#1565c0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
