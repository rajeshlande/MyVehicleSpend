import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LoginPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import { RequireAuth } from './RequireAuth';
import { resetAuthMock } from '../../test/supabaseMock';
import { vi } from 'vitest';
const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../data/supabase', () => ({
  getSupabase: () => ({ auth: authMock }),
  isConfigured: () => true,
}));

function renderAt(path: string, protectedHome = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/"
            element={
              protectedHome ? (
                <RequireAuth>
                  <p>Secret home</p>
                </RequireAuth>
              ) : (
                <p>Home</p>
              )
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => resetAuthMock(authMock, null));

describe('TC-AUTH-02 — weak password rejected before any request', () => {
  it('shows the length message and never calls the API', async () => {
    renderAt('/signup');
    await userEvent.type(await screen.findByLabelText(/^Email/), 'tester1@test.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.'
    );
    expect(authMock.signUp).not.toHaveBeenCalled();
  });
});

describe('TC-AUTH-03 — wrong password', () => {
  it('shows the plain message and keeps the user on the login page', async () => {
    authMock.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'alice@test.local');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('TC-AUTH-01 — sign up', () => {
  it('sends email, password and display name in metadata', async () => {
    authMock.signUp.mockResolvedValue({ data: { session: null }, error: null });
    renderAt('/signup');
    await userEvent.type(await screen.findByLabelText(/^Name/), 'Ravi');
    await userEvent.type(screen.getByLabelText(/^Email/), 'ravi@test.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'Test@1234');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(authMock.signUp).toHaveBeenCalledTimes(1));
    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'ravi@test.local',
      password: 'Test@1234',
      options: { data: { display_name: 'Ravi' } },
    });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('reports an already-registered email in plain words', async () => {
    authMock.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } });
    renderAt('/signup');
    await userEvent.type(await screen.findByLabelText(/^Email/), 'dup@test.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'Test@1234');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});

describe('TC-AUTH-04/02 — session guard', () => {
  it('redirects signed-out users from a protected page to login', async () => {
    renderAt('/', true);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Secret home')).not.toBeInTheDocument();
  });

  it('shows a protected page when a session already exists (persisted session)', async () => {
    resetAuthMock(authMock, { user: { id: 'u1' } });
    renderAt('/', true);
    expect(await screen.findByText('Secret home')).toBeInTheDocument();
  });
});
