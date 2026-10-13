import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  failedItems,
  discardFailed,
  outboxCounts,
  onOutboxChanged,
  notifyOutboxChanged,
} from '../../data/outbox';
import { startSync } from '../../data/sync';

interface Counts {
  pending: number;
  failed: number;
  lastError: string | null;
}

/** Shows how many changes are waiting to sync, and any that the server refused (FR-PWA-05). */
export function SyncStatus() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [counts, setCounts] = useState<Counts | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const c = await outboxCounts(userId);
    const failed = await failedItems(userId);
    setCounts({ ...c, lastError: failed[0]?.lastError ?? null });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const stop = startSync(userId);
    const unsubscribe = onOutboxChanged(() => void refresh());
    return () => {
      stop();
      unsubscribe();
    };
  }, [userId, refresh]);

  async function discard() {
    if (!userId || !counts) return;
    if (
      !window.confirm(
        `Discard ${counts.failed} ${counts.failed === 1 ? 'change' : 'changes'} that could not be saved? You will need to enter ${counts.failed === 1 ? 'it' : 'them'} again.`
      )
    )
      return;
    await discardFailed(userId);
    notifyOutboxChanged();
  }

  if (!userId || !counts || (counts.pending === 0 && counts.failed === 0)) return null;

  return (
    <section className="sync-status" aria-label="Sync status">
      {counts.pending > 0 && (
        <p role="status">
          {counts.pending} {counts.pending === 1 ? 'change is' : 'changes are'} waiting to sync.
          They will be saved when you are online.
        </p>
      )}
      {counts.failed > 0 && (
        <div role="alert">
          <p>
            {counts.failed} {counts.failed === 1 ? 'change' : 'changes'} could not be saved.
            {counts.lastError ? ` ${counts.lastError}` : ''}
          </p>
          <button type="button" onClick={discard}>
            Discard
          </button>
        </div>
      )}
    </section>
  );
}
