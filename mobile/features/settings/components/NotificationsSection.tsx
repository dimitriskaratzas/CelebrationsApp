import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications/prefs';
import {
  getPermissionStatusAsync,
  rescheduleAllAsync,
  requestPermissionAsync,
} from '@/lib/notifications/scheduler';
import { spacing, theme } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Την ίδια μέρα' },
  { value: 1, label: '1 μέρα νωρίτερα' },
  { value: 2, label: '2 μέρες νωρίτερα' },
];

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function leadLabel(days: number): string {
  return LEAD_OPTIONS.find((o) => o.value === days)?.label ?? `${days} μέρες`;
}

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [permission, setPermission] = useState<Notifications.PermissionStatus>(
    Notifications.PermissionStatus.UNDETERMINED,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const [p, s] = await Promise.all([getNotificationPrefs(), getPermissionStatusAsync()]);
      if (cancelled) return;
      setPrefs(p);
      setPermission(s);
    };
    refresh();
    // Re-poll permission when the user comes back from system settings.
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        getPermissionStatusAsync().then((s) => {
          if (!cancelled) setPermission(s);
        });
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // Persist first, then update state — if the write fails, the UI stays consistent
  // with what's actually on disk. (Reschedule errors are non-fatal.)
  const persist = useCallback(async (next: NotificationPrefs) => {
    await setNotificationPrefs(next);
    setPrefs(next);
    await rescheduleAllAsync();
  }, []);

  const onToggle = async (value: boolean) => {
    if (!prefs) return;
    if (value) {
      let status = permission;
      if (status !== 'granted') {
        status = await requestPermissionAsync();
        setPermission(status);
      }
      if (status !== 'granted') {
        Alert.alert(
          'Άρνηση πρόσβασης',
          'Δώσε άδεια για ειδοποιήσεις από τις ρυθμίσεις του τηλεφώνου σου για να συνεχίσεις.',
          [
            { text: 'Άκυρο', style: 'cancel' },
            { text: 'Άνοιξε ρυθμίσεις', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    await persist({ ...prefs, enabled: value });
  };

  const onTimeChange = async (_event: unknown, selected?: Date) => {
    setPickerOpen(false);
    if (!selected || !prefs) return;
    await persist({ ...prefs, hour: selected.getHours(), minute: selected.getMinutes() });
  };

  const onLeadPick = async (value: number) => {
    setLeadOpen(false);
    if (!prefs) return;
    await persist({ ...prefs, leadDays: value });
  };

  if (!prefs) return null;

  const denied = prefs.enabled && permission !== 'granted';
  const showSubRows = prefs.enabled && permission === 'granted';

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>Ειδοποιήσεις</Text>
      <View style={styles.groupBody}>
        <Row
          icon="notifications-outline"
          title="Ειδοποιήσεις γιορτών"
          subtitle={
            prefs.enabled
              ? denied
                ? 'Χρειάζεται άδεια από τις ρυθμίσεις'
                : 'Ενεργό'
              : 'Ανενεργό'
          }
          trailing={
            <Switch
              value={prefs.enabled && permission === 'granted'}
              onValueChange={onToggle}
              trackColor={{ false: theme.surface2, true: theme.accent }}
              thumbColor="#fff"
            />
          }
        />

        {denied ? (
          <>
            <Divider />
            <PressableRow
              icon="alert-circle-outline"
              title="Άνοιξε τις ρυθμίσεις του τηλεφώνου"
              action
              onPress={() => Linking.openSettings()}
            />
          </>
        ) : null}

        {showSubRows ? (
          <>
            <Divider />
            <PressableRow
              icon="time-outline"
              title="Ώρα ειδοποίησης"
              value={formatTime(prefs.hour, prefs.minute)}
              onPress={() => setPickerOpen(true)}
            />
            <Divider />
            <PressableRow
              icon="hourglass-outline"
              title="Χρόνος πριν"
              value={leadLabel(prefs.leadDays)}
              onPress={() => setLeadOpen(true)}
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
            d.setHours(prefs.hour, prefs.minute, 0, 0);
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
            {LEAD_OPTIONS.map((opt) => {
              const selected = opt.value === prefs.leadDays;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onLeadPick(opt.value)}
                  style={({ pressed }) => [
                    styles.sheetOption,
                    selected && styles.sheetOptionSelected,
                    pressed && styles.sheetOptionPressed,
                  ]}
                >
                  <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextSelected]}>
                    {opt.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

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
  action?: boolean;
}

function PressableRow({ icon, title, subtitle, value, onPress, action }: PressableRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={action ? theme.destructive : theme.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, action && styles.rowTitleAction]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  group: { marginTop: spacing.lg, marginHorizontal: spacing.screen, gap: spacing.sm },
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
  },

  // Lead-time sheet
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
