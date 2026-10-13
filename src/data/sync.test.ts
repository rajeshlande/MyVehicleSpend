// T29b + T29c — offline saves are queued, replayed with the same client id, and never duplicated (FR-PWA-04, FR-PWA-05; TC-PWA-04, TC-PWA-05).
// The fake server follows the SQL in add_expense / add_fuel_log: an existing id returns the existing row.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExpenseInput } from '../core/expenses/schema';

type Row = Record<string, unknown>;

const srv = vi.hoisted(() => ({
  expenses: new Map<string, Row>(),
  fuel: new Map<string, Row>(),
  uid: 'user-a' as string | null,
  lostResponseOnce: false,
  rejectNext: false,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock('./supabase', () => {
  const expenseRead = (id: string) => {
    const row = srv.expenses.get(id);
    return row
      ? {
          data: { ...row, expense_categories: { group_name: 'Fuel', name: 'Petrol' } },
          error: null,
        }
      : { data: null, error: { message: 'not found' } };
  };
  return {
    getSupabase: () => ({
      auth: {
        getSession: async () => ({ data: { session: srv.uid ? { user: { id: srv.uid } } : null } }),
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        srv.rpcCalls.push({ name, args });
        if (srv.rejectNext) {
          srv.rejectNext = false;
          return { data: null, error: { code: 'P0002', message: 'That vehicle was not found.' } };
        }
        if (name === 'add_expense') {
          const id = args.p_id as string;
          if (!srv.expenses.has(id)) {
            srv.expenses.set(id, {
              id,
              vehicle_id: args.p_vehicle_id,
              category_id: args.p_category_id,
              expense_date: args.p_expense_date,
              amount: String(args.p_amount),
              gst_amount: String(args.p_gst_amount ?? 0),
              payment_mode: args.p_payment_mode,
              vendor: args.p_vendor,
              odometer_km: args.p_odometer_km,
              notes: args.p_notes,
              receipt_paths: [],
              source: 'manual',
            });
          }
          if (srv.lostResponseOnce) {
            // The row is committed, but the response never reaches the phone.
            srv.lostResponseOnce = false;
            return { data: null, error: { message: 'TypeError: Failed to fetch' } };
          }
          return { data: srv.expenses.get(id), error: null };
        }
        if (name === 'add_fuel_log') {
          const id = args.p_id as string;
          if (!srv.fuel.has(id)) {
            const litres = args.p_litres as number | null;
            const total =
              Math.round((litres ?? 0) * (args.p_price_per_litre as number) * 100) / 100;
            srv.fuel.set(id, {
              id,
              vehicle_id: args.p_vehicle_id,
              expense_id: 'e-' + id,
              filled_on: args.p_filled_on,
              odometer_km: args.p_odometer_km,
              litres,
              energy_kwh: null,
              price_per_unit: args.p_price_per_litre,
              total_amount: String(total),
              is_full_tank: args.p_is_full_tank,
              station: null,
              payment_mode: null,
            });
          }
          return { data: srv.fuel.get(id), error: null };
        }
        return { data: null, error: { message: 'unknown rpc ' + name } };
      },
      from: (table: string) => {
        const q = {
          id: '',
          select() {
            return q;
          },
          eq(_col: string, value: string) {
            q.id = value;
            return q;
          },
          single: async () =>
            table === 'expenses' ? expenseRead(q.id) : { data: null, error: null },
        };
        return q;
      },
    }),
  };
});

import { createExpense } from './expenses';
import { addFuelLog } from './fuel';
import { syncNow, startSync } from './sync';
import { outboxCounts, clearOutboxForTests, discardFailed, failedItems } from './outbox';

const EXPENSE: ExpenseInput = {
  vehicleId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  expenseDate: '2026-10-02',
  amount: 1250.5,
  gstAmount: 0,
  paymentMode: 'upi',
  vendor: 'Pump A',
  odometerKm: 50100,
} as ExpenseInput;

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

beforeEach(async () => {
  srv.expenses.clear();
  srv.fuel.clear();
  srv.uid = 'user-a';
  srv.lostResponseOnce = false;
  srv.rejectNext = false;
  srv.rpcCalls.length = 0;
  setOnline(true);
  await clearOutboxForTests();
});

describe('offline save and replay (TC-PWA-04)', () => {
  it('an online save goes straight to the server and is not queued', async () => {
    const created = await createExpense(EXPENSE);
    expect(created.pending).toBeUndefined();
    expect(created.amount).toBe(1250.5);
    expect(srv.expenses.size).toBe(1);
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });

  it('with the phone offline, the save is queued and shows as pending, and the server is not called', async () => {
    setOnline(false);
    const created = await createExpense(EXPENSE);
    expect(created.pending).toBe(true);
    expect(srv.rpcCalls).toHaveLength(0);
    expect(await outboxCounts('user-a')).toEqual({ pending: 1, failed: 0 });
  });

  it('after a reconnect, the queued expense reaches the server once', async () => {
    setOnline(false);
    await createExpense(EXPENSE);
    setOnline(true);
    await syncNow('user-a');
    expect(srv.expenses.size).toBe(1);
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });
});

describe('no duplicates when a response is lost (T29c, TC-PWA-05)', () => {
  it('the row is committed, the response is lost, the replay reuses the id, and there is still one row', async () => {
    srv.lostResponseOnce = true;
    const provisional = await createExpense(EXPENSE);
    expect(provisional.pending).toBe(true);
    expect(srv.expenses.size).toBe(1); // the server did save it

    await syncNow('user-a');

    expect(srv.expenses.size).toBe(1);
    const sentIds = srv.rpcCalls.filter((c) => c.name === 'add_expense').map((c) => c.args.p_id);
    expect(sentIds).toEqual([provisional.id, provisional.id]); // same client id both times
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });

  it('fuel fills use the same rule through add_fuel_log', async () => {
    srv.lostResponseOnce = false;
    setOnline(false);
    const queued = await addFuelLog({
      vehicleId: '11111111-1111-4111-8111-111111111111',
      filledOn: '2026-10-03',
      odometerKm: 50200,
      litres: 20,
      pricePerUnit: 100,
      isFullTank: true,
      categoryId: '33333333-3333-4333-8333-333333333333',
    } as Parameters<typeof addFuelLog>[0]);
    expect(queued.pending).toBe(true);
    expect(queued.totalAmount).toBe(2000);

    setOnline(true);
    await syncNow('user-a');
    expect(srv.fuel.size).toBe(1);
    expect(srv.fuel.has(queued.id)).toBe(true);
    expect(srv.rpcCalls.filter((c) => c.name === 'add_fuel_log')).toHaveLength(1);
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });
});

describe('server refusals and recovery', () => {
  it('a server rejection is kept as failed with the reason, is not retried, and can be discarded', async () => {
    setOnline(false);
    await createExpense(EXPENSE);
    setOnline(true);
    srv.rejectNext = true;

    await syncNow('user-a');
    const failed = await failedItems('user-a');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.lastError).toMatch(/^That vehicle was not found\./);

    const callsAfterFailure = srv.rpcCalls.length;
    await syncNow('user-a');
    expect(srv.rpcCalls.length).toBe(callsAfterFailure); // not retried

    expect(await discardFailed('user-a')).toBe(1);
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });

  it('a server rejection on the online path is thrown, not queued', async () => {
    srv.rejectNext = true;
    await expect(createExpense(EXPENSE)).rejects.toThrow('That vehicle was not found.');
    expect(await outboxCounts('user-a')).toEqual({ pending: 0, failed: 0 });
  });

  it('with no sign-in, a network failure cannot be queued and says so', async () => {
    srv.uid = null;
    setOnline(false);
    await expect(createExpense(EXPENSE)).rejects.toThrow('Sign in again to save this.');
  });
});

describe('when the app replays (FR-PWA-05)', () => {
  it('replays when the phone comes back online', async () => {
    setOnline(false);
    await createExpense(EXPENSE);
    setOnline(true);
    const stop = startSync('user-a');
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(srv.expenses.size).toBe(1));
    stop();
  });
});
