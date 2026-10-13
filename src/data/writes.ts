import { getSupabase } from './supabase';
import { DataError, isNetworkError } from './errors';
import { enqueueWithId, notifyOutboxChanged } from './outbox';

export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves a write now, or queues it in the outbox when the connection is down (FR-PWA-04).
 * The queued item keeps the client id, so a replay after a dropped response does not create a second row (T29c).
 * Only network failures are queued. A server rejection is thrown so the user sees it.
 */
export async function saveOrQueue<T>(args: {
  op: string;
  id: string;
  payload: unknown;
  send: () => Promise<T>;
  provisional: () => T;
}): Promise<T> {
  const queue = async (): Promise<T> => {
    const userId = await currentUserId();
    if (!userId) throw new DataError('Sign in again to save this.', 'NO_SESSION');
    await enqueueWithId({ id: args.id, userId, op: args.op, payload: args.payload });
    notifyOutboxChanged();
    return args.provisional();
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return queue();
  try {
    return await args.send();
  } catch (e) {
    if (isNetworkError(e)) return queue();
    throw e;
  }
}
