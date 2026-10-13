import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExpenses, type Expense } from '../../data/expenses';
import { listFuelLogs, type FuelLog } from '../../data/fuel';
import { listLoans, listLoanPayments } from '../../data/loans';
import { HomeReminders } from '../reminders/HomeReminders';
import type { VehicleLike } from '../reminders/useReminders';
import { formatDMY, todayIST } from '../../core/dates/dates';
import { formatINR, sumMoney } from '../../core/money/money';
import { positionAfterPayments } from '../../core/loans/payment';
import {
  customRangeError,
  presetRange,
  type DateRange,
  type PeriodPreset,
} from '../../core/reports/period';
import { buildDashboard, type GroupTotal } from '../../core/reports/dashboard';
import { DonutChart, MonthlyBars } from './Charts';
import { PeriodPicker } from '../reports/PeriodPicker';
import { StatCard } from './StatCard';

interface Loaded {
  expenses: Expense[];
  fuel: FuelLog[];
}

interface LoanSummary {
  count: number;
  outstanding: number;
}

const SHORT_MONTH = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${name} ${String(y).slice(2)}`;
};

/** Home dashboard for the active vehicle (FR-RPT-01, FR-RPT-02, TC-RPT-01, TC-RPT-04). */
export function Dashboard({ vehicle }: { vehicle: VehicleLike }) {
  const [today] = useState(() => todayIST());
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [custom, setCustom] = useState<DateRange>({ from: today, to: today });
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loans, setLoans] = useState<LoanSummary | null>(null);
  const [loanError, setLoanError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadError(null);
    Promise.all([listExpenses(vehicle.id), listFuelLogs(vehicle.id)])
      .then(([expenses, fuel]) => {
        if (!cancelled) setData({ expenses, fuel });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : 'Could not load the dashboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  useEffect(() => {
    let cancelled = false;
    setLoans(null);
    setLoanError(false);
    listLoans(vehicle.id)
      .then(async (all) => {
        const active = all.filter((l) => l.status === 'active');
        const outstanding = await Promise.all(
          active.map(async (l) => {
            const rows = await listLoanPayments(l.id);
            return positionAfterPayments(
              l.principal,
              rows.map((p) => ({
                status: p.status,
                principal: p.principalComponent,
                interest: p.interestComponent,
              }))
            ).outstanding;
          })
        );
        if (!cancelled) setLoans({ count: active.length, outstanding: sumMoney(outstanding) });
      })
      .catch(() => {
        if (!cancelled) setLoanError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  const range: DateRange = preset === 'custom' ? custom : presetRange(preset, today);
  const rangeProblem = preset === 'custom' ? customRangeError(custom) : null;

  return (
    <section aria-label="Dashboard" className="dashboard">
      <PeriodPicker
        preset={preset}
        onPreset={setPreset}
        custom={custom}
        onCustom={setCustom}
        problem={rangeProblem}
      />

      {loadError && (
        <p role="alert" className="field-error">
          {loadError}
        </p>
      )}
      {!data && !loadError && <p role="status">Loading…</p>}

      {data && data.expenses.length === 0 && (
        <section className="empty-state" aria-labelledby="dash-empty-title">
          <h2 id="dash-empty-title">No expenses yet</h2>
          <p>Your totals, categories and cost per km appear once you record spend.</p>
          <div className="dashboard-links">
            <Link to="/expenses">Add an expense</Link>
            <Link to="/fuel">Add a fuel fill</Link>
            <Link to="/loans">Add a loan</Link>
            <Link to="/reminders">Add a reminder</Link>
          </div>
        </section>
      )}

      {data && data.expenses.length > 0 && !rangeProblem && (
        <Summary data={data} range={range} today={today} />
      )}

      <div className="dashboard-cards">
        <StatCard
          label="Loan outstanding"
          value={
            loanError ? (
              <span className="field-error">Could not load loans.</span>
            ) : loans === null ? (
              <span className="muted">Loading…</span>
            ) : loans.count === 0 ? (
              <span className="muted">No active loans.</span>
            ) : (
              <strong>{formatINR(loans.outstanding)}</strong>
            )
          }
          note={
            !loanError && loans && loans.count > 0
              ? `across ${loans.count} active ${loans.count === 1 ? 'loan' : 'loans'}`
              : undefined
          }
          tint="tint-amber"
          icon="🏦"
        />
      </div>

      <HomeReminders vehicle={vehicle} />
    </section>
  );
}

function Summary({ data, range, today }: { data: Loaded; range: DateRange; today: string }) {
  const s = buildDashboard({ range, today, expenses: data.expenses, fuelLogs: data.fuel });
  const label = `${formatDMY(range.from)} – ${formatDMY(range.to)}`;
  const maxMonth = Math.max(0, ...s.monthly.map((m) => m.total));

  return (
    <>
      <div className="dashboard-cards">
        <StatCard
          label={`Total spend · ${label}`}
          value={<strong data-testid="dash-total">{formatINR(s.total)}</strong>}
          note={`${s.count} ${s.count === 1 ? 'expense' : 'expenses'}`}
          tint="tint-teal"
          icon="₹"
        />
        <StatCard
          label="Cost per month"
          value={<strong>{formatINR(s.costPerMonth)}</strong>}
          note={`averaged over ${s.monthsCounted} ${s.monthsCounted === 1 ? 'month' : 'months'}`}
          tint="tint-blue"
          icon="📅"
        />
        <StatCard
          label="Cost per km"
          value={
            s.costPerKm.status === 'ok' ? (
              <strong>{formatINR(s.costPerKm.perKm)}/km</strong>
            ) : (
              <span className="muted">{s.costPerKm.message}</span>
            )
          }
          tint="tint-rose"
          icon="⛽"
        />
      </div>

      {s.count === 0 ? (
        <p className="muted">No spend in this period.</p>
      ) : (
        <>
          <CategoryTiles groups={s.byGroup} />
          <div className="dashboard-charts">
            <div className="dashboard-card">
              <h2>By category</h2>
              <DonutChart
                slices={s.byGroup.map((g) => ({ label: g.group, share: g.share, amount: g.total }))}
              />
            </div>
            <div className="dashboard-card">
              <h2>Monthly trend</h2>
              <MonthlyBars
                bars={s.monthly.map((m) => ({
                  label: SHORT_MONTH(m.month),
                  total: m.total,
                  height: maxMonth > 0 ? m.total / maxMonth : 0,
                }))}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

const TILE_TINTS = ['tint-teal', 'tint-blue', 'tint-rose', 'tint-amber'] as const;
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Category tiles with a progress ring for each group's share of the period total. */
export function CategoryTiles({ groups }: { groups: GroupTotal[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="category-tiles" aria-labelledby="category-tiles-title">
      <h2 id="category-tiles-title">Categories</h2>
      <div className="category-grid">
        {groups.map((g, i) => (
          <article key={g.group} className={`category-tile ${TILE_TINTS[i % TILE_TINTS.length]}`}>
            <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <circle cx="24" cy="24" r={RING_RADIUS} className="ring-track" />
              <circle
                cx="24"
                cy="24"
                r={RING_RADIUS}
                className="ring-value"
                strokeDasharray={`${RING_CIRCUMFERENCE * g.share} ${RING_CIRCUMFERENCE}`}
                transform="rotate(-90 24 24)"
              />
              <text x="24" y="28" textAnchor="middle" className="ring-label">
                {Math.round(g.share * 100)}%
              </text>
            </svg>
            <div>
              <strong>{g.group}</strong>
              <div className="category-amount">{formatINR(g.total)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
