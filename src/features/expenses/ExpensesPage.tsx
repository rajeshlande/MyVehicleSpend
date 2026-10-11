import { useEffect, useMemo, useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import {
  createExpense,
  deleteExpense,
  listCategories,
  listExpenses,
  updateExpense,
  type Category,
  type Expense,
} from '../../data/expenses';
import { DataError } from '../../data/errors';
import { lastKnownOdometer } from '../../core/expenses/odometer';
import { formatINR } from '../../core/money/money';
import { formatDMY } from '../../core/dates/dates';
import type { ExpenseInput } from '../../core/expenses/schema';
import { ExpenseForm } from './ExpenseForm';
import { EmptyState } from '../placeholders/Screens';

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; expense: Expense };

/** Expense list for the active vehicle with add, edit and delete (FR-EXP-01, FR-EXP-02, FR-EXP-03). */
export function ExpensesPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[] | undefined>(undefined);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load categories.'));
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    setExpenses(undefined);
    listExpenses(vehicleId)
      .then(setExpenses)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load expenses.');
        setExpenses([]);
      });
  }, [vehicleId]);

  const total = useMemo(() => (expenses ?? []).reduce((s, e) => s + e.amount, 0), [expenses]);

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Expenses</h1>
        <EmptyState title="Add a vehicle first">
          <p>Expenses belong to a vehicle. Add your car or bike to start logging.</p>
        </EmptyState>
      </>
    );
  }

  const editing = view.mode === 'edit' ? view.expense : undefined;
  const readingsExcludingEdit = (expenses ?? [])
    .filter((e) => e.id !== editing?.id)
    .map((e) => e.odometerKm);
  const lastKnown = lastKnownOdometer(activeVehicle.startOdometerKm, readingsExcludingEdit);

  async function save(input: ExpenseInput) {
    if (view.mode === 'edit') {
      const updated = await updateExpense(view.expense.id, input);
      setExpenses((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)));
      setNotice('Expense updated.');
    } else {
      const created = await createExpense(input);
      setExpenses((prev) =>
        [created, ...(prev ?? [])].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate))
      );
      setNotice('Expense saved.');
    }
    setView({ mode: 'list' });
  }

  async function remove(expense: Expense) {
    if (
      !window.confirm(
        `Delete this ${formatINR(expense.amount)} expense? You can't undo this from the app yet.`
      )
    )
      return;
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev?.filter((e) => e.id !== expense.id));
      setNotice('Expense deleted.');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Could not delete the expense.');
    }
  }

  if (view.mode === 'new' || view.mode === 'edit') {
    return (
      <>
        <ExpenseForm
          vehicleId={activeVehicle.id}
          categories={categories}
          initial={editing}
          lastKnownOdometer={lastKnown}
          onSubmit={save}
          onCancel={() => setView({ mode: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <button type="button" className="btn-primary" onClick={() => setView({ mode: 'new' })}>
          Add expense
        </button>
      </div>
      <p className="muted">
        {activeVehicle.registrationNo} · Total shown: {formatINR(total)}
      </p>
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

      {expenses === undefined ? (
        <p role="status">Loading…</p>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet">
          <p>Log your first petrol fill or expense to see it here.</p>
        </EmptyState>
      ) : (
        <ul className="expense-list">
          {expenses.map((e) => (
            <li key={e.id} className="expense-row">
              <div>
                <strong>{e.categoryName}</strong>
                <div className="muted">
                  {formatDMY(e.expenseDate)}
                  {e.vendor ? ` · ${e.vendor}` : ''}
                  {e.paymentMode ? ` · ${e.paymentMode.toUpperCase()}` : ''}
                </div>
              </div>
              <div className="expense-amount">{formatINR(e.amount)}</div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setView({ mode: 'edit', expense: e })}
                  aria-label={`Edit ${e.categoryName} on ${formatDMY(e.expenseDate)}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => remove(e)}
                  aria-label={`Delete ${e.categoryName} on ${formatDMY(e.expenseDate)}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
