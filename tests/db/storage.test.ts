// @vitest-environment node
// T14 — receipts bucket policies (FR-DATA-04, NFR-SEC-07; TC-DATA-04). The storage schema is a shim here.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

const ROOT = join(__dirname, '..', '..');
let db: PGlite;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createDb();
  // Supabase storage shim: only the parts the policies rely on.
  await db.exec(`
    create schema if not exists storage;
    create table storage.buckets (id text primary key, name text, public boolean not null default false);
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid
    );
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    $$;
    grant usage on schema storage to anon, authenticated;
    grant execute on function storage.foldername(text) to anon, authenticated;
  `);
  // The migration's policy block is guarded to run only where storage exists; apply it here.
  await db.exec(readFileSync(join(ROOT, 'supabase/migrations/0008_receipts_storage.sql'), 'utf8'));
  alice = await createUser(db, 'alice@s.local');
  bob = await createUser(db, 'bob@s.local');
  await db.query(
    `insert into storage.objects (bucket_id, name, owner) values
     ('receipts', $1, $2)`,
    [`${alice}/e-1/1.jpg`, alice]
  );
});

describe('receipts bucket (TC-DATA-04)', () => {
  it('is private', async () => {
    const r = await db.query<{ public: boolean }>(
      `select public from storage.buckets where id='receipts'`
    );
    expect(r.rows[0]!.public).toBe(false);
  });

  it('lets the owner read their own receipt', async () => {
    const r = await asUser(db, alice, () =>
      db.query<{ name: string }>(`select name from storage.objects where bucket_id='receipts'`)
    );
    expect(r.rows.map((x) => x.name)).toEqual([`${alice}/e-1/1.jpg`]);
  });

  it("hides another user's receipt from bob", async () => {
    const r = await asUser(db, bob, () =>
      db.query(`select name from storage.objects where bucket_id='receipts'`)
    );
    expect(r.rows).toHaveLength(0);
  });

  it('blocks bob from uploading into another user folder', async () => {
    await expect(
      asUser(db, bob, () =>
        db.query(
          `insert into storage.objects (bucket_id, name, owner) values ('receipts', $1, $2)`,
          [`${alice}/e-2/1.jpg`, bob]
        )
      )
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('lets alice upload into her own folder', async () => {
    await asUser(db, alice, () =>
      db.query(`insert into storage.objects (bucket_id, name, owner) values ('receipts', $1, $2)`, [
        `${alice}/e-2/1.jpg`,
        alice,
      ])
    );
    const r = await db.query(`select 1 from storage.objects where name=$1`, [`${alice}/e-2/1.jpg`]);
    expect(r.rows).toHaveLength(1);
  });

  it('gives anonymous users no access', async () => {
    await expect(
      asUser(db, null, () => db.query(`select name from storage.objects`))
    ).rejects.toThrow(/permission denied/i);
  });
});
