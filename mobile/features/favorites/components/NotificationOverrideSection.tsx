import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  EMPTY_OVERRIDE,
  getOverride,
  setOverride,
  type NotificationOverride,
} from '@/features/favorites/db/favoriteNotifs.repo';
import { getNotificationPrefs, type NotificationPrefs } from '@/lib/notifications/prefs';
import { rescheduleAllAsync } from '@/lib/notifications/scheduler';
import { spacing, theme } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  favoriteId: string;
}

const LEAD_OPTIONS = [0, 1, 2] as const;

function leadLabel(days: number): string {
  if (days === 0) return 'Την ίδια μέρα';
  if (days === 1) return '1 μέρα νωρίτερα';
  return `${days} μέρες νωρίτερα`;
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function NotificationOverrideSection({ favoriteId }: Props) {
  const [globalPrefs, setGlobalPrefs] = useState<NotificationPrefs | null>(null);
  const [override, setOverrideState] = useState<NotificationOverride | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, o] = await Promise.all([getNotificationPrefs(), getOverride(favoriteId)]);
      if (cancelled) return;
      setGlobalPrefs(g);
      setOverrideState(o);
    })();
    return () => {
      cancelled = true;
    };
  }, [favoriteId]);

  // Persist-then-set: if the write fails, UI stays consistent with disk.
  const persist = useCallback(
    async (next: NotificationOverride) => {
      await setOverride(favoriteId, next);
      setOverrideState(next);
      await rescheduleAllAsync();
    },
    [favoriteId],
  );

  if (!globalPrefs || !override) return null;

  const silenced = override.enabled === false;
  // When global notifications are off entirely, per-favorite overrides have no
  // teeth — surface that as a hint instead of pretending the controls do anything.
  const globalOff = !globalPrefs.enabled;

  const effectiveHour = override.hour ?? globalPrefs.hour;
  const effectiveMinute = override.minute ?? globalPrefs.minute;
  const effectiveLead = override.leadDays ?? globalPrefs.leadDays;

  const hourIsCustom = override.hour !== null;
  const leadIsCustom = override.leadDays !== null;

  const timeValue = hourIsCustom
    ? formatTime(effectiveHour, effectiveMinute)
    : `Προεπιλογή (${formatTime(globalPrefs.hour, globalPrefs.minute)})`;

  const leadValue = leadIsCustom
    ? leadLabel(effectiveLead)
    : `Προεπιλογή (${leadLabel(globalPrefs.leadDays)})`;

  const onToggleSilence = (value: boolean) => {
    persist({ ...override, enabled: value ? false : null });
  };

  const onTimeChange = (_event: unknown, selected?: Date) => {
    setPickerOpen(false);
    if (!selected) return;
    persist({ ...override, hour: selected.getHours(), minute: selected.getMinutes() });
  };

  const onResetTime = () => {
    persist({ ...override, hour: null, minute: null });
  };

  const onLeadPick = (value: number | null) => {
    setLeadOpen(false);
    persist({ ...override, leadDays: value });
  };

  const onResetAll = () => {
    persist(EMPTY_OVERRIDE);
  };

  const anyOverride =
    override.enabled !== null ||
    override.hour !== null ||
    override.minute !== null ||
    override.leadDays !== null;

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>Ειδοποιήσεις</Text>
      <View style={styles.groupBody}>
        <Row
          icon="notifications-off-outline"
          title="Σίγαση για αυτό το αγαπημένο"
          subtitle={
            globalOff
              ? 'Οι ειδοποιήσεις είναι κλειστές από τις γενικές ρυθμίσεις'
              : silenced
                ? 'Δεν θα λάβεις ειδοποίηση'
                : 'Ειδοποίηση όπως η προεπιλογή'
          }
          trailing={
            <Switch
              value={silenced}
              onValueChange={onToggleSilence}
              disabled={globalOff}
              trackColor={{ false: theme.surface2, true: theme.destructive }}
              thumbColor="#fff"
            />
          }
        />
        <Divider />
        <PressableRow
          icon="time-outline"
          title="Ώρα ειδοποίησης"
          value={timeValue}
          custom={hourIsCustom}
          disabled={silenced || globalOff}
          onPress={() => setPickerOpen(true)}
          onLongPress={hourIsCustom ? onResetTime : undefined}
        />
        <Divider />
        <PressableRow
          icon="hourglass-outline"
          title="Χρόνος πριν"
          value={leadValue}
          custom={leadIsCustom}
          disabled={silenced || globalOff}
          onPress={() => setLeadOpen(true)}
        />
        {anyOverride ? (
          <>
            <Divider />
            <PressableRow
              icon="refresh-outline"
              title="Επαναφορά προεπιλογών"
              action
              onPress={onResetAll}
            />
          </>
        ) : null}
      </View>

      {pickerOpen ? (
        <DateTimePicker
          mode="time"
          display="spinner"
          value={(() => {
            const d = new Date();
            d.setHours(effectiveHour, effectiveMinute, 0, 0);
            return d;
          })()}
          onChange={onTimeChange}
          is24Hour
        />
      ) : null}

      <Modal visible={leadOpen} transparent animationType="slide" onRequestClose={() => setLeadOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLeadOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Χρόνος πριν τη γιορτή</Text>
            <SheetOption
              label={`Προεπιλογή (${leadLabel(globalPrefs.leadDays)})`}
              selected={!leadIsCustom}
              onPress={() => onLeadPick(null)}
            />
            {LEAD_OPTIONS.map((opt) => (
              <SheetOption
                key={opt}
                label={leadLabel(opt)}
                selected={leadIsCustom && override.leadDays === opt}
                onPress={() => onLeadPick(opt)}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface RowProps {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: React.ReactNode;
}

function Row({ icon, title, subtitle, value, trailing }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {trailing}
    </View>
  );
}

interface PressableRowProps extends RowProps {
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  custom?: boolean;
  action?: boolean;
}

function PressableRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  onLongPress,
  disabled,
  custom,
  action,
}: PressableRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed, disabled && styles.rowDisabled]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={action ? theme.destructive : theme.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, action && styles.rowTitleAction]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, custom && styles.rowValueCustom]}>{value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

interface SheetOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function SheetOption({ label, selected, onPress }: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetOption,
        selected && styles.sheetOptionSelected,
        pressed && styles.sheetOptionPressed,
      ]}
    >
      <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: spacing.lg, gap: spacing.sm },
  groupTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: theme.muted,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  groupBody: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.card,
    borderColor: theme.line,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: theme.line, marginLeft: 60 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowPressed: { backgroundColor: theme.accentSoft },
  rowDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  rowTitleAction: { color: theme.destructive },
  rowSubtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  rowValue: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: theme.muted,
    maxWidth: 160,
    textAlign: 'right',
  },
  rowValueCustom: { color: theme.accent },

  backdrop: { flex: 1, backgroundColor: 'rgba(14, 34, 56, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 22,
    gap: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(14, 34, 56, 0.18)',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: theme.ink,
    paddingHorizontal: 4,
    paddingBottom: spacing.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  sheetOptionPressed: { backgroundColor: theme.accentSoft },
  sheetOptionSelected: { backgroundColor: theme.accentSoft },
  sheetOptionText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  sheetOptionTextSelected: { color: theme.accent },
});
