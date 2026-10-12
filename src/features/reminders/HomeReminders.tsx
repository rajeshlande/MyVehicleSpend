import { Link } from 'react-router-dom';
import type { VehicleLike } from './useReminders';
import { useReminders } from './useReminders';
import { inDashboardWindow, type ReminderState } from '../../core/reminders/due';
import { STATUS_BADGE, timingText } from './reminderText';

const ORDER: Record<ReminderState['status'], number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  done: 3,
};

/** Home panel: overdue items and items due within 30 days (FR-REM-02, TC-REM-02). */
export function HomeReminders({ vehicle }: { vehicle: VehicleLike }) {
  const { items, error } = useReminders(vehicle);
  if (items === undefined) return null;
  const shown = items
    .filter((r) => inDashboardWindow(r.state))
    .sort(
      (a, b) =>
        ORDER[a.state.status] - ORDER[b.state.status] ||
        (a.state.daysLeft ?? 9999) - (b.state.daysLeft ?? 9999)
    );

  return (
    <section className="home-reminders" aria-label="Reminders">
      <h2>Reminders</h2>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="muted">Nothing overdue or due in the next 30 days.</p>
      ) : (
        <ul className="expense-list timeline">
          {shown.map((r) => (
            <li key={r.id} className="expense-row">
              <strong>{r.title}</strong>{' '}
              <span className={`badge badge-${r.state.status}`}>
                {STATUS_BADGE[r.state.status]}
              </span>
              <div className="muted">{timingText(r, r.state).join(' · ')}</div>
            </li>
          ))}
        </ul>
      )}
      <Link to="/reminders">All reminders</Link>
    </section>
  );
}
