import { useEffect, useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { listExpenses, type Expense } from '../../data/expenses';
import { listFuelLogs, type FuelLog } from '../../data/fuel';
import { listLoans, listLoanPayments, type Loan } from '../../data/loans';
import { EmptyState } from '../placeholders/Screens';
import { formatDMY, todayIST } from '../../core/dates/dates';
import { formatINR } from '../../core/money/money';
import {
  customRangeError,
  presetRange,
  type DateRange,
  type PeriodPreset,
} from '../../core/reports/period';
import { buildDashboard } from '../../core/reports/dashboard';
import { monthlyCategoryTable } from '../../core/reports/monthly';
import { expensesCsv, fuelCsv, loanScheduleCsv } from '../../core/reports/exports';
import { PeriodPicker } from './PeriodPicker';
import { DonutChart, MonthlyBars } from '../dashboard/Charts';
import { downloadText } from './download';

const SHORT_MONTH = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${name} ${String(y).slice(2)}`;
};

const fileSafe = (s: string) =>
  s
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'loan';

/** Reports for the active vehicle: period summary, monthly category table and CSV exports (FR-RPT-03..05). */
export function ReportsPage() {
  const { activeVehicle, vehicles } = useVehicles();
  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Reports</h1>
        <EmptyState title="Add a vehicle first">
          <p>Reports are for one vehicle. Add your car or bike to start.</p>
        </EmptyState>
      </>
    );
  }
  return (
    <VehicleReports vehicleId={activeVehicle.id} registrationNo={activeVehicle.registrationNo} />
  );
}

interface Loaded {
  expenses: Expense[];
  fuel: FuelLog[];
}

function VehicleReports({
  vehicleId,
  registrationNo,
}: {
  vehicleId: string;
  registrationNo: string;
}) {
  const [today] = useState(() => todayIST());
  const [preset, setPreset] = useState<PeriodPreset>('this_fy');
  const [custom, setCustom] = useState<DateRange>({ from: today, to: today });
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadError(null);
    Promise.all([listExpenses(vehicleId), listFuelLogs(vehicleId)])
      .then(([expenses, fuel]) => {
        if (!cancelled) setData({ expenses, fuel });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load reports.');
      });
    listLoans(vehicleId)
      .then((all) => {
        if (!cancelled) setLoans(all);
      })
      .catch(() => {
        if (!cancelled) setLoans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const range: DateRange = preset === 'custom' ? custom : presetRange(preset, today);
  const rangeProblem = preset === 'custom' ? customRangeError(custom) : null;
  const periodLabel = `${formatDMY(range.from)} – ${formatDMY(range.to)}`;
  const fileStem = `${registrationNo.replace(/\s+/g, '')}_${range.from}_${range.to}`;

  function exportExpenses() {
    if (!data) return;
    setExportError(null);
    downloadText(`expenses_${fileStem}.csv`, expensesCsv(data.expenses, range));
    setMessage('Expenses CSV downloaded.');
  }

  function exportFuel() {
    if (!data) return;
    setExportError(null);
    downloadText(`fuel_${fileStem}.csv`, fuelCsv(data.fuel, range));
    setMessage('Fuel CSV downloaded.');
  }

  async function exportLoan() {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    setExportError(null);
    try {
      const rows = await listLoanPayments(loan.id);
      downloadText(`loan-schedule_${fileSafe(loan.lender)}.csv`, loanScheduleCsv(rows));
      setMessage(`Loan schedule for ${loan.lender} downloaded.`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export the loan schedule.');
    }
  }

  const inPeriodCount = data
    ? data.expenses.filter((e) => e.expenseDate >= range.from && e.expenseDate <= range.to).length
    : 0;
  const fuelInPeriod = data
    ? data.fuel.filter((f) => f.filledOn >= range.from && f.filledOn <= range.to).length
    : 0;

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
      </div>
      <p className="muted">{registrationNo}</p>

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
      {message && !exportError && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {exportError && (
        <p role="alert" className="field-error">
          {exportError}
        </p>
      )}
      {!data && !loadError && <p role="status">Loading…</p>}

      {data && !rangeProblem && (
        <>
          {(() => {
            const s = buildDashboard({
              range,
              today,
              expenses: data.expenses,
              fuelLogs: data.fuel,
            });
            const table = monthlyCategoryTable(data.expenses, range);
            const maxMonth = Math.max(0, ...s.monthly.map((m) => m.total));
            return (
              <>
                <section aria-label="Period summary" className="dashboard-cards">
                  <div className="dashboard-card">
                    <p className="hint">Total spend · {periodLabel}</p>
                    <strong data-testid="report-total">{formatINR(s.total)}</strong>
                    <div className="muted">
                      {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                    </div>
                  </div>
                </section>

                {s.count === 0 ? (
                  <p className="muted">No expenses in this period.</p>
                ) : (
                  <div className="dashboard-charts">
                    <div className="dashboard-card">
                      <h3>Monthly spend</h3>
                      <MonthlyBars
                        bars={s.monthly.map((m) => ({
                          label: SHORT_MONTH(m.month),
                          total: m.total,
                          height: maxMonth > 0 ? m.total / maxMonth : 0,
                        }))}
                      />
                    </div>
                    <div className="dashboard-card">
                      <h3>By category</h3>
                      <DonutChart
                        slices={s.byGroup.map((g) => ({
                          label: g.group,
                          share: g.share,
                          amount: g.total,
                        }))}
                      />
                    </div>
                  </div>
                )}

                {s.byGroup.length > 0 && (
                  <table className="report-table" aria-label="Category totals">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col" className="num">
                          Amount
                        </th>
                        <th scope="col" className="num">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.byGroup.map((g) => (
                        <tr key={g.group}>
                          <th scope="row">{g.group}</th>
                          <td className="num">{formatINR(g.total)}</td>
                          <td className="num">{Math.round(g.share * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {table.groups.length > 0 && (
                  <div className="report-scroll">
                    <table className="report-table" aria-label="Monthly category table">
                      <thead>
                        <tr>
                          <th scope="col">Month</th>
                          {table.groups.map((g) => (
                            <th scope="col" key={g} className="num">
                              {g}
                            </th>
                          ))}
                          <th scope="col" className="num">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((r) => (
                          <tr key={r.month}>
                            <th scope="row">{SHORT_MONTH(r.month)}</th>
                            {table.groups.map((g) => (
                              <td key={g} className="num">
                                {formatINR(r.byGroup[g] ?? 0)}
                              </td>
                            ))}
                            <td className="num">{formatINR(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          {table.groups.map((g) => (
                            <td key={g} className="num">
                              {formatINR(table.totals.byGroup[g] ?? 0)}
                            </td>
                          ))}
                          <td className="num">{formatINR(table.totals.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            );
          })()}

          <section aria-label="CSV exports" className="report-exports">
            <h2>Export CSV</h2>
            <p className="muted">
              Exports follow the period above. Files open in Excel and Google Sheets (UTF-8 with
              BOM).
            </p>
            <div className="report-export-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={exportExpenses}
                disabled={inPeriodCount === 0}
              >
                Export expenses ({inPeriodCount})
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={exportFuel}
                disabled={fuelInPeriod === 0}
              >
                Export fuel log ({fuelInPeriod})
              </button>
            </div>
            <div className="report-export-row">
              <label>
                Loan{' '}
                <select
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  aria-label="Loan for schedule"
                >
                  <option value="">Choose a loan</option>
                  {loans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lender}
                      {l.status === 'closed' ? ' (closed)' : ''}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void exportLoan()}
                disabled={!loanId}
              >
                Export loan schedule
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
