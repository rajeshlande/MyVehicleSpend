import type { ReactNode } from 'react';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  /** Tint class for the icon tile, e.g. "tint-teal" (see tokens.css). */
  tint?: string;
  /** Decorative icon shown in the tile. Hidden from screen readers. */
  icon?: string;
}

/** Summary card in the Base design: tinted icon tile, label, value and an optional note. */
export function StatCard({ label, value, note, tint = 'tint-blue', icon = '₹' }: StatCardProps) {
  return (
    <div className="dashboard-card stat-card">
      <span className={`stat-icon ${tint}`} aria-hidden="true">
        {icon}
      </span>
      <div className="stat-body">
        <p className="hint">{label}</p>
        <div className="stat-value">{value}</div>
        {note && <div className="muted">{note}</div>}
      </div>
    </div>
  );
}
