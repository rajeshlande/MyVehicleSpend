// T31 — TC-UI-04: the add-expense flow completes with the keyboard only (Chromium, stubbed backend).
// Usage: node scripts/keyboard-check.mjs <baseUrl>   (base URL serves a build with the stub Supabase URL)
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4176';
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
    id: '11111111-1111-4111-8111-111111111111',
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
  {
    id: '33333333-3333-4333-8333-333333333333',
    group_name: 'Maintenance',
    name: 'Periodic service',
    sort_order: 2,
  },
];
const saved = [];

const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(
  (s) => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)),
  session
);
await ctx.route('https://stub.supabase.co/**', async (route) => {
  const req = route.request();
  const url = req.url();
  const json = (body) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.includes('/rest/v1/vehicles')) return json(vehicle);
  if (url.includes('/rest/v1/expense_categories')) return json(categories);
  if (url.includes('/rest/v1/rpc/add_expense')) {
    const args = JSON.parse(req.postData() ?? '{}');
    saved.push(args);
    return json({ id: args.p_id, amount: String(args.p_amount) });
  }
  if (url.includes('/rest/v1/expenses')) {
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const rows = saved.map((a) => ({
      id: a.p_id,
      vehicle_id: a.p_vehicle_id,
      category_id: a.p_category_id,
      expense_date: a.p_expense_date,
      amount: String(a.p_amount),
      gst_amount: '0',
      payment_mode: a.p_payment_mode,
      vendor: null,
      odometer_km: null,
      notes: null,
      receipt_paths: [],
      source: 'manual',
      expense_categories: { group_name: 'Fuel & Energy', name: 'Petrol' },
    }));
    return json(single ? (rows[rows.length - 1] ?? null) : rows);
  }
  return json([]);
});

const p = await ctx.newPage();
await p.goto(base + '/add', { waitUntil: 'networkidle' });
await p.waitForSelector('#qa-category option[value="22222222-2222-4222-8222-222222222222"]', {
  state: 'attached',
});

const focused = () =>
  p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
const steps = [];

// Walk forward with Tab until the category select has focus.
for (let i = 0; i < 40 && (await focused()) !== 'qa-category'; i++) {
  await p.keyboard.press('Tab');
}
steps.push(['category focused', (await focused()) === 'qa-category']);

// Choose a category with the arrow keys.
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(300);
const chosen = await p.inputValue('#qa-category');
steps.push(['category chosen with arrow keys', chosen === '22222222-2222-4222-8222-222222222222']);

// Next control is the amount.
await p.keyboard.press('Tab');
steps.push(['Tab reaches the amount', (await focused()) === 'qa-amount']);
await p.keyboard.type('2500');

// Tab to the Save button, then Enter.
await p.keyboard.press('Tab');
steps.push([
  'Tab reaches the save button',
  (await focused()) !== 'qa-amount' &&
    (await p.evaluate(() => document.activeElement?.getAttribute('type'))) === 'submit',
]);
await p.keyboard.press('Enter');

await p.waitForTimeout(800);
const message = await p.evaluate(
  () =>
    document.querySelector('.quick-add')?.parentElement?.textContent ?? document.body.textContent
);
steps.push(['saved from the keyboard', saved.length === 1 && saved[0].p_amount === 2500]);
steps.push(['confirmation shown', /Saved\s*₹2,500/.test(message ?? '')]);

for (const [name, ok] of steps) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
await b.close();
process.exitCode = steps.every(([, ok]) => ok) ? 0 : 1;
