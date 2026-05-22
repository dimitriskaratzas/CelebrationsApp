import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import * as favoritesRepo from '@/features/favorites/db/favorites.repo';
import { nextCelebrationFor } from '@/features/today/lib/nextCelebration';

import { getNotificationPrefs } from './prefs';

const CHANNEL_ID = 'celebrations';

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

    // Skip if the fire time has already passed (e.g. user enables at noon for a 9:00
    // same-day notification).
    if (fireDate.getTime() <= today.getTime()) continue;

    const kindLabel = next.kind === 'nameday' ? 'Γιορτάζει' : 'Γενέθλια έχει';
    const dayLabel = prefs.leadDays === 0
      ? 'σήμερα'
      : prefs.leadDays === 1
        ? 'αύριο'
        : `σε ${prefs.leadDays} μέρες`;

    items.push({
      date: fireDate,
      title: `${kindLabel} ${dayLabel} ο/η ${fav.displayName}`,
      body:
        next.kind === 'nameday' && next.saint
          ? `${next.saint} · μην ξεχάσεις ευχές!`
          : 'Μην ξεχάσεις ευχές!',
    });
  }

  return items;
}

/**
 * Cancels every previously-scheduled celebration notification and reschedules from
 * the current favorites + prefs. Safe to call on every favorite mutation and on
 * app boot — it diffs by ID-less cancellation+re-add since we don't track scheduled
 * IDs in SQLite (Plan 6+).
 */
export async function rescheduleAllAsync(now: Date = new Date()): Promise<{
  scheduled: number;
  skipped: 'disabled' | 'denied' | 'ok';
}> {
  const prefs = await getNotificationPrefs();
  if (!prefs.enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { scheduled: 0, skipped: 'disabled' };
  }

  const status = await getPermissionStatusAsync();
  if (status !== 'granted') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { scheduled: 0, skipped: 'denied' };
  }

  await ensureChannelAsync();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const favorites = await favoritesRepo.listLive();
  const items = buildScheduledItems(favorites, prefs, now);

  for (const item of items) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        sound: false,
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

export async function cancelAllAsync(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
