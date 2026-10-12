// @vitest-environment node
// T22 — mark_reminder_done RPC (FR-REM-03; TC-REM-03). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;
let puc: string; // reminder id
let pucCategory: string;

const done = (uid: string, args: unknown[]) =>
  asUser(db, uid, () =>
    db.query<{ is_done: boolean; done_on: string }>(
      `select * from public.mark_reminder_done($1,$2,$3,$4,$5,$6,$7)`,
      args
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@d.local');
  bob = await createUser(db, 'bob@d.local');
  car = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00DON00001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
  puc = (
    await asUser(db, alice, () =>
      db.query<{ id: string }>(
        `insert into public.reminders (vehicle_id, reminder_type, title, due_date, lead_days)
         values ($1,'puc','PUC certificate','2026-10-11',15) returning id`,
        [car]
      )
    )
  ).rows[0]!.id;
  pucCategory = (
    await db.query<{ id: string }>(
      `select id from public.expense_categories where name = 'PUC certificate'`
    )
  ).rows[0]!.id;
});

describe('mark_reminder_done (TC-REM-03)', () => {
  it('marks done without an expense when none is recorded', async () => {
    const other = (
      await asUser(db, alice, () =>
        db.query<{ id: string }>(
          `insert into public.reminders (vehicle_id, reminder_type, title, due_date, lead_days)
           values ($1,'custom','Wash','2026-10-20',15) returning id`,
          [car]
        )
      )
    ).rows[0]!.id;
    const [row] = (await done(alice, [other, '2026-10-12', null, null, null, null, null])).rows;
    expect(row?.is_done).toBe(true);
    const stored = await db.query<{ done_on: string }>(
      `select done_on::text done_on from public.reminders where id = $1`,
      [other]
    );
    expect(stored.rows[0]!.done_on).toBe('2026-10-12');
    const n = await db.query<{ n: string }>(
      `select count(*) n from public.expenses where source = 'reminder'`
    );
    expect(Number(n.rows[0]!.n)).toBe(0);
  });

  it('records ₹100 under PUC certificate, dated today, and marks the reminder done', async () => {
    await done(alice, [puc, '2026-10-12', pucCategory, 100, 'upi', 'RTO Kurla', 'PUC renewed']);
    const r = await db.query<{ is_done: boolean; done_on: string }>(
      `select is_done, done_on::text from public.reminders where id = $1`,
      [puc]
    );
    expect(r.rows[0]).toEqual({ is_done: true, done_on: '2026-10-12' });
    const e = await db.query<{
      amount: string;
      category_id: string;
      source: string;
      expense_date: string;
      vendor: string;
    }>(
      `select amount, category_id, source, expense_date::text, vendor from public.expenses where source = 'reminder'`
    );
    expect(e.rows).toHaveLength(1);
    expect(e.rows[0]).toEqual({
      amount: '100.00',
      category_id: pucCategory,
      source: 'reminder',
      expense_date: '2026-10-12',
      vendor: 'RTO Kurla',
    });
  });

  it('refuses to mark an already done reminder done again', async () => {
    await expect(done(alice, [puc, '2026-10-12', null, null, null, null, null])).rejects.toThrow(
      /already done/
    );
  });

  it('another user cannot mark it done', async () => {
    const id = (
      await db.query<{ id: string }>(`select id from public.reminders where title = 'Wash'`)
    ).rows[0]!.id;
    await expect(done(bob, [id, '2026-10-12', null, null, null, null, null])).rejects.toThrow(
      /not found/
    );
  });

  it('a failed expense rolls back the done mark (nothing half-recorded)', async () => {
    const id = (
      await asUser(db, alice, () =>
        db.query<{ id: string }>(
          `insert into public.reminders (vehicle_id, reminder_type, title, due_date, lead_days)
           values ($1,'custom','Tax','2026-10-20',15) returning id`,
          [car]
        )
      )
    ).rows[0]!.id;
    await expect(
      done(alice, [id, '2026-10-12', crypto.randomUUID(), 50, null, null, null])
    ).rejects.toThrow();
    const r = await db.query<{ is_done: boolean }>(
      `select is_done from public.reminders where id = $1`,
      [id]
    );
    expect(r.rows[0]!.is_done).toBe(false);
  });

  it('an expense needs a category and an amount above zero', async () => {
    const id = (
      await db.query<{ id: string }>(`select id from public.reminders where title = 'Tax'`)
    ).rows[0]!.id;
    await expect(done(alice, [id, '2026-10-12', null, 50, null, null, null])).rejects.toThrow(
      /category/
    );
    await expect(done(alice, [id, '2026-10-12', pucCategory, 0, null, null, null])).rejects.toThrow(
      /amount/
    );
  });
});
