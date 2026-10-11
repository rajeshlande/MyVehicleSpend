/** Filter and search rules for the expense list (FR-EXP-03, FR-EXP-04). Pure; no I/O. */

export interface ExpenseFilterable {
  categoryId: string;
  categoryGroup: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMode: string | null;
  amount: number;
  vendor?: string | null;
  notes?: string | null;
}

export interface ExpenseFilters {
  categoryId: string;
  categoryGroup: string;
  from: string; // inclusive, YYYY-MM-DD, '' = none
  to: string; // inclusive, '' = none
  paymentMode: string; // '' = any
  minAmount?: number;
  maxAmount?: number;
  query: string;
}

export const EMPTY_FILTERS: ExpenseFilters = {
  categoryId: '',
  categoryGroup: '',
  from: '',
  to: '',
  paymentMode: '',
  minAmount: undefined,
  maxAmount: undefined,
  query: '',
};

/** True when the row's vendor or notes contain the query (case-insensitive). Blank query matches all. */
export function searchMatches(row: ExpenseFilterable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${row.vendor ?? ''} ${row.notes ?? ''}`.toLowerCase().includes(q);
}

export function applyFilters<T extends ExpenseFilterable>(
  rows: readonly T[],
  f: ExpenseFilters
): T[] {
  return rows.filter((r) => {
    if (f.categoryId && r.categoryId !== f.categoryId) return false;
    if (f.categoryGroup && r.categoryGroup !== f.categoryGroup) return false;
    if (f.from && r.expenseDate < f.from) return false;
    if (f.to && r.expenseDate > f.to) return false;
    if (f.paymentMode && r.paymentMode !== f.paymentMode) return false;
    if (f.minAmount !== undefined && r.amount < f.minAmount) return false;
    if (f.maxAmount !== undefined && r.amount > f.maxAmount) return false;
    return searchMatches(r, f.query);
  });
}

export function hasActiveFilters(f: ExpenseFilters): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);
}
