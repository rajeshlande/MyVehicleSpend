// T19 — EMI payment rules (FR-LOAN-05, FR-LOAN-09; TC-LOAN-05, TC-LOAN-06). Pure.
import { describe, it, expect } from 'vitest';
import { paymentTotal, displayStatus, paymentInputSchema, positionAfterPayments } from './payment';

describe('paymentTotal — what the expense records (TC-LOAN-05)', () => {
  it('EMI ₹16,703.92 + late fee ₹200 = ₹16,903.92', () => {
    expect(paymentTotal({ scheduledEmi: 16703.92, lateFee: 200, bounceCharge: 0 })).toBe(16903.92);
  });

  it('includes a bounce charge as well as a late fee', () => {
    expect(paymentTotal({ scheduledEmi: 16703.92, lateFee: 200, bounceCharge: 500 })).toBe(
      17403.92
    );
  });
});

describe('displayStatus — paid / pending / late (FR-LOAN-05; TC-LOAN-06)', () => {
  it('an instalment due 05/10/2026 and not paid by 08/10/2026 shows Late', () => {
    expect(displayStatus({ status: 'scheduled', dueDate: '2026-10-05' }, '2026-10-08')).toBe(
      'late'
    );
  });

  it('a future due date that is not paid shows Pending', () => {
    expect(displayStatus({ status: 'scheduled', dueDate: '2026-11-05' }, '2026-10-12')).toBe(
      'pending'
    );
  });

  it('due today and not paid is still Pending, not Late', () => {
    expect(displayStatus({ status: 'scheduled', dueDate: '2026-10-12' }, '2026-10-12')).toBe(
      'pending'
    );
  });

  it('a paid instalment stays Paid, even if it was due in the past', () => {
    expect(displayStatus({ status: 'paid', dueDate: '2026-10-05' }, '2026-10-12')).toBe('paid');
  });

  it('a waived instalment stays Waived', () => {
    expect(displayStatus({ status: 'waived', dueDate: '2026-10-05' }, '2026-10-12')).toBe('waived');
  });
});

describe('paymentInputSchema', () => {
  const base = {
    paidOn: '2026-10-12',
    lateFee: 200,
    bounceCharge: 0,
    paymentMode: 'upi',
    notes: '',
  };

  it('accepts a payment on or before tomorrow', () => {
    expect(paymentInputSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a date more than one day in the future', () => {
    const r = paymentInputSchema.safeParse({ ...base, paidOn: '2099-01-01' });
    expect(r.success).toBe(false);
  });

  it('rejects negative fees and notes over 1000 characters', () => {
    expect(paymentInputSchema.safeParse({ ...base, lateFee: -1 }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...base, notes: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('positionAfterPayments — works for payments in any order (FR-LOAN-08)', () => {
  it('outstanding = loan amount minus principal of paid rows, even if a later row is paid first', () => {
    const rows = [
      { status: 'scheduled', principal: 9000, interest: 6000 },
      { status: 'scheduled', principal: 9500, interest: 5500 },
      { status: 'paid', principal: 10000, interest: 5000 }, // paid out of order
    ] as const;
    const pos = positionAfterPayments(
      100000,
      rows.map((r) => ({ ...r }))
    );
    expect(pos.outstanding).toBe(90000); // 1,00,000 less the 10,000 principal paid
    expect(pos.interestPaid).toBe(5000);
    expect(pos.interestRemaining).toBe(11500);
    expect(pos.monthsRemaining).toBe(2);
  });

  it('nothing paid: outstanding is the full amount, all interest remains', () => {
    const pos = positionAfterPayments(100000, [
      { status: 'scheduled', principal: 50000, interest: 1000 },
      { status: 'scheduled', principal: 50000, interest: 500 },
    ]);
    expect(pos).toEqual({
      outstanding: 100000,
      interestPaid: 0,
      interestRemaining: 1500,
      monthsRemaining: 2,
    });
  });
});
