// @vitest-environment node
// T21 — reminders table rules (FR-REM-01, FR-REM-05). Real Postgres (PGlite).
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;
let car: string;

const insert = (uid: string, values: unknown[], cols: string) =>
  asUser(db, uid, () =>
    db.query<{ id: string }>(
      `insert into public.reminders (vehicle_id, ${cols}) values ($1, ${values.map((_, i) => `$${i + 2}`).join(',')}) returning id`,
      [car, ...values]
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@r.local');
  bob = await createUser(db, 'bob@r.local');
  car = (
    await db.query<{ id: string }>(
      `insert into public.vehicles (user_id, vehicle_type, registration_no, fuel_type)
       values ($1,'car','MH00REM00001','petrol') returning id`,
      [alice]
    )
  ).rows[0]!.id;
});

describe('reminders table (FR-REM-01, FR-REM-05)', () => {
  it('stores insurance fields: insurer, policy number, IDV, premium and expiry (TC-REM-01)', async () => {
    const { rows } = await insert(
      alice,
      [
        'insurance',
        'Car insurance',
        '2026-12-02',
        15,
        'ICICI Lombard',
        'OG-26-1234',
        520000,
        18000,
      ],
      'reminder_type, title, due_date, lead_days, insurer, policy_no, idv_amount, premium_amount'
    );
    const r = await db.query<{
      insurer: string;
      policy_no: string;
      idv_amount: string;
      due_date: string;
      lead_days: number;
    }>(
      `select insurer, policy_no, idv_amount, due_date::text, lead_days from public.reminders where id = $1`,
      [rows[0]!.id]
    );
    expect(r.rows[0]).toEqual({
      insurer: 'ICICI Lombard',
      policy_no: 'OG-26-1234',
      idv_amount: '520000.00',
      due_date: '2026-12-02',
      lead_days: 15,
    });
  });

  it('service by km stores the due odometer reading (TC-REM-04)', async () => {
    const { rows } = await insert(
      alice,
      ['service_km', 'Service', 52000, 15],
      'reminder_type, title, due_odometer_km, lead_days'
    );
    const r = await db.query<{ due_odometer_km: number }>(
      `select due_odometer_km from public.reminders where id = $1`,
      [rows[0]!.id]
    );
    expect(r.rows[0]!.due_odometer_km).toBe(52000);
  });

  it('a reminder needs a due date or a due odometer reading', async () => {
    await expect(
      insert(alice, ['custom', 'No trigger', 15], 'reminder_type, title, lead_days')
    ).rejects.toThrow();
  });

  it('lead days outside 0..90 are refused', async () => {
    await expect(
      insert(
        alice,
        ['custom', 'Far', '2026-12-01', 120],
        'reminder_type, title, due_date, lead_days'
      )
    ).rejects.toThrow();
  });

  it('another user cannot see or change the reminder', async () => {
    const id = (
      await db.query<{ id: string }>(`select id from public.reminders where title='Service'`)
    ).rows[0]!.id;
    const seen = await asUser(db, bob, () =>
      db.query<{ n: string }>(`select count(*) n from public.reminders where id = $1`, [id])
    );
    expect(Number(seen.rows[0]!.n)).toBe(0);
    const changed = await asUser(db, bob, () =>
      db.query<{ n: string }>(
        `update public.reminders set title = 'hacked' where id = $1 returning id`,
        [id]
      )
    );
    expect(changed.rows).toHaveLength(0);
  });
});
