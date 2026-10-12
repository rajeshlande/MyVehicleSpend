import { getSupabase } from './supabase';
import { DataError } from './errors';
import { DELETE_CONFIRM_WORD } from '../core/account/delete';

/**
 * Deletes the signed-in account and all its data through the delete-account Edge Function (FR-DATA-03).
 * The function's own messages are shown as they are, since they are written for the user.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await getSupabase().functions.invoke('delete-account', {
    body: { confirm: DELETE_CONFIRM_WORD },
  });
  if (!error) return;

  let message = 'Could not delete the account. Please try again.';
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // Keep the generic message when the reply is not JSON.
    }
  }
  throw new DataError(message);
}
