// T29a — offline read cache (FR-PWA-03; TC-PWA-03 at the data layer). IndexedDB is provided by fake-indexeddb.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataError, NETWORK_CODE } from './errors';
import { oldestCachedAt, clearFreshness } from './freshness';

const session = vi.hoisted(() => ({ uid: 'user-a' as string | null }));
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: session.uid ? { user: { id: session.uid } } : null },
      }),
    },
  }),
}));

import { readThrough, clearOfflineCache } from './offlineCache';

const network = () =>
  new DataError("Couldn't reach the server. Check your connection and try again.", NETWORK_CODE);
const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

beforeEach(async () => {
  setOnline(true);
  session.uid = 'user-a';
  await clearOfflineCache();
});

afterEach(() => {
  setOnline(true);
});

describe('read cache (FR-PWA-03)', () => {
  it('a live read is returned and saved for the next offline visit', async () => {
    const rows = [{ id: 'e1', amount: 100 }];
    expect(await readThrough('expenses|v1', async () => rows)).toEqual(rows);

    const failing = vi.fn(async () => {
      throw network();
    });
    expect(await readThrough('expenses|v1', failing)).toEqual(rows);
  });

  it('when the connection fails, the saved copy is returned and its age is reported', async () => {
    await readThrough('expenses|v1', async () => [{ id: 'e1' }]);
    await readThrough('expenses|v1', async () => {
      throw network();
    });
    expect(oldestCachedAt()).not.toBeNull();
  });

  it('a live read that succeeds clears the "saved data" marker', async () => {
    await readThrough('fuel|v1', async () => [{ id: 'f1' }]);
    await readThrough('fuel|v1', async () => {
      throw network();
    });
    expect(oldestCachedAt()).not.toBeNull();
    await readThrough('fuel|v1', async () => [{ id: 'f2' }]);
    expect(oldestCachedAt()).toBeNull();
  });

  it('a server error is thrown, never hidden by old data', async () => {
    await readThrough('expenses|v1', async () => [{ id: 'e1' }]);
    const serverError = new DataError('Something went wrong. Please try again.', '42P01');
    await expect(
      readThrough('expenses|v1', async () => {
        throw serverError;
      })
    ).rejects.toBe(serverError);
  });

  it('offline with nothing saved says so plainly', async () => {
    setOnline(false);
    await expect(readThrough('expenses|v1', async () => [])).rejects.toMatchObject({
      code: 'OFFLINE_NO_COPY',
    });
  });

  it('offline reads skip the network and use the saved copy', async () => {
    await readThrough('expenses|v1', async () => [{ id: 'e1' }]);
    setOnline(false);
    const live = vi.fn(async () => [{ id: 'never' }]);
    expect(await readThrough('expenses|v1', live)).toEqual([{ id: 'e1' }]);
    expect(live).not.toHaveBeenCalled();
  });

  it('one account never sees another account’s saved data on the same device', async () => {
    await readThrough('expenses|v1', async () => [{ id: 'alice-row' }]);
    session.uid = 'user-b';
    setOnline(false);
    await expect(readThrough('expenses|v1', async () => [])).rejects.toMatchObject({
      code: 'OFFLINE_NO_COPY',
    });
  });

  it('clearing on sign-out removes the saved data', async () => {
    await readThrough('expenses|v1', async () => [{ id: 'e1' }]);
    await clearOfflineCache();
    clearFreshness();
    setOnline(false);
    await expect(readThrough('expenses|v1', async () => [])).rejects.toMatchObject({
      code: 'OFFLINE_NO_COPY',
    });
  });
});
