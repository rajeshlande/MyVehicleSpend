// T22 — mark a reminder done, optionally recording its expense (FR-REM-03; TC-REM-03). Pure.
import { describe, it, expect } from 'vitest';
import { defaultCategoryFor, markDoneSchema } from './done';

const CAT = '44444444-4444-4444-8444-444444444444';

describe('defaultCategoryFor — matching category per reminder type (FR-REM-03)', () => {
  it('PUC maps to Government & RTO › PUC certificate (TC-REM-03)', () => {
    expect(defaultCategoryFor('puc')).toEqual({
      group: 'Government & RTO',
      name: 'PUC certificate',
    });
  });

  it('service reminders map to Maintenance & Service › Periodic service', () => {
    expect(defaultCategoryFor('service_km')).toEqual({
      group: 'Maintenance & Service',
      name: 'Periodic service',
    });
    expect(defaultCategoryFor('service_date')).toEqual({
      group: 'Maintenance & Service',
      name: 'Periodic service',
    });
  });

  it('custom reminders have no default: the user chooses', () => {
    expect(defaultCategoryFor('custom')).toBeNull();
  });
});

describe('markDoneSchema', () => {
  const base = { doneOn: '2026-10-12', recordExpense: false };

  it('marking done without an expense needs only the date', () => {
    expect(markDoneSchema.safeParse(base).success).toBe(true);
  });

  it('TC-REM-03: ₹100 expense with a category, dated today, is accepted', () => {
    const r = markDoneSchema.safeParse({
      ...base,
      recordExpense: true,
      amount: 100,
      categoryId: CAT,
    });
    expect(r.success).toBe(true);
  });

  it('recording an expense needs an amount above zero', () => {
    expect(
      markDoneSchema.safeParse({ ...base, recordExpense: true, categoryId: CAT }).success
    ).toBe(false);
    expect(
      markDoneSchema.safeParse({ ...base, recordExpense: true, amount: 0, categoryId: CAT }).success
    ).toBe(false);
  });

  it('recording an expense needs a category', () => {
    expect(markDoneSchema.safeParse({ ...base, recordExpense: true, amount: 100 }).success).toBe(
      false
    );
  });

  it('refuses a done date more than one day in the future', () => {
    expect(markDoneSchema.safeParse({ ...base, doneOn: '2099-01-01' }).success).toBe(false);
  });
});
