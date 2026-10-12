/**
 * Prepayment simulator (FR-LOAN-06). Pure: shows what a prepayment would do, and saves nothing.
 * Reduce tenure keeps the EMI (SDD §5.4). Reduce EMI keeps the tenure (SDD §5.5).
 */
import { prepaymentReduceEmi, prepaymentReduceTenure, remainingInterest } from './emi';
import { round2 } from '../money/money';

export interface PrepaymentInput {
  /** Balance still owed now (from the schedule, after the instalments paid so far). */
  outstanding: number;
  /** Current EMI. */
  emi: number;
  annualRatePct: number;
  /** Instalments still to pay. */
  remainingMonths: number;
  amount: number;
  mode: 'tenure' | 'emi';
}

export type PrepaymentResult =
  | {
      ok: true;
      newOutstanding: number;
      /** Months left after the prepayment (0 when cleared). */
      newMonths: number;
      /** EMI after the prepayment (0 when cleared). */
      newEmi: number;
      interestBefore: number;
      interestAfter: number;
      interestSaved: number;
    }
  | { ok: false; error: string };

export function simulatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const { outstanding, emi, annualRatePct, remainingMonths, amount, mode } = input;
  if (!(amount > 0)) return { ok: false, error: 'Enter a prepayment amount more than zero.' };
  if (amount > outstanding + 0.005)
    return { ok: false, error: 'The prepayment is more than the outstanding balance.' };

  const interestBefore = remainingInterest({ outstanding, emi, annualRatePct });
  const newOutstanding = round2(outstanding - amount);

  if (newOutstanding <= 0) {
    return {
      ok: true,
      newOutstanding: 0,
      newMonths: 0,
      newEmi: 0,
      interestBefore,
      interestAfter: 0,
      interestSaved: round2(interestBefore),
    };
  }

  if (mode === 'tenure') {
    const months = prepaymentReduceTenure({ outstanding: newOutstanding, emi, annualRatePct });
    if (months === null)
      return { ok: false, error: 'The EMI does not cover the interest on the reduced balance.' };
    const interestAfter = remainingInterest({ outstanding: newOutstanding, emi, annualRatePct });
    return {
      ok: true,
      newOutstanding,
      newMonths: months,
      newEmi: emi,
      interestBefore,
      interestAfter,
      interestSaved: round2(interestBefore - interestAfter),
    };
  }

  if (remainingMonths < 1) return { ok: false, error: 'No instalments are left to reduce.' };
  const newEmi = prepaymentReduceEmi({
    outstanding: newOutstanding,
    annualRatePct,
    remainingMonths,
  });
  const interestAfter = remainingInterest({
    outstanding: newOutstanding,
    emi: newEmi,
    annualRatePct,
  });
  return {
    ok: true,
    newOutstanding,
    newMonths: remainingMonths,
    newEmi,
    interestBefore,
    interestAfter,
    interestSaved: round2(interestBefore - interestAfter),
  };
}

/** Interest accrued on the balance for `days` days since the last instalment (simple, actual/365 estimate). */
export function accruedInterest(input: {
  outstanding: number;
  annualRatePct: number;
  days: number;
}): number {
  if (input.days <= 0 || input.annualRatePct <= 0) return 0;
  return round2((input.outstanding * input.annualRatePct * input.days) / (100 * 365));
}

/** Total to pay to close early: balance + charge % + accrued interest to the date (FR-LOAN-07). An estimate. */
export function foreclosureEstimate(input: {
  outstanding: number;
  annualRatePct: number;
  chargePct: number;
  days: number;
}) {
  const accrued = accruedInterest({
    outstanding: input.outstanding,
    annualRatePct: input.annualRatePct,
    days: input.days,
  });
  const charge = round2((input.outstanding * input.chargePct) / 100);
  return { charge, accruedInterest: accrued, total: round2(input.outstanding + charge + accrued) };
}
