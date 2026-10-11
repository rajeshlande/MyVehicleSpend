import { getSupabase } from './supabase';
import { DataError } from './errors';
import { nextReceiptSlot, receiptObjectPath, type ReceiptKind } from '../core/receipts/rules';
import { setReceiptPaths } from './expenses';

const BUCKET = 'receipts';
/** Signed URLs expire after 1 hour (T14 acceptance). */
export const SIGNED_URL_SECONDS = 3600;

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new DataError('Sign in again to upload receipts.');
  return uid;
}

/** Uploads a receipt into the caller's folder and records it on the expense. Returns the new path list. */
export async function uploadReceipt(
  expenseId: string,
  existingPaths: string[],
  body: Blob,
  kind: ReceiptKind
): Promise<string[]> {
  const slot = nextReceiptSlot(existingPaths);
  if (slot === null) throw new DataError('You can attach up to 3 receipts to an expense.');
  const uid = await currentUserId();
  const ext = kind === 'pdf' ? 'pdf' : 'jpg';
  const path = receiptObjectPath(uid, expenseId, slot, ext);

  const { error: upErr } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, body, {
      contentType: kind === 'pdf' ? 'application/pdf' : 'image/jpeg',
      upsert: false,
    });
  if (upErr)
    throw new DataError("Couldn't upload the receipt. Check your connection and try again.");

  const next = [...existingPaths, path];
  try {
    await setReceiptPaths(expenseId, next);
  } catch (e) {
    // Keep storage and the expense in step: remove the orphan object.
    await getSupabase().storage.from(BUCKET).remove([path]);
    throw e;
  }
  return next;
}

/** Removes a receipt from storage and from the expense. Returns the new path list. */
export async function removeReceipt(
  expenseId: string,
  existingPaths: string[],
  path: string
): Promise<string[]> {
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  if (error) throw new DataError("Couldn't remove the receipt. Try again.");
  const next = existingPaths.filter((p) => p !== path);
  await setReceiptPaths(expenseId, next);
  return next;
}

/** Short-lived link to view a receipt (NFR-SEC-07). */
export async function signedReceiptUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) throw new DataError("Couldn't open the receipt.");
  return data.signedUrl;
}
