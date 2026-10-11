// @vitest-environment node
// T5 (DB part) — profile row is created on sign-up, with INR default (FR-AUTH-05, TC-AUTH-01).
import { describe, it, expect } from 'vitest';
import { createDb } from './harness';

describe('profile trigger on sign-up', () => {
  it('creates a profile with currency INR and the display name from metadata', async () => {
    const db = await createDb();
    const u = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ('new@t.local', '{"display_name":"Ravi"}') returning id`
    );
    const p = await db.query<{ display_name: string; currency: string; locale: string }>(
      `select display_name, currency, locale from public.profiles where id=$1`,
      [u.rows[0]!.id]
    );
    expect(p.rows[0]).toEqual({ display_name: 'Ravi', currency: 'INR', locale: 'en-IN' });
  });

  it('works without metadata (display_name null)', async () => {
    const db = await createDb();
    const u = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('nometa@t.local') returning id`
    );
    const p = await db.query<{ display_name: string | null }>(
      `select display_name from public.profiles where id=$1`,
      [u.rows[0]!.id]
    );
    expect(p.rows[0]!.display_name).toBeNull();
  });
});
