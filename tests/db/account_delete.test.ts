// @vitest-environment node
// T27 — deleting the auth user removes every row they own (FR-DATA-03; TC-DATA-03, data part). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;

const USER_TABLES = [
  'vehicles',
  'expense_categories',
  'expenses',
  'fuel_logs',
  'loans',
  'loan_payments',
  'loan_events',
  'reminders',
] as const;

/** Rows owned by one user, across every user table (plus the profile). */
async function ownedRows(uid: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of USER_TABLES) {
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from public.${t} where user_id = $1`,
      [uid]
    );
    out[t] = r.rows[0]!.n;
  }
  const p = await db.query<{ n: number }>(
    `select count(*)::int n from public.profiles where id = $1`,
    [uid]
  );
  out.profiles = p.rows[0]!.n;
  return out;
}

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@del.local');
  bob = await createUser(db, 'bob@del.local');
  const sysCat = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where user_id is null limit 1`
    )
  ).rows[0]!.id;

  for (const uid of [alice, bob]) {
    await asUser(db, uid, async () => {
      const car = (
        await db.query<{ id: string }>(
          `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type) values ($1,'car',$2,'petrol') returning id`,
          [uid, uid === alice ? 'MH00DEL00001' : 'MH00DEL00002']
        )
      ).rows[0]!.id;
      const custom = (
        await db.query<{ id: string }>(
          `insert into public.expense_categories (user_id, group_name, name) values ($1,'Mine','Tolls') returning id`,
          [uid]
        )
      ).rows[0]!.id;
      const exp = (
        await db.query<{ id: string }>(
          `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount) values ($1,$2,$3,'2026-06-02',100) returning id`,
          [uid, car, sysCat]
        )
      ).rows[0]!.id;
      await db.query(
        `insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount) values ($1,$2,$3,'2026-06-03',50)`,
        [uid, car, custom]
      );
      await db.query(
        `insert into public.fuel_logs (user_id, vehicle_id, expense_id, filled_on, odometer_km, litres, price_per_unit, total_amount)
         values ($1,$2,$3,'2026-06-02',48600,30,41.68,1250.50)`,
        [uid, car, exp]
      );
      const loan = (
        await db.query<{ id: string }>(
          `insert into public.loans (user_id, vehicle_id, lender, principal, annual_rate, tenure_months, start_date, emi_amount)
           values ($1,$2,'HDFC',100000,10.5,12,'2026-01-05',8800) returning id`,
          [uid, car]
        )
      ).rows[0]!.id;
      await db.query(
        `insert into public.loan_payments (user_id, loan_id, installment_no, due_date, scheduled_emi, principal_component, interest_component, opening_balance, closing_balance)
         values ($1,$2,1,'2026-01-05',8800,8000,800,100000,92000)`,
        [uid, loan]
      );
      await db.query(
        `insert into public.loan_events (user_id, loan_id, event_type, event_date, amount) values ($1,$2,'prepayment','2026-03-01',10000)`,
        [uid, loan]
      );
      await db.query(
        `insert into public.reminders (user_id, vehicle_id, reminder_type, title, due_date) values ($1,$2,'puc','PUC','2026-11-30')`,
        [uid, car]
      );
    });
  }
});

describe('deleting the auth user (FR-DATA-03)', () => {
  it('alice has data before the deletion', async () => {
    const before = await ownedRows(alice);
    for (const t of USER_TABLES) expect(before[t], t).toBeGreaterThan(0);
  });

  it('deleting the auth user removes every row Alice owned', async () => {
    const bobBefore = await ownedRows(bob);
    const sysBefore = (
      await db.query<{ n: number }>(
        `select count(*)::int n from public.expense_categories where user_id is null`
      )
    ).rows[0]!.n;

    await db.query(`delete from auth.users where id = $1`, [alice]);

    const after = await ownedRows(alice);
    for (const [table, n] of Object.entries(after)) expect(n, table).toBe(0);
    // Bob's data and the system categories are untouched.
    expect(await ownedRows(bob)).toEqual(bobBefore);
    const sysAfter = (
      await db.query<{ n: number }>(
        `select count(*)::int n from public.expense_categories where user_id is null`
      )
    ).rows[0]!.n;
    expect(sysAfter).toBe(sysBefore);
  });
});
