// T29a UI — the "saved data" notice (FR-PWA-03; TC-PWA-03).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { markCached, clearFreshness } from '../../data/freshness';
import { LastUpdatedNotice } from './LastUpdatedNotice';

beforeEach(() => clearFreshness());

describe('LastUpdatedNotice', () => {
  it('is hidden when everything shown is live', () => {
    const { container } = render(<LastUpdatedNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the last updated time in Indian time when saved data is in use', () => {
    render(<LastUpdatedNotice />);
    act(() => markCached('expenses|v1', '2026-10-12T12:34:00.000Z'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing saved data. Last updated 12/10/2026, 18:04.'
    );
  });

  it('shows the oldest saved time when several reads are saved', () => {
    render(<LastUpdatedNotice />);
    act(() => {
      markCached('expenses|v1', '2026-10-12T12:34:00.000Z');
      markCached('fuel|v1', '2026-10-10T05:00:00.000Z');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Last updated 10/10/2026, 10:30.');
  });
});
