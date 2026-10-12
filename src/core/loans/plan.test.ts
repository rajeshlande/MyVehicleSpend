// T18 — loan plan: computed or entered EMI, flat-rate conversion, schedule (FR-LOAN-01..04).
import { describe, it, expect } from 'vitest';
import { planLoan, scheduleWithDates } from './plan';

describe('planLoan — reducing balance (FR-LOAN-02, FR-LOAN-03)', () => {
  it('computes the EMI and a 60-row schedule for ₹8,00,000 at 9.25% over 60 months', () => {
    const p = planLoan({ principal: 800000, annualRatePct: 9.25, months: 60, method: 'reducing' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.emi).toBe(16703.92);
    expect(p.emiSource).toBe('computed');
    expect(p.rows).toHaveLength(60);
    expect(p.rows[59]?.balance).toBe(0);
  });

  it('uses an entered EMI and still clears the balance (FR-LOAN-01 override)', () => {
    const p = planLoan({
      principal: 800000,
      annualRatePct: 9.25,
      months: 60,
      method: 'reducing',
      emiOverride: 17000,
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.emi).toBe(17000);
    expect(p.emiSource).toBe('entered');
    expect(p.rows[0]?.emi).toBe(17000);
    expect(p.rows[p.rows.length - 1]?.balance).toBe(0);
    // A higher EMI pays off early: the stored tenure follows the rows.
    expect(p.rows.length).toBeLessThan(60);
    expect(p.tenureMonths).toBe(p.rows.length);
  });

  it('rejects an entered EMI that does not cover the first month interest', () => {
    const p = planLoan({
      principal: 800000,
      annualRatePct: 9.25,
      months: 60,
      method: 'reducing',
      emiOverride: 5000,
    });
    expect(p).toEqual({ ok: false, error: expect.stringMatching(/interest/i) });
  });

  it('rejects an entered EMI so low that the final instalment would be far larger', () => {
    const p = planLoan({
      principal: 800000,
      annualRatePct: 9.25,
      months: 60,
      method: 'reducing',
      emiOverride: 16000,
    });
    expect(p).toEqual({ ok: false, error: expect.stringMatching(/too low/i) });
  });

  it('rejects zero or negative entered EMI', () => {
    const p = planLoan({
      principal: 800000,
      annualRatePct: 9.25,
      months: 60,
      method: 'reducing',
      emiOverride: 0,
    });
    expect(p.ok).toBe(false);
  });
});

describe('planLoan — flat rate (FR-LOAN-04)', () => {
  it('computes the flat EMI and shows the equivalent reducing rate as an estimate', () => {
    const p = planLoan({ principal: 500000, annualRatePct: 8, months: 36, method: 'flat' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.emi).toBe(17222.22);
    expect(p.scheduleRatePct).toBeGreaterThan(14);
    expect(p.scheduleRatePct).toBeLessThan(15);
    expect(p.rows).toHaveLength(36);
    expect(p.rows[35]?.balance).toBe(0);
  });
});

describe('planLoan — zero rate', () => {
  it('splits principal evenly with no interest (TC-LOAN-03)', () => {
    const p = planLoan({ principal: 120000, annualRatePct: 0, months: 12, method: 'reducing' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.emi).toBe(10000);
    expect(p.rows.every((r) => r.interest === 0)).toBe(true);
  });
});

describe('scheduleWithDates — due dates and opening balances (FR-LOAN-03)', () => {
  it('puts instalments one month apart from the start date, same day of month', () => {
    const p = planLoan({ principal: 120000, annualRatePct: 0, months: 3, method: 'reducing' });
    if (!p.ok) throw new Error('fixture');
    const s = scheduleWithDates('2026-11-05', p.rows);
    expect(s.map((r) => r.dueDate)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
    expect(s[0]?.openingBalance).toBe(120000);
    expect(s[1]?.openingBalance).toBe(80000); // 3 × ₹40,000, no interest
    expect(s[2]?.closingBalance).toBe(0);
  });

  it('clamps a 31st start to the last day of shorter months', () => {
    const p = planLoan({ principal: 120000, annualRatePct: 0, months: 3, method: 'reducing' });
    if (!p.ok) throw new Error('fixture');
    const s = scheduleWithDates('2026-01-31', p.rows);
    expect(s.map((r) => r.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});
