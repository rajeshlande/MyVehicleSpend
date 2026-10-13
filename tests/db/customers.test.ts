// @vitest-environment node
// Customers (simple contact list, slice 6): owner-only RLS and field checks. Migration 0016.
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, createUser, asUser } from './harness';

let db: PGlite;
let alice: string;
let bob: string;

const insertCustomer = (
  uid: string,
  over: Partial<{
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }> = {}
) =>
  asUser(db, uid, () =>
    db.query<{ id: string }>(
      `insert into public.customers (name, phone, email, notes)
       values ($1,$2,$3,$4) returning id`,
      [
        over.name ?? 'Ravi Kumar',
        over.phone === undefined ? '9800000001' : over.phone,
        over.email === undefined ? null : over.email,
        over.notes === undefined ? null : over.notes,
      ]
    )
  );

beforeAll(async () => {
  db = await createDb({ seed: true });
  alice = await createUser(db, 'alice@c.local');
  bob = await createUser(db, 'bob@c.local');
});

describe('customers (simple contact list)', () => {
  it('stores a customer for the signed-in owner (user_id defaults to auth.uid())', async () => {
    const { rows } = await insertCustomer(alice, { name: 'Asha Rao', email: 'asha@example.com' });
    const row = await asUser(db, alice, () =>
      db.query<{ user_id: string; name: string; email: string }>(
        `select user_id, name, email from public.customers where id = $1`,
        [rows[0]!.id]
      )
    );
    expect(row.rows[0]).toMatchObject({
      user_id: alice,
      name: 'Asha Rao',
      email: 'asha@example.com',
    });
  });

  it('rejects a blank name', async () => {
    await expect(insertCustomer(alice, { name: '   ' })).rejects.toThrow();
  });

  it('rejects a name over 80 characters and notes over 500', async () => {
    await expect(insertCustomer(alice, { name: 'x'.repeat(81) })).rejects.toThrow();
    await expect(insertCustomer(alice, { notes: 'n'.repeat(501) })).rejects.toThrow();
  });

  it('hides customers from other users', async () => {
    await insertCustomer(alice, { name: 'Private Customer' });
    const seenByBob = await asUser(db, bob, () =>
      db.query<{ name: string }>(
        `select name from public.customers where name = 'Private Customer'`
      )
    );
    expect(seenByBob.rows).toHaveLength(0);
  });

  it('does not let another user update or delete a customer', async () => {
    const { rows } = await insertCustomer(alice, { name: 'Guarded' });
    const id = rows[0]!.id;
    const upd = await asUser(db, bob, () =>
      db.query(`update public.customers set name = 'Hacked' where id = $1 returning id`, [id])
    );
    expect(upd.rows).toHaveLength(0);
    const del = await asUser(db, bob, () =>
      db.query(`delete from public.customers where id = $1 returning id`, [id])
    );
    expect(del.rows).toHaveLength(0);
  });

  it('lets the owner edit and delete their own customer', async () => {
    const { rows } = await insertCustomer(alice, { name: 'Editable' });
    const id = rows[0]!.id;
    const upd = await asUser(db, alice, () =>
      db.query<{ name: string }>(
        `update public.customers set name = 'Edited' where id = $1 returning name`,
        [id]
      )
    );
    expect(upd.rows[0]?.name).toBe('Edited');
    const del = await asUser(db, alice, () =>
      db.query(`delete from public.customers where id = $1 returning id`, [id])
    );
    expect(del.rows).toHaveLength(1);
  });

  it('is not reachable without signing in', async () => {
    await expect(
      asUser(db, null, () => db.query(`select id from public.customers`))
    ).rejects.toThrow();
  });
});
