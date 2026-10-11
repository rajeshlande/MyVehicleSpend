// T7 — registration number and vehicle validation (FR-VEH-01, FR-VEH-06; TC-VEH-01, TC-VEH-04).
import { describe, it, expect } from 'vitest';
import { normalizeRegistration, isValidRegistration, formatRegistration } from './registration';
import { vehicleInputSchema } from './schema';

describe('normalizeRegistration', () => {
  it('upper-cases and strips spaces and hyphens (TC-VEH-01)', () => {
    expect(normalizeRegistration(' mh 12 ab 1234 ')).toBe('MH12AB1234');
    expect(normalizeRegistration('mh-12-ab-1234')).toBe('MH12AB1234');
  });
});

describe('isValidRegistration (TC-VEH-04)', () => {
  it('accepts normal and BH-series numbers', () => {
    expect(isValidRegistration('MH12AB1234')).toBe(true);
    expect(isValidRegistration('KA01XY0007')).toBe(true);
    expect(isValidRegistration('22BH1234AA')).toBe(true);
  });
  it('rejects symbols and too-short values', () => {
    expect(isValidRegistration('AB@@')).toBe(false);
    expect(isValidRegistration('AB')).toBe(false);
    expect(isValidRegistration('')).toBe(false);
  });
});

describe('formatRegistration (display)', () => {
  it('groups state, RTO, series and number', () => {
    expect(formatRegistration('MH12AB1234')).toBe('MH 12 AB 1234');
    expect(formatRegistration('KA01XY0007')).toBe('KA 01 XY 0007');
  });
  it('returns unusual formats unchanged', () => {
    expect(formatRegistration('22BH1234AA')).toBe('22BH1234AA');
  });
});

describe('vehicleInputSchema', () => {
  const valid = {
    vehicleType: 'car',
    registrationNo: 'mh 12 ab 1234',
    make: 'Maruti Suzuki',
    model: 'Swift',
    fuelType: 'petrol',
    startOdometerKm: 25000,
  } as const;

  it('accepts a complete car and normalises the registration', () => {
    const r = vehicleInputSchema.parse(valid);
    expect(r.registrationNo).toBe('MH12AB1234');
  });

  it('rejects an invalid registration with a plain message (TC-VEH-04)', () => {
    const r = vehicleInputSchema.safeParse({ ...valid, registrationNo: 'AB-@@' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/Registration number must be/);
    }
  });

  it('rejects an unknown vehicle type and fuel type', () => {
    expect(vehicleInputSchema.safeParse({ ...valid, vehicleType: 'truck' }).success).toBe(false);
    expect(vehicleInputSchema.safeParse({ ...valid, fuelType: 'hydrogen' }).success).toBe(false);
  });

  it('rejects negative odometer and price', () => {
    expect(vehicleInputSchema.safeParse({ ...valid, startOdometerKm: -1 }).success).toBe(false);
    expect(vehicleInputSchema.safeParse({ ...valid, purchasePrice: -5 }).success).toBe(false);
  });
});
