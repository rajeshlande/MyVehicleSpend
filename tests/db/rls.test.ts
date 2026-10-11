// @vitest-environment node
// T3 — RLS policies, RPC/trigger functions and views.
// Covers STC TC-SEC-01..04, TC-FUEL-04, and the add_fuel_log contract.
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let aliceVehicle: string;
let bobVehicle: string;
let petrolCategory: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@test.local');
  bob = await createUser(db, 'bob@test.local');
  const av = await db.query<{ id: string }>(
    `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
     values ($1,'car','MH00TEST0001','petrol') returning id`, [alice]);
  const bv = await db.query<{ id: string }>(
    `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
     values ($1,'bike','MH00TEST0002','petrol') returning id`, [bob]);
  aliceVehicle = av.rows[0]!.id;
  bobVehicle = bv.rows[0]!.id;
  await db.query(
    `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
     values ($1,'car','MH00TEST0003','petrol')`, [alice]);
  petrolCategory = (await db.query<{ id: string }>(
    `select id from public.expense_categories where name='Petrol' and user_id is null`)).rows[0]!.id;
});

describe('TC-SEC — row level security', () => {
  it('TC-SEC-01: a user cannot read another user\'s vehicles', async () => {
    const rows = await asUser(db, alice, async () =>
      (await db.query<{ id: string }>(`select id from public.vehicles where user_id = $1`, [bob])).rows);
    expect(rows).toEqual([]);
  });

  it('TC-SEC-01b: a user sees only their own vehicles when listing all', async () => {
    const rows = await asUser(db, alice, async () =>
      (await db.query<{ id: string }>(`select id from public.vehicles`)).rows);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(aliceVehicle);
    expect(ids).not.toContain(bobVehicle);
  });

  it('TC-SEC-02: a user cannot insert an expense owned by another user', async () => {
    await expect(asUser(db, alice, () =>
      db.query(
        `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount)
         values ($1,$2,$3,'2026-10-01',100)`,
        [bob, bobVehicle, petrolCategory])),
    ).rejects.toThrow();
  });

  it('TC-SEC-03: an expense cannot be attached to another user\'s vehicle (composite FK)', async () => {
    await expect(asUser(db, alice, () =>
      db.query(
        `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount)
         values ($1,$2,$3,'2026-10-01',100)`,
        [alice, bobVehicle, petrolCategory])),
    ).rejects.toThrow(/foreign key|expenses_vehicle_fk/);
  });

  it('TC-SEC-04: anonymous requests have no table access', async () => {
    await expect(asUser(db, null, () =>
      db.query(`select * from public.expenses`))).rejects.toThrow(/permission denied/);
  });

  it('owner can insert, and user_id defaults to auth.uid()', async () => {
    const row = await asUser(db, alice, async () =>
      (await db.query<{ user_id: string }>(
        `insert into public.expenses (vehicle_id, category_id, expense_date, amount)
         values ($1,$2,'2026-10-02',250) returning user_id`,
        [aliceVehicle, petrolCategory])).rows[0]!);
    expect(row.user_id).toBe(alice);
  });

  it('a user cannot update or delete another user\'s rows (no rows affected)', async () => {
    const res = await asUser(db, alice, async () => {
      const u = await db.query(`update public.vehicles set make='X' where id=$1`, [bobVehicle]);
      const d = await db.query(`delete from public.vehicles where id=$1`, [bobVehicle]);
      return { u: u.affectedRows, d: d.affectedRows };
    });
    expect(res).toEqual({ u: 0, d: 0 });
  });
});

describe('TC-FUEL-04 — odometer must not decrease (RULE-03)', () => {
  it('rejects a fuel log with odometer lower than the last reading', async () => {
    await asUser(db, alice, () => db.query(
      `insert into public.fuel_logs (vehicle_id, filled_on, odometer_km, litres, price_per_unit, total_amount)
       values ($1,'2026-10-01',48500,30,102.40,3072.00)`, [aliceVehicle]));
    await expect(asUser(db, alice, () => db.query(
      `insert into public.fuel_logs (vehicle_id, filled_on, odometer_km, litres, price_per_unit, total_amount)
       values ($1,'2026-10-05',48100,10,102.40,1024.00)`, [aliceVehicle]),
    )).rejects.toThrow(/lower than the last recorded reading/);
  });
});

describe('add_fuel_log RPC', () => {
  // Separate vehicle so the odometer history above does not interfere.
  let rpcVehicle: string;
  beforeAll(async () => {
    rpcVehicle = (await db.query<{ id: string }>(
      `select id from public.vehicles where registration_no='MH00TEST0003'`)).rows[0]!.id;
  });

  it('creates a fuel log and its linked expense atomically with the computed total', async () => {
    const id = crypto.randomUUID();
    const row = await asUser(db, alice, async () =>
      (await db.query<{ total_amount: string; expense_id: string }>(
        `select * from public.add_fuel_log($1,$2,'2026-10-11',48210,32.5,102.40,true,'HP Pump, Pune','upi',$3)`,
        [id, rpcVehicle, petrolCategory])).rows[0]!);
    expect(Number(row.total_amount)).toBe(3328.0); // 32.50 × 102.40
    const exp = await db.query<{ amount: string; source: string }>(
      `select amount, source from public.expenses where id=$1`, [row.expense_id]);
    expect(Number(exp.rows[0]!.amount)).toBe(3328.0);
    expect(exp.rows[0]!.source).toBe('fuel');
  });

  it('is idempotent: a retry with the same client id creates nothing new', async () => {
    const id = crypto.randomUUID();
    const call = () => asUser(db, alice, () => db.query(
      `select * from public.add_fuel_log($1,$2,'2026-10-12',48300,20,100,true,null,'cash',$3)`,
      [id, rpcVehicle, petrolCategory]));
    await call();
    await call();
    const fuel = await db.query<{ n: string }>(`select count(*)::text n from public.fuel_logs where id=$1`, [id]);
    const exp = await db.query<{ n: string }>(
      `select count(*)::text n from public.expenses where source='fuel' and odometer_km=48300 and vehicle_id=$1`, [rpcVehicle]);
    expect(Number(fuel.rows[0]!.n)).toBe(1);
    expect(Number(exp.rows[0]!.n)).toBe(1);
  });
});

describe('views respect RLS (security_invoker)', () => {
  it('v_fuel_efficiency shows only the caller\'s rows', async () => {
    // Full-tank fills only: 500 km on 25 L = 20.00 km/l (the view uses the latest fill's litres).
    await db.exec(`
      insert into public.fuel_logs (user_id, vehicle_id, filled_on, odometer_km, litres, price_per_unit, total_amount, is_full_tank)
      values (${`'${bob}'`}, '${bobVehicle}', '2026-09-01', 1000, 30, 100, 3000, true),
             (${`'${bob}'`}, '${bobVehicle}', '2026-09-20', 1500, 25, 100, 2500, true);`);
    const bobRows = await asUser(db, bob, async () =>
      (await db.query<{ kmpl: string }>(`select kmpl from public.v_fuel_efficiency`)).rows);
    expect(bobRows.map((r) => Number(r.kmpl))).toEqual([20]);
    const aliceRows = await asUser(db, alice, async () =>
      (await db.query(`select * from public.v_fuel_efficiency where vehicle_id=$1`, [bobVehicle])).rows);
    expect(aliceRows).toEqual([]);
  });

  it('v_monthly_spend totals match a direct sum of the caller\'s expenses', async () => {
    const viewSum = await asUser(db, alice, async () =>
      (await db.query<{ s: string }>(
        `select coalesce(sum(total_amount),0)::text s from public.v_monthly_spend
         where category='Petrol' and month='2026-10-01'`)).rows[0]!.s);
    const direct = await db.query<{ s: string }>(
      `select coalesce(sum(amount),0)::text s from public.expenses
       where user_id=$1 and category_id=$2 and expense_date >= '2026-10-01' and expense_date < '2026-11-01'
         and deleted_at is null`, [alice, petrolCategory]);
    expect(Number(viewSum)).toBe(Number(direct.rows[0]!.s));
    expect(Number(viewSum)).toBeGreaterThan(0);
  });
});
