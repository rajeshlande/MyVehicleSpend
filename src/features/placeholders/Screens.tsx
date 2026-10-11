import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSignOut } from '../../components/AppShell';
import { useVehicles } from '../vehicles/VehicleContext';
import { formatRegistration } from '../../core/vehicles/registration';

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
  const { vehicles, activeVehicle } = useVehicles();
  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Home</h1>
        <EmptyState title="Add your car or bike">
          <p>Start with the registration number and today's odometer reading.</p>
          <Link to="/vehicles" className="btn-primary">
            Add vehicle
          </Link>
        </EmptyState>
      </>
    );
  }
  return (
    <>
      <h1>Home</h1>
      <section className="vehicle-card" aria-labelledby="active-vehicle">
        <div>
          <p className="hint" id="active-vehicle">
            Active vehicle
          </p>
          <strong>{formatRegistration(activeVehicle.registrationNo)}</strong>
          <div className="hint">
            {[activeVehicle.make, activeVehicle.model].filter(Boolean).join(' ') ||
              activeVehicle.vehicleType}{' '}
            · {activeVehicle.startOdometerKm.toLocaleString('en-IN')} km
          </div>
        </div>
        <Link to="/vehicles">Manage vehicles</Link>
      </section>
      <EmptyState title="No expenses yet">
        <p>Logging expenses and fuel arrives in Phases 3 and 4.</p>
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
        <li>
          <Link to="/vehicles">Vehicles</Link>
        </li>
        <li>Reports (coming in Phase 7)</li>
        <li>Settings (coming in Phase 8)</li>
      </ul>
      <button type="button" className="btn-secondary" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}
