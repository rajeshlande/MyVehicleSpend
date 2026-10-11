// Real-browser check for browser-side receipt compression (T14 acceptance: ≤ 1 MB, JPEG, max side 2000 px).
// Usage: node scripts/receipt-compress-check.mjs [baseUrl]   (needs the Vite dev server: npx vite --port 5173)
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const MB = 1024 * 1024;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async () => {
  const { compressImage } = await import('/src/data/receiptImage.ts');

  // Build a noisy photo-like image so the JPEG encoder cannot shrink it much.
  async function makePhoto(w, h, type) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255;
      img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, type, 1));
    return new File([blob], 'photo', { type });
  }

  const dims = async (blob) => {
    const b = await createImageBitmap(blob);
    const d = { w: b.width, h: b.height };
    b.close();
    return d;
  };

  const out = {};
  // A 12-megapixel-class camera photo (4000 × 3000).
  const big = await makePhoto(4000, 3000, 'image/jpeg');
  const bigOut = await compressImage(big);
  out.big = {
    inBytes: big.size,
    outBytes: bigOut.size,
    outType: bigOut.type,
    outDims: await dims(bigOut),
  };

  // A small photo must keep its size and still be JPEG.
  const small = await makePhoto(800, 600, 'image/png');
  const smallOut = await compressImage(small);
  out.small = {
    inBytes: small.size,
    outBytes: smallOut.size,
    outType: smallOut.type,
    outDims: await dims(smallOut),
  };
  return out;
});

await browser.close();

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${detail}`);
};

const b = result.big;
check(
  'large photo ≤ 1 MB',
  b.outBytes <= MB,
  `(${(b.inBytes / MB).toFixed(1)} MB in → ${(b.outBytes / MB).toFixed(2)} MB out)`
);
check('large photo is JPEG', b.outType === 'image/jpeg', `(${b.outType})`);
check(
  'large photo max side ≤ 2000 px',
  Math.max(b.outDims.w, b.outDims.h) <= 2000,
  `(${b.outDims.w}×${b.outDims.h})`
);
const s = result.small;
check('small photo ≤ 1 MB', s.outBytes <= MB, `(${(s.outBytes / 1024).toFixed(0)} KB)`);
check(
  'small photo keeps dimensions',
  s.outDims.w === 800 && s.outDims.h === 600,
  `(${s.outDims.w}×${s.outDims.h})`
);
console.log(`\n${failures === 0 ? 'All checks passed' : failures + ' check(s) failed'}`);
process.exitCode = failures === 0 ? 0 : 1;
