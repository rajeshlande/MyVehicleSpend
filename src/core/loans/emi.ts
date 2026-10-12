/**
 * Loan maths (SDD §5.1–§5.5, FR-LOAN-02..08). Pure; no I/O.
 * The schedule is computed in whole paise so that principal components sum exactly.
 */
import { round2, toPaise, fromPaise } from '../money/money';

export interface EmiInput {
  principal: number;
  annualRatePct: number; // reducing-balance rate, % p.a.
  months: number;
}

export interface ScheduleRow {
  no: number;
  interest: number;
  principal: number;
  emi: number;
  balance: number;
}

/** Monthly rate from an annual percentage: r = annual / 12 / 100. */
const monthly = (annualPct: number) => annualPct / 12 / 100;

/** Reducing-balance EMI, rounded to paise (SDD §5.1). */
export function emi({ principal, annualRatePct, months }: EmiInput): number {
  const r = monthly(annualRatePct);
  if (r === 0) return round2(principal / months);
  const g = Math.pow(1 + r, months);
  return round2((principal * r * g) / (g - 1));
}

/** Month-by-month schedule (SDD §5.2). The last row clears any rounding residue. */
export function buildSchedule(input: EmiInput): { emi: number; rows: ScheduleRow[] } {
  const instalment = emi(input);
  const r = monthly(input.annualRatePct);
  const emiP = toPaise(instalment);
  let balanceP = toPaise(input.principal);
  const rows: ScheduleRow[] = [];

  for (let k = 1; k <= input.months && balanceP > 0; k++) {
    const interestP = Math.round(balanceP * r);
    let principalP = k === input.months ? balanceP : emiP - interestP;
    if (principalP > balanceP) principalP = balanceP;
    if (principalP < 0) principalP = 0;
    balanceP -= principalP;
    rows.push({
      no: k,
      interest: fromPaise(interestP),
      principal: fromPaise(principalP),
      emi: fromPaise(interestP + principalP),
      balance: fromPaise(balanceP),
    });
  }
  return { emi: instalment, rows };
}

/** Flat-rate EMI: (P + P × R × years) / n (SDD §5.3). */
export function flatRateEmi(input: {
  principal: number;
  flatRatePct: number;
  months: number;
}): number {
  const total = input.principal + (input.principal * input.flatRatePct * (input.months / 12)) / 100;
  return round2(total / input.months);
}

/**
 * Reducing-balance rate equivalent to a flat-rate loan (SDD §5.3, Newton-Raphson, max 50 steps).
 * Returns the monthly rate and the nominal annual rate (monthly × 12).
 */
export function flatRateEffectiveRate(input: { principal: number; emi: number; months: number }): {
  monthlyRate: number;
  annualNominalPct: number;
} {
  const { principal, emi: pmt, months } = input;
  const pv = (r: number) => (r === 0 ? pmt * months : (pmt * (1 - Math.pow(1 + r, -months))) / r);
  let r = 0.01;
  for (let i = 0; i < 50; i++) {
    const f = pv(r) - principal;
    const h = 1e-7;
    const df = (pv(r + h) - pv(r - h)) / (2 * h);
    if (df === 0 || !Number.isFinite(df)) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - r) < 1e-10) {
      r = next;
      break;
    }
    r = next;
  }
  return { monthlyRate: r, annualNominalPct: r * 12 * 100 };
}

/**
 * Months left after a prepayment, keeping the EMI (SDD §5.4).
 * 0 when nothing is outstanding. null when the EMI does not cover the monthly interest, so the
 * loan would never amortise (SDD §5.4 calls this "fully repaid"; it is not, so it is reported as null).
 */
export function prepaymentReduceTenure(input: {
  outstanding: number;
  emi: number;
  annualRatePct: number;
}): number | null {
  if (input.outstanding <= 0) return 0;
  const r = monthly(input.annualRatePct);
  if (r === 0) return Math.ceil(input.outstanding / input.emi);
  const denom = 1 - (input.outstanding * r) / input.emi;
  if (denom <= 0) return null;
  return Math.ceil(-Math.log(denom) / Math.log(1 + r));
}

/** New EMI after a prepayment, keeping the tenure (SDD §5.5). */
export function prepaymentReduceEmi(input: {
  outstanding: number;
  annualRatePct: number;
  remainingMonths: number;
}): number {
  const r = monthly(input.annualRatePct);
  const m = input.remainingMonths;
  if (r === 0) return round2(input.outstanding / m);
  const g = Math.pow(1 + r, m);
  return round2((input.outstanding * r * g) / (g - 1));
}

/** Interest still to be paid if the EMI continues from the given balance. */
export function remainingInterest(input: {
  outstanding: number;
  emi: number;
  annualRatePct: number;
}): number {
  const r = monthly(input.annualRatePct);
  let balance = input.outstanding;
  let total = 0;
  for (let i = 0; i < 1200 && balance > 0.005; i++) {
    const interest = balance * r;
    const payment = Math.min(input.emi, balance + interest);
    total += interest;
    balance = balance + interest - payment;
    if (payment <= interest) break; // EMI does not cover interest: would never end
  }
  return round2(total);
}

/** Amount to close a loan early (FR-LOAN-07). Charge is a % of the outstanding principal. */
export function foreclosureQuote(input: {
  outstanding: number;
  chargePct: number;
  accruedInterest?: number;
}) {
  const charge = round2((input.outstanding * input.chargePct) / 100);
  const accruedInterest = input.accruedInterest ?? 0;
  return { charge, accruedInterest, total: round2(input.outstanding + charge + accruedInterest) };
}

/** Position after N instalments have been paid (FR-LOAN-08). */
export function loanSummary(rows: readonly ScheduleRow[], paidCount: number) {
  const paid = rows.slice(0, paidCount);
  const rest = rows.slice(paidCount);
  const first = rows[0];
  const outstanding =
    paidCount === 0
      ? round2((first?.balance ?? 0) + (first?.principal ?? 0))
      : (rows[paidCount - 1]?.balance ?? 0);
  return {
    outstanding,
    interestPaid: round2(paid.reduce((t, r) => t + r.interest, 0)),
    interestRemaining: round2(rest.reduce((t, r) => t + r.interest, 0)),
    monthsRemaining: rest.length,
  };
}
