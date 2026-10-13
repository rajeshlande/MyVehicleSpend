import { DataError } from './errors';
import { replay, notifyOutboxChanged, type OutboxItem, type ReplayResult } from './outbox';
import { createExpenseWithId } from './expenses';
import { addFuelLogWithId } from './fuel';
import type { ExpenseInput } from '../core/expenses/schema';
import type { FuelInput } from '../core/fuel/schema';

/** Sends one queued write through the same functions the online path uses, with the same client id. */
export async function sendOutboxItem(item: OutboxItem): Promise<void> {
  switch (item.op) {
    case 'expense.create':
      await createExpenseWithId(item.id, item.payload as ExpenseInput);
      return;
    case 'fuel.create':
      await addFuelLogWithId(item.id, item.payload as FuelInput & { categoryId: string });
      return;
    default:
      throw new DataError('This change is no longer supported. Enter it again.', 'UNKNOWN_OP');
  }
}

// One replay at a time. A second trigger while one is running gets the same result.
let inFlight: Promise<ReplayResult> | null = null;

export function syncNow(userId: string): Promise<ReplayResult> {
  inFlight ??= replay(userId, sendOutboxItem).finally(() => {
    inFlight = null;
    notifyOutboxChanged();
  });
  return inFlight;
}

/**
 * Replays the queue when the phone comes back online and once when the app opens (FR-PWA-05).
 * Returns a function that stops the online listener.
 */
export function startSync(userId: string): () => void {
  const onOnline = () => {
    void syncNow(userId);
  };
  window.addEventListener('online', onOnline);
  void syncNow(userId);
  return () => window.removeEventListener('online', onOnline);
}
