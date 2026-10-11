// @vitest-environment node
// T9 (DB part) — delete_vehicle RPC: soft-deletes the vehicle and its linked rows (TC-VEH-06).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let carId: string;
let bikeId: string;
let bobCarId: string;
let petrol: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@v.local');
  bob = await createUser(db, 'bob@v.local');
  const ins = async (uid: string, reg: string, type: string) =>
    (await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,$2,$3,'petrol') returning id`, [uid, type, reg])).rows[0]!.id;
  carId = await ins(alice, 'MH00TEST0001', 'car');
  bikeId = await ins(alice, 'MH00TEST0002', 'bike');
  bobCarId = await ins(bob, 'MH00TEST0009', 'car');
  petrol = (await db.query<{ id: string }>(
    `select id from public.expense_categories where name='Petrol' and user_id is null`)).rows[0]!.id;
  // Linked data on Alice's car: an expense, a fuel log and a reminder.
  await db.query(`insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount)
                  values ($1,$2,$3,'2026-10-01',500)`, [alice, carId, petrol]);
  await db.query(`insert into public.fuel_logs (user_id, vehicle_id, filled_on, odometer_km, litres, price_per_unit, total_amount)
                  values ($1,$2,'2026-10-01',1000,20,100,2000)`, [alice, carId]);
  await db.query(`insert into public.reminders (user_id, vehicle_id, reminder_type, title, due_date)
                  values ($1,$2,'puc','PUC','2026-12-01')`, [alice, carId]);
});

describe('TC-VEH-06 — delete_vehicle', () => {
  it('soft-deletes the vehicle and all linked rows, and leaves other vehicles alone', async () => {
    await asUser(db, alice, () => db.query(`select public.delete_vehicle($1)`, [carId]));

    const veh = await db.query<{ deleted_at: Date | null }>(`select deleted_at from public.vehicles where id=$1`, [carId]);
    expect(veh.rows[0]!.deleted_at).not.toBeNull();

    for (const table of ['expenses', 'fuel_logs', 'reminders']) {
      const r = await db.query<{ n: string }>(
        `select count(*)::text n from public.${table} where vehicle_id=$1 and deleted_at is null`, [carId]);
      expect(Number(r.rows[0]!.n), table).toBe(0);
    }

    const bike = await db.query<{ deleted_at: Date | null }>(`select deleted_at from public.vehicles where id=$1`, [bikeId]);
    expect(bike.rows[0]!.deleted_at).toBeNull();
  });

  it('cannot delete another user\'s vehicle', async () => {
    await expect(asUser(db, alice, () =>
      db.query(`select public.delete_vehicle($1)`, [bobCarId]))).rejects.toThrow(/vehicle not found/);
    const bob1 = await db.query<{ deleted_at: Date | null }>(`select deleted_at from public.vehicles where id=$1`, [bobCarId]);
    expect(bob1.rows[0]!.deleted_at).toBeNull();
  });

  it('a deleted vehicle cannot be deleted again', async () => {
    await expect(asUser(db, alice, () =>
      db.query(`select public.delete_vehicle($1)`, [carId]))).rejects.toThrow(/vehicle not found/);
  });

  it('a registration number of a deleted vehicle cannot be re-added (unique row kept by soft delete)', async () => {
    // Re-adding the same registration after deletion must still be blocked by the unique
    // constraint (soft delete keeps the row). The UI tells the user to restore instead.
    await expect(db.query(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00TEST0001','petrol')`, [alice])).rejects.toThrow(/vehicles_user_reg_unique/);
  });
});
