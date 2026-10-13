// T32 — TC-PERF-02: dashboard renders within 1.5 s of the expenses response, with 5,000 expenses.
// Runs at normal speed and with 4x CPU throttling (a rough mid-range phone). Chromium, stubbed backend.
// Usage: node scripts/perf-check.mjs <baseUrl>   (base URL serves a build with the stub Supabase URL)
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4176';
const N = 5000;
const BUDGET_MS = 1500;
const VEH = '11111111-1111-4111-8111-111111111111';
const categories = Array.from({ length: 8 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  group_name: ['Fuel & Energy', 'Maintenance', 'Insurance', 'Tolls'][i % 4],
  name: `Category ${i}`,
  sort_order: i,
}));
const expenses = Array.from({ length: N }, (_, i) => {
  const c = categories[i % categories.length];
  const month = '10';
  const day = String((i % 27) + 1).padStart(2, '0');
  return {
    id: `e${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`,
    vehicle_id: VEH,
    category_id: c.id,
    expense_date: `2026-${month}-${day}`,
    amount: String(100 + (i % 500)),
    gst_amount: '0',
    payment_mode: 'upi',
    vendor: `Vendor ${i % 50}`,
    odometer_km: null,
    notes: null,
    receipt_paths: [],
    source: 'manual',
    expense_categories: { group_name: c.group_name, name: c.name },
  };
});

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

async function run(throttle) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(
    (s) => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)),
    session
  );
  let responseAt = 0;
  await ctx.route('https://stub.supabase.co/**', async (route) => {
    const url = route.request().url();
    const json = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/rest/v1/vehicles')) return json(vehicle);
    if (url.includes('/rest/v1/expense_categories')) return json(categories);
    if (url.includes('/rest/v1/expenses')) {
      responseAt = performance.timeOrigin ? Date.now() : Date.now();
      return json(expenses);
    }
    return json([]);
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="dash-total"]', { timeout: 60000 });
  const renderedAt = Date.now();
  const total = await p.textContent('[data-testid="dash-total"]');
  await ctx.close();
  return { ms: renderedAt - responseAt, total };
}

const results = [];
for (const [label, rate] of [
  ['1x', 1],
  ['4x CPU', 4],
]) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await run(rate));
  const worst = Math.max(...runs.map((r) => r.ms));
  results.push([label, worst, runs.map((r) => r.ms).join(', ')]);
  console.log(
    `${label}: runs ${runs.map((r) => r.ms + ' ms').join(', ')} (worst ${worst} ms, total shown ${runs[0].total})`
  );
}
await b.close();
const ok = results.every(([, worst]) => worst <= BUDGET_MS);
console.log(
  ok ? `PASS  dashboard within ${BUDGET_MS} ms, 5,000 expenses` : `FAIL  over ${BUDGET_MS} ms`
);
process.exitCode = ok ? 0 : 1;
