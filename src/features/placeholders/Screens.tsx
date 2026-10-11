import type { ReactNode } from 'react';
import { useSignOut } from '../../components/AppShell';

/** Shared empty-state block (UI/UX §9). Real content arrives in later phases. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <h2 id="empty-title">{title}</h2>
      {children}
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <h1>Home</h1>
      <EmptyState title="Add your car or bike">
        <p>Vehicles and dashboard arrive in the next phases.</p>
      </EmptyState>
    </>
  );
}

export function ExpensesPage() {
  return (
    <>
      <h1>Expenses</h1>
      <EmptyState title="No expenses yet">
        <p>Log your first petrol fill or expense to see it here.</p>
      </EmptyState>
    </>
  );
}

export function LoansPage() {
  return (
    <>
      <h1>Loans</h1>
      <EmptyState title="No loans yet">
        <p>Add a vehicle loan to see its EMI schedule.</p>
      </EmptyState>
    </>
  );
}

export function AddPage() {
  return (
    <>
      <h1>Add entry</h1>
      <EmptyState title="Quick add is coming soon">
        <p>Expense, fuel, reminder and EMI entry arrive in Phases 3 to 6.</p>
      </EmptyState>
    </>
  );
}

export function MorePage() {
  const signOut = useSignOut();
  return (
    <>
      <h1>More</h1>
      <ul>
        <li>Vehicles (coming in Phase 2)</li>
        <li>Reports (coming in Phase 7)</li>
        <li>Settings (coming in Phase 8)</li>
      </ul>
      <button type="button" className="btn-secondary" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}
