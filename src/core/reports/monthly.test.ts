import { describe, it, expect } from 'vitest';
import { monthlyCategoryTable } from './monthly';
import { presetRange } from './period';

const e = (expenseDate: string, amount: number, categoryGroup: string) => ({
  expenseDate,
  amount,
  categoryGroup,
});

describe('monthly category table (FR-RPT-03)', () => {
  it('has one column per category group, largest first, and exact totals', () => {
    const t = monthlyCategoryTable(
      [
        e('2026-04-03', 0.1, 'Insurance'),
        e('2026-04-09', 0.2, 'Fuel'),
        e('2026-05-01', 1000, 'Fuel'),
      ],
      { from: '2026-04-01', to: '2026-05-31' }
    );
    expect(t.groups).toEqual(['Fuel', 'Insurance']);
    expect(t.rows).toEqual([
      { month: '2026-04', byGroup: { Fuel: 0.2, Insurance: 0.1 }, total: 0.3 },
      { month: '2026-05', byGroup: { Fuel: 1000, Insurance: 0 }, total: 1000 },
    ]);
    expect(t.totals).toEqual({ byGroup: { Fuel: 1000.2, Insurance: 0.1 }, total: 1000.3 });
  });

  it('column totals always add up to the grand total', () => {
    const t = monthlyCategoryTable(
      [e('2026-04-03', 33.33, 'A'), e('2026-04-04', 33.33, 'B'), e('2026-04-05', 33.34, 'C')],
      { from: '2026-04-01', to: '2026-04-30' }
    );
    const sum = Object.values(t.totals.byGroup).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(t.totals.total, 10);
    expect(t.totals.total).toBe(100);
  });

  it('TC-RPT-02: the FY filter 1 Apr to 31 Mar excludes 1 March data', () => {
    const fy = presetRange('this_fy', '2026-10-11');
    expect(fy).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    const t = monthlyCategoryTable(
      [
        e('2026-03-01', 500, 'Fuel'),
        e('2026-04-01', 100, 'Fuel'),
        e('2027-03-31', 50, 'Fuel'),
        e('2027-04-01', 999, 'Fuel'),
      ],
      fy
    );
    expect(t.totals.total).toBe(150);
    expect(t.rows[0]?.month).toBe('2026-04');
    expect(t.rows).toHaveLength(12);
  });

  it('an empty range gives zero rows, no NaN', () => {
    const t = monthlyCategoryTable([], { from: '2026-04-01', to: '2026-04-30' });
    expect(t.groups).toEqual([]);
    expect(t.totals.total).toBe(0);
    expect(JSON.stringify(t)).not.toMatch(/NaN/);
  });
});
