// Browser glue for reminder notifications (FR-REM-04). Rules live in core/notifications/notify.ts.
import { pickNotifications, pruneSentKeys, type DueItem } from '../../core/notifications/notify';

const PREF_KEY = 'reminders.notifications';
const SENT_KEY = 'reminders.notified';

export type BrowserPermission = NotificationPermission | 'unsupported';

/** Current browser permission. Never prompts. */
export function browserPermission(): BrowserPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function readPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writePreference(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the preference simply is not remembered.
  }
}

/**
 * Asks the browser for permission. Call only from a user tap.
 * A refusal or any error resolves to a non-granted value and never throws.
 */
export async function requestBrowserPermission(): Promise<BrowserPermission> {
  if (browserPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function readSent(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
    );
  } catch {
    return new Set();
  }
}

/**
 * Shows a notification for each overdue or due-soon item not yet shown today.
 * Runs only while the app is open, and only when permission is granted and the user has turned reminders on.
 */
export function notifyDue(items: readonly DueItem[], today: string): void {
  if (browserPermission() !== 'granted' || !readPreference()) return;
  const sent = readSent();
  const pending = pickNotifications(items, today, sent);
  for (const p of pending) {
    try {
      new Notification(p.title, { body: p.body, tag: p.key });
      sent.add(p.key);
    } catch {
      // A failed notification is not recorded, so it can be tried on the next visit.
    }
  }
  if (pending.length > 0) {
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(pruneSentKeys([...sent], today)));
    } catch {
      // Storage blocked: at worst the same item is shown again.
    }
  }
}
