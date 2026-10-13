import { describe, it, expect } from 'vitest';
import { addDays, addMonths, addYears, weekDays, step } from './views';

describe('calendar date steps', () => {
  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps the day when a month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-13', -1)).toBe('2026-09-13');
  });

  it('clamps leap day when a year is added', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
  });

  it('returns the Sunday-to-Saturday week that contains the date', () => {
    expect(weekDays('2026-10-13')).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
    // A Sunday starts its own week.
    expect(weekDays('2026-10-11')[0]).toBe('2026-10-11');
  });

  it('steps by one unit of each view', () => {
    expect(step('day', '2026-10-13', 1)).toBe('2026-10-14');
    expect(step('week', '2026-10-13', -1)).toBe('2026-10-06');
    expect(step('month', '2026-10-13', 1)).toBe('2026-11-13');
    expect(step('year', '2026-10-13', -1)).toBe('2025-10-13');
  });
});
