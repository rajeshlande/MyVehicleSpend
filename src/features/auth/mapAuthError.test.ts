// Sign-in errors must say what to do, not a generic message (SDD §8).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapAuthError } from './AuthContext';

afterEach(() => vi.restoreAllMocks());

describe('mapAuthError', () => {
  it('wrong email or password', () => {
    expect(mapAuthError('Invalid login credentials', 'invalid_credentials')).toBe(
      'Email or password is incorrect.'
    );
  });

  it('account not yet confirmed by email (the case that showed "Something went wrong")', () => {
    expect(mapAuthError('Email not confirmed', 'email_not_confirmed')).toBe(
      'Confirm your email first. Open the link we sent you, then sign in.'
    );
  });

  it('too many attempts, by error code or message', () => {
    expect(mapAuthError('Request rate limit reached', 'over_request_rate_limit')).toMatch(
      /Too many attempts/
    );
    expect(mapAuthError('email rate limit exceeded', undefined)).toMatch(/Too many attempts/);
  });

  it('account already exists', () => {
    expect(mapAuthError('User already registered', 'user_already_exists')).toMatch(
      /already exists/
    );
  });

  it('weak password', () => {
    expect(mapAuthError('Password should be at least 6 characters.', 'weak_password')).toBe(
      'Choose a stronger password.'
    );
  });

  it('no connection', () => {
    expect(mapAuthError('TypeError: Failed to fetch', undefined)).toMatch(
      /Couldn't reach the server/
    );
  });

  it('an unknown error still shows the generic message and logs the raw error for debugging', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mapAuthError('Something odd happened', 'unexpected_failure')).toBe(
      'Something went wrong. Please try again.'
    );
    expect(log).toHaveBeenCalledWith('[auth] unexpected_failure: Something odd happened');
  });
});
