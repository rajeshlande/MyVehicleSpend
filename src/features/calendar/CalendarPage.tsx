import { useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { useReminders, type ReminderView } from '../reminders/useReminders';
import { buildMonthGrid, groupByDate } from '../../core/calendar/month';
import { step, weekDays, type CalendarView } from '../../core/calendar/views';
import { formatDMY, todayIST } from '../../core/dates/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthName(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function Chips({ items }: { items: ReminderView[] }) {
  return (
    <>
      {items.map((r) => (
        <span key={r.id} className={`calendar-chip chip-${r.state.status}`}>
          {r.isDone ? '✓ ' : ''}
          {r.title}
        </span>
      ))}
    </>
  );
}

/**
 * Calendar of the active vehicle's reminders (Base design): day, week, month and year views.
 * Reminders with a due date sit on their day. Km-only reminders are listed underneath.
 * `initialMonth` ("YYYY-MM") is for tests; by default the calendar opens on today (India time).
 */
export function CalendarPage({ initialMonth }: { initialMonth?: string }) {
  const { activeVehicle } = useVehicles();
  const { items, error } = useReminders(activeVehicle);
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => (initialMonth ? `${initialMonth}-01` : todayIST()));

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

  const byDate = groupByDate<ReminderView>(items);
  const undated = items.filter((r) => !r.dueDate);
  const today = todayIST();
  const [year, month] = anchor.split('-').map(Number) as [number, number];
  const unit = view;

  let title: string;
  if (view === 'day') title = formatDMY(anchor);
  else if (view === 'week') {
    const days = weekDays(anchor);
    title = `${formatDMY(days[0] ?? anchor)} – ${formatDMY(days[6] ?? anchor)}`;
  } else if (view === 'month') title = monthName(month, year);
  else title = String(year);

  return (
    <>
      <div className="page-head">
        <h1>Calendar</h1>
      </div>
      <div className="calendar-head">
        <button
          type="button"
          className="btn-secondary"
          aria-label={`Previous ${unit}`}
          onClick={() => setAnchor(step(view, anchor, -1))}
        >
          ‹
        </button>
        <h2>{title}</h2>
        <button
          type="button"
          className="btn-secondary"
          aria-label={`Next ${unit}`}
          onClick={() => setAnchor(step(view, anchor, 1))}
        >
          ›
        </button>
      </div>
      <div role="group" aria-label="Calendar view" className="calendar-views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="btn-secondary"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'month' && (
        <table className="calendar-grid" role="grid" aria-label={monthName(month, year)}>
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
            {buildMonthGrid(year, month).map((week) => (
              <tr key={week[0]?.date}>
                {week.map((cell) => (
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
                    <Chips items={byDate.get(cell.date) ?? []} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'week' && (
        <div className="calendar-list" aria-label="Week">
          {weekDays(anchor).map((day) => (
            <div key={day} role="group" aria-label={formatDMY(day)} className="calendar-row">
              <strong>{formatDMY(day)}</strong>
              <div>
                {(byDate.get(day) ?? []).length === 0 ? (
                  <span className="muted">Nothing due</span>
                ) : (
                  <Chips items={byDate.get(day) ?? []} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'day' && (
        <div className="calendar-list" aria-label="Day">
          <div role="group" aria-label={formatDMY(anchor)} className="calendar-row">
            <strong>{formatDMY(anchor)}</strong>
            <div>
              {(byDate.get(anchor) ?? []).length === 0 ? (
                <span className="muted">Nothing due</span>
              ) : (
                <Chips items={byDate.get(anchor) ?? []} />
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'year' && (
        <div className="calendar-year" aria-label={`${year}`}>
          {MONTH_NAMES.map((name, i) => {
            const prefix = `${year}-${String(i + 1).padStart(2, '0')}-`;
            const count = items.filter((r) => r.dueDate?.startsWith(prefix)).length;
            return (
              <button
                key={name}
                type="button"
                className="calendar-year-month"
                aria-label={`${name} ${year}, ${count} ${count === 1 ? 'reminder' : 'reminders'}`}
                onClick={() => {
                  setAnchor(`${year}-${String(i + 1).padStart(2, '0')}-01`);
                  setView('month');
                }}
              >
                <strong>{name}</strong>
                <span className="muted">
                  {count} {count === 1 ? 'reminder' : 'reminders'}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
