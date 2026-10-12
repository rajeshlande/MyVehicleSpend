import { useMemo, useState, type FormEvent } from 'react';
import { loanInputSchema, type LoanInput } from '../../core/loans/schema';
import { planLoan, type LoanPlan } from '../../core/loans/plan';
import { formatINR } from '../../core/money/money';
import { todayIST } from '../../core/dates/dates';
import type { Loan } from '../../data/loans';
import { DataError } from '../../data/errors';

type OkPlan = Extract<LoanPlan, { ok: true }>;

interface Props {
  vehicleId: string;
  onSubmit: (input: LoanInput, plan: OkPlan) => Promise<Loan>;
  onSaved: (loan: Loan) => void;
  onCancel: () => void;
}

/** A number typed in a field: '' → undefined, otherwise the number (NaN when it is not a number). */
function num(raw: string): number | undefined {
  const t = raw.trim().replace(/,/g, '');
  if (t === '') return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** Loan form (FR-LOAN-01). Shows the computed EMI as the user types; the user may enter their own EMI. */
export function LoanForm({ vehicleId, onSubmit, onSaved, onCancel }: Props) {
  const [lender, setLender] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const [startDate, setStartDate] = useState(todayIST());
  const [method, setMethod] = useState<'reducing' | 'flat'>('reducing');
  const [overrideEmi, setOverrideEmi] = useState(false);
  const [emiText, setEmiText] = useState('');
  const [processingFee, setProcessingFee] = useState('0');
  const [otherCharges, setOtherCharges] = useState('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const p = num(principal);
  const r = num(rate);
  const n = num(tenure);
  const typedEmi = num(emiText);

  // Computed EMI preview (without any override), so the user sees the figure before choosing to change it.
  const computed = useMemo(() => {
    if (
      !p ||
      p <= 0 ||
      r === undefined ||
      Number.isNaN(r) ||
      !n ||
      n < 1 ||
      n > 360 ||
      !Number.isInteger(n)
    )
      return null;
    const plan = planLoan({ principal: p, annualRatePct: r, months: n, method });
    return plan.ok ? plan : null;
  }, [p, r, n, method]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = loanInputSchema.safeParse({
      vehicleId,
      lender,
      accountLast4: accountLast4.trim() === '' ? undefined : accountLast4.trim(),
      principal: p ?? Number.NaN,
      annualRatePct: r ?? Number.NaN,
      tenureMonths: n ?? Number.NaN,
      startDate,
      interestMethod: method,
      processingFee: num(processingFee) ?? 0,
      otherCharges: num(otherCharges) ?? 0,
    });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (overrideEmi && (typedEmi === undefined || Number.isNaN(typedEmi) || typedEmi <= 0))
      next.emi = 'Enter the EMI amount, for example 16703.92.';
    if (Number.isNaN(num(processingFee) ?? 0))
      next.processingFee = 'Enter the processing fee as a number.';
    if (Number.isNaN(num(otherCharges) ?? 0))
      next.otherCharges = 'Enter the other charges as a number.';

    let plan: LoanPlan | null = null;
    if (parsed.success) {
      plan = planLoan({
        principal: parsed.data.principal,
        annualRatePct: parsed.data.annualRatePct,
        months: parsed.data.tenureMonths,
        method: parsed.data.interestMethod,
        emiOverride: overrideEmi ? typedEmi : undefined,
      });
      if (!plan.ok && !next.emi) next.emi = plan.error;
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success || !plan || !plan.ok) return;

    setSaving(true);
    try {
      onSaved(await onSubmit(parsed.data, plan));
    } catch (err) {
      setErrors({
        form: err instanceof DataError ? err.message : 'Could not save the loan. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="loan-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="loan-form-title"
    >
      <h2 id="loan-form-title">New loan</h2>

      <div className="field">
        <label htmlFor="loan-lender">Lender</label>
        <input id="loan-lender" value={lender} onChange={(e) => setLender(e.target.value)} />
        {errors.lender && (
          <p className="field-error" role="alert">
            {errors.lender}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-account">Loan account, last 4 digits (optional)</label>
        <input
          id="loan-account"
          inputMode="numeric"
          maxLength={4}
          value={accountLast4}
          onChange={(e) => setAccountLast4(e.target.value)}
        />
        {errors.accountLast4 && (
          <p className="field-error" role="alert">
            {errors.accountLast4}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-principal">Loan amount (₹)</label>
        <input
          id="loan-principal"
          inputMode="decimal"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />
        {errors.principal && (
          <p className="field-error" role="alert">
            {errors.principal}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-rate">Annual interest rate (%)</label>
        <input
          id="loan-rate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        {errors.annualRatePct && (
          <p className="field-error" role="alert">
            {errors.annualRatePct}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-tenure">Tenure (months)</label>
        <input
          id="loan-tenure"
          inputMode="numeric"
          value={tenure}
          onChange={(e) => setTenure(e.target.value)}
        />
        {errors.tenureMonths && (
          <p className="field-error" role="alert">
            {errors.tenureMonths}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-start">First EMI date</label>
        <input
          id="loan-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        {errors.startDate && (
          <p className="field-error" role="alert">
            {errors.startDate}
          </p>
        )}
      </div>

      <fieldset className="field">
        <legend>Interest method</legend>
        <label>
          <input
            type="radio"
            name="loan-method"
            checked={method === 'reducing'}
            onChange={() => setMethod('reducing')}
          />{' '}
          Reducing balance
        </label>
        <label>
          <input
            type="radio"
            name="loan-method"
            checked={method === 'flat'}
            onChange={() => setMethod('flat')}
          />{' '}
          Flat rate
        </label>
      </fieldset>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={overrideEmi}
            onChange={(e) => setOverrideEmi(e.target.checked)}
          />{' '}
          Enter my own EMI
        </label>
        {overrideEmi ? (
          <>
            <label htmlFor="loan-emi">EMI (₹)</label>
            <input
              id="loan-emi"
              inputMode="decimal"
              value={emiText}
              onChange={(e) => setEmiText(e.target.value)}
            />
          </>
        ) : (
          <p className="field-hint" role="status">
            {computed
              ? `Computed EMI: ${formatINR(computed.emi)} a month`
              : 'Enter the amount, rate and tenure to see the EMI.'}
          </p>
        )}
        {errors.emi && (
          <p className="field-error" role="alert">
            {errors.emi}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-fee">Processing fee (₹, optional)</label>
        <input
          id="loan-fee"
          inputMode="decimal"
          value={processingFee}
          onChange={(e) => setProcessingFee(e.target.value)}
        />
        {errors.processingFee && (
          <p className="field-error" role="alert">
            {errors.processingFee}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="loan-other">Other charges (₹, optional)</label>
        <input
          id="loan-other"
          inputMode="decimal"
          value={otherCharges}
          onChange={(e) => setOtherCharges(e.target.value)}
        />
        {errors.otherCharges && (
          <p className="field-error" role="alert">
            {errors.otherCharges}
          </p>
        )}
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save loan'}
        </button>
      </div>
    </form>
  );
}
