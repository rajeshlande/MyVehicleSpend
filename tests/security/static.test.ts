// T30 — static checks on the code and the deployment headers (SDD §8; Deployment Guide §3.1).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p);
    return ['.ts', '.tsx'].includes(extname(p)) &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx')
      ? [p]
      : [];
  });
}

const APP_SOURCE = files(join(ROOT, 'src'));
const read = (p: string) => readFileSync(p, 'utf8');

describe('code checks (T30)', () => {
  it('no dangerouslySetInnerHTML anywhere in the app', () => {
    const hits = APP_SOURCE.filter((f) => read(f).includes('dangerouslySetInnerHTML'));
    expect(hits).toEqual([]);
  });

  it('the service role key is never referenced by the app', () => {
    const hits = APP_SOURCE.filter((f) => /service_role|SERVICE_ROLE|serviceRole/.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('no logging of tokens, sessions or passwords', () => {
    const offending: string[] = [];
    for (const f of APP_SOURCE) {
      read(f)
        .split('\n')
        .forEach((line, i) => {
          if (
            /console\.(log|info|warn|error|debug)\(/.test(line) &&
            /token|session|password|secret/i.test(line)
          ) {
            offending.push(`${f}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offending).toEqual([]);
  });

  it('the app never writes to innerHTML or eval', () => {
    const hits = APP_SOURCE.filter((f) => /\.innerHTML\s*=|\beval\(|new Function\(/.test(read(f)));
    expect(hits).toEqual([]);
  });
});

describe('deployment headers (Deployment Guide §3.1)', () => {
  const headers = read(join(ROOT, 'public/_headers'));
  const csp = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'))!;

  it('sets the Content-Security-Policy with the required directives', () => {
    for (const d of [
      "default-src 'self'",
      "script-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self'",
    ]) {
      expect(csp).toContain(d);
    }
  });

  it('script-src does not allow unsafe-inline or unsafe-eval', () => {
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
    expect(scriptSrc).not.toMatch(/unsafe-/);
  });

  it('sets HSTS, nosniff, referrer and clickjacking headers', () => {
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(headers).toContain('X-Frame-Options: DENY');
  });

  it('keeps the service worker and manifest uncached', () => {
    expect(headers).toMatch(/\/sw\.js\n\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/manifest\.webmanifest\n\s+Cache-Control: no-cache/);
  });
});
