// @vitest-environment node
// T4 — System expense categories seed.
import { describe, it, expect } from 'vitest';
import { createDb } from './harness';

describe('T4 seed.sql', () => {
  it('inserts the 78 system categories from the schema doc §7', async () => {
    const db = await createDb({ seed: true });
    const r = await db.query<{ n: string }>(
      `select count(*)::text as n from public.expense_categories where user_id is null`
    );
    expect(Number(r.rows[0]!.n)).toBe(78);
  });

  it('is idempotent when re-run', async () => {
    const db = await createDb({ seed: true });
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    await db.exec(readFileSync(resolve(__dirname, '../../supabase/seed.sql'), 'utf8'));
    const r = await db.query<{ n: string }>(
      `select count(*)::text as n from public.expense_categories where user_id is null`
    );
    expect(Number(r.rows[0]!.n)).toBe(78);
  });

  it('includes a known Indian category', async () => {
    const db = await createDb({ seed: true });
    const r = await db.query<{ n: string }>(
      `select count(*)::text as n from public.expense_categories where group_name='Government & RTO' and name='PUC certificate'`
    );
    expect(Number(r.rows[0]!.n)).toBe(1);
  });
});
