/**
 * Dashboard period presets (FR-RPT-02). Dates are YYYY-MM-DD, Indian financial year is 1 April to 31 March.
 */
import { fiscalYearOf, fyRange } from '../dates/dates';

export type PeriodPreset = 'this_month' | 'last_month' | 'this_fy' | 'last_12' | 'custom';

export interface DateRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Year and month (1–12) shifted by a number of months. */
function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function monthStart(y: number, m: number): string {
  return `${y}-${pad(m)}-01`;
}

function monthEnd(y: number, m: number): string {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(last)}`;
}

/** Date range for a fixed preset. "last_12" is the first day of the month 11 months ago up to today. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string): DateRange {
  const [y, m] = today.split('-').map(Number) as [number, number, number];
  switch (preset) {
    case 'this_month':
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    case 'last_month': {
      const p = shiftMonth(y, m, -1);
      return { from: monthStart(p.y, p.m), to: monthEnd(p.y, p.m) };
    }
    case 'this_fy':
      return fyRange(fiscalYearOf(today));
    case 'last_12': {
      const s = shiftMonth(y, m, -11);
      return { from: monthStart(s.y, s.m), to: today };
    }
  }
}

/** Null when the custom range is usable; otherwise the message to show. */
export function customRangeError(range: DateRange): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
    return 'Choose both dates.';
  }
  if (range.from > range.to) return 'The start date must be on or before the end date.';
  return null;
}

/** "YYYY-MM" key for a date. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Every calendar month (YYYY-MM) touched by the range, in order. */
export function monthsInRange(range: DateRange): string[] {
  const [fy, fm] = range.from.split('-').map(Number) as [number, number];
  const [ty, tm] = range.to.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = fy * 12 + (fm - 1); i <= ty * 12 + (tm - 1); i++) {
    out.push(`${Math.floor(i / 12)}-${pad((i % 12) + 1)}`);
  }
  return out;
}
