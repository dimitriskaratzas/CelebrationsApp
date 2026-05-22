import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
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

import { suggestByPrefix } from '@/features/today/namedays/catalog';
import { shadow, spacing, theme } from '@/lib/ui/theme';

import type { FavoriteInput } from '../db/favorites.repo';
import { useNamedayMatch } from '../hooks/useNamedayMatch';

import { BirthdayInput } from './BirthdayInput';
import { NameAutocomplete } from './NameAutocomplete';
import { NamedayConfirm, NO_NAMEDAY } from './NamedayConfirm';
import {
  relationshipIcon,
  relationshipLabel,
  RelationshipPicker,
} from './RelationshipPicker';

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
  /** Optional eyebrow text shown above the title; defaults to the saveLabel parent's intent. */
  eyebrow?: string;
  /** Title rendered at the top of the form. */
  title?: string;
  /** Optional extra content rendered below Notes (e.g. per-favorite notification overrides). */
  extraSection?: React.ReactNode;
  onSubmit: (input: FavoriteInput) => Promise<void> | void;
}

// ─── Floating-label text field ────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  innerRef?: (ref: TextInput | null) => void;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  autoFocus,
  innerRef,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const isFloating = focused || value.length > 0;
  return (
    <View
      style={[
        styles.field,
        focused && styles.fieldFocused,
        multiline && styles.fieldMultiline,
      ]}
    >
      <Text style={[styles.fieldLabel, isFloating && styles.fieldLabelFloating]}>
        {label}
      </Text>
      <TextInput
        ref={innerRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={isFloating ? placeholder : undefined}
        placeholderTextColor="rgba(14, 34, 56, 0.30)"
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        selectionColor={theme.accent}
      />
    </View>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function FavoriteForm({
  initial,
  saveLabel,
  eyebrow,
  title,
  extraSection,
  onSubmit,
}: Props) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(initial?.birthDate ?? null);
  const [relationship, setRelationship] = useState<string | null>(initial?.relationship ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  // Empty-string namedayKey means "user explicitly opted out" (Καμία γιορτή).
  const [namedayKey, setNamedayKey] = useState<string | null>(() => {
    if (initial?.namedayKey === '') return NO_NAMEDAY;
    return initial?.namedayKey ?? null;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const match = useNamedayMatch(displayName);
  const namedayResolved = namedayKey !== null || match.kind === 'matched';

  const suggestions = useMemo(() => {
    if (namedayKey !== null) return [];
    if (match.kind === 'matched') return [];
    return suggestByPrefix(displayName, 5);
  }, [displayName, namedayKey, match.kind]);

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
    <View style={styles.screen}>
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(eyebrow || title) ? (
            <View style={styles.header}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              {title ? <Text style={styles.title}>{title}</Text> : null}
            </View>
          ) : null}

          {/* Name section */}
          <SectionLabel>Όνομα</SectionLabel>
          <Field
            label="Πώς το/τη φωνάζεις;"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              setNamedayKey(null);
            }}
            placeholder="π.χ. Πατέρας, Γιώργος…"
            maxLength={80}
            autoFocus={!initial}
          />
          <NameAutocomplete
            suggestions={suggestions}
            onPick={(entry) => {
              setDisplayName(entry.primary_form);
              setNamedayKey(entry.nameday_key);
            }}
          />
          <View style={styles.confirmWrap}>
            <NamedayConfirm match={match} selectedKey={namedayKey} onChange={setNamedayKey} />
          </View>

          {/* Birthday section */}
          <SectionLabel optional>Γενέθλια</SectionLabel>
          <BirthdayInput value={birthDate} onChange={setBirthDate} />

          {/* Relationship section */}
          <SectionLabel optional>Σχέση</SectionLabel>
          <Pressable
            style={({ pressed }) => [styles.relRow, pressed && styles.relRowPressed]}
            onPress={() => setPickerOpen(true)}
          >
            <View style={styles.relIconWrap}>
              <Ionicons
                name={relationshipIcon(relationship)}
                size={20}
                color={theme.accent}
              />
            </View>
            <Text
              style={[styles.relLabel, !relationship && styles.relLabelPlaceholder]}
            >
              {relationshipLabel(relationship)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </Pressable>

          {/* Notes section */}
          <SectionLabel optional>Σημειώσεις</SectionLabel>
          <Field
            label="Κάτι που δεν πρέπει να ξεχάσεις"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />

          {extraSection}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Sticky save bar */}
        <View style={styles.saveBar}>
          <LinearGradient
            colors={['rgba(248,251,253,0)', theme.bgBottom]}
            style={styles.saveBarFade}
            pointerEvents="none"
          />
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              !canSave && styles.saveBtnDisabled,
              canSave && shadow.card,
              pressed && canSave && styles.saveBtnPressed,
            ]}
          >
            <Text style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>
              {saving ? 'Αποθήκευση…' : saveLabel}
            </Text>
            {!saving ? (
              <Ionicons
                name="arrow-forward"
                size={18}
                color={canSave ? theme.heroAccentInk : 'rgba(14, 34, 56, 0.35)'}
              />
            ) : null}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <RelationshipPicker
        visible={pickerOpen}
        value={relationship}
        onSelect={setRelationship}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {optional ? <Text style={styles.sectionOptional}>προαιρετικό</Text> : null}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  kav: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: 120, // room for sticky save bar
  },

  header: { gap: 4, marginBottom: spacing.lg, marginTop: spacing.sm },
  eyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.accent,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: theme.ink,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: theme.muted,
    textTransform: 'uppercase',
  },
  sectionOptional: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: 'rgba(92, 115, 144, 0.7)',
  },

  // Floating-label field
  field: {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 10,
    minHeight: 56,
    justifyContent: 'center',
  },
  fieldFocused: {
    borderColor: theme.accent,
    backgroundColor: '#fff',
  },
  fieldMultiline: { minHeight: 100, paddingTop: 22, paddingBottom: 14 },
  fieldLabel: {
    position: 'absolute',
    left: 14,
    top: 18,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: 'rgba(92, 115, 144, 0.85)',
  },
  fieldLabelFloating: {
    top: 8,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'Manrope_700Bold',
    color: theme.accent,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 17,
    color: theme.ink,
    padding: 0,
    margin: 0,
  },
  fieldInputMultiline: {
    textAlignVertical: 'top',
    minHeight: 60,
  },

  confirmWrap: { marginTop: 10 },

  // Relationship row
  relRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
  },
  relRowPressed: { backgroundColor: theme.accentSoft },
  relIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relLabel: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  relLabelPlaceholder: {
    color: theme.muted,
    fontFamily: 'Manrope_500Medium',
  },

  bottomSpacer: { height: spacing.xl },

  // Save bar
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
    paddingTop: 24,
  },
  saveBarFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.gold,
    paddingVertical: 16,
    borderRadius: theme.radius.chip,
  },
  saveBtnDisabled: { backgroundColor: theme.surface2 },
  saveBtnPressed: { opacity: 0.88 },
  saveLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 15,
    color: theme.heroAccentInk,
    letterSpacing: 0.3,
  },
  saveLabelDisabled: { color: 'rgba(14, 34, 56, 0.35)' },
});
