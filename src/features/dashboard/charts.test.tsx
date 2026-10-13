import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DonutChart, PALETTE } from './Charts';

const OLD_DEFAULTS = ['#2f6fed', '#e8833a'];

describe('chart palette (Base design)', () => {
  it('no longer uses the old default blue and orange series colours', () => {
    for (const old of OLD_DEFAULTS) expect(PALETTE).not.toContain(old);
  });

  it('has distinct colours, all as 6-digit hex', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('colours each donut slice from the palette, in order', () => {
    const slices = [
      { label: 'Fuel', share: 0.5, amount: 500 },
      { label: 'Insurance', share: 0.3, amount: 300 },
      { label: 'Service', share: 0.2, amount: 200 },
    ];
    const { container } = render(<DonutChart slices={slices} />);
    const strokes = Array.from(container.querySelectorAll('circle'))
      .map((c) => c.getAttribute('stroke'))
      .filter((s): s is string => s !== null && s !== '#eceef2');
    expect(strokes).toEqual(PALETTE.slice(0, 3));
  });
});
