// T17 — EMI engine (SDD §5.1–5.5; TC-LOAN-01..04, 07..10). Pure; no I/O.
import { describe, it, expect } from 'vitest';
import {
  emi,
  buildSchedule,
  flatRateEmi,
  flatRateEffectiveRate,
  prepaymentReduceTenure,
  prepaymentReduceEmi,
  remainingInterest,
  foreclosureQuote,
  loanSummary,
} from './emi';

describe('EMI, reducing balance (SDD §5.1; TC-LOAN-01)', () => {
  it('₹8,00,000 at 9.25% for 60 months = ₹16,703.92 (matches spreadsheet PMT)', () => {
    expect(emi({ principal: 800000, annualRatePct: 9.25, months: 60 })).toBe(16703.92);
  });

  it('zero-rate loan: ₹1,20,000 over 12 months = ₹10,000.00 (TC-LOAN-03)', () => {
    expect(emi({ principal: 120000, annualRatePct: 0, months: 12 })).toBe(10000);
  });
});

describe('Amortisation schedule (SDD §5.2; TC-LOAN-02)', () => {
  const s = buildSchedule({ principal: 800000, annualRatePct: 9.25, months: 60 });

  it('has one row per month and the last balance is exactly zero', () => {
    expect(s.rows).toHaveLength(60);
    expect(s.rows[59]?.balance).toBe(0);
  });

  it('principal components sum exactly to the loan amount', () => {
    const sum = s.rows.reduce((t, r) => t + r.principal, 0);
    expect(Math.round(sum * 100) / 100).toBe(800000);
  });

  it('total interest is within ₹1 of (EMI × months) − principal', () => {
    const totalInterest = s.rows.reduce((t, r) => t + r.interest, 0);
    expect(Math.abs(totalInterest - (16703.92 * 60 - 800000))).toBeLessThan(1);
  });

  it('each row is interest + principal, and the first interest is principal × monthly rate', () => {
    const first = s.rows[0];
    expect(first?.interest).toBe(Math.round(800000 * (0.0925 / 12) * 100) / 100);
    for (const r of s.rows)
      expect(Math.round((r.interest + r.principal) * 100) / 100).toBeCloseTo(r.emi, 2);
  });
});

describe('Flat-rate loan (SDD §5.3; TC-LOAN-04)', () => {
  it('₹5,00,000 flat 8% for 36 months = ₹17,222.22 EMI', () => {
    expect(flatRateEmi({ principal: 500000, flatRatePct: 8, months: 36 })).toBe(17222.22);
  });

  it('shows the equivalent reducing rate, computed (about 14.5% nominal p.a.)', () => {
    const e = flatRateEffectiveRate({ principal: 500000, emi: 17222.22, months: 36 });
    expect(e.annualNominalPct).toBeGreaterThan(14);
    expect(e.annualNominalPct).toBeLessThan(15);
    // Check: the EMI over 36 months at that rate pays back the principal.
    const pv = (17222.22 * (1 - Math.pow(1 + e.monthlyRate, -36))) / e.monthlyRate;
    expect(Math.abs(pv - 500000)).toBeLessThan(1);
  });
});

describe('Prepayment (SDD §5.4, §5.5; TC-LOAN-07, TC-LOAN-08)', () => {
  // Original loan after 14 EMIs: outstanding is the balance after row 14 of the schedule.
  const s = buildSchedule({ principal: 800000, annualRatePct: 9.25, months: 60 });
  const outstanding14 = s.rows[13]!.balance;

  it('reduce-tenure: a ₹1,00,000 prepayment shortens the remaining months, EMI unchanged (TC-LOAN-07)', () => {
    const before = 46;
    const after = prepaymentReduceTenure({
      outstanding: outstanding14 - 100000,
      emi: 16703.92,
      annualRatePct: 9.25,
    });
    expect(after).toBeLessThan(before);
    expect(after).toBe(38);
    const saved =
      remainingInterest({ outstanding: outstanding14, emi: 16703.92, annualRatePct: 9.25 }) -
      remainingInterest({
        outstanding: outstanding14 - 100000,
        emi: 16703.92,
        annualRatePct: 9.25,
      });
    expect(saved).toBeGreaterThanOrEqual(0);
  });

  it('reduce-tenure: a small balance is cleared by one more instalment', () => {
    expect(prepaymentReduceTenure({ outstanding: 10000, emi: 16703.92, annualRatePct: 9.25 })).toBe(
      1
    );
  });

  it('reduce-tenure: nothing outstanding means 0 months', () => {
    expect(prepaymentReduceTenure({ outstanding: 0, emi: 16703.92, annualRatePct: 9.25 })).toBe(0);
  });

  it('reduce-tenure: an EMI that does not cover interest returns null (never amortises)', () => {
    // Interest on ₹30,00,000 at 9.25% is about ₹23,125 a month, more than the ₹16,703.92 EMI.
    expect(
      prepaymentReduceTenure({ outstanding: 3000000, emi: 16703.92, annualRatePct: 9.25 })
    ).toBeNull();
  });

  it('reduce-EMI: keeps 46 months and recalculates the EMI with the SDD formula (TC-LOAN-08)', () => {
    const newEmi = prepaymentReduceEmi({
      outstanding: outstanding14 - 100000,
      annualRatePct: 9.25,
      remainingMonths: 46,
    });
    expect(newEmi).toBe(14113.58);
    expect(newEmi).toBeLessThan(16703.92);
  });

  it('reduce-EMI with zero rate divides the balance evenly', () => {
    expect(
      prepaymentReduceEmi({ outstanding: 120000, annualRatePct: 0, remainingMonths: 12 })
    ).toBe(10000);
  });
});

describe('Foreclosure estimate (FR-LOAN-07; TC-LOAN-09)', () => {
  it('outstanding ₹5,00,000 with a 4% charge: charge ₹20,000, total ₹5,20,000', () => {
    expect(foreclosureQuote({ outstanding: 500000, chargePct: 4 })).toEqual({
      charge: 20000,
      accruedInterest: 0,
      total: 520000,
    });
  });

  it('adds accrued interest to date when given', () => {
    expect(
      foreclosureQuote({ outstanding: 500000, chargePct: 4, accruedInterest: 1234.5 }).total
    ).toBe(521234.5);
  });
});

describe('Loan summary (FR-LOAN-08; TC-LOAN-10)', () => {
  const s = buildSchedule({ principal: 800000, annualRatePct: 9.25, months: 60 });
  const sum = loanSummary(s.rows, 14);

  it('shows outstanding, interest paid, interest remaining and months remaining for 14 of 60 paid', () => {
    expect(sum.outstanding).toBe(s.rows[13]?.balance);
    expect(sum.monthsRemaining).toBe(46);
    const paid = s.rows.slice(0, 14).reduce((t, r) => t + r.interest, 0);
    expect(sum.interestPaid).toBe(Math.round(paid * 100) / 100);
    expect(Math.round((sum.interestPaid + sum.interestRemaining) * 100) / 100).toBeCloseTo(
      s.rows.reduce((t, r) => t + r.interest, 0),
      0
    );
  });
});
