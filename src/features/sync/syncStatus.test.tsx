// T29b UI — the sync status panel: waiting changes, refused changes, and discard (FR-PWA-05).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueWithId, clearOutboxForTests, notifyOutboxChanged } from '../../data/outbox';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'user-a' } } }),
}));
// The replay itself is covered in src/data/sync.test.ts. Here only the panel matters.
vi.mock('../../data/sync', () => ({ startSync: () => () => {} }));

import { SyncStatus } from './SyncStatus';
import { failedItems, replay } from '../../data/outbox';

beforeEach(async () => {
  await clearOutboxForTests();
});

describe('SyncStatus', () => {
  it('shows nothing when nothing is waiting', async () => {
    const { container } = render(<SyncStatus />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says how many changes are waiting to sync', async () => {
    await enqueueWithId({ id: 'a1', userId: 'user-a', op: 'expense.create', payload: {} });
    await enqueueWithId({ id: 'a2', userId: 'user-a', op: 'fuel.create', payload: {} });
    render(<SyncStatus />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 changes are waiting to sync. They will be saved when you are online.'
    );
  });

  it('counts only this user’s changes', async () => {
    await enqueueWithId({ id: 'b1', userId: 'user-b', op: 'expense.create', payload: {} });
    const { container } = render(<SyncStatus />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows changes the server refused, with the reason, and can discard them', async () => {
    await enqueueWithId({ id: 'c1', userId: 'user-a', op: 'expense.create', payload: {} });
    render(<SyncStatus />);
    // Mark it as refused by the server (a non-network failure).
    await replay(
      'user-a',
      async () => {
        const { DataError } = await import('../../data/errors');
        throw new DataError('That vehicle was not found.', 'P0002');
      },
      Date.now()
    );
    expect((await failedItems('user-a')).length).toBe(1);
    notifyOutboxChanged();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 change could not be saved. That vehicle was not found.');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await failedItems('user-a')).toHaveLength(0);
    confirm.mockRestore();
  });
});
