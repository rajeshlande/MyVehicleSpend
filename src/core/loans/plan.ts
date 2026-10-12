/**
 * Loan plan: EMI (computed or entered), flat-rate conversion and the schedule (FR-LOAN-01..04).
 * Pure; no I/O. The schedule is what gets stored in loan_payments.
 */
import { emi, buildSchedule, flatRateEmi, flatRateEffectiveRate, type ScheduleRow } from './emi';
import { round2 } from '../money/money';

export interface PlanInput {
  principal: number;
  annualRatePct: number;
  months: number;
  method: 'reducing' | 'flat';
  /** EMI typed by the user. Omit to use the computed EMI. */
  emiOverride?: number;
}

export type LoanPlan =
  | {
      ok: true;
      emi: number;
      emiSource: 'computed' | 'entered';
      /** Reducing rate used for the schedule. Equals the input rate for reducing loans, the equivalent rate for flat. */
      scheduleRatePct: number;
      /** Tenure to store. Less than the input only when an entered EMI pays the loan off early. */
      tenureMonths: number;
      rows: ScheduleRow[];
    }
  | { ok: false; error: string };

export function planLoan(input: PlanInput): LoanPlan {
  const { principal, annualRatePct, months, method, emiOverride } = input;
  const emiSource = emiOverride === undefined ? 'computed' : 'entered';
  const computed =
    method === 'flat'
      ? flatRateEmi({ principal, flatRatePct: annualRatePct, months })
      : emi({ principal, annualRatePct, months });
  const instalment = emiOverride ?? computed;
  if (!(instalment > 0)) return { ok: false, error: 'EMI must be more than zero.' };

  const scheduleRatePct =
    method === 'flat'
      ? flatRateEffectiveRate({ principal, emi: instalment, months }).annualNominalPct
      : annualRatePct;

  const firstInterest = (principal * scheduleRatePct) / 1200;
  if (instalment <= firstInterest) {
    return {
      ok: false,
      error: `EMI does not cover the first month's interest (₹${round2(firstInterest).toFixed(2)}).`,
    };
  }

  const { rows } = buildSchedule({ principal, annualRatePct: scheduleRatePct, months }, instalment);
  const last = rows[rows.length - 1];
  if (!last) return { ok: false, error: 'The schedule could not be built.' };
  if (last.emi - instalment > Math.max(1, instalment * 0.05)) {
    return {
      ok: false,
      error: `EMI is too low for this tenure. The last instalment would be ₹${last.emi.toFixed(2)}.`,
    };
  }
  return { ok: true, emi: instalment, emiSource, scheduleRatePct, tenureMonths: rows.length, rows };
}

export interface DatedRow extends ScheduleRow {
  dueDate: string;
  openingBalance: number;
  closingBalance: number;
}

/** Due date for instalment `index` (0-based): same day of month, clamped to the month's last day. */
export function dueDateFor(startDate: string, index: number): string {
  const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
  const targetMonth = m - 1 + index;
  const year = y + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Adds due dates and opening/closing balances to schedule rows, ready to store in loan_payments. */
export function scheduleWithDates(startDate: string, rows: readonly ScheduleRow[]): DatedRow[] {
  return rows.map((r, i) => ({
    ...r,
    dueDate: dueDateFor(startDate, i),
    openingBalance: round2(r.balance + r.principal),
    closingBalance: r.balance,
  }));
}
