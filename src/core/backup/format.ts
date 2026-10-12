/**
 * JSON backup file (FR-DATA-01, FR-DATA-02). Pure: no I/O.
 * The row arrays keep the database column names (snake_case), so a backup restores without renaming.
 * Receipt images are not included: only their storage paths are, and the files stay in storage.
 */
import { isoDateIST } from '../dates/dates';

export const BACKUP_FORMAT = 'my-vehicle-spend-backup';
export const BACKUP_SCHEMA_VERSION = 1;
/** Largest backup the app will read, to keep the browser responsive. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export const BACKUP_ARRAYS = [
  'expenseCategories',
  'vehicles',
  'expenses',
  'fuelLogs',
  'loans',
  'loanPayments',
  'loanEvents',
  'reminders',
] as const;

export type BackupArray = (typeof BACKUP_ARRAYS)[number];
export type BackupRow = Record<string, unknown>;
export type BackupRows = Record<BackupArray, BackupRow[]>;
export type BackupCounts = Record<BackupArray, number>;

export interface BackupFile extends BackupRows {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
}

export function buildBackup(rows: BackupRows, exportedAt: string): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    ...rows,
  };
}

/** e.g. my-vehicle-spend-backup-2026-10-12.json, dated in Indian time. */
export function backupFileName(exportedAt: string): string {
  return `my-vehicle-spend-backup-${isoDateIST(new Date(exportedAt))}.json`;
}

export function countRows(rows: BackupRows): BackupCounts {
  return Object.fromEntries(BACKUP_ARRAYS.map((k) => [k, rows[k].length])) as BackupCounts;
}

export type ParseResult =
  { ok: true; backup: BackupFile; counts: BackupCounts } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads and checks a backup file's text. Returns a plain message when it cannot be restored. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a My Vehicle Spend backup.' };
  }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This backup uses schema version ${String(raw.schemaVersion)}. This app restores version ${BACKUP_SCHEMA_VERSION} only.`,
    };
  }
  if (typeof raw.exportedAt !== 'string') {
    return { ok: false, error: 'The backup is missing its export date.' };
  }
  for (const key of BACKUP_ARRAYS) {
    const list = raw[key];
    if (!Array.isArray(list)) {
      return { ok: false, error: `The backup is incomplete: "${key}" is missing.` };
    }
    if (!list.every((r) => isObject(r) && typeof r.id === 'string')) {
      return { ok: false, error: `The backup is damaged: a row in "${key}" has no ID.` };
    }
  }
  const backup = raw as unknown as BackupFile;
  return { ok: true, backup, counts: countRows(backup) };
}
