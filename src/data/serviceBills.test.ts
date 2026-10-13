// Invoice module (service bills) data layer, with a stubbed Supabase client. Migration 0015.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: { data: null as unknown, error: null as null | { message: string; code?: string } },
  selectResult: { data: [] as unknown[], error: null as null | { message: string } },
  updates: [] as { table: string; values: Record<string, unknown>; eq: [string, unknown][] }[],
}));

vi.mock('./supabase', () => {
  const query = (table: string) => {
    const q: Record<string, unknown> = {};
    const eqs: [string, unknown][] = [];
    for (const m of ['select', 'order']) q[m] = () => q;
    q.eq = (col: string, val: unknown) => {
      eqs.push([col, val]);
      return q;
    };
    q.update = (values: Record<string, unknown>) => {
      const u = { table, values, eq: eqs };
      stub.updates.push(u);
      const chain: Record<string, unknown> = {};
      chain.eq = (col: string, val: unknown) => {
        u.eq.push([col, val]);
        return Promise.resolve({ error: null });
      };
      return chain;
    };
    q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(stub.selectResult).then(resolve, reject);
    return q;
  };
  return {
    getSupabase: () => ({
      from: (table: string) => query(table),
      rpc: async (name: string, args: Record<string, unknown>) => {
        stub.rpcCalls.push({ name, args });
        return stub.rpcResult;
      },
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-a' } } } }) },
    }),
  };
});

import { createServiceBill, listServiceBills, markServiceBillPaid } from './serviceBills';

const VEHICLE = '6f1c3a52-1b7e-4d2a-9c3e-0a1b2c3d4e5f';

beforeEach(() => {
  stub.rpcCalls.length = 0;
  stub.updates.length = 0;
  stub.rpcResult = { data: { id: 'b1' }, error: null };
  stub.selectResult = { data: [], error: null };
});

describe('createServiceBill', () => {
  it('sends the bill and its lines to create_service_bill with snake_case fields', async () => {
    await createServiceBill({
      vehicleId: VEHICLE,
      billNo: 'SB-101',
      vendor: 'Sharma Motors',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      tax: 0,
      notes: 'Under warranty',
      items: [{ description: 'Engine oil', quantity: 2, unitPrice: 150.5 }],
    });
    expect(stub.rpcCalls).toHaveLength(1);
    const call = stub.rpcCalls[0]!;
    expect(call.name).toBe('create_service_bill');
    expect(call.args).toMatchObject({
      p_vehicle_id: VEHICLE,
      p_bill_no: 'SB-101',
      p_vendor: 'Sharma Motors',
      p_issue_date: '2026-10-01',
      p_due_date: '2026-10-15',
      p_tax: 0,
      p_notes: 'Under warranty',
      p_items: [{ description: 'Engine oil', quantity: 2, unit_price: 150.5 }],
    });
    expect(String(call.args.p_id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends a null due date when there is none', async () => {
    await createServiceBill({
      vehicleId: VEHICLE,
      billNo: 'SB-102',
      vendor: 'X',
      issueDate: '2026-10-01',
      dueDate: null,
      tax: 0,
      items: [{ description: 'Wash', quantity: 1, unitPrice: 300 }],
    });
    expect(stub.rpcCalls[0]?.args.p_due_date).toBeNull();
  });

  it('passes the database message through when the bill is rejected', async () => {
    stub.rpcResult = { data: null, error: { message: 'A bill needs at least one item.' } };
    await expect(
      createServiceBill({
        vehicleId: VEHICLE,
        billNo: 'SB-103',
        vendor: 'X',
        issueDate: '2026-10-01',
        dueDate: null,
        tax: 0,
        items: [{ description: 'x', quantity: 1, unitPrice: 1 }],
      })
    ).rejects.toThrow();
  });
});

describe('listServiceBills', () => {
  it('maps stored rows, with their lines, to the UI shape', async () => {
    stub.selectResult = {
      data: [
        {
          id: 'b1',
          vehicle_id: VEHICLE,
          bill_no: 'SB-101',
          vendor: 'Sharma Motors',
          issue_date: '2026-10-01',
          due_date: '2026-10-15',
          status: 'unpaid',
          subtotal: 1501,
          tax: 0,
          total: 1501,
          notes: null,
          service_bill_items: [
            { id: 'i1', description: 'Engine oil', quantity: 1, unit_price: 1200, amount: 1200 },
            { id: 'i2', description: 'Oil filter', quantity: 2, unit_price: 150.5, amount: 301 },
          ],
        },
      ],
      error: null,
    };
    const [bill] = await listServiceBills(VEHICLE);
    expect(bill).toMatchObject({
      id: 'b1',
      billNo: 'SB-101',
      vendor: 'Sharma Motors',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      status: 'unpaid',
      total: 1501,
    });
    expect(bill?.lines.map((l) => [l.description, l.amount])).toEqual([
      ['Engine oil', 1200],
      ['Oil filter', 301],
    ]);
  });
});

describe('markServiceBillPaid', () => {
  it('updates the status of that bill only', async () => {
    await markServiceBillPaid('b1');
    expect(stub.updates).toEqual([
      { table: 'service_bills', values: { status: 'paid' }, eq: [['id', 'b1']] },
    ]);
  });
});
