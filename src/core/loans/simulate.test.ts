// T20 — prepayment simulator (FR-LOAN-06; TC-LOAN-07, TC-LOAN-08). Pure; nothing is saved.
import { describe, it, expect } from 'vitest';
import { simulatePrepayment } from './simulate';
import { buildSchedule } from './emi';

// Loan: ₹8,00,000 at 9.25% for 60 months, EMI ₹16,703.92. After 14 EMIs the balance is row 14's closing balance.
const sched = buildSchedule({ principal: 800000, annualRatePct: 9.25, months: 60 });
const OUT14 = sched.rows[13]!.balance;
const base = { outstanding: OUT14, emi: 16703.92, annualRatePct: 9.25, remainingMonths: 46 };

describe('simulatePrepayment — reduce tenure (TC-LOAN-07)', () => {
  it('₹1,00,000 prepaid after 14 EMIs: months fall from 46 to 38, EMI unchanged, interest saved ≥ 0', () => {
    const r = simulatePrepayment({ ...base, amount: 100000, mode: 'tenure' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newOutstanding).toBeCloseTo(OUT14 - 100000, 2);
    expect(r.newMonths).toBe(38);
    expect(r.newEmi).toBe(16703.92);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
});

describe('simulatePrepayment — reduce EMI (TC-LOAN-08)', () => {
  it('same prepayment with reduced EMI: tenure unchanged at 46, EMI recalculated to ₹14,113.58', () => {
    const r = simulatePrepayment({ ...base, amount: 100000, mode: 'emi' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newMonths).toBe(46);
    expect(r.newEmi).toBe(14113.58);
    expect(r.interestSaved).toBeGreaterThan(0);
  });

  it('reduce EMI saves less interest than reduce tenure (shorter tenure saves more)', () => {
    const t = simulatePrepayment({ ...base, amount: 100000, mode: 'tenure' });
    const e = simulatePrepayment({ ...base, amount: 100000, mode: 'emi' });
    if (!t.ok || !e.ok) throw new Error('fixture');
    expect(t.interestSaved).toBeGreaterThan(e.interestSaved);
  });
});

describe('simulatePrepayment — edge cases', () => {
  it('a prepayment that covers everything clears the loan and saves all remaining interest', () => {
    const r = simulatePrepayment({ ...base, amount: OUT14, mode: 'tenure' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newOutstanding).toBe(0);
    expect(r.newMonths).toBe(0);
    expect(r.interestAfter).toBe(0);
  });

  it('rejects zero or negative amounts', () => {
    expect(simulatePrepayment({ ...base, amount: 0, mode: 'tenure' }).ok).toBe(false);
    expect(simulatePrepayment({ ...base, amount: -5, mode: 'emi' }).ok).toBe(false);
  });

  it('rejects an amount above the outstanding balance', () => {
    const r = simulatePrepayment({ ...base, amount: OUT14 + 1, mode: 'tenure' });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/more than the outstanding/i) });
  });

  it('zero-rate loan: saves no interest', () => {
    const r = simulatePrepayment({
      outstanding: 120000,
      emi: 10000,
      annualRatePct: 0,
      remainingMonths: 12,
      amount: 20000,
      mode: 'emi',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.interestSaved).toBe(0);
    expect(r.newEmi).toBe(8333.33);
  });
});

import { foreclosureEstimate, accruedInterest } from './simulate';

describe('accruedInterest — interest since the last instalment (estimate)', () => {
  it('₹5,00,000 at 9% for 30 days ≈ ₹3,698.63 (simple, actual/365)', () => {
    expect(accruedInterest({ outstanding: 500000, annualRatePct: 9, days: 30 })).toBe(3698.63);
  });

  it('zero days or zero rate: nothing accrued', () => {
    expect(accruedInterest({ outstanding: 500000, annualRatePct: 9, days: 0 })).toBe(0);
    expect(accruedInterest({ outstanding: 500000, annualRatePct: 0, days: 30 })).toBe(0);
  });
});

describe('foreclosureEstimate — total payable (FR-LOAN-07; TC-LOAN-09)', () => {
  it('outstanding ₹5,00,000 with a 4% charge and no days accrued: total ₹5,20,000', () => {
    expect(
      foreclosureEstimate({ outstanding: 500000, annualRatePct: 9, chargePct: 4, days: 0 })
    ).toEqual({ charge: 20000, accruedInterest: 0, total: 520000 });
  });

  it('adds accrued interest to the charge and the balance', () => {
    const f = foreclosureEstimate({
      outstanding: 500000,
      annualRatePct: 9,
      chargePct: 4,
      days: 30,
    });
    expect(f.accruedInterest).toBe(3698.63);
    expect(f.total).toBe(523698.63);
  });
});
