import { describe, it, expect } from 'vitest';
import { buildDashboard, type SpendRow } from './dashboard';

const RANGE = { from: '2026-10-01', to: '2026-10-31' };
const TODAY = '2026-10-11';

const row = (
  expenseDate: string,
  amount: number,
  categoryGroup = 'Fuel',
  odometerKm?: number
): SpendRow => ({
  expenseDate,
  amount,
  categoryGroup,
  odometerKm,
});

describe('dashboard totals (TC-RPT-01: to the paisa)', () => {
  it('sums only expenses inside the period, exactly', () => {
    const s = buildDashboard({
      range: RANGE,
      today: TODAY,
      expenses: [
        row('2026-10-01', 0.1),
        row('2026-10-05', 0.2),
        row('2026-10-31', 0.7),
        row('2026-09-30', 999), // before the period
        row('2026-11-01', 999), // after the period
      ],
      fuelLogs: [],
    });
    expect(s.total).toBe(1);
    expect(s.count).toBe(3);
  });

  it('avoids float drift across many small amounts', () => {
    const expenses = Array.from({ length: 10 }, () => row('2026-10-02', 0.1));
    expect(buildDashboard({ range: RANGE, today: TODAY, expenses, fuelLogs: [] }).total).toBe(1);
  });

  it('groups spend by category group, largest first, with shares', () => {
    const s = buildDashboard({
      range: RANGE,
      today: TODAY,
      expenses: [row('2026-10-02', 300, 'Fuel'), row('2026-10-03', 100, 'Insurance')],
      fuelLogs: [],
    });
    expect(s.byGroup).toEqual([
      { group: 'Fuel', total: 300, share: 0.75 },
      { group: 'Insurance', total: 100, share: 0.25 },
    ]);
  });

  it('monthly trend includes empty months in the range', () => {
    const s = buildDashboard({
      range: { from: '2026-08-01', to: '2026-10-31' },
      today: TODAY,
      expenses: [row('2026-08-15', 50), row('2026-10-02', 25)],
      fuelLogs: [],
    });
    expect(s.monthly).toEqual([
      { month: '2026-08', total: 50 },
      { month: '2026-09', total: 0 },
      { month: '2026-10', total: 25 },
    ]);
  });
});

describe('cost per month and cost per km (FR-RPT-01, TC-FUEL-05)', () => {
  it('cost per month uses months elapsed so far in an open period', () => {
    // FY 1 Apr to 31 Mar; today is 11 Oct, so 7 months have elapsed.
    const s = buildDashboard({
      range: { from: '2026-04-01', to: '2027-03-31' },
      today: TODAY,
      expenses: [row('2026-04-10', 700)],
      fuelLogs: [],
    });
    expect(s.monthsCounted).toBe(7);
    expect(s.costPerMonth).toBe(100);
  });

  it('cost per month is zero, not NaN, with no spend', () => {
    const s = buildDashboard({ range: RANGE, today: TODAY, expenses: [], fuelLogs: [] });
    expect(s.costPerMonth).toBe(0);
    expect(Number.isNaN(s.costPerMonth)).toBe(false);
  });

  it('cost per km is spend over the odometer span (TC-FUEL-05: ₹6,000 over 600 km = ₹10.00/km)', () => {
    const s = buildDashboard({
      range: RANGE,
      today: TODAY,
      expenses: [row('2026-10-02', 6000, 'Fuel', 48000)],
      fuelLogs: [{ filledOn: '2026-10-20', odometerKm: 48600 }],
    });
    expect(s.costPerKm).toEqual({ status: 'ok', perKm: 10 });
  });

  it('says why cost per km is unavailable with too few readings', () => {
    const s = buildDashboard({
      range: RANGE,
      today: TODAY,
      expenses: [row('2026-10-02', 6000)],
      fuelLogs: [],
    });
    expect(s.costPerKm.status).toBe('insufficient');
  });
});

describe('empty period (TC-RPT-04)', () => {
  it('returns zeros and empty lists, never NaN', () => {
    const s = buildDashboard({ range: RANGE, today: TODAY, expenses: [], fuelLogs: [] });
    expect(s.total).toBe(0);
    expect(s.byGroup).toEqual([]);
    expect(s.monthly.every((m) => m.total === 0)).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/);
  });
});
