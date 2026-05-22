import { getSyncState, setSyncState } from '@/lib/db/sync-state';

export interface NotificationPrefs {
  enabled: boolean;
  /** Hour of day (0–23) to fire notifications. Default 9. */
  hour: number;
  /** Minute (0–59). Default 0. */
  minute: number;
  /** How many days before the celebration to notify. 0 = on the day. */
  leadDays: number;
}

const KEY = 'notifications.prefs';

const DEFAULT: NotificationPrefs = {
  enabled: false,
  hour: 9,
  minute: 0,
  leadDays: 0,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await getSyncState(KEY);
  if (!raw) return DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await setSyncState(KEY, JSON.stringify(prefs));
}
