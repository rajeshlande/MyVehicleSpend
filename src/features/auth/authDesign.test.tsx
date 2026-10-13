import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LoginPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import { RecoverPage } from './RecoverPage';
import { resetAuthMock } from '../../test/supabaseMock';

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock('../../data/supabase', () => ({
  getSupabase: () => ({ auth: authMock }),
  isConfigured: () => true,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/recover" element={<RecoverPage />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  resetAuthMock(authMock, null);
  authMock.resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
});

describe('Design auth screens — email and password only', () => {
  it('sign-in offers no Google or Facebook sign-in', async () => {
    renderAt('/login');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google|facebook/i })).toBeNull();
  });

  it('sign-in links to password recovery', async () => {
    renderAt('/login');
    const link = await screen.findByRole('link', { name: 'Reset password' });
    expect(link).toHaveAttribute('href', '/recover');
  });

  it('recover sends a reset email and shows the same message for any address', async () => {
    renderAt('/recover');
    await userEvent.type(await screen.findByLabelText('Email'), 'driver@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() =>
      expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith(
        'driver@example.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/login') })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for that email, a reset link is on its way.'
    );
  });

  it('sign-up with a session shows the account-created step before going home', async () => {
    authMock.signUp.mockResolvedValue({
      data: { session: { user: { id: 'u1' } }, user: { id: 'u1' } },
      error: null,
    });
    renderAt('/signup');
    await userEvent.type(await screen.findByLabelText('Email'), 'driver@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'correct-horse-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Account created' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
  });
});
