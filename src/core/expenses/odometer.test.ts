// T13 — odometer warning on expenses (FR-EXP-07, RULE-03; TC-EXP-04).
import { describe, it, expect } from 'vitest';
import { lastKnownOdometer, checkOdometer } from './odometer';

describe('lastKnownOdometer', () => {
  it('uses the highest reading, or the vehicle start reading when there are none', () => {
    expect(lastKnownOdometer(25000, [])).toBe(25000);
    expect(lastKnownOdometer(25000, [48210, 30000])).toBe(48210);
    expect(lastKnownOdometer(25000, [null, undefined])).toBe(25000);
  });
});

describe('checkOdometer (TC-EXP-04)', () => {
  it('is ok when the reading is equal to or above the last known value', () => {
    expect(checkOdometer(48210, 48210)).toEqual({ status: 'ok' });
    expect(checkOdometer(48300, 48210)).toEqual({ status: 'ok' });
  });

  it('warns when the reading is lower than the last known value', () => {
    expect(checkOdometer(48000, 48210)).toEqual({ status: 'lower', lastKnown: 48210 });
  });

  it('is ok when no odometer is entered', () => {
    expect(checkOdometer(undefined, 48210)).toEqual({ status: 'ok' });
  });
});
