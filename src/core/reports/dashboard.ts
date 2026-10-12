/**
 * Dashboard totals for one vehicle and period (FR-RPT-01). Pure: the caller loads the rows.
 * Money is summed in integer paise (CODING §3). Every division is guarded, so there is no NaN.
 */
import { round2, sumMoney } from '../money/money';
import { costPerKm, type CostPerKmResult } from '../fuel/mileage';
import { monthKey, monthsInRange, type DateRange } from './period';

export interface SpendRow {
  expenseDate: string;
  amount: number;
  categoryGroup: string;
  odometerKm?: number;
}

export interface OdometerRow {
  filledOn: string;
  odometerKm: number;
}

export interface DashboardInput {
  range: DateRange;
  /** Today (YYYY-MM-DD). Caps the months used for cost per month when a period runs into the future. */
  today: string;
  expenses: readonly SpendRow[];
  fuelLogs: readonly OdometerRow[];
}

export interface GroupTotal {
  group: string;
  total: number;
  /** Share of the period total, 0–1. */
  share: number;
}

export interface MonthTotal {
  month: string;
  total: number;
}

export interface DashboardSummary {
  total: number;
  count: number;
  byGroup: GroupTotal[];
  monthly: MonthTotal[];
  monthsCounted: number;
  costPerMonth: number;
  costPerKm: CostPerKmResult;
}

const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;

export function buildDashboard(input: DashboardInput): DashboardSummary {
  const { range, today } = input;
  const rows = input.expenses.filter((e) => inRange(e.expenseDate, range));
  const total = sumMoney(rows.map((e) => e.amount));

  const groupTotals = new Map<string, number[]>();
  for (const e of rows) {
    const list = groupTotals.get(e.categoryGroup) ?? [];
    list.push(e.amount);
    groupTotals.set(e.categoryGroup, list);
  }
  const byGroup: GroupTotal[] = [...groupTotals.entries()]
    .map(([group, amounts]) => {
      const t = sumMoney(amounts);
      return { group, total: t, share: total > 0 ? t / total : 0 };
    })
    .sort((a, b) => b.total - a.total || a.group.localeCompare(b.group));

  const monthly: MonthTotal[] = monthsInRange(range).map((month) => ({
    month,
    total: sumMoney(rows.filter((e) => monthKey(e.expenseDate) === month).map((e) => e.amount)),
  }));

  // Months that have happened so far in the period (at least one), so an open FY is not under-counted.
  const elapsedTo = range.to < today ? range.to : today;
  const monthsCounted = Math.max(1, monthsInRange({ from: range.from, to: elapsedTo }).length);
  const costPerMonth = total > 0 ? round2(total / monthsCounted) : 0;

  // Distance is the span of odometer readings inside the period, from fuel fills and expense rows.
  const readings = [
    ...input.fuelLogs.filter((f) => inRange(f.filledOn, range)).map((f) => f.odometerKm),
    ...rows.flatMap((e) => (e.odometerKm === undefined ? [] : [e.odometerKm])),
  ];
  let perKm: CostPerKmResult;
  if (readings.length < 2) {
    perKm = {
      status: 'insufficient',
      message: 'Cost per km needs two odometer readings in this period.',
    };
  } else {
    perKm = costPerKm(total, Math.min(...readings), Math.max(...readings));
  }

  return {
    total,
    count: rows.length,
    byGroup,
    monthly,
    monthsCounted,
    costPerMonth,
    costPerKm: perKm,
  };
}
