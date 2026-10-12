// Browser checks for TC-UI-02 (tap targets ≥ 44 px) and TC-UI-06 (no horizontal scroll at 320 px).
// Usage: node scripts/browser-checks.mjs [baseUrl]   (default http://localhost:4173)
// Signed-in routes use a fake session in localStorage; data calls fail offline, which is fine for layout checks.
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const STORAGE_KEY = 'sb-127-auth-token';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = 9999999999;
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', aud: 'authenticated', exp, email: 'check@example.in' })}.sig`,
  refresh_token: 'refresh-placeholder',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: exp,
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'check@example.in',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};

const SIGNED_OUT = ['/login', '/signup'];
const SIGNED_IN = ['/', '/expenses', '/add', '/more', '/vehicles', '/fuel', '/loans', '/reminders'];
const VIEWPORTS = [
  { name: '320px', width: 320, height: 640 },
  { name: 'desktop', width: 1280, height: 800 },
];

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  for (const route of [...SIGNED_OUT, ...SIGNED_IN]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    if (SIGNED_IN.includes(route)) {
      await ctx.addInitScript(
        ([k, v]) => localStorage.setItem(k, v),
        [STORAGE_KEY, JSON.stringify(session)]
      );
    }
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const report = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const targets = [
        ...document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"]'),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const visible =
            r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          return visible && !el.hasAttribute('hidden') && el.type !== 'hidden';
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: (
              el.getAttribute('aria-label') ||
              el.textContent ||
              el.getAttribute('name') ||
              el.id ||
              el.tagName
            )
              .trim()
              .slice(0, 40),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((t) => t.w < 44 || t.h < 44);
      return { overflow, small: targets, title: document.querySelector('h1')?.textContent ?? '' };
    });
    results.push({ viewport: vp.name, route, ...report });
    await page.screenshot({
      path: `/tmp/shot-${vp.name}${route.replace(/\//g, '_') || '_home'}.png`,
      fullPage: false,
    });
    await ctx.close();
  }
}
await browser.close();

let failures = 0;
for (const r of results) {
  const bad = r.overflow > 0 || r.small.length > 0;
  if (bad) failures++;
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${r.viewport.padEnd(8)} ${r.route.padEnd(10)} "${r.title}" overflow=${r.overflow}px small-targets=${r.small.length}`
  );
  for (const t of r.small.slice(0, 8)) console.log(`       - ${t.label} (${t.w}×${t.h})`);
}
console.log(`\n${results.length} page checks, ${failures} with issues`);
process.exitCode = 0;
