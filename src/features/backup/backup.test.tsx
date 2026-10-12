// T26 UI — backup download and restore (FR-DATA-01, FR-DATA-02; TC-DATA-01, TC-DATA-02).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { buildBackup, BACKUP_ARRAYS, type BackupRows } from '../../core/backup/format';

const api = vi.hoisted(() => ({
  exportBackup: vi.fn(),
  restoreBackup: vi.fn(),
  downloadText: vi.fn(),
}));
vi.mock('../../data/backup', () => ({
  exportBackup: api.exportBackup,
  restoreBackup: api.restoreBackup,
}));
vi.mock('../reports/download', () => ({ downloadText: api.downloadText }));

import { BackupPage } from './BackupPage';

const EXPORTED_AT = '2026-10-12T04:30:00.000Z';

function rowsWith(
  over: Partial<Record<(typeof BACKUP_ARRAYS)[number], unknown[]>> = {}
): BackupRows {
  const r = Object.fromEntries(BACKUP_ARRAYS.map((k) => [k, []])) as unknown as BackupRows;
  return Object.assign(r, over) as BackupRows;
}

const oneVehicle = () =>
  rowsWith({ vehicles: [{ id: 'v1', registration_no: 'MH01AB1234' }] as never[] });

beforeEach(() => {
  vi.clearAllMocks();
  api.exportBackup.mockResolvedValue(buildBackup(oneVehicle(), EXPORTED_AT));
  api.restoreBackup.mockResolvedValue({ vehicles: 1 });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <BackupPage />
    </MemoryRouter>
  );
}

const fileOf = (obj: unknown) =>
  new File([typeof obj === 'string' ? obj : JSON.stringify(obj)], 'backup.json', {
    type: 'application/json',
  });

describe('download a backup (FR-DATA-01, TC-DATA-01)', () => {
  it('downloads a JSON file with the schema version, named with the Indian date', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(api.downloadText).toHaveBeenCalledTimes(1);
    const [name, content, mime] = api.downloadText.mock.calls[0] as [string, string, string];
    expect(name).toBe('my-vehicle-spend-backup-2026-10-12.json');
    expect(mime).toBe('application/json');
    const parsed = JSON.parse(content) as { schemaVersion: number; vehicles: unknown[] };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.vehicles).toHaveLength(1);
    expect(await screen.findByText('Backup downloaded: 1 vehicles.')).toBeInTheDocument();
  });

  it('shows the error when the backup cannot be made', async () => {
    api.exportBackup.mockRejectedValue(
      new Error("Couldn't reach the server. Check your connection and try again.")
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the server");
    expect(api.downloadText).not.toHaveBeenCalled();
  });
});

describe('restore from a backup (FR-DATA-02, TC-DATA-02)', () => {
  it('shows what the file holds and restores only after the explicit button', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(
      screen.getByLabelText('Backup file'),
      fileOf(buildBackup(oneVehicle(), EXPORTED_AT))
    );
    const preview = await screen.findByLabelText('Backup preview');
    expect(preview).toHaveTextContent('contains 1 vehicles');
    expect(api.restoreBackup).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Restore this backup' }));
    expect(api.restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 1 }));
    expect(await screen.findByText('Restored: 1 vehicles.')).toBeInTheDocument();
  });

  it('cancel leaves nothing restored', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(
      screen.getByLabelText('Backup file'),
      fileOf(buildBackup(oneVehicle(), EXPORTED_AT))
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Backup preview')).not.toBeInTheDocument();
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('an invalid file shows the reason and cannot be restored', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.upload(
      screen.getByLabelText('Backup file'),
      fileOf('{"format":"my-vehicle-spend-backup","schemaVersion":9}')
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This backup uses schema version 9. This app restores version 1 only.'
    );
    expect(screen.queryByRole('button', { name: 'Restore this backup' })).not.toBeInTheDocument();
    expect(api.restoreBackup).not.toHaveBeenCalled();
  });

  it('a non-empty account is refused by the server, with its message', async () => {
    api.restoreBackup.mockRejectedValue(
      new Error('Restore needs an empty account. Your account already has data.')
    );
    const user = userEvent.setup();
    renderPage();
    await user.upload(
      screen.getByLabelText('Backup file'),
      fileOf(buildBackup(oneVehicle(), EXPORTED_AT))
    );
    await user.click(await screen.findByRole('button', { name: 'Restore this backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Restore needs an empty account.');
    expect(api.restoreBackup).toHaveBeenCalledTimes(1);
  });
});
