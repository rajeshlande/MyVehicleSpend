import { getSupabase } from './supabase';
import { mapDbError, DataError } from './errors';
import {
  buildBackup,
  type BackupArray,
  type BackupCounts,
  type BackupFile,
  type BackupRow,
  type BackupRows,
} from '../core/backup/format';

const PAGE = 1000;

/**
 * Reads every row of one table for the signed-in user (RLS scopes it). Soft-deleted rows are included,
 * so that foreign keys in the file still point at rows that exist in it.
 */
async function fetchAll(table: string, onlyUserCategories = false): Promise<BackupRow[]> {
  const sb = getSupabase();
  const out: BackupRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1);
    if (onlyUserCategories) q = q.not('user_id', 'is', null);
    const { data, error } = await q;
    if (error) throw mapDbError(error);
    const rows = (data ?? []) as unknown as BackupRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const SOURCES: Record<BackupArray, { table: string; onlyUserCategories?: boolean }> = {
  expenseCategories: { table: 'expense_categories', onlyUserCategories: true },
  vehicles: { table: 'vehicles' },
  expenses: { table: 'expenses' },
  fuelLogs: { table: 'fuel_logs' },
  loans: { table: 'loans' },
  loanPayments: { table: 'loan_payments' },
  loanEvents: { table: 'loan_events' },
  reminders: { table: 'reminders' },
};

/** Every row the signed-in user owns, as a backup file (FR-DATA-01). */
export async function exportBackup(now: Date = new Date()): Promise<BackupFile> {
  const entries = await Promise.all(
    (Object.keys(SOURCES) as BackupArray[]).map(async (key) => {
      const src = SOURCES[key];
      return [key, await fetchAll(src.table, src.onlyUserCategories)] as const;
    })
  );
  const rows = Object.fromEntries(entries) as unknown as BackupRows;
  return buildBackup(rows, now.toISOString());
}

/**
 * Restores a backup into the signed-in account, which must be empty (FR-DATA-02, TC-DATA-02).
 * The server does the whole restore in one transaction, so a failure leaves nothing behind.
 */
export async function restoreBackup(backup: BackupFile): Promise<BackupCounts> {
  const { data, error } = await getSupabase().rpc('restore_backup', { p_payload: backup });
  if (error) {
    // Messages from restore_backup are written for the user, so they pass through.
    if (error.code === '22023' && error.message) throw new DataError(error.message, error.code);
    throw mapDbError(error);
  }
  return data as unknown as BackupCounts;
}
