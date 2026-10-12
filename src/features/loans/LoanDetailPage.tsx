import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  closeLoan,
  getLoan,
  listLoanPayments,
  recordLoanPayment,
  type Loan,
  type LoanPayment,
} from '../../data/loans';
import { listCategories, type Category } from '../../data/expenses';
import { DataError } from '../../data/errors';
import { formatINR, parseMoneyInput } from '../../core/money/money';
import { formatDMY, todayIST } from '../../core/dates/dates';
import { PAYMENT_MODES, type PaymentMode } from '../../core/expenses/schema';
import {
  displayStatus,
  paymentInputSchema,
  paymentTotal,
  positionAfterPayments,
  type DisplayStatus,
} from '../../core/loans/payment';
import { EmptyState } from '../placeholders/Screens';

const STATUS_LABEL: Record<DisplayStatus, string> = {
  paid: 'Paid',
  late: 'Late',
  pending: 'Pending',
  waived: 'Waived',
};

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  fastag: 'FASTag',
  emi: 'EMI',
  other: 'Other',
};

/** One loan: summary, the full schedule, record an EMI payment, and close loan (FR-LOAN-03..05, 08, 11). */
export function LoanDetailPage() {
  const { loanId = '' } = useParams();
  const [loan, setLoan] = useState<Loan | null | undefined>(undefined);
  const [rows, setRows] = useState<LoanPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [closing, setClosing] = useState(false);
  const [closedOn, setClosedOn] = useState(todayIST());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Record-payment form state. `payingId` is the instalment being recorded, or null.
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(todayIST());
  const [lateFee, setLateFee] = useState('0');
  const [bounceCharge, setBounceCharge] = useState('0');
  const [paymentMode, setPaymentMode] = useState<string>('upi');
  const [notes, setNotes] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getLoan(loanId), listLoanPayments(loanId), listCategories()])
      .then(([l, p, c]) => {
        if (!live) return;
        setLoan(l);
        setRows(p);
        setCategories(c);
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

  const today = todayIST();

  // Summary from the rows marked paid, correct whatever order payments were made in (FR-LOAN-08).
  const summary = useMemo(() => {
    if (!loan || rows.length === 0) return null;
    return positionAfterPayments(
      loan.principal,
      rows.map((r) => ({
        status: r.status,
        principal: r.principalComponent,
        interest: r.interestComponent,
      }))
    );
  }, [loan, rows]);

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
  const current = loan;

  async function confirmClose() {
    try {
      await closeLoan(current.id, closedOn);
      setLoan({ ...current, status: 'closed', closedOn });
      setClosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close the loan.');
    }
  }

  function startPaying(r: LoanPayment) {
    setPayingId(r.id);
    setPaidOn(todayIST());
    setLateFee('0');
    setBounceCharge('0');
    setPaymentMode('upi');
    setNotes('');
    setPayErrors({});
    setError(null);
    setNotice(null);
  }

  async function handleRecord(e: FormEvent) {
    e.preventDefault();
    const payment = rows.find((r) => r.id === payingId);
    if (!payment) return;

    const late = parseMoneyInput(lateFee);
    const bounce = parseMoneyInput(bounceCharge);
    const parsed = paymentInputSchema.safeParse({
      paidOn,
      lateFee: late ?? Number.NaN,
      bounceCharge: bounce ?? Number.NaN,
      paymentMode: paymentMode || undefined,
      notes,
    });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
    }
    const expense = categories.find(
      (c) => c.groupName === 'Loan & Finance' && c.name === 'EMI payment'
    );
    if (!expense) next.form = 'The EMI payment category is missing. Check the expense categories.';
    setPayErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success || !expense) return;

    setSaving(true);
    try {
      const saved = await recordLoanPayment(payment.id, expense.id, parsed.data);
      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setPayingId(null);
      setNotice(
        `Instalment ${payment.installmentNo} recorded: ${formatINR(paymentTotal({ scheduledEmi: payment.scheduledEmi, lateFee: parsed.data.lateFee, bounceCharge: parsed.data.bounceCharge }))} added to expenses.`
      );
    } catch (err) {
      setPayErrors({
        form: err instanceof DataError ? err.message : 'Could not record the payment. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  const paying = rows.find((r) => r.id === payingId);

  return (
    <>
      <p>
        <Link to="/loans">← Loans</Link>
      </p>
      <h1>
        {current.lender}
        {current.accountLast4 ? ` ···${current.accountLast4}` : ''}
      </h1>
      <p className="muted">
        {current.status === 'closed'
          ? `Closed on ${formatDMY(current.closedOn ?? current.startDate)}`
          : 'Active'}{' '}
        · {formatINR(current.principal)} · {current.annualRate}%{' '}
        {current.interestMethod === 'flat' ? 'flat' : 'reducing'} · {current.tenureMonths} months ·
        EMI {formatINR(current.emiAmount)}
      </p>

      {summary && (
        <section aria-label="Loan summary" className="mileage-summary">
          <p>Outstanding {formatINR(summary.outstanding)}</p>
          <p>Interest paid {formatINR(summary.interestPaid)}</p>
          <p>Interest remaining {formatINR(summary.interestRemaining)}</p>
          <p>Months remaining {summary.monthsRemaining}</p>
        </section>
      )}

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

      {current.status === 'active' &&
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
            <button type="button" className="btn-primary" onClick={() => void confirmClose()}>
              Confirm close
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setClosing(true)}>
            Mark loan closed
          </button>
        ))}

      {paying && (
        <form className="loan-form" onSubmit={handleRecord} noValidate aria-labelledby="pay-title">
          <h2 id="pay-title">Record payment for instalment {paying.installmentNo}</h2>
          <p className="muted">
            EMI {formatINR(paying.scheduledEmi)} due {formatDMY(paying.dueDate)}. Interest in this
            instalment: {formatINR(paying.interestComponent)}.
          </p>

          <div className="field">
            <label htmlFor="pay-date">Paid on</label>
            <input
              id="pay-date"
              type="date"
              value={paidOn}
              max={today}
              onChange={(e) => setPaidOn(e.target.value)}
            />
            {payErrors.paidOn && (
              <p className="field-error" role="alert">
                {payErrors.paidOn}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="pay-late">Late fee (₹)</label>
            <input
              id="pay-late"
              inputMode="decimal"
              value={lateFee}
              onChange={(e) => setLateFee(e.target.value)}
            />
            {payErrors.lateFee && (
              <p className="field-error" role="alert">
                {payErrors.lateFee}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="pay-bounce">Bounce charge (₹)</label>
            <input
              id="pay-bounce"
              inputMode="decimal"
              value={bounceCharge}
              onChange={(e) => setBounceCharge(e.target.value)}
            />
            {payErrors.bounceCharge && (
              <p className="field-error" role="alert">
                {payErrors.bounceCharge}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="pay-mode">Payment mode</label>
            <select
              id="pay-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="">Not recorded</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pay-notes">Notes (optional)</label>
            <input id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {payErrors.notes && (
              <p className="field-error" role="alert">
                {payErrors.notes}
              </p>
            )}
          </div>

          <p className="field-hint" role="status">
            Expense to record:{' '}
            {formatINR(
              paymentTotal({
                scheduledEmi: paying.scheduledEmi,
                lateFee: parseMoneyInput(lateFee) ?? 0,
                bounceCharge: parseMoneyInput(bounceCharge) ?? 0,
              })
            )}{' '}
            under Loan &amp; Finance › EMI payment
          </p>

          {payErrors.form && (
            <p className="field-error" role="alert">
              {payErrors.form}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPayingId(null)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>
      )}

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
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = displayStatus(r, today);
              const canRecord =
                current.status === 'active' && (status === 'pending' || status === 'late');
              return (
                <tr key={r.id}>
                  <td>{r.installmentNo}</td>
                  <td>{formatDMY(r.dueDate)}</td>
                  <td>{formatINR(r.scheduledEmi)}</td>
                  <td>{formatINR(r.principalComponent)}</td>
                  <td>{formatINR(r.interestComponent)}</td>
                  <td>{formatINR(r.closingBalance)}</td>
                  <td>{STATUS_LABEL[status]}</td>
                  <td>
                    {canRecord && (
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Record payment for instalment ${r.installmentNo}`}
                        onClick={() => startPaying(r)}
                      >
                        Record payment
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
