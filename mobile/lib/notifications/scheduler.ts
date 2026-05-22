import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import * as favoritesRepo from '@/features/favorites/db/favorites.repo';
import { nextCelebrationFor } from '@/features/today/lib/nextCelebration';

import { getNotificationPrefs } from './prefs';

const CHANNEL_ID = 'celebrations';
const NOTIFICATION_KIND = 'celebration';

// Foreground behavior: still display notifications when the app is open. Without this,
// expo-notifications would silently swallow them on Android while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Γιορτές',
    description: 'Υπενθυμίσεις για γιορτές και γενέθλια.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#0F4C81',
    showBadge: false,
  });
}

export async function getPermissionStatusAsync(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPermissionAsync(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync({
    android: {},
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status;
}

interface ScheduledItem {
  date: Date;
  title: string;
  body: string;
}

function buildScheduledItems(
  favorites: Awaited<ReturnType<typeof favoritesRepo.listLive>>,
  prefs: { hour: number; minute: number; leadDays: number },
  today: Date,
): ScheduledItem[] {
  const items: ScheduledItem[] = [];

  for (const fav of favorites) {
    const next = nextCelebrationFor(fav, today);
    if (!next) continue;

    const fireDate = new Date(next.date);
    fireDate.setDate(fireDate.getDate() - prefs.leadDays);
    fireDate.setHours(prefs.hour, prefs.minute, 0, 0);

    // Same-day-past-hour rescue: if the only thing wrong is that the configured fire
    // hour has already passed *today* (e.g. user enabled notifications at 21:00 for a
    // 09:00 same-day reminder), fire a few seconds from now rather than silently
    // skipping the celebration entirely.
    if (fireDate.getTime() <= today.getTime()) {
      const nextStart = new Date(next.date);
      nextStart.setHours(0, 0, 0, 0);
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const isLatePastHourToday =
        prefs.leadDays === 0 && nextStart.getTime() === todayStart.getTime();
      if (!isLatePastHourToday) continue;
      // Fire in 5 seconds so the notification appears immediately.
      fireDate.setTime(today.getTime() + 5_000);
    }

    const kindLabel = next.kind === 'nameday' ? 'Γιορτάζει' : 'Γενέθλια έχει';
    const dayLabel = prefs.leadDays === 0
      ? 'σήμερα'
      : prefs.leadDays === 1
        ? 'αύριο'
        : `σε ${prefs.leadDays} μέρες`;

    items.push({
      date: fireDate,
      // Drop "ο/η" — relationship words like "Πατέρας"/"Μαμά" don't read well with the
      // gender article. Bare colon-separated is neutral and idiomatic.
      title: `${kindLabel} ${dayLabel}: ${fav.displayName}`,
      body: 'Μην ξεχάσεις ευχές!',
    });
  }

  return items;
}

// Selectively cancels only Celebrations-scheduled notifications. Tagged via
// content.data.kind = 'celebration' so a future feature can schedule its own
// notifications without us nuking them on every favorite mutation.
async function cancelCelebrationsScheduledAsync(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ours = all.filter(
    (n) => (n.content?.data as { kind?: string } | undefined)?.kind === NOTIFICATION_KIND,
  );
  for (const n of ours) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

// Single-flight lock. While a reschedule is running, additional calls coalesce into
// a single follow-up run so a burst of `favorites:changed` events can't race-cancel.
let inFlight: Promise<RescheduleResult> | null = null;
let rerunPending = false;

interface RescheduleResult {
  scheduled: number;
  skipped: 'disabled' | 'denied' | 'ok';
}

async function doReschedule(now: Date): Promise<RescheduleResult> {
  const prefs = await getNotificationPrefs();
  if (!prefs.enabled) {
    await cancelCelebrationsScheduledAsync();
    return { scheduled: 0, skipped: 'disabled' };
  }

  const status = await getPermissionStatusAsync();
  if (status !== 'granted') {
    await cancelCelebrationsScheduledAsync();
    return { scheduled: 0, skipped: 'denied' };
  }

  await ensureChannelAsync();
  await cancelCelebrationsScheduledAsync();

  const favorites = await favoritesRepo.listLive();
  const items = buildScheduledItems(favorites, prefs, now);

  for (const item of items) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        sound: false,
        data: { kind: NOTIFICATION_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        channelId: CHANNEL_ID,
      },
    });
  }

  return { scheduled: items.length, skipped: 'ok' };
}

/**
 * Cancel + re-add every Celebrations notification. Safe to call frequently:
 * concurrent invocations are coalesced into one trailing run so a burst of
 * `favorites:changed` events can't race-cancel each other's freshly-scheduled
 * items. Other apps' / future-feature notifications are left untouched.
 */
export async function rescheduleAllAsync(now: Date = new Date()): Promise<RescheduleResult> {
  if (inFlight) {
    rerunPending = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      let result = await doReschedule(now);
      // If a request came in during our run, replay once with a fresh `now`.
      while (rerunPending) {
        rerunPending = false;
        result = await doReschedule(new Date());
      }
      return result;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function cancelAllAsync(): Promise<void> {
  await cancelCelebrationsScheduledAsync();
}
