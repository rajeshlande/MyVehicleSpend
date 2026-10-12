import { useState } from 'react';
import { exportBackup, restoreBackup } from '../../data/backup';
import { downloadText } from '../reports/download';
import {
  BACKUP_ARRAYS,
  backupFileName,
  countRows,
  MAX_BACKUP_BYTES,
  parseBackup,
  type BackupArray,
  type BackupCounts,
  type BackupFile,
} from '../../core/backup/format';

const LABEL: Record<BackupArray, string> = {
  expenseCategories: 'custom categories',
  vehicles: 'vehicles',
  expenses: 'expenses',
  fuelLogs: 'fuel fills',
  loans: 'loans',
  loanPayments: 'loan instalments',
  loanEvents: 'loan events',
  reminders: 'reminders',
};

/** Reads a file as text. FileReader works on older mobile browsers too. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

function describeCounts(c: BackupCounts): string {
  return BACKUP_ARRAYS.filter((k) => c[k] > 0)
    .map((k) => `${c[k]} ${LABEL[k]}`)
    .join(', ');
}

/** Backup and restore (FR-DATA-01, FR-DATA-02). Restore only works on an empty account. */
export function BackupPage() {
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; fileName: string } | null>(null);

  async function download() {
    setBusy('export');
    setError(null);
    setMessage(null);
    try {
      const backup = await exportBackup();
      downloadText(
        backupFileName(backup.exportedAt),
        JSON.stringify(backup, null, 2),
        'application/json'
      );
      const summary = describeCounts(countRows(backup));
      setMessage(
        summary ? `Backup downloaded: ${summary}.` : 'Backup downloaded. There is no data yet.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the backup.');
    } finally {
      setBusy(null);
    }
  }

  async function chooseFile(file: File | undefined) {
    setPending(null);
    setError(null);
    setMessage(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('This file is too large to be a backup.');
      return;
    }
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setError('Could not read the file.');
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setPending({ backup: parsed.backup, fileName: file.name });
  }

  async function restore() {
    if (!pending) return;
    setBusy('restore');
    setError(null);
    setMessage(null);
    try {
      const counts = await restoreBackup(pending.backup);
      setMessage(`Restored: ${describeCounts(counts) || 'nothing to restore'}.`);
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The restore did not finish. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>Backup and restore</h1>

      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <section aria-labelledby="backup-export" className="report-exports">
        <h2 id="backup-export">Download a backup</h2>
        <p className="muted">
          A JSON file with your vehicles, expenses, fuel logs, loans and reminders. Receipt photos
          are not included. We suggest a backup every week.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void download()}
          disabled={busy !== null}
        >
          {busy === 'export' ? 'Preparing…' : 'Download backup'}
        </button>
      </section>

      <section aria-labelledby="backup-restore" className="report-exports">
        <h2 id="backup-restore">Restore from a backup</h2>
        <p className="muted">
          Restore only works on an empty account. It adds the backup's data with the same IDs. If
          anything fails, nothing is changed.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Backup file"
          disabled={busy !== null}
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
        {pending && (
          <div className="dashboard-card" aria-label="Backup preview">
            <p>
              <strong>{pending.fileName}</strong> contains{' '}
              {describeCounts(countRows(pending.backup)) || 'no data'}.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void restore()}
              disabled={busy !== null}
            >
              {busy === 'restore' ? 'Restoring…' : 'Restore this backup'}
            </button>{' '}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPending(null)}
              disabled={busy !== null}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </>
  );
}
