import { Dashboard } from '../dashboard/Dashboard';
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
      <section className="vehicle-card home-hero" aria-labelledby="active-vehicle">
        <div>
          <p className="hint" id="active-vehicle">
            Active vehicle
          </p>
          <strong className="home-hero-title">
            {formatRegistration(activeVehicle.registrationNo)}
          </strong>
          <div className="hint">
            {[activeVehicle.make, activeVehicle.model].filter(Boolean).join(' ') ||
              activeVehicle.vehicleType}{' '}
            · {activeVehicle.startOdometerKm.toLocaleString('en-IN')} km
          </div>
        </div>
        <div className="home-hero-actions">
          <Link to="/add" className="hero-btn">
            Add entry
          </Link>
          <Link to="/reminders" className="hero-btn hero-btn-ghost">
            Reminders
          </Link>
        </div>
        <Link to="/vehicles" className="home-hero-manage">
          Manage vehicles
        </Link>
      </section>
      <Dashboard vehicle={activeVehicle} />
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
        <li>
          <Link to="/fuel">Fuel log</Link>
        </li>
        <li>
          <Link to="/loans">Loans</Link>
        </li>
        <li>
          <Link to="/reminders">Reminders</Link>
        </li>
        <li>
          <Link to="/reports">Reports</Link>
        </li>
        <li>
          <Link to="/backup">Backup and restore</Link>
        </li>
        <li>
          <Link to="/account">Delete account</Link>
        </li>
        <li>Settings (coming in Phase 8)</li>
      </ul>
      <button type="button" className="btn-secondary" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}
