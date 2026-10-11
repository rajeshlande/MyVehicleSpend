import { useEffect, useState } from 'react';
import { useVehicles } from './VehicleContext';
import { VehicleForm } from './VehicleForm';
import {
  createVehicle,
  deleteVehicle,
  listDeletedVehicles,
  restoreVehicle,
  updateVehicle,
  type Vehicle,
} from '../../data/vehicles';
import { formatRegistration, normalizeRegistration } from '../../core/vehicles/registration';
import type { VehicleInput } from '../../core/vehicles/schema';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; vehicle: Vehicle };

export function VehiclesPage() {
  const { vehicles, activeVehicle, setActiveVehicleId, reload } = useVehicles();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Vehicle[]>([]);
  // Set when a new vehicle uses the number of a deleted one (T9b).
  const [restoreOffer, setRestoreOffer] = useState<Vehicle | null>(null);

  async function loadDeleted() {
    try {
      setDeleted(await listDeletedVehicles());
    } catch {
      setDeleted([]);
    }
  }

  useEffect(() => {
    void loadDeleted();
  }, []);

  async function restore(v: Vehicle) {
    await restoreVehicle(v.id);
    setActiveVehicleId(v.id);
    setRestoreOffer(null);
    setMessage('Vehicle restored.');
    await reload();
    await loadDeleted();
    setMode({ kind: 'list' });
  }

  async function save(input: VehicleInput) {
    if (mode.kind === 'edit') {
      await updateVehicle(mode.vehicle.id, { ...input, isArchived: mode.vehicle.isArchived });
      setMessage('Vehicle updated.');
    } else {
      const reg = normalizeRegistration(input.registrationNo);
      const match =
        deleted.find((d) => d.registrationNo === reg) ??
        (await findDeleted(reg).catch(() => undefined)); // lookup failure must not block a save; the unique index still guards
      if (match) {
        setRestoreOffer(match);
        setMode({ kind: 'list' });
        return;
      }
      const created = await createVehicle(input);
      setActiveVehicleId(created.id);
      setMessage('Vehicle added.');
    }
    await reload();
    setMode({ kind: 'list' });
  }

  async function findDeleted(reg: string): Promise<Vehicle | undefined> {
    const list = await listDeletedVehicles();
    setDeleted(list);
    return list.find((d) => d.registrationNo === reg);
  }

  async function toggleArchive(v: Vehicle) {
    await updateVehicle(v.id, {
      vehicleType: v.vehicleType,
      registrationNo: v.registrationNo,
      make: v.make,
      model: v.model,
      variant: v.variant,
      fuelType: v.fuelType,
      purchaseDate: v.purchaseDate,
      purchasePrice: v.purchasePrice,
      startOdometerKm: v.startOdometerKm,
      isArchived: !v.isArchived,
    });
    await reload();
  }

  if (mode.kind === 'add' || mode.kind === 'edit') {
    return (
      <>
        <h1>{mode.kind === 'edit' ? 'Edit vehicle' : 'Add vehicle'}</h1>
        <VehicleForm
          initial={mode.kind === 'edit' ? mode.vehicle : undefined}
          onSubmit={save}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <h1>Vehicles</h1>
      {message && (
        <p role="status" className="form-ok">
          {message}
        </p>
      )}
      {restoreOffer && (
        <div className="warning-box" role="alert">
          <p>
            {formatRegistration(restoreOffer.registrationNo)} was deleted earlier. Restore that
            vehicle instead of adding a new one?
          </p>
          <button type="button" className="btn-primary" onClick={() => void restore(restoreOffer)}>
            Restore it
          </button>{' '}
          <button type="button" className="btn-secondary" onClick={() => setRestoreOffer(null)}>
            Not now
          </button>
        </div>
      )}
      {vehicles === undefined && <p role="status">Loading vehicles…</p>}
      {vehicles !== undefined && vehicles.length === 0 && (
        <section className="empty-state" aria-labelledby="no-vehicles">
          <h2 id="no-vehicles">Add your car or bike</h2>
          <p>Start with the registration number and today's odometer reading.</p>
          <button type="button" className="btn-primary" onClick={() => setMode({ kind: 'add' })}>
            Add vehicle
          </button>
        </section>
      )}
      {vehicles && vehicles.length > 0 && (
        <>
          <ul className="vehicle-list">
            {vehicles.map((v) => {
              const isActive = activeVehicle?.id === v.id;
              return (
                <li key={v.id} className="vehicle-card">
                  <div>
                    <strong>{formatRegistration(v.registrationNo)}</strong>
                    {v.isArchived && <span className="badge"> Archived</span>}
                    <div className="hint">
                      {[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType} ·{' '}
                      {v.startOdometerKm.toLocaleString('en-IN')} km
                    </div>
                  </div>
                  <div className="vehicle-actions">
                    {isActive ? (
                      <span className="badge badge-active">Active</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setActiveVehicleId(v.id)}
                      >
                        Make active
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setMode({ kind: 'edit', vehicle: v })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void toggleArchive(v)}
                    >
                      {v.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button type="button" className="btn-danger" onClick={() => setDeleteTarget(v)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-primary" onClick={() => setMode({ kind: 'add' })}>
            Add another vehicle
          </button>
        </>
      )}
      {deleted.length > 0 && (
        <section aria-labelledby="deleted-heading" className="deleted-list">
          <h2 id="deleted-heading">Deleted vehicles</h2>
          <ul className="vehicle-list">
            {deleted.map((v) => (
              <li key={v.id} className="vehicle-card">
                <div>
                  <strong>{formatRegistration(v.registrationNo)}</strong>
                  <div className="hint">
                    {[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`Restore ${formatRegistration(v.registrationNo)}`}
                  onClick={() => void restore(v)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {deleteTarget && (
        <DeleteVehicleDialog
          vehicle={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteVehicle(deleteTarget.id);
            setDeleteTarget(null);
            setMessage('Vehicle deleted.');
            await reload();
            await loadDeleted();
          }}
        />
      )}
    </>
  );
}

/** Typed confirmation before deletion (FR-VEH-03). The button stays disabled until "DELETE" is typed. */
export function DeleteVehicleDialog({
  vehicle,
  onConfirm,
  onCancel,
}: {
  vehicle: Vehicle;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = typed === 'DELETE';

  return (
    <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
      <h2 id="delete-title">Delete {formatRegistration(vehicle.registrationNo)}?</h2>
      <p>
        Its expenses, fuel logs, reminders and loans will be hidden from your account. This cannot
        be undone from the app. Type <strong>DELETE</strong> to confirm.
      </p>
      <label>
        Type DELETE
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn-danger"
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete. Try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete vehicle
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
