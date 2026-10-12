import type { DateRange, PeriodPreset } from '../../core/reports/period';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_fy', label: 'This FY (Apr–Mar)' },
  { value: 'last_12', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

/** Period selector shared by the dashboard and reports (FR-RPT-02). */
export function PeriodPicker({
  preset,
  onPreset,
  custom,
  onCustom,
  problem,
}: {
  preset: PeriodPreset;
  onPreset: (p: PeriodPreset) => void;
  custom: DateRange;
  onCustom: (r: DateRange) => void;
  problem: string | null;
}) {
  return (
    <div className="dashboard-period">
      <label>
        Period{' '}
        <select value={preset} onChange={(e) => onPreset(e.target.value as PeriodPreset)}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {preset === 'custom' && (
        <>
          <label>
            From{' '}
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            />
          </label>
          <label>
            To{' '}
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              onChange={(e) => onCustom({ ...custom, to: e.target.value })}
            />
          </label>
        </>
      )}
      {problem && (
        <p role="alert" className="field-error">
          {problem}
        </p>
      )}
    </div>
  );
}
