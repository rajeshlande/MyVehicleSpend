// T16a — fuel entry rules (FR-FUEL-01, FR-FUEL-04, FR-FUEL-05; TC-FUEL-01, TC-FUEL-04). Pure.
import { describe, it, expect } from 'vitest';
import { fuelInputSchema, fuelTotal, quantityUnit } from './schema';

const base = {
  vehicleId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  filledOn: '2026-10-01',
  odometerKm: 48000,
  pricePerUnit: 100.5,
  isFullTank: true,
  paymentMode: 'upi',
  station: 'HP Pump',
};

describe('fuelTotal (TC-FUEL-01)', () => {
  it('multiplies quantity by price and rounds to paise: 30 L × ₹100.50 = ₹3,015.00', () => {
    expect(fuelTotal(30, 100.5)).toBe(3015);
  });

  it('rounds half-paise correctly: 12.345 kWh × ₹8.00 = ₹98.76', () => {
    expect(fuelTotal(12.345, 8)).toBe(98.76);
  });
});

describe('quantityUnit', () => {
  it('uses kWh for EVs and litres for everything else', () => {
    expect(quantityUnit('ev')).toBe('kWh');
    expect(quantityUnit('petrol')).toBe('litres');
    expect(quantityUnit('cng')).toBe('litres');
  });
});

describe('fuelInputSchema', () => {
  it('accepts a petrol fill with litres', () => {
    const r = fuelInputSchema.safeParse({
      ...base,
      litres: 30,
      energyKwh: undefined,
      fuelType: 'petrol',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an EV fill with kWh and no litres', () => {
    const r = fuelInputSchema.safeParse({
      ...base,
      litres: undefined,
      energyKwh: 12,
      fuelType: 'ev',
    });
    expect(r.success).toBe(true);
  });

  it('requires kWh for EVs and litres for petrol', () => {
    expect(fuelInputSchema.safeParse({ ...base, litres: 30, fuelType: 'ev' }).success).toBe(false);
    expect(fuelInputSchema.safeParse({ ...base, energyKwh: 12, fuelType: 'petrol' }).success).toBe(
      false
    );
  });

  it('rejects a zero or negative quantity and a zero price', () => {
    expect(fuelInputSchema.safeParse({ ...base, litres: 0, fuelType: 'petrol' }).success).toBe(
      false
    );
    expect(
      fuelInputSchema.safeParse({ ...base, litres: 10, pricePerUnit: 0, fuelType: 'petrol' })
        .success
    ).toBe(false);
  });

  it('rejects implausible values: over 200 L in one fill, price over ₹9,999.99', () => {
    expect(fuelInputSchema.safeParse({ ...base, litres: 201, fuelType: 'petrol' }).success).toBe(
      false
    );
    expect(
      fuelInputSchema.safeParse({ ...base, litres: 10, pricePerUnit: 10000, fuelType: 'petrol' })
        .success
    ).toBe(false);
  });

  it('rejects a negative odometer', () => {
    expect(
      fuelInputSchema.safeParse({ ...base, litres: 10, odometerKm: -1, fuelType: 'petrol' }).success
    ).toBe(false);
  });
});
