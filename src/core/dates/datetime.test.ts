import { describe, it, expect } from 'vitest';
import { formatDateTimeIST } from './dates';

describe('formatDateTimeIST (TC-PWA-03 "Last updated")', () => {
  it('shows Indian time, not UTC', () => {
    // 12:34 UTC is 18:04 in India.
    expect(formatDateTimeIST('2026-10-12T12:34:00.000Z')).toBe('12/10/2026, 18:04');
  });
});
