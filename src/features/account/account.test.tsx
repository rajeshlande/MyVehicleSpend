// T27 UI — delete account with typed confirmation (FR-DATA-03; TC-DATA-03 UI part).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../data/account', () => ({ deleteAccount: api.deleteAccount }));
vi.mock('../../components/AppShell', () => ({ useSignOut: () => api.signOut }));

import { AccountPage } from './AccountPage';

beforeEach(() => {
  vi.clearAllMocks();
  api.deleteAccount.mockResolvedValue(undefined);
  api.signOut.mockResolvedValue(undefined);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );
}

describe('typed confirmation (FR-DATA-03)', () => {
  it('the delete button stays disabled until DELETE is typed exactly', async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = screen.getByRole('button', { name: 'Delete my account' });
    expect(btn).toBeDisabled();

    const box = screen.getByLabelText('Type DELETE to confirm');
    await user.type(box, 'delete');
    expect(btn).toBeDisabled();

    await user.clear(box);
    await user.type(box, 'DELETE');
    expect(btn).toBeEnabled();
  });

  it('nothing is deleted before the button is pressed', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });
});

describe('deleting (TC-DATA-03)', () => {
  it('deletes the account, then signs out', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(api.deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      api.signOut.mock.invocationCallOrder[0]!
    );
  });

  it('a failure shows the reason and keeps the user signed in', async () => {
    api.deleteAccount.mockRejectedValue(
      new Error('Could not delete your receipt photos. Nothing was deleted. Try again.')
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was deleted');
    expect(api.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
  });

  it('points to the backup page before deleting', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Download a backup first' })).toHaveAttribute(
      'href',
      '/backup'
    );
  });
});
