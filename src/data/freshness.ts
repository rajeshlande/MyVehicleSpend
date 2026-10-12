import { useSyncExternalStore } from 'react';

/**
 * Which reads were answered from the offline cache, and when that data was last saved (FR-PWA-03).
 * A live read clears its key. The UI shows the oldest cached time.
 */
const cached = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function markCached(key: string, savedAt: string): void {
  cached.set(key, savedAt);
  emit();
}

export function markLive(key: string): void {
  if (cached.delete(key)) emit();
}

export function clearFreshness(): void {
  if (cached.size === 0) return;
  cached.clear();
  emit();
}

/** Oldest save time among cached reads, or null when everything shown is live. */
export function oldestCachedAt(): string | null {
  let oldest: string | null = null;
  for (const t of cached.values()) {
    if (oldest === null || t < oldest) oldest = t;
  }
  return oldest;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useLastUpdated(): string | null {
  return useSyncExternalStore(subscribe, oldestCachedAt, () => null);
}
