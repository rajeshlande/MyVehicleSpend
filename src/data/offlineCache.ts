import Dexie, { type Table } from 'dexie';
import { getSupabase } from './supabase';
import { DataError, isNetworkError } from './errors';
import { markCached, markLive, clearFreshness } from './freshness';

/**
 * Read cache in IndexedDB (FR-PWA-03, SDD §5). Holds the last successful result of each read.
 * Keys include the user id, so one account never sees another's data on a shared device.
 * Cleared on sign-out. Only reads are cached here; writes belong to the outbox (T29b).
 */
interface Snapshot {
  key: string;
  savedAt: string;
  payload: unknown;
}

class CacheDb extends Dexie {
  snapshots!: Table<Snapshot, string>;
  constructor() {
    super('my-vehicle-spend-cache');
    this.version(1).stores({ snapshots: 'key' });
  }
}

let db: CacheDb | null = null;
function cacheDb(): CacheDb {
  db ??= new CacheDb();
  return db;
}

async function userScope(): Promise<string> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? 'anon';
  } catch {
    return 'anon';
  }
}

function offlineNoCopy(): DataError {
  return new DataError(
    "You're offline, and this has not been loaded before. Connect once to load it.",
    'OFFLINE_NO_COPY'
  );
}

async function fromCache<T>(scoped: string, key: string): Promise<T> {
  const snap = await cacheDb().snapshots.get(scoped);
  if (!snap) throw offlineNoCopy();
  markCached(key, snap.savedAt);
  return snap.payload as T;
}

/**
 * Runs a read live. On success, saves a copy. If the connection fails, returns the saved copy and marks it as cached.
 * Other errors are thrown unchanged, so a real server error is never hidden by old data.
 */
export async function readThrough<T>(key: string, live: () => Promise<T>): Promise<T> {
  const scoped = `${await userScope()}|${key}`;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return fromCache<T>(scoped, key);
  }
  try {
    const data = await live();
    const savedAt = new Date().toISOString();
    await cacheDb()
      .snapshots.put({ key: scoped, savedAt, payload: data })
      .catch(() => undefined); // a full or blocked store must not break a good read
    markLive(key);
    return data;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    return fromCache<T>(scoped, key);
  }
}

/** Removes every saved read. Called on sign-out, so the next user starts clean. */
export async function clearOfflineCache(): Promise<void> {
  clearFreshness();
  await cacheDb()
    .snapshots.clear()
    .catch(() => undefined);
}
