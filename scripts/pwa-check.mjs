// PWA checks for TC-PWA-01 (installable: manifest + icons), TC-PWA-02 (shell loads offline).
// Usage: node scripts/pwa-check.mjs [baseUrl]   (default http://127.0.0.1:4173, a production build served by `vite preview`)
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // TC-PWA-01: manifest and icons.
  const manifestRes = await page.request.get(`${BASE}/manifest.webmanifest`);
  const manifest = manifestRes.ok() ? await manifestRes.json() : {};
  check('manifest is served', manifestRes.ok());
  const has = (size, maskable) =>
    (manifest.icons ?? []).some((i) => i.sizes === size && (i.purpose === 'maskable') === maskable);
  check('manifest has a 192 icon', has('192x192', false));
  check('manifest has a 512 icon', has('512x512', false));
  check('manifest has a maskable 512 icon', has('512x512', true));
  for (const icon of manifest.icons ?? []) {
    const r = await page.request.get(`${BASE}/${icon.src}`);
    check(`icon ${icon.src} loads`, r.ok(), `${r.status()}`);
  }
  check('display is standalone', manifest.display === 'standalone');

  // TC-PWA-02: register the service worker online, then reload with the network off.
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const registered = await page.evaluate(async () => {
    const timeout = new Promise((r) => setTimeout(() => r(null), 15000));
    return Promise.race([navigator.serviceWorker.ready.then((reg) => reg.scope), timeout]);
  });
  check('service worker registers', typeof registered === 'string', String(registered));
  await page
    .waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .catch(() => {});
  await page.reload({ waitUntil: 'load' });
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  check('service worker controls the page', controlled);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  const headings = await page.locator('h1').allInnerTexts();
  check(
    'app shell renders offline (a page heading is shown)',
    headings.length > 0,
    headings.join(' | ').slice(0, 40)
  );
  const banner = page.getByRole('status').filter({ hasText: 'You are offline.' });
  check('offline notice is shown', (await banner.count()) > 0);
  await context.setOffline(false);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
