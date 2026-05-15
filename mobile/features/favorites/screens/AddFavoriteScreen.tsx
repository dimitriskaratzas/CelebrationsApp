import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as repo from '../db/favorites.repo';
import { BirthdayInput } from '../components/BirthdayInput';
import { RelationshipPicker, relationshipLabel } from '../components/RelationshipPicker';

export function AddFavoriteScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = displayName.trim().length > 0 && !saving;

  const onSave = async () => {
    setSaving(true);
    try {
      const cap = await repo.countLive();
      if (cap >= 10) {
        Alert.alert(
          'Όριο 10 αγαπημένων',
          'Έχεις φτάσει το όριο των 10 αγαπημένων στη δωρεάν έκδοση.',
        );
        return;
      }

      await repo.create({
        displayName: displayName.trim(),
        namedayKey: '',
        birthDate,
        relationship,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Σφάλμα', e instanceof Error ? e.message : String(e));
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
            onChangeText={setDisplayName}
            placeholder="π.χ. Πατέρας, Γιώργος, …"
            maxLength={80}
            autoFocus
          />
        </View>

        <BirthdayInput value={birthDate} onChange={setBirthDate} />

        <View style={styles.field}>
          <Text style={styles.label}>Σχέση</Text>
          <Pressable
            style={styles.input}
            onPress={() => setPickerOpen(true)}
          >
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
          <Text style={styles.saveBtnText}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</Text>
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
