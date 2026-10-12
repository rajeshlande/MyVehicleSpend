import { REMINDER_TYPE_LABEL } from '../../core/reminders/schema';
import type { ReminderState, ReminderStatus } from '../../core/reminders/due';
import type { Reminder } from '../../data/reminders';

export const STATUS_BADGE: Record<ReminderStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  done: 'Done',
};

/** Plain-language timing: "3 days left", "2 days overdue", "200 km to service". */
export function timingText(r: Reminder, s: ReminderState): string[] {
  const parts: string[] = [REMINDER_TYPE_LABEL[r.reminderType]];
  if (s.daysLeft !== undefined) {
    if (s.daysLeft < 0) parts.push(`${-s.daysLeft} ${-s.daysLeft === 1 ? 'day' : 'days'} overdue`);
    else if (s.daysLeft === 0) parts.push('Due today');
    else parts.push(`${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} left`);
  }
  if (s.kmLeft !== undefined) {
    if (s.kmLeft > 0) parts.push(`${s.kmLeft.toLocaleString('en-IN')} km to service`);
    else parts.push(`${(-s.kmLeft).toLocaleString('en-IN')} km overdue`);
  }
  return parts;
}
