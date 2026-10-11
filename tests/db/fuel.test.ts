// @vitest-environment node
// T16a — add_fuel_log RPC: atomic fuel row + linked expense, idempotent, litres or kWh (FR-FUEL-01, FR-FUEL-04, FR-FUEL-05).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let ev: string;
let bobCar: string;
let petrol: string;
let evCharging: string;

const call = (uid: string, args: unknown[]) =>
  asUser(db, uid, () =>
    db.query<{
      id: string;
      expense_id: string;
      total_amount: string;
      litres: string | null;
      energy_kwh: string | null;
    }>(`select * from public.add_fuel_log($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, args)
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@f.local');
  bob = await createUser(db, 'bob@f.local');
  const ins = async (uid: string, reg: string, type: string, fuel: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
         values ($1,$2,$3,$4) returning id`,
        [uid, type, reg, fuel]
      )
    ).rows[0]!.id;
  car = await ins(alice, 'MH00FUEL0001', 'car', 'petrol');
  ev = await ins(alice, 'MH00FUEL0002', 'car', 'ev');
  bobCar = await ins(bob, 'MH00FUEL0009', 'car', 'petrol');
  const cat = async (name: string) =>
    (
      await db.query<{ id: string }>(
        `select id from public.expense_categories where name=$1 and user_id is null`,
        [name]
      )
    ).rows[0]!.id;
  petrol = await cat('Petrol');
  evCharging = await cat('EV charging (public)');
});

describe('add_fuel_log — petrol (TC-FUEL-01)', () => {
  it('creates the fuel row and the linked expense in one call', async () => {
    const id = '10000000-0000-4000-8000-000000000001';
    const r = await call(alice, [
      id,
      car,
      '2026-10-01',
      48000,
      30,
      100.5,
      true,
      'HP Pump',
      'upi',
      petrol,
      null,
    ]);
    expect(r.rows[0]!.id).toBe(id);
    expect(Number(r.rows[0]!.total_amount)).toBe(3015);

    const exp = await db.query<{ amount: string; source: string; vehicle_id: string }>(
      `select amount, source, vehicle_id from public.expenses where id=$1`,
      [r.rows[0]!.expense_id]
    );
    expect(Number(exp.rows[0]!.amount)).toBe(3015);
    expect(exp.rows[0]!.source).toBe('fuel');
    expect(exp.rows[0]!.vehicle_id).toBe(car);
  });

  it('is idempotent: a retry with the same id creates nothing new (TC-PWA-05)', async () => {
    const id = '10000000-0000-4000-8000-000000000002';
    const args = [id, car, '2026-10-02', 48100, 20, 100, true, null, 'cash', petrol, null];
    await call(alice, args);
    const before = await db.query<{ n: string }>(
      `select count(*)::text n from public.expenses where vehicle_id=$1`,
      [car]
    );
    await call(alice, args);
    const after = await db.query<{ n: string }>(
      `select count(*)::text n from public.expenses where vehicle_id=$1`,
      [car]
    );
    const rows = await db.query<{ n: string }>(
      `select count(*)::text n from public.fuel_logs where id=$1`,
      [id]
    );
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    expect(rows.rows[0]!.n).toBe('1');
  });

  it('rejects a lower odometer and leaves no expense behind (RULE-03, TC-FUEL-04)', async () => {
    const before = await db.query<{ n: string }>(
      `select count(*)::text n from public.expenses where vehicle_id=$1`,
      [car]
    );
    await expect(
      call(alice, [
        '10000000-0000-4000-8000-000000000003',
        car,
        '2026-10-03',
        47000,
        10,
        100,
        true,
        null,
        'cash',
        petrol,
        null,
      ])
    ).rejects.toThrow(/lower than the last recorded reading/i);
    const after = await db.query<{ n: string }>(
      `select count(*)::text n from public.expenses where vehicle_id=$1`,
      [car]
    );
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it("cannot log a fill on another user's vehicle", async () => {
    await expect(
      call(alice, [
        '10000000-0000-4000-8000-000000000004',
        bobCar,
        '2026-10-04',
        900,
        10,
        100,
        true,
        null,
        'cash',
        petrol,
        null,
      ])
    ).rejects.toThrow();
  });
});

describe('add_fuel_log — EV (FR-FUEL-05)', () => {
  it('stores kWh and no litres; total = kWh × price per kWh', async () => {
    const r = await call(alice, [
      '20000000-0000-4000-8000-000000000001',
      ev,
      '2026-10-05',
      5000,
      null,
      8.5,
      true,
      'Tata Power',
      'upi',
      evCharging,
      12,
    ]);
    expect(r.rows[0]!.litres).toBeNull();
    expect(Number(r.rows[0]!.energy_kwh)).toBe(12);
    expect(Number(r.rows[0]!.total_amount)).toBe(102);
  });

  it('rejects a fill with both litres and kWh', async () => {
    await expect(
      call(alice, [
        '20000000-0000-4000-8000-000000000002',
        ev,
        '2026-10-06',
        5100,
        5,
        8,
        true,
        null,
        'upi',
        evCharging,
        5,
      ])
    ).rejects.toThrow(/exactly one of litres or kWh/i);
  });

  it('rejects a fill with neither litres nor kWh', async () => {
    await expect(
      call(alice, [
        '20000000-0000-4000-8000-000000000003',
        ev,
        '2026-10-06',
        5100,
        null,
        8,
        true,
        null,
        'upi',
        evCharging,
        null,
      ])
    ).rejects.toThrow(/exactly one of litres or kWh/i);
  });
});
