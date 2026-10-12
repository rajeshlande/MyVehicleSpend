import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  closeLoan,
  getLoan,
  listLoanPayments,
  type Loan,
  type LoanPayment,
} from '../../data/loans';
import { loanSummary, type ScheduleRow } from '../../core/loans/emi';
import { formatINR } from '../../core/money/money';
import { formatDMY, todayIST } from '../../core/dates/dates';
import { EmptyState } from '../placeholders/Screens';

/** One loan: summary, the full schedule and close loan (FR-LOAN-03, FR-LOAN-08, FR-LOAN-11). */
export function LoanDetailPage() {
  const { loanId = '' } = useParams();
  const [loan, setLoan] = useState<Loan | null | undefined>(undefined);
  const [rows, setRows] = useState<LoanPayment[]>([]);
  const [closing, setClosing] = useState(false);
  const [closedOn, setClosedOn] = useState(todayIST());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([getLoan(loanId), listLoanPayments(loanId)])
      .then(([l, p]) => {
        if (!live) return;
        setLoan(l);
        setRows(p);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Could not load the loan.');
        setLoan(null);
      });
    return () => {
      live = false;
    };
  }, [loanId]);

  // Summary is based on the rows marked paid, so it stays right once payments are recorded (T19).
  const summary = useMemo(() => {
    const asRows: ScheduleRow[] = rows.map((r) => ({
      no: r.installmentNo,
      interest: r.interestComponent,
      principal: r.principalComponent,
      emi: r.scheduledEmi,
      balance: r.closingBalance,
    }));
    const paidCount = rows.filter((r) => r.status === 'paid').length;
    return asRows.length ? loanSummary(asRows, paidCount) : null;
  }, [rows]);

  if (loan === undefined) return <p role="status">Loading…</p>;
  if (loan === null) {
    return (
      <>
        <h1>Loan</h1>
        <EmptyState title="Loan not found">
          <p>{error ?? 'This loan does not exist or was removed.'}</p>
        </EmptyState>
        <p>
          <Link to="/loans">Back to loans</Link>
        </p>
      </>
    );
  }

  async function confirmClose(current: Loan) {
    try {
      await closeLoan(current.id, closedOn);
      setLoan({ ...current, status: 'closed', closedOn });
      setClosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close the loan.');
    }
  }

  return (
    <>
      <p>
        <Link to="/loans">← Loans</Link>
      </p>
      <h1>
        {loan.lender}
        {loan.accountLast4 ? ` ···${loan.accountLast4}` : ''}
      </h1>
      <p className="muted">
        {loan.status === 'closed'
          ? `Closed on ${formatDMY(loan.closedOn ?? loan.startDate)}`
          : 'Active'}{' '}
        · {formatINR(loan.principal)} · {loan.annualRate}%{' '}
        {loan.interestMethod === 'flat' ? 'flat' : 'reducing'} · {loan.tenureMonths} months · EMI{' '}
        {formatINR(loan.emiAmount)}
      </p>

      {summary && (
        <section aria-label="Loan summary" className="mileage-summary">
          <p>Outstanding {formatINR(summary.outstanding)}</p>
          <p>Interest paid {formatINR(summary.interestPaid)}</p>
          <p>Interest remaining {formatINR(summary.interestRemaining)}</p>
          <p>Months remaining {summary.monthsRemaining}</p>
        </section>
      )}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      {loan.status === 'active' &&
        (closing ? (
          <div className="form-actions">
            <label htmlFor="close-date">Closed on</label>
            <input
              id="close-date"
              type="date"
              value={closedOn}
              max={todayIST()}
              onChange={(e) => setClosedOn(e.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={() => setClosing(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={() => void confirmClose(loan)}>
              Confirm close
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setClosing(true)}>
            Mark loan closed
          </button>
        ))}

      <h2>Schedule</h2>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Repayment schedule</caption>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Due</th>
              <th scope="col">EMI</th>
              <th scope="col">Principal</th>
              <th scope="col">Interest</th>
              <th scope="col">Balance after</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.installmentNo}</td>
                <td>{formatDMY(r.dueDate)}</td>
                <td>{formatINR(r.scheduledEmi)}</td>
                <td>{formatINR(r.principalComponent)}</td>
                <td>{formatINR(r.interestComponent)}</td>
                <td>{formatINR(r.closingBalance)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
