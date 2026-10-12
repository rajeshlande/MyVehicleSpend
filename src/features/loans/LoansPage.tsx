import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVehicles } from '../vehicles/VehicleContext';
import { createLoan, listLoans, type Loan } from '../../data/loans';
import { formatINR } from '../../core/money/money';
import { formatDMY } from '../../core/dates/dates';
import type { LoanInput } from '../../core/loans/schema';
import type { LoanPlan } from '../../core/loans/plan';
import { scheduleWithDates } from '../../core/loans/plan';
import { EmptyState } from '../placeholders/Screens';
import { LoanForm } from './LoanForm';

type Filter = 'active' | 'closed';

/** Loans for the active vehicle, with the Active / Closed filter (FR-LOAN-11). Add loan opens the form. */
export function LoansPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [loans, setLoans] = useState<Loan[] | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = activeVehicle?.id;
  useEffect(() => {
    if (!vehicleId) return;
    setLoans(undefined);
    listLoans(vehicleId)
      .then(setLoans)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load loans.');
        setLoans([]);
      });
  }, [vehicleId]);

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Loans</h1>
        <EmptyState title="Add a vehicle first">
          <p>Loans belong to a vehicle. Add your car or bike to start.</p>
        </EmptyState>
      </>
    );
  }

  if (adding) {
    return (
      <LoanForm
        vehicleId={activeVehicle.id}
        onSubmit={(input: LoanInput, plan: Extract<LoanPlan, { ok: true }>) =>
          createLoan(input, {
            emi: plan.emi,
            tenureMonths: plan.tenureMonths,
            rows: scheduleWithDates(input.startDate, plan.rows),
          })
        }
        onSaved={(saved) => {
          setLoans((prev) => [saved, ...(prev ?? [])]);
          setNotice('Loan saved with its full schedule.');
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  const shown = (loans ?? []).filter((l) =>
    filter === 'active' ? l.status === 'active' : l.status === 'closed'
  );

  return (
    <>
      <div className="page-head">
        <h1>Loans</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          Add loan
        </button>
      </div>
      <p className="muted">{activeVehicle.registrationNo}</p>

      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div role="group" aria-label="Show loans" className="filter-tabs">
        <button
          type="button"
          aria-pressed={filter === 'active'}
          onClick={() => setFilter('active')}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={filter === 'closed'}
          onClick={() => setFilter('closed')}
        >
          Closed
        </button>
      </div>

      {loans === undefined ? (
        <p role="status">Loading…</p>
      ) : shown.length === 0 ? (
        <EmptyState title={filter === 'active' ? 'No active loans' : 'No closed loans'}>
          <p>
            {filter === 'active'
              ? 'Add a vehicle loan to see its EMI schedule.'
              : 'Closed loans appear here.'}
          </p>
        </EmptyState>
      ) : (
        <ul
          className="expense-list"
          aria-label={`${filter === 'active' ? 'Active' : 'Closed'} loans`}
        >
          {shown.map((l) => (
            <li key={l.id} className="expense-row">
              <Link to={`/loans/${l.id}`}>
                <strong>{l.lender}</strong>
                {l.accountLast4 ? ` ···${l.accountLast4}` : ''}
              </Link>
              <div className="muted">
                {formatINR(l.principal)} · {l.annualRate}% · {l.tenureMonths} months · EMI{' '}
                {formatINR(l.emiAmount)} · from {formatDMY(l.startDate)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
