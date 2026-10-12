/** EMI payment rules (FR-LOAN-05, FR-LOAN-09). Pure. */
import { z } from 'zod';
import { round2 } from '../money/money';
import { todayIST, isFutureBeyondTomorrow } from '../dates/dates';
import { PAYMENT_MODES } from '../expenses/schema';

/** Amount of the expense created for a payment: EMI plus late fee plus bounce charge. */
export function paymentTotal(p: {
  scheduledEmi: number;
  lateFee: number;
  bounceCharge: number;
}): number {
  return round2(p.scheduledEmi + p.lateFee + p.bounceCharge);
}

export type DisplayStatus = 'paid' | 'late' | 'pending' | 'waived';

/**
 * Status shown in the schedule. "Late" is derived from the due date, not stored, so it needs no background job.
 * A payment due today is still pending until the day ends.
 */
export function displayStatus(
  row: { status: 'scheduled' | 'paid' | 'late' | 'waived'; dueDate: string },
  today: string = todayIST()
): DisplayStatus {
  if (row.status === 'paid') return 'paid';
  if (row.status === 'waived') return 'waived';
  return row.dueDate < today ? 'late' : 'pending';
}

export const paymentInputSchema = z.object({
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid payment date.')
    .refine(
      (d) => !isFutureBeyondTomorrow(d, todayIST()),
      'The date cannot be more than a day in the future.'
    ),
  lateFee: z.number().min(0, 'Late fee cannot be negative.'),
  bounceCharge: z.number().min(0, 'Bounce charge cannot be negative.'),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  notes: z.string().max(1000, 'Keep notes under 1000 characters.'),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/**
 * Where the loan stands, from the rows marked paid (FR-LOAN-08). Works for payments in any order:
 * outstanding is the loan amount less the principal already paid.
 */
export function positionAfterPayments(
  principal: number,
  rows: readonly {
    status: 'scheduled' | 'paid' | 'late' | 'waived';
    principal: number;
    interest: number;
  }[]
): {
  outstanding: number;
  interestPaid: number;
  interestRemaining: number;
  monthsRemaining: number;
} {
  const paid = rows.filter((r) => r.status === 'paid');
  const open = rows.filter((r) => r.status !== 'paid');
  return {
    outstanding: round2(principal - paid.reduce((t, r) => t + r.principal, 0)),
    interestPaid: round2(paid.reduce((t, r) => t + r.interest, 0)),
    interestRemaining: round2(open.reduce((t, r) => t + r.interest, 0)),
    monthsRemaining: open.length,
  };
}
