/**
 * Test harness: real PostgreSQL (PGlite, in-process) with a minimal Supabase shim.
 * The shim provides only what Supabase normally supplies: the anon/authenticated roles,
 * the auth.users table, and auth.uid(). Migrations and seed run unchanged.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

export async function createDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(ROOT, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x: string) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  if (opts.seed) await db.exec(readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8'));
  return db;
}

/** Create a user row in auth.users and return its id. */
export async function createUser(db: PGlite, email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    'insert into auth.users (email) values ($1) returning id',
    [email],
  );
  const row = r.rows[0];
  if (!row) throw new Error(`failed to create auth user ${email}`);
  return row.id;
}

/**
 * Run a function as an authenticated user (RLS applies), or as anon when uid is null.
 * Resets role afterwards so superuser setup queries keep working.
 */
export async function asUser<T>(
  db: PGlite,
  uid: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(
    uid
      ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`
      : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
