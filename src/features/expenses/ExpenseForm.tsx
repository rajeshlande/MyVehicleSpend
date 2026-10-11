import { useState, type FormEvent } from 'react';
import {
  expenseInputSchema,
  PAYMENT_MODES,
  type ExpenseInput,
  type PaymentMode,
} from '../../core/expenses/schema';
import { parseMoneyInput } from '../../core/money/money';
import { checkOdometer } from '../../core/expenses/odometer';
import { todayIST } from '../../core/dates/dates';
import type { Category, Expense } from '../../data/expenses';

interface Props {
  vehicleId: string;
  categories: Category[];
  initial?: Expense;
  /** Highest odometer reading known for the vehicle, excluding the expense being edited. */
  lastKnownOdometer: number;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel: () => void;
}

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  fastag: 'FASTag',
  emi: 'EMI',
  other: 'Other',
};

type FieldErrors = Partial<
  Record<
    | 'categoryId'
    | 'expenseDate'
    | 'amount'
    | 'gstAmount'
    | 'paymentMode'
    | 'odometerKm'
    | 'vendor'
    | 'notes'
    | 'form'
    | 'overrideReason',
    string
  >
>;

/** Add or edit an expense (FR-EXP-01, FR-EXP-07). Validation is shared with the core schema. */
export function ExpenseForm({
  vehicleId,
  categories,
  initial,
  lastKnownOdometer,
  onSubmit,
  onCancel,
}: Props) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? todayIST());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [gst, setGst] = useState(initial?.gstAmount ? String(initial.gstAmount) : '');
  const [paymentMode, setPaymentMode] = useState<string>(initial?.paymentMode ?? 'upi');
  const [vendor, setVendor] = useState(initial?.vendor ?? '');
  const [odometer, setOdometer] = useState(
    initial?.odometerKm !== undefined ? String(initial.odometerKm) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [overrideReason, setOverrideReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const odometerNum = odometer.trim() === '' ? undefined : Number(odometer);
  const odometerCheck = checkOdometer(
    odometerNum !== undefined && Number.isFinite(odometerNum) ? odometerNum : undefined,
    lastKnownOdometer
  );
  const needsOverride = odometerCheck.status === 'lower';

  const groups = [...new Set(categories.map((c) => c.groupName))];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};

    const amountNum = parseMoneyInput(amount);
    if (amountNum === null)
      next.amount = 'Enter an amount in rupees, for example 4850 or 4,850.50.';
    const gstTrim = gst.trim();
    const gstNum = gstTrim === '' ? 0 : parseMoneyInput(gst);
    if (gstNum === null) next.gstAmount = 'Enter GST in rupees, or leave it blank.';

    if (needsOverride && !overrideReason.trim()) {
      next.overrideReason = `This reading is lower than the last known ${lastKnownOdometer.toLocaleString('en-IN')} km. Add a reason to save it.`;
    }

    const odometerKm = odometer.trim() === '' ? undefined : odometerNum;
    const finalNotes =
      needsOverride && overrideReason.trim()
        ? `Odometer override: ${overrideReason.trim()}${notes.trim() ? `\n${notes.trim()}` : ''}`
        : notes;

    const parsed = expenseInputSchema.safeParse({
      vehicleId,
      categoryId,
      expenseDate,
      amount: amountNum ?? Number.NaN,
      gstAmount: gstNum ?? 0,
      paymentMode: paymentMode || undefined,
      vendor,
      odometerKm,
      notes: finalNotes,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="expense-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="expense-form-title"
    >
      <h2 id="expense-form-title">{initial ? 'Edit expense' : 'New expense'}</h2>

      <div className="field">
        <label htmlFor="exp-category">Category</label>
        <select
          id="exp-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-invalid={!!errors.categoryId}
        >
          <option value="">Choose a category</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {categories
                .filter((c) => c.groupName === g)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {errors.categoryId && (
          <p className="field-error" role="alert">
            {errors.categoryId}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="exp-date">Date</label>
        <input
          id="exp-date"
          type="date"
          value={expenseDate}
          max={todayIST()}
          onChange={(e) => setExpenseDate(e.target.value)}
          aria-invalid={!!errors.expenseDate}
        />
        {errors.expenseDate && (
          <p className="field-error" role="alert">
            {errors.expenseDate}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="exp-amount">Amount (₹)</label>
        <input
          id="exp-amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={!!errors.amount}
        />
        {errors.amount && (
          <p className="field-error" role="alert">
            {errors.amount}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="exp-gst">GST included (₹, optional)</label>
        <input
          id="exp-gst"
          inputMode="decimal"
          autoComplete="off"
          value={gst}
          onChange={(e) => setGst(e.target.value)}
          aria-invalid={!!errors.gstAmount}
        />
        {errors.gstAmount && (
          <p className="field-error" role="alert">
            {errors.gstAmount}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="exp-mode">Payment mode</label>
        <select
          id="exp-mode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
          aria-invalid={!!errors.paymentMode}
        >
          <option value="">Choose a payment mode</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
        {errors.paymentMode && (
          <p className="field-error" role="alert">
            {errors.paymentMode}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="exp-vendor">Vendor or shop (optional)</label>
        <input
          id="exp-vendor"
          value={vendor}
          maxLength={120}
          onChange={(e) => setVendor(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="exp-odo">Odometer reading in km (optional)</label>
        <input
          id="exp-odo"
          inputMode="numeric"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          aria-describedby="exp-odo-hint"
          aria-invalid={!!errors.odometerKm}
        />
        <p id="exp-odo-hint" className="field-hint">
          Last known reading: {lastKnownOdometer.toLocaleString('en-IN')} km
        </p>
        {errors.odometerKm && (
          <p className="field-error" role="alert">
            {errors.odometerKm}
          </p>
        )}
      </div>

      {needsOverride && (
        <div className="warning-box" role="alert">
          <p>
            This reading is lower than the last known{' '}
            {odometerCheck.status === 'lower'
              ? odometerCheck.lastKnown.toLocaleString('en-IN')
              : ''}{' '}
            km. Check it, or add a reason to save anyway.
          </p>
          <label htmlFor="exp-override">Reason</label>
          <input
            id="exp-override"
            value={overrideReason}
            maxLength={200}
            onChange={(e) => setOverrideReason(e.target.value)}
            aria-invalid={!!errors.overrideReason}
          />
          {errors.overrideReason && <p className="field-error">{errors.overrideReason}</p>}
        </div>
      )}

      <div className="field">
        <label htmlFor="exp-notes">Notes (optional)</label>
        <textarea
          id="exp-notes"
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : needsOverride ? 'Save anyway' : 'Save expense'}
        </button>
      </div>
    </form>
  );
}
