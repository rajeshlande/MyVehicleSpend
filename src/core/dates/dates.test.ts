// Dates: business dates are Indian (Asia/Kolkata), stored as YYYY-MM-DD (RULE-02, CODING §3).
import { describe, it, expect } from 'vitest';
import {
  todayIST,
  isoDateIST,
  fiscalYearOf,
  fyRange,
  formatDMY,
  isFutureBeyondTomorrow,
} from './dates';

describe('todayIST', () => {
  it('uses the Indian calendar day, not UTC', () => {
    // 2026-10-10 20:00 UTC is already 2026-10-11 01:30 in India.
    expect(isoDateIST(new Date('2026-10-10T20:00:00Z'))).toBe('2026-10-11');
    expect(todayIST(new Date('2026-10-11T06:00:00Z'))).toBe('2026-10-11');
  });
});

describe('Indian financial year (1 April – 31 March)', () => {
  it('maps dates to the FY that starts in April', () => {
    expect(fiscalYearOf('2026-03-31')).toBe(2025);
    expect(fiscalYearOf('2026-04-01')).toBe(2026);
    expect(fiscalYearOf('2026-10-11')).toBe(2026);
  });
  it('returns the inclusive FY date range', () => {
    expect(fyRange(2026)).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });
});

describe('formatting and validation', () => {
  it('formats as DD/MM/YYYY', () => {
    expect(formatDMY('2026-10-03')).toBe('03/10/2026');
  });
  it('flags dates more than one day ahead (FR-EXP schema rule)', () => {
    expect(isFutureBeyondTomorrow('2026-10-12', '2026-10-11')).toBe(false);
    expect(isFutureBeyondTomorrow('2026-10-13', '2026-10-11')).toBe(true);
  });
});
