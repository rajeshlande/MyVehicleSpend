// @vitest-environment node
// T2 — Database schema migration 0001 applies and matches the design.
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
});

const TABLES = [
  'profiles', 'vehicles', 'expense_categories', 'fuel_logs', 'expenses',
  'loans', 'loan_payments', 'loan_events', 'reminders',
];

describe('T2 schema 0001_init', () => {
  it('creates every designed table', async () => {
    const r = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
    );
    const names = r.rows.map((x) => x.table_name);
    for (const t of TABLES) expect(names).toContain(t);
  });

  it('rejects an expense amount above ₹1 crore (CHECK)', async () => {
    await expect(
      db.query(`insert into public.expenses (user_id, vehicle_id, category_id, expense_date, amount)
                values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '2026-10-01', 10000000.01)`),
    ).rejects.toThrow();
  });

  it('rejects a duplicate registration number for the same user', async () => {
    const u = (await db.query<{ id: string }>(`insert into auth.users (email) values ('dup@t.local') returning id`)).rows[0]!.id;
    await db.query(`insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
                    values ($1,'car','MH12AB1234','petrol')`, [u]);
    await expect(
      db.query(`insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
                values ($1,'bike','MH12AB1234','petrol')`, [u]),
    ).rejects.toThrow(/vehicles_user_reg_unique/);
  });

  it('rejects a registration number with spaces (format CHECK)', async () => {
    const u = (await db.query<{ id: string }>(`insert into auth.users (email) values ('fmt@t.local') returning id`)).rows[0]!.id;
    await expect(
      db.query(`insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
                values ($1,'car','MH 12 AB','petrol')`, [u]),
    ).rejects.toThrow();
  });

  it('updated_at trigger refreshes on update', async () => {
    const u = (await db.query<{ id: string }>(`insert into auth.users (email) values ('trg@t.local') returning id`)).rows[0]!.id;
    const v = (await db.query<{ id: string; updated_at: Date }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type, updated_at)
       values ($1,'car','KA01XY0007','petrol', '2000-01-01') returning id, updated_at`, [u])).rows[0]!;
    await db.query(`update public.vehicles set make='Maruti' where id=$1`, [v.id]);
    const after = await db.query<{ updated_at: Date }>(`select updated_at from public.vehicles where id=$1`, [v.id]);
    expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(v.updated_at.getTime());
  });
});
