// T27 — delete-account logic (FR-DATA-03; TC-DATA-03 in its server part). Runs in Node; no live project.
import { describe, it, expect, vi } from 'vitest';
import { deleteAccount, type AccountDeps } from '../../supabase/functions/delete-account/logic';

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOKEN = 'token-of-alice';

function deps(over: Partial<AccountDeps> = {}) {
  const calls: string[] = [];
  const d: AccountDeps = {
    verifyJwt: vi.fn(async (jwt: string) => (jwt === TOKEN ? UID : null)),
    listReceiptPaths: vi.fn(async () => {
      calls.push('list');
      return [`${UID}/e1/1.jpg`, `${UID}/e1/2.pdf`];
    }),
    removeReceiptPaths: vi.fn(async () => {
      calls.push('remove');
    }),
    deleteAuthUser: vi.fn(async () => {
      calls.push('deleteUser');
    }),
    ...over,
  };
  return { d, calls };
}

const ok = { authorization: `Bearer ${TOKEN}`, body: { confirm: 'DELETE' } };

describe('who may delete (FR-DATA-03)', () => {
  it('no sign-in header → 401 and nothing is touched', async () => {
    const { d, calls } = deps();
    const r = await deleteAccount({ authorization: null, body: { confirm: 'DELETE' } }, d);
    expect(r.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('a token that does not verify → 401 and nothing is touched', async () => {
    const { d, calls } = deps();
    const r = await deleteAccount(
      { authorization: 'Bearer forged', body: { confirm: 'DELETE' } },
      d
    );
    expect(r.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('a verification error is treated as not signed in', async () => {
    const { d, calls } = deps({
      verifyJwt: vi.fn(async () => Promise.reject(new Error('network'))),
    });
    const r = await deleteAccount(ok, d);
    expect(r.status).toBe(401);
    expect(calls).toEqual([]);
  });
});

describe('typed confirmation', () => {
  it.each([{}, { confirm: 'delete' }, { confirm: true }, undefined, null])(
    'refuses %j → 400, nothing deleted',
    async (body) => {
      const { d, calls } = deps();
      const r = await deleteAccount({ authorization: `Bearer ${TOKEN}`, body }, d);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('Type DELETE to confirm.');
      expect(calls).toEqual([]);
    }
  );
});

describe('the deletion itself', () => {
  it('deletes receipt files first, then the auth user, and reports the count', async () => {
    const { d, calls } = deps();
    const r = await deleteAccount(ok, d);
    expect(r).toEqual({ status: 200, body: { deleted: true, receiptsRemoved: 2 } });
    expect(calls).toEqual(['list', 'remove', 'deleteUser']);
    expect(d.deleteAuthUser).toHaveBeenCalledWith(UID);
    expect(d.removeReceiptPaths).toHaveBeenCalledWith([`${UID}/e1/1.jpg`, `${UID}/e1/2.pdf`]);
  });

  it('with no receipts, skips the storage call and still deletes the account', async () => {
    const { d } = deps({ listReceiptPaths: vi.fn(async () => []) });
    const r = await deleteAccount(ok, d);
    expect(r.status).toBe(200);
    expect(d.removeReceiptPaths).not.toHaveBeenCalled();
    expect(d.deleteAuthUser).toHaveBeenCalledTimes(1);
  });

  it('the user id comes from the token, never from the body', async () => {
    const { d } = deps();
    await deleteAccount(
      { authorization: `Bearer ${TOKEN}`, body: { confirm: 'DELETE', userId: 'someone-else' } },
      d
    );
    expect(d.deleteAuthUser).toHaveBeenCalledWith(UID);
    expect(d.listReceiptPaths).toHaveBeenCalledWith(UID);
  });

  it('if receipt removal fails, the account is kept so the user can retry', async () => {
    const { d, calls } = deps({
      removeReceiptPaths: vi.fn(async () => {
        throw new Error('storage down');
      }),
    });
    const r = await deleteAccount(ok, d);
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/Nothing was deleted/);
    expect(calls).not.toContain('deleteUser');
  });

  it('if the auth user cannot be removed, the message says receipts are already gone', async () => {
    const { d } = deps({
      deleteAuthUser: vi.fn(async () => {
        throw new Error('db error');
      }),
    });
    const r = await deleteAccount(ok, d);
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/receipt photos were removed/);
  });
});
