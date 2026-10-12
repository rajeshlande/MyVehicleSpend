import { formatINR } from '../../core/money/money';

/** Palette for chart slices. Colours cycle when there are more groups than colours. */
const PALETTE = [
  '#2f6fed',
  '#e8833a',
  '#2fa37a',
  '#c44d8b',
  '#7c5cd6',
  '#c9a227',
  '#3aa3c9',
  '#8a8f98',
];

export interface Slice {
  label: string;
  /** Share of the total, 0–1. */
  share: number;
  amount: number;
}

/** Category donut drawn as SVG, with a legend (FR-RPT-01). No external assets. */
export function DonutChart({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) return null;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" width="160" height="160" role="img" aria-label="Spend by category">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eceef2" strokeWidth="6" />
        {slices.map((s, i) => {
          const pct = s.share * 100;
          const seg = (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={25 - acc}
            />
          );
          acc += pct;
          return seg;
        })}
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <span
              className="swatch"
              style={{ background: PALETTE[i % PALETTE.length] }}
              aria-hidden="true"
            />{' '}
            {s.label} · {formatINR(s.amount)} · {Math.round(s.share * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Bar {
  label: string;
  total: number;
  /** Bar height, 0–1 of the largest month. */
  height: number;
}

/** Monthly spend bars. A month with no spend shows an empty bar. */
export function MonthlyBars({ bars }: { bars: Bar[] }) {
  return (
    <ol className="bar-chart" aria-label="Monthly spend">
      {bars.map((b) => (
        <li key={b.label} className="bar-col" title={`${b.label}: ${formatINR(b.total)}`}>
          <div className="bar-track">
            <div className="bar" style={{ height: `${Math.max(0, b.height) * 100}%` }} />
          </div>
          <span className="bar-label">{b.label}</span>
        </li>
      ))}
    </ol>
  );
}
