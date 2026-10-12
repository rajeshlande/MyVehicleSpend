/**
 * delete-account logic (FR-DATA-03). No Deno or Supabase imports here, so it can be tested in Node.
 * The caller's identity comes only from the verified JWT, never from the request body.
 * Order: verify the user, check the typed confirmation, delete receipt files, then delete the auth user.
 * Deleting the auth user cascades to every user-owned table (all reference auth.users on delete cascade).
 * If receipt deletion fails, the account is kept, so the user can try again.
 */

export const CONFIRM_WORD = 'DELETE';

export interface AccountDeps {
  /** Returns the user id for a valid access token, or null when the token is not valid. */
  verifyJwt(jwt: string): Promise<string | null>;
  /** Every receipt object path under the user's folder, including nested folders. */
  listReceiptPaths(uid: string): Promise<string[]>;
  removeReceiptPaths(paths: string[]): Promise<void>;
  deleteAuthUser(uid: string): Promise<void>;
}

export interface AccountRequest {
  authorization: string | null;
  body: unknown;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export async function deleteAccount(req: AccountRequest, deps: AccountDeps): Promise<Reply> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.authorization ?? '');
  if (!m || !m[1]) return { status: 401, body: { error: 'Sign in first.' } };

  let uid: string | null;
  try {
    uid = await deps.verifyJwt(m[1] ?? '');
  } catch {
    uid = null;
  }
  if (!uid) return { status: 401, body: { error: 'Your session has expired. Sign in again.' } };

  const confirm = (req.body as { confirm?: unknown } | null | undefined)?.confirm;
  if (confirm !== CONFIRM_WORD) {
    return { status: 400, body: { error: `Type ${CONFIRM_WORD} to confirm.` } };
  }

  let receipts: string[];
  try {
    receipts = await deps.listReceiptPaths(uid);
    if (receipts.length > 0) await deps.removeReceiptPaths(receipts);
  } catch {
    return {
      status: 500,
      body: { error: 'Could not delete your receipt photos. Nothing was deleted. Try again.' },
    };
  }

  try {
    await deps.deleteAuthUser(uid);
  } catch {
    return {
      status: 500,
      body: { error: 'Could not delete the account. Your receipt photos were removed; try again.' },
    };
  }

  return { status: 200, body: { deleted: true, receiptsRemoved: receipts.length } };
}
