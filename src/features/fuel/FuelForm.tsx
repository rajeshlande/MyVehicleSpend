import { useMemo, useState, type FormEvent } from 'react';
import { fuelInputSchema, fuelTotal, quantityUnit, type FuelInput } from '../../core/fuel/schema';
import { formatINR } from '../../core/money/money';
import { todayIST } from '../../core/dates/dates';
import { PAYMENT_MODES, type PaymentMode } from '../../core/expenses/schema';
import type { Category } from '../../data/expenses';
import type { FuelLog } from '../../data/fuel';
import { DataError } from '../../data/errors';

interface Props {
  vehicleId: string;
  fuelType: string;
  categories: Category[];
  lastKnownOdometer: number;
  /** The database trigger is the source of truth for the odometer rule (RULE-03); errors come back as DataError. */
  onSubmit: (input: FuelInput) => Promise<FuelLog>;
  onSaved: (log: FuelLog) => void;
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

/** Category used by default for each fuel type (seed names, schema doc §7). */
const DEFAULT_CATEGORY: Record<string, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  lpg: 'LPG',
  ev: 'EV charging (public)',
  hybrid: 'Petrol',
};

const QTY = /^\d+(\.\d{1,3})?$/;
const PRICE = /^\d+(\.\d{1,2})?$/;

/** Fuel log form (FR-FUEL-01, FR-FUEL-04, FR-FUEL-05). Shows the total as the user types. */
export function FuelForm({
  vehicleId,
  fuelType,
  categories,
  lastKnownOdometer,
  onSubmit,
  onSaved,
  onCancel,
}: Props) {
  const unit = quantityUnit(fuelType);
  const fuelCategories = categories.filter((c) => c.groupName === 'Fuel & Energy');
  const defaultCat = fuelCategories.find((c) => c.name === DEFAULT_CATEGORY[fuelType])?.id ?? '';

  const [categoryId, setCategoryId] = useState(defaultCat);
  const [filledOn, setFilledOn] = useState(todayIST());
  const [odometer, setOdometer] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [isFull, setIsFull] = useState(true);
  const [station, setStation] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('upi');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => {
    const q = Number(qty.replace(/,/g, ''));
    const p = Number(price.replace(/,/g, ''));
    return QTY.test(qty) && PRICE.test(price) && q > 0 && p > 0 ? fuelTotal(q, p) : null;
  }, [qty, price]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q =
      qty.trim() === '' ? undefined : QTY.test(qty.trim()) ? Number(qty.trim()) : Number.NaN;
    const p = PRICE.test(price.trim()) ? Number(price.trim()) : Number.NaN;
    const o = odometer.trim() === '' ? Number.NaN : Number(odometer.trim());

    const parsed = fuelInputSchema.safeParse({
      vehicleId,
      categoryId,
      filledOn,
      odometerKm: o,
      fuelType,
      litres: unit === 'litres' ? q : undefined,
      energyKwh: unit === 'kWh' ? q : undefined,
      pricePerUnit: p,
      isFullTank: isFull,
      station,
      paymentMode: paymentMode as PaymentMode,
    });

    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (!categoryId) next.categoryId = 'Choose a fuel category.';
    if (Number.isNaN(o) && odometer.trim() === '') next.odometerKm = 'Enter the odometer reading.';
    if (Number.isNaN(q as number) && qty.trim() !== '')
      next.qty = unit === 'kWh' ? 'Enter kWh as a number.' : 'Enter litres as a number.';
    if (Number.isNaN(p) && price.trim() !== '')
      next.pricePerUnit = 'Enter the price as a number, for example 100.50.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      const saved = await onSubmit(parsed.data);
      onSaved(saved);
    } catch (err) {
      setErrors({
        form: err instanceof DataError ? err.message : 'Could not save the fill. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  const qtyLabel = unit === 'kWh' ? 'Energy (kWh)' : 'Litres';
  const priceLabel = unit === 'kWh' ? 'Price per kWh (₹)' : 'Price per litre (₹)';

  return (
    <form
      className="fuel-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="fuel-form-title"
    >
      <h2 id="fuel-form-title">New fuel fill</h2>

      <div className="field">
        <label htmlFor="fuel-category">Fuel category</label>
        <select
          id="fuel-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Choose a fuel category</option>
          {fuelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="field-error" role="alert">
            {errors.categoryId}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="fuel-date">Date</label>
        <input
          id="fuel-date"
          type="date"
          value={filledOn}
          max={todayIST()}
          onChange={(e) => setFilledOn(e.target.value)}
        />
        {errors.filledOn && (
          <p className="field-error" role="alert">
            {errors.filledOn}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="fuel-odo">Odometer reading (km)</label>
        <input
          id="fuel-odo"
          inputMode="numeric"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          aria-describedby="fuel-odo-hint"
        />
        <p id="fuel-odo-hint" className="field-hint">
          Last known reading: {lastKnownOdometer.toLocaleString('en-IN')} km
        </p>
        {errors.odometerKm && (
          <p className="field-error" role="alert">
            {errors.odometerKm}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="fuel-qty">{qtyLabel}</label>
        <input
          id="fuel-qty"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        {(errors.litres || errors.energyKwh || errors.qty) && (
          <p className="field-error" role="alert">
            {errors.litres ?? errors.energyKwh ?? errors.qty}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="fuel-price">{priceLabel}</label>
        <input
          id="fuel-price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {errors.pricePerUnit && (
          <p className="field-error" role="alert">
            {errors.pricePerUnit}
          </p>
        )}
      </div>

      <p role="status" className="fuel-total">
        Total {total === null ? '—' : formatINR(total)}
      </p>

      <div className="field checkbox-field">
        <input
          id="fuel-full"
          type="checkbox"
          checked={isFull}
          onChange={(e) => setIsFull(e.target.checked)}
        />
        <label htmlFor="fuel-full">Full tank</label>
        <p className="field-hint">Untick for a top-up. Mileage uses only full-tank fills.</p>
      </div>

      <div className="field">
        <label htmlFor="fuel-station">Station (optional)</label>
        <input
          id="fuel-station"
          value={station}
          maxLength={80}
          onChange={(e) => setStation(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="fuel-mode">Payment mode</label>
        <select id="fuel-mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save fuel fill'}
        </button>
      </div>
    </form>
  );
}
