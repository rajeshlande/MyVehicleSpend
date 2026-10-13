import Dexie, { type Table } from 'dexie';
import { isNetworkError, DataError } from './errors';

/**
 * Outbox for writes made while offline (FR-PWA-04, FR-PWA-05; SDD §5, NFR-REL-02).
 * Each queued write has a client-made UUID, which is also the row id on the server. T29c relies on that for safe retries.
 * Items are replayed in the order they were queued. A network failure stops the replay and backs off.
 * After 5 failed network attempts, or on a server rejection, the item is marked failed and is not retried.
 */
export const MAX_ATTEMPTS = 5;

export type OutboxStatus = 'pending' | 'failed';

export interface OutboxItem {
  id: string; // client UUID, also the server row id
  userId: string;
  op: string; // e.g. 'expense.create', 'fuel.create'
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number; // epoch ms
  createdAt: number; // epoch ms
  lastError: string | null;
}

class OutboxDb extends Dexie {
  outbox!: Table<OutboxItem, string>;
  constructor() {
    super('my-vehicle-spend-outbox');
    this.version(1).stores({ outbox: 'id, userId, createdAt' });
  }
}

let db: OutboxDb | null = null;
function outboxDb(): OutboxDb {
  db ??= new OutboxDb();
  return db;
}

/** Back-off after the nth failed attempt: 10 s, 20 s, 40 s, 80 s (NFR-REL-02). */
export function backoffMs(attempts: number): number {
  return 5_000 * 2 ** attempts;
}

export interface NewOutboxItem {
  id: string; // client UUID, reused on every replay
  userId: string;
  op: string;
  payload: unknown;
}

/** Queues a write under a client id the caller already holds (the same id is used for the provisional row). */
export async function enqueueWithId(item: NewOutboxItem, now: number = Date.now()): Promise<void> {
  await outboxDb().outbox.add({
    ...item,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    lastError: null,
  });
}

export async function enqueue(
  userId: string,
  op: string,
  payload: unknown,
  now: number = Date.now()
): Promise<string> {
  const id = crypto.randomUUID();
  await enqueueWithId({ id, userId, op, payload }, now);
  return id;
}

/** Pending and failed counts for one user (T29b). */
export async function outboxCounts(userId: string): Promise<{ pending: number; failed: number }> {
  const items = await outboxDb().outbox.where('userId').equals(userId).toArray();
  return {
    pending: items.filter((i) => i.status === 'pending').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };
}

/** Removes the items the user has been told could not be saved. */
export async function discardFailed(userId: string): Promise<number> {
  const failed = await failedItems(userId);
  await outboxDb().outbox.bulkDelete(failed.map((i) => i.id));
  return failed.length;
}

/** Tells the UI that the queue changed (a write was queued, sent, or discarded). */
export function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('outbox-changed'));
}

/** Subscribes to queue changes. Returns the unsubscribe function. */
export function onOutboxChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('outbox-changed', listener);
  return () => window.removeEventListener('outbox-changed', listener);
}

export async function pendingCount(userId: string): Promise<number> {
  return outboxDb()
    .outbox.where('userId')
    .equals(userId)
    .filter((i) => i.status === 'pending')
    .count();
}

export async function failedItems(userId: string): Promise<OutboxItem[]> {
  return outboxDb()
    .outbox.where('userId')
    .equals(userId)
    .filter((i) => i.status === 'failed')
    .toArray();
}

export type Sender = (item: OutboxItem) => Promise<void>;

export interface ReplayResult {
  sent: number;
  failed: number;
  stoppedOffline: boolean;
}

function messageOf(e: unknown): string {
  return e instanceof DataError ? e.message : 'Could not save. Please try again.';
}

/**
 * Sends the due pending items for one user, oldest first.
 * Stops at the first network error, so the queue keeps its order.
 */
export async function replay(
  userId: string,
  send: Sender,
  now: number = Date.now()
): Promise<ReplayResult> {
  const table = outboxDb().outbox;
  const pending = (await table.where('userId').equals(userId).sortBy('createdAt')).filter(
    (i) => i.status === 'pending'
  );
  // Order is strict: an item that is still backing off blocks the ones queued after it.
  const due: OutboxItem[] = [];
  for (const item of pending) {
    if (item.nextAttemptAt > now) break;
    due.push(item);
  }
  const result: ReplayResult = { sent: 0, failed: 0, stoppedOffline: false };

  for (const item of due) {
    try {
      await send(item);
      await table.delete(item.id);
      result.sent += 1;
    } catch (e) {
      if (isNetworkError(e)) {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await table.update(item.id, { status: 'failed', attempts, lastError: messageOf(e) });
          result.failed += 1;
        } else {
          await table.update(item.id, {
            attempts,
            nextAttemptAt: now + backoffMs(attempts),
            lastError: messageOf(e),
          });
        }
        result.stoppedOffline = true;
        break;
      }
      // The server rejected the write. Keep it for the user to see, and do not retry it.
      await table.update(item.id, {
        status: 'failed',
        attempts: item.attempts + 1,
        lastError: messageOf(e),
      });
      result.failed += 1;
    }
  }
  return result;
}

/** Test helper: removes all queued items. */
export async function clearOutboxForTests(): Promise<void> {
  await outboxDb().outbox.clear();
}
