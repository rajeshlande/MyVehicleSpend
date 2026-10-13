import { describe, it, expect } from 'vitest';
import { CSP_POLICY, cspMetaTag } from './cspMeta';

describe('CSP for static hosting', () => {
  it('keeps the same source rules as public/_headers', () => {
    expect(CSP_POLICY).toContain("default-src 'self'");
    expect(CSP_POLICY).toContain("script-src 'self'");
    expect(CSP_POLICY).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(CSP_POLICY).toContain("worker-src 'self'");
  });

  it('never allows eval or inline scripts', () => {
    expect(CSP_POLICY).not.toContain("'unsafe-eval'");
    expect(CSP_POLICY).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it('is emitted as a meta tag carrying the policy', () => {
    expect(cspMetaTag()).toBe(
      `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}" />`
    );
  });
});
