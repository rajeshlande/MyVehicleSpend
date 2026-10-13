// T31 — axe-core scan of every route, in light and dark mode (TC-UI-03, TC-UI-05).
// Usage: node scripts/a11y-scan.mjs <baseUrl>   (the build must use a Supabase URL that answers with stubs, see docs)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const base = process.argv[2] ?? 'http://127.0.0.1:4176';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const SIGNED_IN = [
  '/',
  '/expenses',
  '/add',
  '/fuel',
  '/loans',
  '/reminders',
  '/reports',
  '/backup',
  '/vehicles',
  '/account',
  '/more',
];
const SIGNED_OUT = ['/login', '/signup'];

const b = await chromium.launch();
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
const vehicle = [
  {
    id: 'v1',
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

const expenses = [1, 2].map((i) => ({
  id: 'e' + i,
  vehicle_id: 'v1',
  category_id: 'c' + i,
  expense_date: '2026-10-0' + i,
  amount: String(1000 * i),
  gst_amount: '0',
  payment_mode: 'upi',
  vendor: 'Pump ' + i,
  odometer_km: 1000 + i,
  notes: null,
  receipt_paths: [],
  source: 'manual',
  expense_categories: {
    group_name: i === 1 ? 'Fuel' : 'Maintenance',
    name: i === 1 ? 'Petrol' : 'Service',
  },
}));

const report = {};
for (const scheme of ['light', 'dark']) {
  for (const signedIn of [true, false]) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, colorScheme: scheme });
    if (signedIn) {
      await ctx.addInitScript(
        (s) => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)),
        session
      );
    }
    await ctx.route('https://stub.supabase.co/**', (route) => {
      const url = route.request().url();
      if (url.includes('/rest/v1/vehicles'))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(vehicle),
        });
      if (url.includes('/rest/v1/expenses'))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(expenses),
        });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const p = await ctx.newPage();
    for (const route of signedIn ? SIGNED_IN : SIGNED_OUT) {
      await p.goto(base + route, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(300);
      await p.addScriptTag({ content: axeSource });
      const result = await p.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
          },
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          target: v.nodes[0]?.target?.join(' ') ?? '',
          summary: (v.nodes[0]?.failureSummary ?? '').split('\n').slice(0, 2).join(' '),
        }));
      });
      report[`${scheme} ${route}`] = result;
    }
    await ctx.close();
  }
}
await b.close();

let critical = 0;
for (const [page, vs] of Object.entries(report)) {
  for (const v of vs) {
    if (v.impact === 'critical') critical += 1;
  }
  if (vs.length) console.log(`\n${page}`);
  for (const v of vs)
    console.log(
      `  [${v.impact}] ${v.id} (${v.nodes} node${v.nodes === 1 ? '' : 's'}): ${v.help} — ${v.target}`
    );
}
console.log(`\nPages scanned: ${Object.keys(report).length}. Critical violations: ${critical}.`);
process.exitCode = critical > 0 ? 1 : 0;
