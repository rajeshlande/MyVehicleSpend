// T18 — loan input validation (FR-LOAN-01).
import { describe, it, expect } from 'vitest';
import { loanInputSchema } from './schema';

const base = {
  vehicleId: '11111111-1111-4111-8111-111111111111',
  lender: 'HDFC Bank',
  accountLast4: '4321',
  principal: 800000,
  annualRatePct: 9.25,
  tenureMonths: 60,
  startDate: '2026-11-05',
  interestMethod: 'reducing' as const,
  processingFee: 0,
  otherCharges: 0,
};

describe('loanInputSchema', () => {
  it('accepts a complete loan', () => {
    expect(loanInputSchema.safeParse(base).success).toBe(true);
  });

  it('requires a lender name', () => {
    expect(loanInputSchema.safeParse({ ...base, lender: ' ' }).success).toBe(false);
  });

  it('accepts a blank account last-4 but rejects anything that is not 4 digits', () => {
    expect(loanInputSchema.safeParse({ ...base, accountLast4: undefined }).success).toBe(true);
    expect(loanInputSchema.safeParse({ ...base, accountLast4: '43' }).success).toBe(false);
  });

  it('rejects zero principal, a rate above 60%, and tenure outside 1..360', () => {
    expect(loanInputSchema.safeParse({ ...base, principal: 0 }).success).toBe(false);
    expect(loanInputSchema.safeParse({ ...base, annualRatePct: 61 }).success).toBe(false);
    expect(loanInputSchema.safeParse({ ...base, tenureMonths: 361 }).success).toBe(false);
    expect(loanInputSchema.safeParse({ ...base, tenureMonths: 12.5 }).success).toBe(false);
  });

  it('rejects a principal above ₹10 crore (numeric(12,2) headroom and sanity)', () => {
    expect(loanInputSchema.safeParse({ ...base, principal: 100_000_001 }).success).toBe(false);
  });
});
