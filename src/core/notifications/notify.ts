/**
 * Browser notification rules (FR-REM-04). Pure: no browser API is touched here.
 * Notifications are shown only while the app is open. Installed-app notifications need a service worker (not built yet).
 */

export type OptInState = 'ask' | 'on' | 'off' | 'blocked' | 'unsupported';

/**
 * What the "Turn on reminders" control should show.
 * The permission prompt is asked only after the user taps the control, never on page load.
 */
export function optInState(input: {
  permission: NotificationPermission | 'unsupported';
  preferenceOn: boolean;
}): OptInState {
  if (input.permission === 'unsupported') return 'unsupported';
  if (input.permission === 'denied') return 'blocked';
  if (input.permission === 'granted') return input.preferenceOn ? 'on' : 'off';
  return 'ask';
}

export interface DueItem {
  id: string;
  title: string;
  status: 'overdue' | 'due_soon' | 'upcoming' | 'done';
}

export interface PendingNotification {
  id: string;
  title: string;
  body: string;
  /** Key stored so the same item is not shown twice on the same day. */
  key: string;
}

const KEY_SEP = ':';

export function notificationKey(id: string, today: string): string {
  return `${id}${KEY_SEP}${today}`;
}

/** Overdue and due-soon items that have not been shown yet today. */
export function pickNotifications(
  items: readonly DueItem[],
  today: string,
  sent: ReadonlySet<string>
): PendingNotification[] {
  const out: PendingNotification[] = [];
  for (const item of items) {
    if (item.status !== 'overdue' && item.status !== 'due_soon') continue;
    const key = notificationKey(item.id, today);
    if (sent.has(key)) continue;
    out.push({
      id: item.id,
      title: item.title,
      body: item.status === 'overdue' ? 'Overdue' : 'Due soon',
      key,
    });
  }
  return out;
}

/** Keep only keys for today, so the stored list does not grow without limit. */
export function pruneSentKeys(keys: readonly string[], today: string): string[] {
  return keys.filter((k) => k.endsWith(`${KEY_SEP}${today}`));
}
