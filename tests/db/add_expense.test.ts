// @vitest-environment node
// T29c — add_expense RPC: idempotent by client id, so a retried offline save creates one row (TC-PWA-05 at DB level).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let bobCar: string;
let petrol: string;

const ID = '20000000-0000-4000-8000-000000000001';

const call = (uid: string | null, args: unknown[]) =>
  asUser(db, uid, () =>
    db.query<{ id: string; user_id: string; amount: string; vendor: string | null }>(
      `select * from public.add_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      args
    )
  );

const count = async (id: string) =>
  (
    await db.query<{ n: number }>(`select count(*)::int as n from public.expenses where id=$1`, [
      id,
    ])
  ).rows[0]!.n;

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@e.local');
  bob = await createUser(db, 'bob@e.local');
  const ins = async (uid: string, reg: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
         values ($1,'car',$2,'petrol') returning id`,
        [uid, reg]
      )
    ).rows[0]!.id;
  car = await ins(alice, 'MH00EXP0001');
  bobCar = await ins(bob, 'MH00EXP0009');
  petrol = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where name='Petrol' and user_id is null`
    )
  ).rows[0]!.id;
});

const args = (id: string, amount: number, vendor: string | null = 'Pump A') => [
  id,
  car,
  petrol,
  '2026-10-02',
  amount,
  0,
  'upi',
  vendor,
  50100,
  null,
];

describe('add_expense — create (TC-PWA-05 at DB level)', () => {
  it('creates the expense for the caller with the client id', async () => {
    const r = await call(alice, args(ID, 1250.5));
    expect(r.rows[0]).toMatchObject({
      id: ID,
      user_id: alice,
      amount: '1250.50',
      vendor: 'Pump A',
    });
    expect(await count(ID)).toBe(1);
  });

  it('a retry with the same id returns the existing row and creates nothing (lost response)', async () => {
    // The first save committed, but the response never reached the phone, so the outbox replays it.
    const again = await call(alice, args(ID, 9999, 'Different'));
    expect(again.rows[0]).toMatchObject({ id: ID, amount: '1250.50', vendor: 'Pump A' });
    expect(await count(ID)).toBe(1);
  });

  it('refuses another user’s id and leaves their row unchanged', async () => {
    await expect(call(bob, args(ID, 1))).rejects.toThrow(/permission/i);
    const row = (
      await db.query<{ amount: string; user_id: string }>(
        `select amount, user_id from public.expenses where id=$1`,
        [ID]
      )
    ).rows[0]!;
    expect(row).toMatchObject({ amount: '1250.50', user_id: alice });
  });

  it('refuses a vehicle that is not the caller’s', async () => {
    await expect(
      asUser(db, alice, () =>
        db.query(`select * from public.add_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
          '20000000-0000-4000-8000-000000000002',
          bobCar,
          petrol,
          '2026-10-02',
          100,
          0,
          'cash',
          null,
          null,
          null,
        ])
      )
    ).rejects.toThrow();
  });

  it('keeps the amount rule: zero is refused', async () => {
    await expect(call(alice, args('20000000-0000-4000-8000-000000000003', 0))).rejects.toThrow(
      /expenses_amount_check|check constraint/
    );
  });

  it('refuses a call with no sign-in', async () => {
    await expect(call(null, args('20000000-0000-4000-8000-000000000004', 100))).rejects.toThrow();
    expect(await count('20000000-0000-4000-8000-000000000004')).toBe(0);
  });
});
