import { useState, type FormEvent } from 'react';
import {
  vehicleInputSchema,
  FUEL_TYPES,
  VEHICLE_TYPES,
  type VehicleInput,
} from '../../core/vehicles/schema';
import { formatRegistration, normalizeRegistration } from '../../core/vehicles/registration';
import type { Vehicle } from '../../data/vehicles';

interface Props {
  initial?: Vehicle;
  onSubmit: (input: VehicleInput) => Promise<void>;
  onCancel: () => void;
}

const FUEL_LABEL: Record<(typeof FUEL_TYPES)[number], string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  lpg: 'LPG',
  ev: 'Electric (EV)',
  hybrid: 'Hybrid',
};

const TYPE_LABEL: Record<(typeof VEHICLE_TYPES)[number], string> = {
  car: 'Car',
  bike: 'Bike',
  scooter: 'Scooter',
  other: 'Other',
};

/** Add or edit a vehicle (FR-VEH-01, FR-VEH-02). Validation is shared with the core schema. */
export function VehicleForm({ initial, onSubmit, onCancel }: Props) {
  const [vehicleType, setVehicleType] = useState<string>(initial?.vehicleType ?? 'car');
  const [registrationNo, setRegistrationNo] = useState(
    initial ? formatRegistration(initial.registrationNo) : ''
  );
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [variant, setVariant] = useState(initial?.variant ?? '');
  const [fuelType, setFuelType] = useState<string>(initial?.fuelType ?? 'petrol');
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [purchasePrice, setPurchasePrice] = useState(
    initial?.purchasePrice === undefined ? '' : String(initial.purchasePrice)
  );
  const [odometer, setOdometer] = useState(initial ? String(initial.startOdometerKm) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = vehicleInputSchema.safeParse({
      vehicleType,
      registrationNo: normalizeRegistration(registrationNo),
      make,
      model,
      variant,
      fuelType,
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice === '' ? undefined : Number(purchasePrice),
      startOdometerKm: odometer === '' ? Number.NaN : Number(odometer),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} noValidate aria-label={initial ? 'Edit vehicle' : 'Add vehicle'}>
      <label>
        Vehicle type
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Registration number
        <input
          value={registrationNo}
          onChange={(e) => setRegistrationNo(e.target.value)}
          placeholder="e.g. MH 12 AB 1234"
          autoCapitalize="characters"
          required
        />
      </label>
      <label>
        Make <span className="hint">(optional)</span>
        <input
          value={make}
          onChange={(e) => setMake(e.target.value)}
          placeholder="e.g. Maruti Suzuki"
        />
      </label>
      <label>
        Model <span className="hint">(optional)</span>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Swift" />
      </label>
      <label>
        Variant <span className="hint">(optional)</span>
        <input
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          placeholder="e.g. VXi"
        />
      </label>
      <label>
        Fuel type
        <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
          {FUEL_TYPES.map((f) => (
            <option key={f} value={f}>
              {FUEL_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Odometer now (km)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          required
        />
      </label>
      <label>
        Purchase date <span className="hint">(optional)</span>
        <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
      </label>
      <label>
        Purchase price (₹) <span className="hint">(optional)</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
