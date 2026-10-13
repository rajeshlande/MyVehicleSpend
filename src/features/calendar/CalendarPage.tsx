import { useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { useReminders, type ReminderView } from '../reminders/useReminders';
import { buildMonthGrid, groupByDate } from '../../core/calendar/month';
import { formatDMY, todayIST } from '../../core/dates/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthTitle(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Month calendar of the active vehicle's reminders (Base design). Reminders with a due date
 * sit on their day. Km-only reminders are listed underneath. `initialMonth` ("YYYY-MM") is
 * for tests; by default the calendar opens on the current month in India time.
 */
export function CalendarPage({ initialMonth }: { initialMonth?: string }) {
  const { activeVehicle } = useVehicles();
  const { items, error } = useReminders(activeVehicle);
  const [ym, setYm] = useState(() => initialMonth ?? todayIST().slice(0, 7));

  if (!activeVehicle) {
    return (
      <>
        <h1>Calendar</h1>
        <p>Add a vehicle first. Its reminders appear here.</p>
      </>
    );
  }
  if (error) {
    return (
      <>
        <h1>Calendar</h1>
        <p role="alert" className="field-error">
          {error}
        </p>
      </>
    );
  }
  if (items === undefined) {
    return (
      <>
        <h1>Calendar</h1>
        <p role="status">Loading…</p>
      </>
    );
  }

  const [year, month] = ym.split('-').map(Number) as [number, number];
  const weeks = buildMonthGrid(year, month);
  const byDate = groupByDate<ReminderView>(items);
  const undated = items.filter((r) => !r.dueDate);
  const today = todayIST();

  return (
    <>
      <div className="page-head">
        <h1>Calendar</h1>
      </div>
      <div className="calendar-head">
        <button
          type="button"
          className="btn-secondary"
          aria-label="Previous month"
          onClick={() => setYm(shiftMonth(ym, -1))}
        >
          ‹
        </button>
        <h2>{monthTitle(year, month)}</h2>
        <button
          type="button"
          className="btn-secondary"
          aria-label="Next month"
          onClick={() => setYm(shiftMonth(ym, 1))}
        >
          ›
        </button>
      </div>

      <table className="calendar-grid" role="grid" aria-label={monthTitle(year, month)}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.date}>
              {week.map((cell) => {
                const reminders = byDate.get(cell.date) ?? [];
                return (
                  <td
                    key={cell.date}
                    role="gridcell"
                    aria-label={formatDMY(cell.date)}
                    className={[
                      'calendar-day',
                      cell.inMonth ? '' : 'calendar-day-muted',
                      cell.date === today ? 'calendar-day-today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="calendar-date">{Number(cell.date.slice(8))}</span>
                    {reminders.map((r) => (
                      <span key={r.id} className={`calendar-chip chip-${r.state.status}`}>
                        {r.isDone ? '✓ ' : ''}
                        {r.title}
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {undated.length > 0 && (
        <section aria-label="Reminders without a date" className="dashboard-card">
          <h2>Reminders without a date</h2>
          <ul>
            {undated.map((r) => (
              <li key={r.id}>
                {r.title}
                {r.dueOdometerKm !== undefined && ` · due at ${r.dueOdometerKm} km`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
