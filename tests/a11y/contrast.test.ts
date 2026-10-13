// T31 — TC-UI-03: text contrast ≥ 4.5:1 in light and dark themes (WCAG 2.x AA). Reads the real token and style files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8');

/** Every block that starts with `selector`, so tokens declared in more than one :root block are all read. */
function blocks(text: string, selector: string): string[] {
  const out: string[] = [];
  let at = text.indexOf(selector);
  while (at >= 0) {
    out.push(text.slice(text.indexOf('{', at) + 1, text.indexOf('}', at)));
    at = text.indexOf(selector, at + 1);
  }
  return out;
}

function vars(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!;
  return out;
}

// The dark overrides sit in the prefers-color-scheme media block. Light values come from everything outside it.
const DARK_MEDIA = /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/;
const darkSrc = tokens.match(DARK_MEDIA)?.[0] ?? '';
const light = Object.assign({}, ...blocks(tokens.replace(DARK_MEDIA, ''), ':root {').map(vars));
const dark = { ...light, ...vars(blocks(darkSrc, ':root {')[0] ?? '') };

function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = '#ffffff';

describe('theme colours meet 4.5:1 for body text (TC-UI-03)', () => {
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${name}: text, muted text, primary button, and the warn banner`, () => {
      expect(ratio(t.text!, t.bg!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted!, t.bg!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted!, t.surface!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.text!, t.surface!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t['primary-contrast']!, t.primary!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.bg!, t.warn!)).toBeGreaterThanOrEqual(4.5); // the offline banner
      expect(ratio(t.danger!, t.bg!)).toBeGreaterThanOrEqual(4.5); // error text
    });
  }
});

describe('home hero and category tiles (T31 redesign)', () => {
  it('white text on both hero gradient ends is readable', () => {
    expect(ratio(WHITE, light['hero-from']!)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(WHITE, light['hero-to']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('the "Add entry" button text on white is readable', () => {
    expect(ratio(light['hero-to']!, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  for (const tint of ['teal', 'blue', 'rose', 'amber']) {
    it(`category tile text on the ${tint} tint`, () => {
      const m = css.match(
        new RegExp(
          `\\.tint-${tint} \\{\\s*background: var\\(--tint-${tint}\\);\\s*color: (#[0-9a-fA-F]{6});`
        )
      );
      expect(m, `tint-${tint} rule`).not.toBeNull();
      expect(ratio(m![1]!, light[`tint-${tint}`]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
