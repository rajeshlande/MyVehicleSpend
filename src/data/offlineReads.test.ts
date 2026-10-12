// T29a — the real listExpenses, with a stubbed Supabase client: live, then offline (TC-PWA-03).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  next: { data: [] as unknown[], error: null as null | { message: string; code?: string } },
}));
vi.mock('./supabase', () => {
  // A chainable query: every builder call returns the same object, and awaiting it yields `state.next`.
  const query: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'not', 'range']) query[m] = () => query;
  query.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(state.next).then(resolve, reject);
  return {
    getSupabase: () => ({
      from: () => query,
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-a' } } } }) },
    }),
  };
});

import { listExpenses } from './expenses';
import { oldestCachedAt } from './freshness';
import { clearOfflineCache } from './offlineCache';

const row = (id: string) => ({
  id,
  vehicle_id: 'v1',
  category_id: 'c1',
  expense_date: '2026-06-02',
  amount: '1250.50',
  gst_amount: '0',
  payment_mode: 'upi',
  vendor: null,
  odometer_km: null,
  notes: null,
  receipt_paths: [],
  source: 'manual',
  expense_categories: { group_name: 'Fuel', name: 'Petrol' },
});

beforeEach(async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  await clearOfflineCache();
});

describe('listExpenses with the offline cache (TC-PWA-03)', () => {
  it('online: returns live rows; offline: returns the last saved rows, marked as saved data', async () => {
    state.next = { data: [row('e1')], error: null };
    const live = await listExpenses('v1');
    expect(live.map((e) => e.id)).toEqual(['e1']);
    expect(oldestCachedAt()).toBeNull();

    // The connection drops: the browser's fetch fails, which the data layer maps to a network error.
    state.next = { data: [], error: { message: 'TypeError: Failed to fetch' } };
    const saved = await listExpenses('v1');
    expect(saved.map((e) => e.id)).toEqual(['e1']);
    expect(saved[0]?.amount).toBe(1250.5);
    expect(oldestCachedAt()).not.toBeNull();
  });

  it('a real server error is shown, not replaced by saved rows', async () => {
    state.next = { data: [row('e1')], error: null };
    await listExpenses('v1');
    state.next = {
      data: [],
      error: { message: 'relation "expenses" does not exist', code: '42P01' },
    };
    await expect(listExpenses('v1')).rejects.toThrow(/Something went wrong/);
  });
});
