// @vitest-environment node
// T9b — restore_vehicle RPC: brings back a soft-deleted vehicle and the rows removed with it (N-7).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let carId: string;
let bobCarId: string;
let petrol: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@r.local');
  bob = await createUser(db, 'bob@r.local');
  carId = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00REST0001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
  bobCarId = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00REST0009','petrol') returning id`,
      [bob]
    )
  ).rows[0]!.id;
  petrol = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where name='Petrol' and user_id is null`
    )
  ).rows[0]!.id;
  await db.query(
    `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount)
     values ($1,$2,$3,'2026-10-01',500)`,
    [alice, carId, petrol]
  );
  // An expense deleted on its own, before the vehicle was deleted: must stay deleted on restore.
  await db.query(
    `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount, deleted_at)
     values ($1,$2,$3,'2026-09-01',300, now() - interval '1 day')`,
    [alice, carId, petrol]
  );
  await asUser(db, alice, () => db.query(`select public.delete_vehicle($1)`, [carId]));
});

describe('T9b — restore_vehicle', () => {
  it('lists the deleted vehicle for its owner only (RLS)', async () => {
    const mine = await asUser(db, alice, () =>
      db.query<{ id: string }>(`select id from public.vehicles where deleted_at is not null`)
    );
    expect(mine.rows.map((r) => r.id)).toEqual([carId]);
    const theirs = await asUser(db, bob, () =>
      db.query<{ id: string }>(`select id from public.vehicles where deleted_at is not null`)
    );
    expect(theirs.rows).toHaveLength(0);
  });

  it('restores the vehicle and the expense deleted with it, not earlier single deletes', async () => {
    await asUser(db, alice, () => db.query(`select public.restore_vehicle($1)`, [carId]));

    const veh = await db.query<{ deleted_at: Date | null }>(
      `select deleted_at from public.vehicles where id=$1`,
      [carId]
    );
    expect(veh.rows[0]!.deleted_at).toBeNull();

    const live = await db.query<{ amount: string }>(
      `select amount from public.expenses where vehicle_id=$1 and deleted_at is null`,
      [carId]
    );
    expect(live.rows.map((r) => Number(r.amount))).toEqual([500]);
  });

  it('rejects restoring a vehicle that is not deleted', async () => {
    await expect(
      asUser(db, alice, () => db.query(`select public.restore_vehicle($1)`, [carId]))
    ).rejects.toThrow(/not found|not deleted/i);
  });

  it("cannot restore another user's vehicle", async () => {
    await asUser(db, bob, () => db.query(`select public.delete_vehicle($1)`, [bobCarId]));
    await expect(
      asUser(db, alice, () => db.query(`select public.restore_vehicle($1)`, [bobCarId]))
    ).rejects.toThrow(/not found/i);
  });

  it('blocks re-adding a deleted registration number as a new vehicle (the case the UI turns into Restore)', async () => {
    await asUser(db, alice, () => db.query(`select public.delete_vehicle($1)`, [carId]));
    await expect(
      db.query(
        `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
         values ($1,'bike','MH00REST0001','petrol')`,
        [alice]
      )
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('restores the original vehicle after that attempt', async () => {
    await asUser(db, alice, () => db.query(`select public.restore_vehicle($1)`, [carId]));
    const veh = await db.query<{ deleted_at: Date | null }>(
      `select deleted_at from public.vehicles where id=$1`,
      [carId]
    );
    expect(veh.rows[0]!.deleted_at).toBeNull();
  });
});
