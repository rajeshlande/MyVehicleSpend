import { describe, it, expect } from 'vitest';
import html from '../../index.html?raw';

describe('index.html (GitHub Pages compatible)', () => {
  it('resolves the icon against the base path, not the host root', () => {
    expect(html).toContain('href="%BASE_URL%icons/apple-touch-icon.png"');
    expect(html).not.toMatch(/href="\/icons\//);
  });
});
