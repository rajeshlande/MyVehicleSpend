import { describe, it, expect } from 'vitest';
import { presetRange, customRangeError, monthsInRange, monthKey } from './period';

// Today is 11/10/2026 (Sun 11 Oct 2026) per the spec example in TC-RPT-02.
const TODAY = '2026-10-11';

describe('period presets (FR-RPT-02)', () => {
  it('this month is the first to the last day of the current month', () => {
    expect(presetRange('this_month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('last month crosses the year boundary correctly', () => {
    expect(presetRange('last_month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('last_month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('this FY runs 1 April to 31 March (TC-RPT-02: 01/04/2026 – 31/03/2027)', () => {
    expect(presetRange('this_fy', TODAY)).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });

  it('this FY before April belongs to the previous financial year', () => {
    expect(presetRange('this_fy', '2027-02-10')).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });

  it('last 12 months starts 11 months back and ends today', () => {
    expect(presetRange('last_12', TODAY)).toEqual({ from: '2025-11-01', to: TODAY });
    expect(presetRange('last_12', '2026-01-05')).toEqual({ from: '2025-02-01', to: '2026-01-05' });
  });
});

describe('custom range', () => {
  it('accepts an ordered range', () => {
    expect(customRangeError({ from: '2026-01-01', to: '2026-01-31' })).toBeNull();
  });

  it('rejects a start after the end', () => {
    expect(customRangeError({ from: '2026-02-01', to: '2026-01-31' })).toMatch(/start date/);
  });

  it('rejects an incomplete date', () => {
    expect(customRangeError({ from: '', to: '2026-01-31' })).toBe('Choose both dates.');
  });
});

describe('months in a range', () => {
  it('lists every month, including ones with no data', () => {
    expect(monthsInRange({ from: '2026-11-20', to: '2027-02-03' })).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('gives a month key from a date', () => {
    expect(monthKey('2026-10-11')).toBe('2026-10');
  });
});
