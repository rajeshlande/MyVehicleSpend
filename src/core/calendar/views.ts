/** Date steps for the calendar views. Dates are ISO strings (YYYY-MM-DD); weeks start on Sunday. */

export type CalendarView = 'day' | 'week' | 'month' | 'year';

const DAY_MS = 86_400_000;

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return format(new Date(parse(iso).getTime() + days * DAY_MS));
}

/** Adds months. A day past the end of the target month is clamped to its last day. */
export function addMonths(iso: string, months: number): string {
  const d = parse(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return format(target);
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

/** The seven days (Sunday to Saturday) of the week that contains `iso`. */
export function weekDays(iso: string): string[] {
  const start = addDays(iso, -parse(iso).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Moves the anchor date by one unit of the view (a day, a week, a month or a year). */
export function step(view: CalendarView, iso: string, direction: 1 | -1): string {
  switch (view) {
    case 'day':
      return addDays(iso, direction);
    case 'week':
      return addDays(iso, 7 * direction);
    case 'month':
      return addMonths(iso, direction);
    case 'year':
      return addYears(iso, direction);
  }
}
