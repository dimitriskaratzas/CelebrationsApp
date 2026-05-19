import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import {
  ActivityIndicator,
  Alert,
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
import { shadow, spacing, theme, typography } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface PricingTier {
  label: string;
  price: string;
  cadence: string;
  highlighted?: boolean;
}

const PRICING: PricingTier[] = [
  { label: 'Μηνιαίο', price: '1,99 €', cadence: '/μήνα' },
  { label: 'Ετήσιο', price: '9,99 €', cadence: '/έτος', highlighted: true },
  { label: 'Εφάπαξ', price: '19,99 €', cadence: 'μία φορά' },
];

export function SettingsScreen() {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  const { lastSyncedAt, pendingCount, isSyncing, lastError, syncNow } = useSync();

  const lastSyncLabel = lastSyncedAt
    ? format(new Date(lastSyncedAt), "EEEE d MMMM, HH:mm", { locale: el })
    : 'Ποτέ';

  const onPickPremium = (tier: PricingTier) => {
    Alert.alert(
      'Σύντομα κοντά σας',
      `Το ${tier.label.toLowerCase()} (${tier.price}) θα είναι διαθέσιμο σε μελλοντική έκδοση.`,
    );
  };

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

        {/* Premium card (mock) */}
        <LinearGradient
          colors={['#1f1305', '#2b1c0a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.premiumCard, shadow.card]}
        >
          <Text style={styles.premiumEyebrow}>CELEBRATIONS PREMIUM</Text>
          <Text style={styles.premiumHeadline}>Ξεκλείδωσε όλες τις γιορτές.</Text>
          <Text style={styles.premiumLede}>
            Απεριόριστα αγαπημένα, ευχές με AI, ειδοποιήσεις 24 ώρες πριν.
          </Text>
          <View style={styles.pricingRow}>
            {PRICING.map((tier) => (
              <Pressable
                key={tier.label}
                onPress={() => onPickPremium(tier)}
                style={({ pressed }) => [
                  styles.priceTile,
                  tier.highlighted && styles.priceTileHighlight,
                  pressed && styles.pressedSubtle,
                ]}
              >
                <Text
                  style={[
                    styles.priceLabel,
                    tier.highlighted && styles.priceLabelHighlight,
                  ]}
                >
                  {tier.label}
                </Text>
                <Text
                  style={[
                    styles.pricePrice,
                    tier.highlighted && styles.pricePriceHighlight,
                  ]}
                >
                  {tier.price}
                </Text>
                <Text style={styles.priceCadence}>{tier.cadence}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

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

  // Premium
  premiumCard: {
    marginHorizontal: spacing.screen,
    borderRadius: theme.radius.card,
    padding: spacing.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 201, 60, 0.55)',
  },
  premiumEyebrow: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.gold,
  },
  premiumHeadline: {
    marginTop: spacing.sm,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: '#fff',
  },
  premiumLede: {
    marginTop: 6,
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.78)',
  },
  pricingRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceTile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    gap: 2,
  },
  priceTileHighlight: {
    borderColor: theme.gold,
    backgroundColor: 'rgba(255,201,60,0.10)',
  },
  priceLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  priceLabelHighlight: { color: theme.gold },
  pricePrice: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#fff',
  },
  pricePriceHighlight: { color: theme.gold },
  priceCadence: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
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

  pressedSubtle: { opacity: 0.8 },
});
