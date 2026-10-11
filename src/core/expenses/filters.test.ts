// T12 — pure filter and search rules (FR-EXP-03, FR-EXP-04; TC-EXP-05, TC-EXP-06).
import { describe, it, expect } from 'vitest';
import { applyFilters, searchMatches, EMPTY_FILTERS, type ExpenseFilterable } from './filters';

const rows: ExpenseFilterable[] = [
  {
    categoryId: 'c-petrol',
    categoryGroup: 'Fuel & Energy',
    expenseDate: '2026-10-01',
    paymentMode: 'upi',
    amount: 3000,
    vendor: 'HP Pump',
    notes: '',
  },
  {
    categoryId: 'c-service',
    categoryGroup: 'Maintenance',
    expenseDate: '2026-09-15',
    paymentMode: 'card',
    amount: 8500,
    vendor: 'Sharma Motors',
    notes: 'Engine oil and filter',
  },
  {
    categoryId: 'c-insurance',
    categoryGroup: 'Insurance & Legal',
    expenseDate: '2026-04-02',
    paymentMode: 'netbanking',
    amount: 12000,
    vendor: '',
    notes: 'Annual cover',
  },
];

describe('applyFilters (FR-EXP-03, TC-EXP-05)', () => {
  it('returns everything with empty filters', () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('filters by category group', () => {
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, categoryGroup: 'Maintenance' }).map((r) => r.vendor)
    ).toEqual(['Sharma Motors']);
  });

  it('filters by category id', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, categoryId: 'c-petrol' })).toHaveLength(1);
  });

  it('applies an inclusive date range', () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, from: '2026-09-15', to: '2026-10-01' });
    expect(out).toHaveLength(2);
  });

  it('filters by payment mode and amount range (inclusive)', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, paymentMode: 'card' })).toHaveLength(1);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, minAmount: 3000, maxAmount: 8500 })).toHaveLength(
      2
    );
  });

  it('combines filters with AND', () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      from: '2026-01-01',
      paymentMode: 'upi',
      minAmount: 1000,
    });
    expect(out.map((r) => r.vendor)).toEqual(['HP Pump']);
  });
});

describe('searchMatches (FR-EXP-04, TC-EXP-06)', () => {
  it('matches vendor case-insensitively', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, query: 'sharma' }).map((r) => r.vendor)).toEqual([
      'Sharma Motors',
    ]);
  });

  it('also matches note text', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, query: 'engine oil' })).toHaveLength(1);
  });

  it('ignores surrounding spaces and treats an empty query as no filter', () => {
    expect(searchMatches(rows[0]!, '   ')).toBe(true);
    expect(searchMatches(rows[0]!, '  hp  ')).toBe(true);
  });

  it('returns no rows for an unmatched query', () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, query: 'zzz' })).toHaveLength(0);
  });
});
