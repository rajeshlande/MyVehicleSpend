import { describe, it, expect } from 'vitest';
import {
  buildBackup,
  parseBackup,
  backupFileName,
  countRows,
  BACKUP_ARRAYS,
  type BackupRows,
} from './format';

const empty = (): BackupRows =>
  Object.fromEntries(BACKUP_ARRAYS.map((k) => [k, []])) as unknown as BackupRows;

const sample = (): BackupRows => {
  const r = empty();
  r.vehicles = [{ id: 'v1', registration_no: 'MH01AB1234' }];
  r.expenses = [
    { id: 'e1', amount: '1250.50' },
    { id: 'e2', amount: '80' },
  ];
  return r;
};

describe('backup file (FR-DATA-01)', () => {
  it('carries the format, schema version and export time', () => {
    const b = buildBackup(sample(), '2026-10-12T04:30:00.000Z');
    expect(b.format).toBe('my-vehicle-spend-backup');
    expect(b.schemaVersion).toBe(1);
    expect(b.exportedAt).toBe('2026-10-12T04:30:00.000Z');
    expect(b.vehicles).toHaveLength(1);
  });

  it('names the file with the Indian date', () => {
    // 23:30 UTC on 11 Oct is already 12 Oct in India.
    expect(backupFileName('2026-10-11T23:30:00.000Z')).toBe(
      'my-vehicle-spend-backup-2026-10-12.json'
    );
  });

  it('counts rows per table', () => {
    expect(countRows(sample())).toMatchObject({ vehicles: 1, expenses: 2, loans: 0 });
  });
});

describe('parsing a backup (FR-DATA-02)', () => {
  const text = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ ...buildBackup(sample(), '2026-10-12T00:00:00.000Z'), ...over });

  it('accepts a valid file and returns counts', () => {
    const r = parseBackup(text());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.counts.expenses).toBe(2);
  });

  it('rejects text that is not JSON', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'This file is not valid JSON.' });
  });

  it('rejects a JSON file that is not a backup', () => {
    expect(parseBackup('{"hello":1}')).toEqual({
      ok: false,
      error: 'This file is not a My Vehicle Spend backup.',
    });
    expect(parseBackup('[1,2]')).toEqual({
      ok: false,
      error: 'This file is not a My Vehicle Spend backup.',
    });
  });

  it('rejects a newer schema version with a clear message', () => {
    const r = parseBackup(text({ schemaVersion: 2 }));
    expect(r).toEqual({
      ok: false,
      error: 'This backup uses schema version 2. This app restores version 1 only.',
    });
  });

  it('rejects a backup missing one of its tables', () => {
    const b = JSON.parse(text()) as Record<string, unknown>;
    delete b.loanEvents;
    expect(parseBackup(JSON.stringify(b))).toEqual({
      ok: false,
      error: 'The backup is incomplete: "loanEvents" is missing.',
    });
  });

  it('rejects a row with no ID', () => {
    const b = JSON.parse(text()) as { expenses: Record<string, unknown>[] };
    b.expenses = [{ amount: 5 }];
    const r = parseBackup(JSON.stringify(b));
    expect(r).toEqual({
      ok: false,
      error: 'The backup is damaged: a row in "expenses" has no ID.',
    });
  });
});
