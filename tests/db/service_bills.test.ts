// @vitest-environment node
// Service bills (Invoice module, vehicle scope): create_service_bill RPC, RLS and totals.
// Real Postgres (PGlite). Migration 0015.
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let bobCar: string;

type Item = { description: string; quantity: number; unit_price: number };

function items(...rows: Item[]): string {
  return JSON.stringify(rows);
}

const createBill = (
  uid: string,
  over: Partial<{
    id: string;
    vehicle: string;
    billNo: string;
    issue: string;
    due: string | null;
    tax: number;
    items: string;
  }> = {}
) =>
  asUser(db, uid, () =>
    db.query<{ id: string; subtotal: string; tax: string; total: string; status: string }>(
      `select * from public.create_service_bill($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        over.id ?? crypto.randomUUID(),
        over.vehicle ?? car,
        over.billNo ?? 'SB-001',
        'Sharma Motors',
        over.issue ?? '2026-10-01',
        over.due === undefined ? '2026-10-15' : over.due,
        over.tax ?? 0,
        null,
        over.items ??
          items(
            { description: 'Engine oil', quantity: 1, unit_price: 1200 },
            { description: 'Oil filter', quantity: 2, unit_price: 150.5 }
          ),
      ]
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@b.local');
  bob = await createUser(db, 'bob@b.local');
  car = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00BILL0001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
  bobCar = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00BILL0002','petrol') returning id`,
      [bob]
    )
  ).rows[0]!.id;
});

describe('create_service_bill (Invoice module, vehicle scope)', () => {
  it('computes line amounts, subtotal and total on the server', async () => {
    const id = crypto.randomUUID();
    const [bill] = (await createBill(alice, { id, tax: 0 })).rows;
    // 1 × 1200 + 2 × 150.50 = 1501.00; tax 0.
    expect(Number(bill?.subtotal)).toBe(1501);
    expect(Number(bill?.total)).toBe(1501);
    expect(bill?.status).toBe('unpaid');
    const lines = await db.query<{ amount: string }>(
      `select amount from public.service_bill_items where bill_id = $1 order by amount`,
      [id]
    );
    expect(lines.rows.map((r) => Number(r.amount))).toEqual([301, 1200]);
  });

  it('adds tax to the total', async () => {
    const [bill] = (await createBill(alice, { billNo: 'SB-TAX', tax: 270.18 })).rows;
    expect(Number(bill?.total)).toBe(1771.18);
  });

  it('is idempotent: a retry with the same id creates nothing new', async () => {
    const id = crypto.randomUUID();
    await createBill(alice, { id, billNo: 'SB-RETRY' });
    await createBill(alice, { id, billNo: 'SB-RETRY' });
    const n = await db.query<{ bills: string; lines: string }>(
      `select (select count(*) from public.service_bills where id = $1) bills,
              (select count(*) from public.service_bill_items where bill_id = $1) lines`,
      [id]
    );
    expect(Number(n.rows[0]!.bills)).toBe(1);
    expect(Number(n.rows[0]!.lines)).toBe(2);
  });

  it('rejects a bill with no items', async () => {
    await expect(createBill(alice, { billNo: 'SB-EMPTY', items: '[]' })).rejects.toThrow(
      /at least one item/i
    );
  });

  it('rejects a line with zero or negative quantity or a negative price', async () => {
    await expect(
      createBill(alice, {
        billNo: 'SB-QTY',
        items: items({ description: 'x', quantity: 0, unit_price: 10 }),
      })
    ).rejects.toThrow();
    await expect(
      createBill(alice, {
        billNo: 'SB-PRICE',
        items: items({ description: 'x', quantity: 1, unit_price: -5 }),
      })
    ).rejects.toThrow();
  });

  it('rejects a due date before the issue date', async () => {
    await expect(
      createBill(alice, { billNo: 'SB-DATES', issue: '2026-10-10', due: '2026-10-01' })
    ).rejects.toThrow(/due date/i);
  });

  it('rejects a negative tax', async () => {
    await expect(createBill(alice, { billNo: 'SB-NEGTAX', tax: -1 })).rejects.toThrow();
  });

  it('keeps bill numbers unique per owner', async () => {
    await expect(createBill(alice, { billNo: 'SB-001' })).rejects.toThrow(/duplicate|unique/i);
  });

  it("cannot attach a bill to another owner's vehicle", async () => {
    await expect(createBill(alice, { billNo: 'SB-XCAR', vehicle: bobCar })).rejects.toThrow();
  });
});

describe('service bills row-level security', () => {
  it('another user cannot read a bill', async () => {
    const id = crypto.randomUUID();
    await createBill(alice, { id, billNo: 'SB-PRIVATE' });
    const seen = await asUser(db, bob, () =>
      db.query(`select id from public.service_bills where id = $1`, [id])
    );
    expect(seen.rows).toHaveLength(0);
  });

  it("another user cannot mark someone else's bill paid", async () => {
    const id = crypto.randomUUID();
    await createBill(alice, { id, billNo: 'SB-PAYME' });
    await asUser(db, bob, () =>
      db.query(`update public.service_bills set status = 'paid' where id = $1`, [id])
    );
    const row = await db.query<{ status: string }>(
      `select status from public.service_bills where id = $1`,
      [id]
    );
    expect(row.rows[0]?.status).toBe('unpaid');
  });

  it('the owner can mark a bill paid', async () => {
    const id = crypto.randomUUID();
    await createBill(alice, { id, billNo: 'SB-OWNPAY' });
    await asUser(db, alice, () =>
      db.query(`update public.service_bills set status = 'paid' where id = $1`, [id])
    );
    const row = await db.query<{ status: string }>(
      `select status from public.service_bills where id = $1`,
      [id]
    );
    expect(row.rows[0]?.status).toBe('paid');
  });
});
