import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App without Supabase settings', () => {
  it('shows a setup message instead of crashing', () => {
    // The auth mock is not imported in this file, so the real config check runs.
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Setup needed' })).toBeInTheDocument();
  });
});
