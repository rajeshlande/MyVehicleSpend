/**
 * Reminder due logic (FR-REM-01, FR-REM-02). Pure: the caller passes today's date and the current odometer.
 *
 * Date reminders: due soon when the due date is within `leadDays` days; overdue after the due date.
 * Km reminders: due soon within KM_LEAD km of the due reading; overdue once the odometer reaches it.
 * A reminder with both a date and a km uses whichever trigger is more urgent.
 */

/** Km before a service-by-km reminder counts as due soon. Not in the spec; chosen here. */
export const KM_LEAD = 500;

export type ReminderStatus = 'done' | 'overdue' | 'due_soon' | 'upcoming';

export interface ReminderDates {
  dueDate?: string | null;
  dueOdometerKm?: number | null;
  leadDays: number;
  isDone: boolean;
}

export interface ReminderContext {
  /** ISO date (YYYY-MM-DD) for "today", in India time. */
  today: string;
  /** Highest known odometer reading for the vehicle. Needed only for km reminders. */
  currentOdometerKm?: number;
}

export interface ReminderState {
  status: ReminderStatus;
  /** Days from today to the due date (negative once overdue). Undefined without a date. */
  daysLeft?: number;
  /** Km from the current odometer to the due reading (negative once overdue). Undefined without a reading. */
  kmLeft?: number;
}

/** Whole days from `from` to `to` (UTC arithmetic, so no timezone drift). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The date the reminder starts showing as due soon: due date minus lead days (TC-REM-01). */
export function dueSoonFrom(dueDate: string, leadDays: number): string {
  const d = new Date(`${dueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - leadDays);
  return d.toISOString().slice(0, 10);
}

export function reminderStatus(r: ReminderDates, ctx: ReminderContext): ReminderState {
  if (r.isDone) return { status: 'done' };

  let overdue = false;
  let soon = false;
  let daysLeft: number | undefined;
  let kmLeft: number | undefined;

  if (r.dueDate) {
    daysLeft = daysBetween(ctx.today, r.dueDate);
    if (daysLeft < 0) overdue = true;
    else if (daysLeft <= r.leadDays) soon = true;
  }

  if (r.dueOdometerKm != null && ctx.currentOdometerKm != null) {
    kmLeft = r.dueOdometerKm - ctx.currentOdometerKm;
    if (kmLeft <= 0) overdue = true;
    else if (kmLeft <= KM_LEAD) soon = true;
  }

  const status: ReminderStatus = overdue ? 'overdue' : soon ? 'due_soon' : 'upcoming';
  return { status, daysLeft, kmLeft };
}

/** Home shows overdue items and items due within 30 days (FR-REM-02). */
export function inDashboardWindow(
  s: { status: ReminderStatus; daysLeft?: number },
  windowDays = 30
): boolean {
  if (s.status === 'done') return false;
  if (s.status === 'overdue' || s.status === 'due_soon') return true;
  return s.daysLeft !== undefined && s.daysLeft <= windowDays;
}
