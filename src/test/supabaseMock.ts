import { vi, type Mock } from 'vitest';

export interface AuthMock {
  getSession: Mock;
  onAuthStateChange: Mock;
  signInWithPassword: Mock;
  signUp: Mock;
  signOut: Mock;
}

/**
 * Each test file declares its own vi.hoisted auth mock and vi.mock('.../data/supabase').
 * This helper only resets that mock between tests.
 */
export function resetAuthMock(authMock: AuthMock, session: unknown = null) {
  authMock.getSession.mockReset().mockResolvedValue({ data: { session } });
  authMock.onAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  authMock.signInWithPassword.mockReset();
  authMock.signUp.mockReset();
  authMock.signOut.mockReset().mockResolvedValue({ error: null });
}
