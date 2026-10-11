// T15 — mileage and cost per km (SDD §5.6, §5.7; TC-FUEL-03, TC-FUEL-05, TC-FUEL-07). Pure.
import { describe, it, expect } from 'vitest';
import { computeMileage, costPerKm, type FuelFill } from './mileage';

const fill = (filledOn: string, odometerKm: number, litres: number, isFull = true): FuelFill => ({
  filledOn,
  odometerKm,
  litres,
  isFull,
});

describe('computeMileage (SDD §5.6)', () => {
  it('includes partial fills in litres between two full tanks (TC-FUEL-02 data)', () => {
    const r = computeMileage([
      fill('2026-08-01', 48000, 30),
      fill('2026-08-10', 48250, 14, false),
      fill('2026-08-20', 48500, 16),
    ]);
    // Litres after the first full tank, up to and including the second: 14 + 16 = 30 L over 500 km.
    expect(r.status).toBe('ok');
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0]!.distanceKm).toBe(500);
    expect(r.intervals[0]!.litres).toBe(30);
    expect(r.intervals[0]!.kmpl).toBeCloseTo(16.67, 2);
  });

  it('gives average, best and worst with the dates of the best and worst intervals (TC-FUEL-03)', () => {
    const r = computeMileage([
      fill('2026-07-01', 10000, 20),
      fill('2026-07-15', 10400, 20), // 400 km / 20 L = 20.00
      fill('2026-08-01', 10800, 25), // 400 km / 25 L = 16.00
      fill('2026-08-20', 11200, 40), // 400 km / 40 L = 10.00
    ]);
    expect(r.status).toBe('ok');
    expect(r.averageKmpl).toBeCloseTo(1200 / 85, 2); // total km / total litres = 14.12
    expect(r.best).toEqual({ kmpl: 20, endDate: '2026-07-15' });
    expect(r.worst).toEqual({ kmpl: 10, endDate: '2026-08-20' });
  });

  it('ignores intervals with zero or negative distance (RULE-03 guard)', () => {
    const r = computeMileage([
      fill('2026-07-01', 10000, 20),
      fill('2026-07-10', 10000, 20), // distance 0: rejected
      fill('2026-07-20', 10500, 25),
    ]);
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0]!.distanceKm).toBe(500);
  });

  it('asks for one more full tank when fewer than two full fills exist (TC-FUEL-07)', () => {
    const r = computeMileage([fill('2026-07-01', 10000, 20)]);
    expect(r).toMatchObject({
      status: 'insufficient',
      message: 'Add one more full-tank fill to see mileage.',
    });
  });

  it('reports insufficient data under 50 km of total distance', () => {
    const r = computeMileage([fill('2026-07-01', 10000, 20), fill('2026-07-02', 10030, 2)]);
    expect(r).toMatchObject({
      status: 'insufficient',
      message: 'Not enough distance yet. Mileage needs at least 50 km.',
    });
  });

  it('sorts fills by odometer before computing', () => {
    const r = computeMileage([
      fill('2026-08-20', 10800, 20),
      fill('2026-07-01', 10000, 20),
      fill('2026-07-15', 10400, 20),
    ]);
    expect(r.intervals.map((i) => i.distanceKm)).toEqual([400, 400]);
  });
});

describe('costPerKm (SDD §5.7, TC-FUEL-05)', () => {
  it('is spend divided by distance: ₹6,000 over 600 km = ₹10.00/km', () => {
    expect(costPerKm(6000, 48000, 48600)).toEqual({ status: 'ok', perKm: 10 });
  });

  it('shows insufficient data under 50 km', () => {
    expect(costPerKm(1000, 48000, 48040)).toEqual({
      status: 'insufficient',
      message: 'Not enough distance yet. Cost per km needs at least 50 km.',
    });
  });
});
