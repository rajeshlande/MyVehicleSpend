import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App without Supabase settings', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('shows a setup message instead of crashing', () => {
    // The auth mock is not imported in this file, so the real config check runs.
    // Clear the settings explicitly, so a local .env.local does not change the result.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Setup needed' })).toBeInTheDocument();
  });
});
