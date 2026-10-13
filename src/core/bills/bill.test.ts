import { describe, it, expect } from 'vitest';
import { computeTotals, serviceBillSchema } from './bill';

const VEHICLE = '6f1c3a52-1b7e-4d2a-9c3e-0a1b2c3d4e5f';

function input(over: Partial<Record<string, unknown>> = {}) {
  return {
    vehicleId: VEHICLE,
    billNo: 'SB-101',
    vendor: 'Sharma Motors',
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    tax: 0,
    notes: '',
    items: [{ description: 'Engine oil', quantity: 1, unitPrice: 1200 }],
    ...over,
  };
}

describe('computeTotals', () => {
  it('works out each line, the subtotal and the total in paise, with no float drift', () => {
    const t = computeTotals(
      [
        { quantity: 1, unitPrice: 1200 },
        { quantity: 2, unitPrice: 150.5 },
      ],
      0
    );
    expect(t.lines).toEqual([1200, 301]);
    expect(t.subtotal).toBe(1501);
    expect(t.total).toBe(1501);
  });

  it('adds tax to the subtotal', () => {
    const t = computeTotals([{ quantity: 1, unitPrice: 1000 }], 180);
    expect(t.total).toBe(1180);
  });

  it('handles fractional quantities such as 1.5 litres', () => {
    const t = computeTotals([{ quantity: 1.5, unitPrice: 99.99 }], 0);
    expect(t.lines[0]).toBe(149.99);
  });
});

describe('serviceBillSchema', () => {
  it('accepts a valid bill', () => {
    expect(serviceBillSchema.safeParse(input()).success).toBe(true);
  });

  it('needs at least one item', () => {
    const r = serviceBillSchema.safeParse(input({ items: [] }));
    expect(r.success).toBe(false);
  });

  it('rejects a zero or negative quantity and a negative price', () => {
    expect(
      serviceBillSchema.safeParse(
        input({ items: [{ description: 'x', quantity: 0, unitPrice: 10 }] })
      ).success
    ).toBe(false);
    expect(
      serviceBillSchema.safeParse(
        input({ items: [{ description: 'x', quantity: 1, unitPrice: -5 }] })
      ).success
    ).toBe(false);
  });

  it('rejects a due date before the issue date', () => {
    const r = serviceBillSchema.safeParse(
      input({ issueDate: '2026-10-10', dueDate: '2026-10-01' })
    );
    expect(r.success).toBe(false);
  });

  it('rejects a blank bill number and a blank vendor', () => {
    expect(serviceBillSchema.safeParse(input({ billNo: '  ' })).success).toBe(false);
    expect(serviceBillSchema.safeParse(input({ vendor: '' })).success).toBe(false);
  });

  it('rejects an amount above the app limit (₹1 crore) on any line', () => {
    const r = serviceBillSchema.safeParse(
      input({ items: [{ description: 'x', quantity: 1, unitPrice: 20_000_000 }] })
    );
    expect(r.success).toBe(false);
  });
});
