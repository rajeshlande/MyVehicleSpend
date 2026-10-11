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
import { formatINR, parseMoneyInput, sumMoney } from '../../core/money/money';
import { formatDMY } from '../../core/dates/dates';
import {
  applyFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
  type ExpenseFilters,
} from '../../core/expenses/filters';
import { PAYMENT_MODES, type ExpenseInput, type PaymentMode } from '../../core/expenses/schema';
import { ExpenseForm } from './ExpenseForm';
import { EmptyState } from '../placeholders/Screens';

type View =
  | { mode: 'list' }
  | { mode: 'new' }
  | { mode: 'edit'; expense: Expense }
  | { mode: 'duplicate'; expense: Expense };

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  fastag: 'FASTag',
  emi: 'EMI',
  other: 'Other',
};

/** Expense list for the active vehicle: filters, search, add, edit, duplicate, delete (FR-EXP-01..05). */
export function ExpensesPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[] | undefined>(undefined);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = activeVehicle?.id;
  const groups = useMemo(() => [...new Set(categories.map((c) => c.groupName))], [categories]);

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

  const shown = useMemo(() => applyFilters(expenses ?? [], filters), [expenses, filters]);
  const total = useMemo(() => sumMoney(shown.map((e) => e.amount)), [shown]);

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

  function setAmountFilter(which: 'min' | 'max', raw: string) {
    if (which === 'min') setMinText(raw);
    else setMaxText(raw);
    const n = raw.trim() === '' ? undefined : (parseMoneyInput(raw) ?? undefined);
    setFilters((f) => (which === 'min' ? { ...f, minAmount: n } : { ...f, maxAmount: n }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setMinText('');
    setMaxText('');
  }

  if (view.mode === 'new' || view.mode === 'edit' || view.mode === 'duplicate') {
    return (
      <ExpenseForm
        vehicleId={activeVehicle.id}
        categories={categories}
        initial={editing}
        duplicateOf={view.mode === 'duplicate' ? view.expense : undefined}
        lastKnownOdometer={lastKnown}
        onSubmit={save}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  const categoryValue = filters.categoryGroup
    ? `group:${filters.categoryGroup}`
    : filters.categoryId
      ? `cat:${filters.categoryId}`
      : '';

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <button type="button" className="btn-primary" onClick={() => setView({ mode: 'new' })}>
          Add expense
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

      <form
        className="filter-bar"
        aria-label="Filter expenses"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="field">
          <label htmlFor="f-search">Search vendor or notes</label>
          <input
            id="f-search"
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-category">Filter category</label>
          <select
            id="f-category"
            value={categoryValue}
            onChange={(e) => {
              const v = e.target.value;
              setFilters({
                ...filters,
                categoryId: v.startsWith('cat:') ? v.slice(4) : '',
                categoryGroup: v.startsWith('group:') ? v.slice(6) : '',
              });
            }}
          >
            <option value="">All categories</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                <option value={`group:${g}`}>All of {g}</option>
                {categories
                  .filter((c) => c.groupName === g)
                  .map((c) => (
                    <option key={c.id} value={`cat:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-from">From date</label>
          <input
            id="f-from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-to">To date</label>
          <input
            id="f-to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-mode">Filter payment mode</label>
          <select
            id="f-mode"
            value={filters.paymentMode}
            onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
          >
            <option value="">Any mode</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-min">Min amount (₹)</label>
          <input
            id="f-min"
            inputMode="decimal"
            value={minText}
            onChange={(e) => setAmountFilter('min', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="f-max">Max amount (₹)</label>
          <input
            id="f-max"
            inputMode="decimal"
            value={maxText}
            onChange={(e) => setAmountFilter('max', e.target.value)}
          />
        </div>
        {hasActiveFilters(filters) && (
          <button type="button" className="btn-secondary" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </form>

      {expenses === undefined ? (
        <p role="status">Loading…</p>
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet">
          <p>Log your first petrol fill or expense to see it here.</p>
        </EmptyState>
      ) : (
        <>
          <p className="summary" role="status">
            {shown.length} of {expenses.length} shown · Total shown: {formatINR(total)}
          </p>
          {shown.length === 0 ? (
            <p className="muted">No expenses match these filters.</p>
          ) : (
            <ul className="expense-list" aria-label="Expenses">
              {shown.map((e) => (
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
                      onClick={() => setView({ mode: 'duplicate', expense: e })}
                      aria-label={`Duplicate ${e.categoryName} on ${formatDMY(e.expenseDate)}`}
                    >
                      Duplicate
                    </button>
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
      )}
    </>
  );
}
