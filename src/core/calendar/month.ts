/** Month grid for the calendar. Weeks start on Sunday. Dates are ISO strings (YYYY-MM-DD). */

export interface DayCell {
  date: string;
  /** False for the padding days from the previous or next month. */
  inMonth: boolean;
}

const DAY_MS = 86_400_000;

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Returns the weeks of a month as rows of seven cells. `month` is 1–12.
 * Rows run from the Sunday on or before the 1st to the Saturday on or after the last day.
 */
export function buildMonthGrid(year: number, month: number): DayCell[][] {
  const first = Date.UTC(year, month - 1, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(first).getUTCDay(); // 0 = Sunday
  const start = first - firstWeekday * DAY_MS;
  const cellCount = Math.ceil((firstWeekday + lastDay) / 7) * 7;

  const cells: DayCell[] = [];
  for (let i = 0; i < cellCount; i++) {
    const ms = start + i * DAY_MS;
    const d = new Date(ms);
    cells.push({
      date: isoOf(ms),
      inMonth: d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year,
    });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Groups items by their ISO due date. Items without a date are left out. */
export function groupByDate<T extends { dueDate?: string | null }>(items: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    if (!item.dueDate) continue;
    const list = out.get(item.dueDate);
    if (list) list.push(item);
    else out.set(item.dueDate, [item]);
  }
  return out;
}
