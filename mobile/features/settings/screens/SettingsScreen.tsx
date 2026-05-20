import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSync } from '@/lib/sync/SyncProvider';
import { Banner } from '@/lib/ui/Banner';
import { spacing, theme, typography } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function SettingsScreen() {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  const { lastSyncedAt, pendingCount, isSyncing, lastError, syncNow } = useSync();

  const lastSyncLabel = lastSyncedAt
    ? format(new Date(lastSyncedAt), "EEEE d MMMM, HH:mm", { locale: el })
    : 'Ποτέ';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bgTop} />
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Ρυθμίσεις</Text>
        </View>

        {/* Account */}
        <SettingsGroup title="Λογαριασμός">
          <SettingRow
            icon="person-circle-outline"
            title={isAnonymous ? 'Συνδεδεμένος ανώνυμα' : user?.email ?? 'Συνδεδεμένος'}
            subtitle={user?.id ? `id: ${user.id.slice(0, 8)}…` : undefined}
          />
          <Divider />
          <SettingRow
            icon="log-in-outline"
            title="Σύνδεση"
            onPress={() => router.push('/auth/sign-in')}
            chevron
          />
          <Divider />
          <SettingRow
            icon="person-add-outline"
            title="Δημιουργία λογαριασμού"
            onPress={() => router.push('/auth/register')}
            chevron
          />
        </SettingsGroup>

        {/* Sync */}
        <SettingsGroup title="Συγχρονισμός">
          <SettingRow
            icon="time-outline"
            title="Τελευταίος συγχρονισμός"
            value={lastSyncLabel}
          />
          <Divider />
          <SettingRow
            icon="cloud-upload-outline"
            title="Εκκρεμή"
            value={String(pendingCount)}
          />
          <Divider />
          <SettingRow
            icon="refresh-outline"
            title={isSyncing ? 'Συγχρονισμός…' : 'Συγχρονισμός τώρα'}
            onPress={() => {
              void syncNow();
            }}
            disabled={isSyncing}
            spinner={isSyncing}
            action
          />
        </SettingsGroup>

        {lastError && !isSyncing ? (
          <View style={styles.errorRow}>
            <Banner tone="error" message={`Σφάλμα συγχρονισμού: ${lastError}`} />
          </View>
        ) : null}

        {/* About */}
        <SettingsGroup title="Σχετικά">
          <SettingRow
            icon="information-circle-outline"
            title="Έκδοση"
            value={Application.nativeApplicationVersion ?? '—'}
          />
          <Divider />
          <SettingRow
            icon="hammer-outline"
            title="Build"
            value={Application.nativeBuildVersion ?? '—'}
          />
          <Divider />
          <SettingRow
            icon="git-branch-outline"
            title="Κανάλι"
            value={Updates.channel ?? 'development'}
          />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

interface SettingRowProps {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  disabled?: boolean;
  spinner?: boolean;
  action?: boolean;
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  chevron,
  disabled,
  spinner,
  action,
}: SettingRowProps) {
  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, action && styles.settingTitleAction, disabled && styles.disabledText]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>
      {spinner ? <ActivityIndicator size="small" color={theme.accent} /> : null}
      {value && !spinner ? <Text style={styles.settingValue}>{value}</Text> : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.muted} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.settingRow, pressed && styles.pressedRow]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.settingRow}>{body}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  scroll: {
    paddingTop: spacing.statusBarOffset,
    paddingBottom: spacing.xxl + spacing.tabBarHeight,
  },

  header: { paddingHorizontal: spacing.screen, marginBottom: spacing.lg },
  title: {
    ...typography.display.title,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.ink,
  },

  // Setting groups
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

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressedRow: { backgroundColor: theme.accentSoft },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: { flex: 1, gap: 2 },
  settingTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: theme.ink,
  },
  settingTitleAction: { color: theme.accent },
  settingSubtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: theme.muted,
  },
  settingValue: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: theme.muted,
  },
  disabledText: { color: theme.muted },

  errorRow: {
    marginTop: spacing.md,
    marginHorizontal: spacing.screen,
    borderRadius: 12,
    overflow: 'hidden',
  },

});
