// @vitest-environment node
// T26 — restore_backup RPC (FR-DATA-02; TC-DATA-02). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let carol: string;
let backup: Record<string, unknown>;
let aliceCar: string;
let aliceLoan: string;

const TABLES = {
  expenseCategories: 'expense_categories',
  vehicles: 'vehicles',
  expenses: 'expenses',
  fuelLogs: 'fuel_logs',
  loans: 'loans',
  loanPayments: 'loan_payments',
  loanEvents: 'loan_events',
  reminders: 'reminders',
} as const;

/** Count rows visible to a user, per table (RLS applies). */
async function counts(uid: string): Promise<Record<string, number>> {
  return asUser(db, uid, async () => {
    const out: Record<string, number> = {};
    for (const [key, table] of Object.entries(TABLES)) {
      if (key === 'expenseCategories') {
        out[key] = (
          await db.query<{ n: number }>(
            `select count(*)::int n from public.expense_categories where user_id is not null`
          )
        ).rows[0]!.n;
      } else {
        out[key] = (
          await db.query<{ n: number }>(`select count(*)::int n from public.${table}`)
        ).rows[0]!.n;
      }
    }
    return out;
  });
}

const EXPECTED = {
  expenseCategories: 1,
  vehicles: 1,
  expenses: 2,
  fuelLogs: 1,
  loans: 1,
  loanPayments: 2,
  loanEvents: 1,
  reminders: 1,
};
const ZERO = Object.fromEntries(Object.keys(EXPECTED).map((k) => [k, 0]));

const restore = (uid: string | null, payload: unknown) =>
  asUser(db, uid, () =>
    db.query<{ restore_backup: Record<string, number> }>(
      `select public.restore_backup($1::jsonb)`,
      [JSON.stringify(payload)]
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@b.local');
  bob = await createUser(db, 'bob@b.local');
  carol = await createUser(db, 'carol@b.local');

  // Alice's full data set: a custom category, a car, an expense, a fuel fill linked to it, a loan with payments and an event, a reminder.
  const sysCat = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where user_id is null limit 1`
    )
  ).rows[0]!.id;
  await asUser(db, alice, async () => {
    const custom = await db.query<{ id: string }>(
      `insert into public.expense_categories (user_id, group_name, name) values ($1,'My group','Parking') returning id`,
      [alice]
    );
    aliceCar = (
      await db.query<{ id: string }>(
        `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type, start_odometer_km)
         values ($1,'car','MH00BAK00001','petrol',48000) returning id`,
        [alice]
      )
    ).rows[0]!.id;
    const exp = await db.query<{ id: string }>(
      `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount, payment_mode, vendor, odometer_km)
       values ($1,$2,$3,'2026-06-02',1250.50,'upi','शर्मा पेट्रोल',48600) returning id`,
      [alice, aliceCar, sysCat]
    );
    await db.query(
      `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount, payment_mode)
       values ($1,$2,$3,'2026-06-05',80,'cash')`,
      [alice, aliceCar, custom.rows[0]!.id]
    );
    await db.query(
      `insert into public.fuel_logs (user_id, vehicle_id, expense_id, filled_on, odometer_km, litres, price_per_unit, total_amount)
       values ($1,$2,$3,'2026-06-02',48600,30,41.68,1250.50)`,
      [alice, aliceCar, exp.rows[0]!.id]
    );
    aliceLoan = (
      await db.query<{ id: string }>(
        `insert into public.loans (user_id, vehicle_id, lender, principal, annual_rate, tenure_months, start_date, emi_amount)
         values ($1,$2,'HDFC Bank',100000,10.5,12,'2026-01-05',8800) returning id`,
        [alice, aliceCar]
      )
    ).rows[0]!.id;
    await db.query(
      `insert into public.loan_payments (user_id, loan_id, installment_no, due_date, scheduled_emi, principal_component, interest_component, opening_balance, closing_balance, status)
       values ($1,$2,1,'2026-01-05',8800,8000,800,100000,92000,'paid'),($1,$2,2,'2026-02-05',8800,8100,700,92000,83900,'scheduled')`,
      [alice, aliceLoan]
    );
    await db.query(
      `insert into public.loan_events (user_id, loan_id, event_type, event_date, amount) values ($1,$2,'prepayment','2026-03-01',10000)`,
      [alice, aliceLoan]
    );
    await db.query(
      `insert into public.reminders (user_id, vehicle_id, reminder_type, title, due_date) values ($1,$2,'puc','PUC certificate','2026-11-30')`,
      [alice, aliceCar]
    );
  });

  // Build the backup the way the app does: each table's rows as JSON, for Alice only.
  backup = await asUser(db, alice, async () => {
    const rows = async (sql: string) => (await db.query<{ j: unknown }>(sql)).rows[0]!.j;
    return {
      format: 'my-vehicle-spend-backup',
      schemaVersion: 1,
      expenseCategories: await rows(
        `select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.expense_categories t where user_id is not null`
      ),
      vehicles: await rows(`select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.vehicles t`),
      expenses: await rows(`select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.expenses t`),
      fuelLogs: await rows(
        `select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.fuel_logs t`
      ),
      loans: await rows(`select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.loans t`),
      loanPayments: await rows(
        `select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.loan_payments t`
      ),
      loanEvents: await rows(
        `select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.loan_events t`
      ),
      reminders: await rows(
        `select coalesce(jsonb_agg(to_jsonb(t)),'[]') j from public.reminders t`
      ),
    };
  });
});

describe('restore into an empty account (TC-DATA-02)', () => {
  beforeAll(async () => {
    // The originals are removed first, as after an account deletion. IDs must not clash (see the collision test).
    await db.exec(`
      delete from public.reminders; delete from public.loan_events; delete from public.loan_payments;
      delete from public.loans; delete from public.fuel_logs; delete from public.expenses;
      delete from public.vehicles; delete from public.expense_categories where user_id is not null;`);
  });

  it('restores row counts and keeps every ID', async () => {
    const result = await restore(carol, backup);
    expect(result.rows[0]!.restore_backup).toEqual(EXPECTED);
    expect(await counts(carol)).toEqual(EXPECTED);

    const carCar = await asUser(db, carol, () =>
      db.query<{ id: string }>(
        `select id from public.vehicles where registration_no = 'MH00BAK00001'`
      )
    );
    expect(carCar.rows[0]!.id).toBe(aliceCar);
    const loan = await asUser(db, carol, () =>
      db.query<{ id: string }>(`select id from public.loans`)
    );
    expect(loan.rows[0]!.id).toBe(aliceLoan);
  });

  it('sets the restored rows to the signed-in user, not the file', async () => {
    const owners = await asUser(db, carol, () =>
      db.query<{ user_id: string }>(`select distinct user_id from public.expenses`)
    );
    expect(owners.rows.map((r) => r.user_id)).toEqual([carol]);
  });

  it('keeps Hindi text and exact amounts', async () => {
    const r = await asUser(db, carol, () =>
      db.query<{ vendor: string; amount: string }>(
        `select vendor, amount::text from public.expenses where expense_date = '2026-06-02'`
      )
    );
    expect(r.rows[0]).toEqual({ vendor: 'शर्मा पेट्रोल', amount: '1250.50' });
  });

  it('does not touch another user’s data', async () => {
    expect(await counts(bob)).toEqual(ZERO);
  });
});

describe('restore refusals', () => {
  it('refuses an account that already has data', async () => {
    const before = await counts(carol);
    await expect(restore(carol, backup)).rejects.toThrow(/empty account/);
    expect(await counts(carol)).toEqual(before);
  });

  it('refuses when a backup ID still exists elsewhere, and writes nothing', async () => {
    // Carol still holds the restored vehicle with the same ID, so a new account cannot take it.
    const clash = await createUser(db, 'frank@b.local');
    await expect(restore(clash, backup)).rejects.toThrow(/IDs in this backup already exist/);
    expect(await counts(clash)).toEqual(ZERO);
  });

  it('refuses a backup from a newer schema version', async () => {
    await expect(restore(bob, { ...backup, schemaVersion: 2 })).rejects.toThrow(
      /not a backup this version can restore/
    );
    expect(await counts(bob)).toEqual(ZERO);
  });

  it('refuses a file of another format', async () => {
    await expect(restore(bob, { ...backup, format: 'something-else' })).rejects.toThrow(
      /not a backup/
    );
    expect(await counts(bob)).toEqual(ZERO);
  });

  it('needs a signed-in user', async () => {
    await expect(restore(null, backup)).rejects.toThrow(/Sign in first/);
  });

  it('a bad row rolls back the whole restore (no partial data)', async () => {
    // Clear the shared IDs first, so the only failure is the bad amount.
    await db.exec(`
      delete from public.reminders; delete from public.loan_events; delete from public.loan_payments;
      delete from public.loans; delete from public.fuel_logs; delete from public.expenses;
      delete from public.vehicles; delete from public.expense_categories where user_id is not null;`);
    const dave = await createUser(db, 'dave@b.local');
    const bad = {
      ...backup,
      expenses: [{ ...(backup.expenses as Record<string, unknown>[])[0], amount: -5 }],
    };
    await expect(restore(dave, bad)).rejects.toThrow(/amount|check/i);
    expect(await counts(dave)).toEqual(ZERO);
  });
});
