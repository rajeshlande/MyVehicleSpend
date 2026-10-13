// T33 — local browser checks for STCs that have no automated test: TC-PWA-01, TC-PWA-02, TC-UI-02, TC-UI-06.
// Chromium against the stub-env build (no live backend). Usage: node scripts/stc-local-check.mjs <baseUrl>
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4176';
const results = [];
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ' — ' + detail : ''}`);
};

const exp = Math.floor(Date.now() / 1000) + 86400;
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'user-a', aud: 'authenticated', role: 'authenticated', exp })}.sig`;
const session = {
  access_token: jwt,
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: exp,
  refresh_token: 'r',
  user: {
    id: 'user-a',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'a@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};
const VEH = '11111111-1111-4111-8111-111111111111';
const vehicle = [
  {
    id: VEH,
    user_id: 'user-a',
    vehicle_type: 'car',
    registration_no: 'MH01AB1234',
    make: 'Maruti',
    model: 'Swift',
    fuel_type: 'petrol',
    start_odometer_km: 1000,
    created_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
];
const categories = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    group_name: 'Fuel & Energy',
    name: 'Petrol',
    sort_order: 1,
  },
];

// ---- TC-PWA-01: installable (manifest + icons + meta) ----
{
  const m = JSON.parse(
    readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8')
  );
  const iconsOk =
    m.icons?.some((i) => i.sizes === '192x192') && m.icons?.some((i) => i.sizes === '512x512');
  const iconFiles = (m.icons ?? []).every((i) => {
    try {
      readFileSync(new URL('../dist/' + i.src, import.meta.url));
      return true;
    } catch {
      return false;
    }
  });
  check(
    'TC-PWA-01',
    'manifest has name, standalone display, start_url and 192/512 icons',
    !!(m.name && m.display === 'standalone' && m.start_url && iconsOk && iconFiles)
  );
}

const b = await chromium.launch();

async function signedInContext(viewport) {
  const ctx = await b.newContext({ viewport, serviceWorkers: 'allow' });
  await ctx.addInitScript(
    (s) => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)),
    session
  );
  await ctx.route('https://stub.supabase.co/**', (route) => {
    const url = route.request().url();
    const json = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/rest/v1/vehicles')) return json(vehicle);
    if (url.includes('/rest/v1/expense_categories')) return json(categories);
    if (url.includes('/rest/v1/expenses')) return json([]);
    return json([]);
  });
  return ctx;
}

// ---- TC-PWA-02: app shell loads offline; offline notice shown ----
{
  const ctx = await signedInContext({ width: 390, height: 844 });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="dash-total"], h1', { timeout: 30000 });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload({ waitUntil: 'load' });
  await p
    .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 })
    .catch(() => {});
  const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await p.goto(base + '/expenses', { waitUntil: 'load' }).catch(() => {});
  await p.waitForTimeout(1500);
  const shell = await p.evaluate(
    () => !!document.querySelector('nav[aria-label="Primary mobile"], h1')
  );
  const notice = await p.isVisible('text=You are offline').catch(() => false);
  check(
    'TC-PWA-02',
    'app shell opens offline with the offline notice',
    controlled && shell && notice,
    `sw controlled=${controlled}, shell=${shell}, notice=${notice}`
  );
  await ctx.close();
}

// ---- TC-UI-06: no horizontal scroll at 320 px ----
{
  const ctx = await signedInContext({ width: 320, height: 640 });
  const p = await ctx.newPage();
  const routes = [
    '/',
    '/expenses',
    '/add',
    '/fuel',
    '/loans',
    '/reminders',
    '/reports',
    '/more',
    '/vehicles',
    '/backup',
    '/account',
  ];
  const bad = [];
  for (const r of routes) {
    await p.goto(base + r, { waitUntil: 'load' });
    await p.waitForTimeout(700);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) bad.push(`${r} +${over}px`);
  }
  check(
    'TC-UI-06',
    `no horizontal overflow at 320 px on ${routes.length} routes`,
    bad.length === 0,
    bad.join('; ') || 'all within width'
  );
  await ctx.close();
}

// ---- TC-UI-02: tap targets ≥ 44 px on the signed-in home and expenses pages (390 px) ----
{
  const ctx = await signedInContext({ width: 390, height: 844 });
  const p = await ctx.newPage();
  const small = {};
  let inspected = 0;
  for (const r of ['/', '/expenses']) {
    await p.goto(base + r, { waitUntil: 'load' });
    await p.waitForTimeout(700);
    const list = await p.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return (
            cs.display !== 'none' &&
            cs.visibility !== 'hidden' &&
            el.getClientRects().length > 0 &&
            !el.closest('[hidden]')
          );
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((x) => x.w < 44 || x.h < 44)
    );
    small[r] = list;
    inspected += await p.evaluate(
      () =>
        document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')
          .length
    );
  }
  const total = Object.values(small).reduce((n, l) => n + l.length, 0);
  const sample = Object.entries(small)
    .flatMap(([r, l]) => l.slice(0, 4).map((x) => `${r} ${x.tag} "${x.text}" ${x.w}x${x.h}`))
    .join('; ');
  check(
    'TC-UI-02',
    'interactive controls are at least 44×44 px at 390 px',
    total === 0,
    total ? `${total} small: ${sample}` : `none found in ${inspected} controls`
  );
  await ctx.close();
}

await b.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
