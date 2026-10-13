import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { createExpense, listCategories, type Category } from '../../data/expenses';
import { DataError } from '../../data/errors';
import { expenseInputSchema } from '../../core/expenses/schema';
import { parseMoneyInput, formatINR } from '../../core/money/money';
import { todayIST } from '../../core/dates/dates';
import { EmptyState } from '../placeholders/Screens';

/**
 * Quick add (FR-EXP-09): category, amount, Save. Date is today and payment mode is UPI.
 * Everything else lives in the full form on the Expenses page.
 */
export function QuickAddPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ categoryId?: string; amount?: string; form?: string }>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((e) =>
        setErrors({ form: e instanceof Error ? e.message : 'Could not load categories.' })
      );
  }, []);

  const groups = useMemo(() => [...new Set(categories.map((c) => c.groupName))], [categories]);

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Quick add</h1>
        <EmptyState title="Add a vehicle first">
          <p>Expenses belong to a vehicle. Add your car or bike to start logging.</p>
        </EmptyState>
      </>
    );
  }

  const vehicleId = activeVehicle.id;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(null);
    const amountNum = parseMoneyInput(amount);
    const parsed = expenseInputSchema.safeParse({
      vehicleId,
      categoryId,
      expenseDate: todayIST(),
      amount: amountNum ?? Number.NaN,
      gstAmount: 0,
      paymentMode: 'upi',
    });
    if (!parsed.success) {
      const next: typeof errors = {};
      if (amountNum === null) next.amount = 'Enter an amount in rupees, for example 3000.';
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'categoryId' && !next.categoryId) next.categoryId = issue.message;
        if (key === 'amount' && !next.amount) next.amount = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const created = await createExpense(parsed.data);
      setSaved(
        created.pending
          ? `Saved on this phone · ${formatINR(created.amount)} · will sync when online`
          : `Saved ${formatINR(created.amount)} · ${created.categoryName || 'expense'}`
      );
      setAmount('');
    } catch (err) {
      setErrors({ form: err instanceof DataError ? err.message : 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Quick add</h1>
      <p className="muted">{activeVehicle.registrationNo} · today, UPI</p>
      <form className="quick-add" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="qa-category">Category</label>
          <select
            id="qa-category"
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
          <label htmlFor="qa-amount">Amount (₹)</label>
          <input
            id="qa-amount"
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

        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        {saved && (
          <p className="notice" role="status">
            {saved}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      <p>
        <a href={`${import.meta.env.BASE_URL}expenses`}>
          Add details (date, vendor, GST, odometer)
        </a>
      </p>
    </>
  );
}
