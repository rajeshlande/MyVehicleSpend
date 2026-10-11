import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { RequireAuth } from '../features/auth/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { AppShell } from '../components/AppShell';
import { VehicleProvider } from '../features/vehicles/VehicleContext';

vi.mock('../data/vehicles', () => ({ listVehicles: vi.fn().mockResolvedValue([]) }));
import { MorePage, HomePage } from '../features/placeholders/Screens';
import { resetAuthMock } from '../test/supabaseMock';
import { vi } from 'vitest';
const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../data/supabase', () => ({
  getSupabase: () => ({ auth: authMock }),
  isConfigured: () => true,
}));


function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <VehicleProvider>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/more" element={<MorePage />} />
                    </Routes>
                  </AppShell>
                </VehicleProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetAuthMock(authMock, { user: { id: 'u1' } });
  // Real Supabase emits SIGNED_OUT to subscribers; mirror that so the guard sees the change.
  authMock.signOut.mockImplementation(async () => {
    const cb = authMock.onAuthStateChange.mock.calls[0]?.[0] as (e: string, s: null) => void;
    cb('SIGNED_OUT', null);
    return { error: null };
  });
});

describe('TC-UI-01 — navigation', () => {
  it('the mobile bar shows the five destinations with text labels', async () => {
    renderApp('/');
    const bottom = await screen.findByRole('navigation', { name: 'Primary mobile' });
    for (const label of ['Home', 'Expenses', 'Add', 'Loans', 'More']) {
      expect(within(bottom).getByText(label, { exact: false })).toBeInTheDocument();
    }
  });

  it('the Add control has an accessible name in the mobile bar', async () => {
    renderApp('/');
    const bottom = await screen.findByRole('navigation', { name: 'Primary mobile' });
    expect(within(bottom).getByRole('button', { name: 'Add entry' })).toBeInTheDocument();
  });
});

describe('sign out', () => {
  it('calls signOut and returns to login', async () => {
    renderApp('/more');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
