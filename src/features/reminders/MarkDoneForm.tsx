import { useMemo, useState, type FormEvent } from 'react';
import { markDoneSchema, type MarkDoneInput } from '../../core/reminders/done';
import { defaultCategoryFor } from '../../core/reminders/done';
import { REMINDER_TYPE_LABEL } from '../../core/reminders/schema';
import { PAYMENT_MODES, type PaymentMode } from '../../core/expenses/schema';
import { parseMoneyInput } from '../../core/money/money';
import { todayIST } from '../../core/dates/dates';
import type { Category } from '../../data/expenses';
import type { Reminder } from '../../data/reminders';
import { DataError } from '../../data/errors';

interface Props {
  reminder: Reminder;
  categories: Category[];
  onSubmit: (input: MarkDoneInput) => Promise<unknown>;
  onSaved: () => void;
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

/** Mark a reminder done, optionally recording its expense (FR-REM-03; TC-REM-03). */
export function MarkDoneForm({ reminder, categories, onSubmit, onSaved, onCancel }: Props) {
  const preferred = defaultCategoryFor(reminder.reminderType);
  const defaultCategory = useMemo(
    () =>
      categories.find(
        (c) => preferred && c.groupName === preferred.group && c.name === preferred.name
      )?.id ?? '',
    [categories, preferred]
  );

  const [doneOn, setDoneOn] = useState(todayIST());
  const [recordExpense, setRecordExpense] = useState(false);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [paymentMode, setPaymentMode] = useState<string>('upi');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = amount.trim() === '' ? undefined : parseMoneyInput(amount);
    const parsed = markDoneSchema.safeParse({
      doneOn,
      recordExpense,
      amount: recordExpense ? (parsedAmount ?? undefined) : undefined,
      categoryId: recordExpense && categoryId ? categoryId : undefined,
      paymentMode: recordExpense && paymentMode ? (paymentMode as PaymentMode) : undefined,
      vendor: recordExpense ? vendor : undefined,
      notes: recordExpense ? notes : undefined,
    });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (recordExpense && amount.trim() !== '' && parsedAmount === null)
      next.amount = 'Enter the amount as a number, for example 100.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      onSaved();
    } catch (err) {
      setErrors({
        form:
          err instanceof DataError ? err.message : 'Could not mark the reminder done. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="reminder-form" onSubmit={handleSubmit} noValidate aria-labelledby="done-title">
      <h2 id="done-title">Mark “{reminder.title}” done</h2>
      <p className="muted">{REMINDER_TYPE_LABEL[reminder.reminderType]}</p>

      <div className="field">
        <label htmlFor="done-on">Done on</label>
        <input
          id="done-on"
          type="date"
          value={doneOn}
          max={todayIST()}
          onChange={(e) => setDoneOn(e.target.value)}
        />
        {errors.doneOn && (
          <p className="field-error" role="alert">
            {errors.doneOn}
          </p>
        )}
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={recordExpense}
            onChange={(e) => setRecordExpense(e.target.checked)}
          />{' '}
          Record as expense
        </label>
      </div>

      {recordExpense && (
        <fieldset className="field">
          <legend>Expense</legend>
          <label htmlFor="done-amount">Amount (₹)</label>
          <input
            id="done-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && (
            <p className="field-error" role="alert">
              {errors.amount}
            </p>
          )}

          <label htmlFor="done-category">Expense category</label>
          <select
            id="done-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.groupName} › {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="field-error" role="alert">
              {errors.categoryId}
            </p>
          )}

          <label htmlFor="done-mode">Payment mode</label>
          <select
            id="done-mode"
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

          <label htmlFor="done-vendor">Vendor (optional)</label>
          <input id="done-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />

          <label htmlFor="done-notes">Notes (optional)</label>
          <input id="done-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </fieldset>
      )}

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
          {saving ? 'Saving…' : 'Mark done'}
        </button>
      </div>
    </form>
  );
}
