/**
 * Monthly report table with category columns (FR-RPT-03). Money in integer paise; every row and column
 * total is exact. Only expenses inside the range count (FR-RPT-05 comes from the range itself).
 */
import { sumMoney } from '../money/money';
import { monthKey, monthsInRange, type DateRange } from './period';

export interface ReportSpendRow {
  expenseDate: string;
  amount: number;
  categoryGroup: string;
}

export interface MonthlyCategoryTable {
  /** Category group columns, largest total first. */
  groups: string[];
  rows: { month: string; byGroup: Record<string, number>; total: number }[];
  totals: { byGroup: Record<string, number>; total: number };
}

export function inRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function monthlyCategoryTable(
  expenses: readonly ReportSpendRow[],
  range: DateRange
): MonthlyCategoryTable {
  const rowsIn = expenses.filter((e) => inRange(e.expenseDate, range));
  const groupAmounts = new Map<string, number[]>();
  for (const e of rowsIn) {
    const list = groupAmounts.get(e.categoryGroup) ?? [];
    list.push(e.amount);
    groupAmounts.set(e.categoryGroup, list);
  }
  const groups = [...groupAmounts.entries()]
    .map(([g, a]) => ({ g, t: sumMoney(a) }))
    .sort((a, b) => b.t - a.t || a.g.localeCompare(b.g))
    .map((x) => x.g);

  const rows = monthsInRange(range).map((month) => {
    const inMonth = rowsIn.filter((e) => monthKey(e.expenseDate) === month);
    const byGroup: Record<string, number> = {};
    for (const g of groups) {
      byGroup[g] = sumMoney(inMonth.filter((e) => e.categoryGroup === g).map((e) => e.amount));
    }
    return { month, byGroup, total: sumMoney(inMonth.map((e) => e.amount)) };
  });

  const totalByGroup: Record<string, number> = {};
  for (const g of groups) {
    totalByGroup[g] = sumMoney(rows.map((r) => r.byGroup[g] ?? 0));
  }
  return {
    groups,
    rows,
    totals: { byGroup: totalByGroup, total: sumMoney(rows.map((r) => r.total)) },
  };
}
