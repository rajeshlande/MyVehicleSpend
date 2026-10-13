import { useEffect, useMemo, useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { listCategories, type Category } from '../../data/expenses';
import { addFuelLog, listFuelLogs, type FuelLog } from '../../data/fuel';
import { computeMileage, type FuelFill } from '../../core/fuel/mileage';
import { quantityUnit } from '../../core/fuel/schema';
import { formatINR } from '../../core/money/money';
import { formatDMY } from '../../core/dates/dates';
import { EmptyState } from '../placeholders/Screens';
import { FuelForm } from './FuelForm';

/** Fuel history with km/l per fill, summary, and the add form (FR-FUEL-01..05). */
export function FuelPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [logs, setLogs] = useState<FuelLog[] | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = activeVehicle?.id;
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    if (!vehicleId) return;
    setLogs(undefined);
    listFuelLogs(vehicleId)
      .then(setLogs)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load fuel fills.');
        setLogs([]);
      });
  }, [vehicleId]);

  const fuelType = activeVehicle?.fuelType ?? 'petrol';
  const unit = quantityUnit(fuelType);
  const kmUnit = unit === 'kWh' ? 'km/kWh' : 'km/l';

  const mileage = useMemo(() => {
    const fills: FuelFill[] = (logs ?? []).map((l) => ({
      filledOn: l.filledOn,
      odometerKm: l.odometerKm,
      litres: (unit === 'kWh' ? l.energyKwh : l.litres) ?? 0,
      isFull: l.isFullTank,
    }));
    return computeMileage(fills);
  }, [logs, unit]);

  // km/l for the fill that closes each interval, matched by odometer reading.
  const kmplByOdometer = useMemo(
    () => new Map(mileage.intervals.map((i) => [i.toOdometerKm, i.kmpl])),
    [mileage]
  );

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Fuel</h1>
        <EmptyState title="Add a vehicle first">
          <p>Fuel fills belong to a vehicle. Add your car or bike to start logging.</p>
        </EmptyState>
      </>
    );
  }

  const lastKnown = Math.max(
    activeVehicle.startOdometerKm,
    ...(logs ?? []).map((l) => l.odometerKm)
  );

  if (adding) {
    return (
      <FuelForm
        vehicleId={activeVehicle.id}
        fuelType={fuelType}
        categories={categories}
        lastKnownOdometer={lastKnown}
        onSubmit={(input) => addFuelLog({ ...input, categoryId: input.categoryId })}
        onSaved={(saved) => {
          setLogs((prev) => [saved, ...(prev ?? [])]);
          setNotice(
            saved.pending
              ? 'Saved on this phone. It will sync when you are online.'
              : 'Fuel fill saved.'
          );
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Fuel</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          Add fuel fill
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

      {logs === undefined ? (
        <p role="status">Loading…</p>
      ) : mileage.status === 'ok' &&
        mileage.best &&
        mileage.worst &&
        mileage.averageKmpl !== undefined ? (
        <section className="mileage-summary" aria-label="Mileage summary">
          <p>
            Average {mileage.averageKmpl.toFixed(2)} {kmUnit}
          </p>
          <p>
            Best {mileage.best.kmpl.toFixed(2)} {kmUnit} on {formatDMY(mileage.best.endDate)}
          </p>
          <p>
            Worst {mileage.worst.kmpl.toFixed(2)} {kmUnit} on {formatDMY(mileage.worst.endDate)}
          </p>
        </section>
      ) : logs.length > 0 ? (
        <p className="muted">{mileage.message}</p>
      ) : null}

      {logs !== undefined && logs.length === 0 && (
        <EmptyState title="No fuel fills yet">
          <p>Log your first fill to start tracking mileage.</p>
        </EmptyState>
      )}

      {logs && logs.length > 0 && (
        <ul className="expense-list" aria-label="Fuel fills">
          {logs.map((l) => {
            const qty = (unit === 'kWh' ? l.energyKwh : l.litres) ?? 0;
            const kmpl = kmplByOdometer.get(l.odometerKm);
            return (
              <li key={l.id} className="expense-row">
                <div>
                  <strong>
                    {qty} {unit === 'kWh' ? 'kWh' : 'L'} · {l.odometerKm.toLocaleString('en-IN')} km
                  </strong>
                  <div className="muted">
                    {formatDMY(l.filledOn)} · {formatINR(l.pricePerUnit)}/
                    {unit === 'kWh' ? 'kWh' : 'L'}
                    {l.isFullTank ? '' : ' · Top-up'}
                  </div>
                </div>
                <div className="expense-amount">
                  {formatINR(l.totalAmount)}
                  {kmpl !== undefined && (
                    <div className="muted">
                      {kmpl.toFixed(2)} {kmUnit}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
