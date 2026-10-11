/** Rupee amounts are handled as integer paise internally to avoid float drift (CODING §3). */

export const MAX_EXPENSE_AMOUNT = 10_000_000; // ₹1 crore, FR-EXP-06

/**
 * Rupees to whole paise. Scales by 1e6 first so binary floats such as 1.005
 * (stored as 1.00499…) still round half-up to 101 paise.
 */
export function toPaise(rupees: number): number {
  return Math.round(Math.round(rupees * 1e6) / 1e4);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** Round to 2 decimals via paise. Use at storage and display boundaries only. */
export function round2(rupees: number): number {
  return fromPaise(toPaise(rupees));
}

/** Exact total of a list of rupee amounts. */
export function sumMoney(amounts: readonly number[]): number {
  return fromPaise(amounts.reduce((acc, a) => acc + toPaise(a), 0));
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** ₹1,23,456.00 — Indian digit grouping via Intl (never hand-rolled). */
export function formatINR(rupees: number): string {
  return inr.format(rupees);
}

/**
 * Parses what a user types: "123456.5", "1,23,456.5", "₹ 4,850".
 * Returns null for anything that is not a number with at most two decimals.
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[₹\s,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** True for an amount that is greater than zero, at most ₹1 crore, and finite. */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_EXPENSE_AMOUNT;
}
