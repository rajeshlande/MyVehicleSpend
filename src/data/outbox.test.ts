// T29b slice 1 — outbox store and replay engine (FR-PWA-04, FR-PWA-05; NFR-REL-02).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataError, NETWORK_CODE } from './errors';
import {
  enqueue,
  replay,
  pendingCount,
  failedItems,
  backoffMs,
  clearOutboxForTests,
  MAX_ATTEMPTS,
  type OutboxItem,
} from './outbox';

const network = () => new DataError("Couldn't reach the server.", NETWORK_CODE);
const rejected = () => new DataError('That vehicle was not found.', 'P0002');

beforeEach(async () => {
  await clearOutboxForTests();
});

describe('enqueue', () => {
  it('stores the write with a client UUID and counts it as pending', async () => {
    const id = await enqueue('u1', 'expense.create', { amount: 100 }, 1000);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await pendingCount('u1')).toBe(1);
  });

  it('counts per user, so one account never sees another’s queue', async () => {
    await enqueue('u1', 'expense.create', {}, 1);
    await enqueue('u2', 'fuel.create', {}, 1);
    expect(await pendingCount('u1')).toBe(1);
    expect(await pendingCount('u2')).toBe(1);
    expect(await pendingCount('u3')).toBe(0);
  });
});

describe('replay', () => {
  it('sends in queue order and removes what the server accepted', async () => {
    const a = await enqueue('u1', 'expense.create', { n: 'a' }, 1);
    const b = await enqueue('u1', 'fuel.create', { n: 'b' }, 2);
    const sent: string[] = [];
    const result = await replay(
      'u1',
      async (item: OutboxItem) => {
        sent.push(item.id);
      },
      10
    );
    expect(sent).toEqual([a, b]);
    expect(result).toEqual({ sent: 2, failed: 0, stoppedOffline: false });
    expect(await pendingCount('u1')).toBe(0);
  });

  it('keeps the same client UUID on replay, so the server can match it (T29c)', async () => {
    const id = await enqueue('u1', 'expense.create', {}, 1);
    const seen: string[] = [];
    await replay(
      'u1',
      async (item) => {
        seen.push(item.id);
        throw network();
      },
      10
    );
    await replay(
      'u1',
      async (item) => {
        seen.push(item.id);
      },
      1_000_000
    );
    expect(seen).toEqual([id, id]);
  });

  it('a network failure stops the replay, keeps order, and backs off', async () => {
    const a = await enqueue('u1', 'expense.create', {}, 1);
    await enqueue('u1', 'fuel.create', {}, 2);
    const send = vi.fn(async () => {
      throw network();
    });
    const result = await replay('u1', send, 100);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.stoppedOffline).toBe(true);
    expect(await pendingCount('u1')).toBe(2);

    // Not due again until the back-off has passed.
    const before = await replay('u1', send, 100 + backoffMs(1) - 1);
    expect(before.sent + before.failed).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(a).toBeTruthy();
  });

  it('gives up after the max attempts and marks the item failed', async () => {
    const id = await enqueue('u1', 'expense.create', { x: 1 }, 0);
    let now = 0;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      now += 10 * 60 * 1000; // past any back-off
      await replay(
        'u1',
        async () => {
          throw network();
        },
        now
      );
    }
    const failed = await failedItems('u1');
    expect(failed.map((i) => i.id)).toEqual([id]);
    expect(failed[0]?.attempts).toBe(MAX_ATTEMPTS);
    expect(failed[0]?.lastError).toBe("Couldn't reach the server.");
    expect(await pendingCount('u1')).toBe(0);
  });

  it('a server rejection is kept as failed at once, not retried, and does not stop later items', async () => {
    const bad = await enqueue('u1', 'fuel.create', {}, 1);
    const good = await enqueue('u1', 'expense.create', {}, 2);
    const sent: string[] = [];
    const result = await replay(
      'u1',
      async (item) => {
        sent.push(item.id);
        if (item.id === bad) throw rejected();
      },
      10
    );
    expect(sent).toEqual([bad, good]);
    expect(result).toEqual({ sent: 1, failed: 1, stoppedOffline: false });
    const failed = await failedItems('u1');
    expect(failed.map((i) => i.id)).toEqual([bad]);
    expect(failed[0]?.lastError).toBe('That vehicle was not found.');
  });

  it('a replay never touches another user’s items', async () => {
    await enqueue('u1', 'expense.create', {}, 1);
    const other = await enqueue('u2', 'expense.create', {}, 1);
    const sent: string[] = [];
    await replay(
      'u1',
      async (item) => {
        sent.push(item.id);
      },
      10
    );
    expect(sent).not.toContain(other);
    expect(await pendingCount('u2')).toBe(1);
  });
});

describe('backoffMs', () => {
  it('doubles from 10 s', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([10_000, 20_000, 40_000, 80_000]);
  });
});
