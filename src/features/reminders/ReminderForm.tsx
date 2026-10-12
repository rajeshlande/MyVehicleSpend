import { useState, type FormEvent } from 'react';
import {
  reminderInputSchema,
  REMINDER_TYPES,
  REMINDER_TYPE_LABEL,
  type ReminderInput,
  type ReminderType,
} from '../../core/reminders/schema';
import { parseMoneyInput } from '../../core/money/money';
import type { Reminder } from '../../data/reminders';
import { DataError } from '../../data/errors';

interface Props {
  vehicleId: string;
  initial?: Reminder;
  onSubmit: (input: ReminderInput) => Promise<Reminder>;
  onSaved: (r: Reminder) => void;
  onCancel: () => void;
}

/** Reminder form (FR-REM-01, FR-REM-05). Insurance fields show only for insurance reminders. */
export function ReminderForm({ vehicleId, initial, onSubmit, onSaved, onCancel }: Props) {
  const [type, setType] = useState<ReminderType>(initial?.reminderType ?? 'custom');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [dueKm, setDueKm] = useState(initial?.dueOdometerKm?.toString() ?? '');
  const [lead, setLead] = useState(initial?.leadDays?.toString() ?? '15');
  const [insurer, setInsurer] = useState(initial?.insurer ?? '');
  const [policyNo, setPolicyNo] = useState(initial?.policyNo ?? '');
  const [idv, setIdv] = useState(initial?.idvAmount?.toString() ?? '');
  const [premium, setPremium] = useState(initial?.premiumAmount?.toString() ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isInsurance = type === 'insurance';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const km = dueKm.trim() === '' ? undefined : Number(dueKm.trim());
    const leadNum = lead.trim() === '' ? Number.NaN : Number(lead.trim());
    const idvNum = idv.trim() === '' ? undefined : parseMoneyInput(idv);
    const premNum = premium.trim() === '' ? undefined : parseMoneyInput(premium);

    const parsed = reminderInputSchema.safeParse({
      vehicleId,
      reminderType: type,
      title,
      dueDate: dueDate || undefined,
      dueOdometerKm: km !== undefined && Number.isNaN(km) ? Number.NaN : km,
      leadDays: leadNum,
      insurer: isInsurance ? insurer : undefined,
      policyNo: isInsurance ? policyNo : undefined,
      idvAmount: isInsurance ? (idvNum ?? undefined) : undefined,
      premiumAmount: isInsurance ? (premNum ?? undefined) : undefined,
      notes,
    });

    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (dueKm.trim() !== '' && km !== undefined && Number.isNaN(km))
      next.dueOdometerKm = 'Enter the odometer reading as a number.';
    if (isInsurance && idv.trim() !== '' && idvNum === null)
      next.idvAmount = 'Enter the IDV as a number, for example 520000.';
    if (isInsurance && premium.trim() !== '' && premNum === null)
      next.premiumAmount = 'Enter the premium as a number, for example 18000.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      onSaved(await onSubmit(parsed.data));
    } catch (err) {
      setErrors({
        form: err instanceof DataError ? err.message : 'Could not save the reminder. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="reminder-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="reminder-form-title"
    >
      <h2 id="reminder-form-title">{initial ? 'Edit reminder' : 'New reminder'}</h2>

      <div className="field">
        <label htmlFor="rem-type">Reminder type</label>
        <select
          id="rem-type"
          value={type}
          onChange={(e) => setType(e.target.value as ReminderType)}
        >
          {REMINDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {REMINDER_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rem-title">Title</label>
        <input id="rem-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && (
          <p className="field-error" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="rem-date">Due date</label>
        <input
          id="rem-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-describedby={isInsurance ? 'rem-date-hint' : undefined}
        />
        {isInsurance && (
          <p id="rem-date-hint" className="field-hint">
            For insurance, this is the policy expiry date.
          </p>
        )}
        {errors.dueDate && (
          <p className="field-error" role="alert">
            {errors.dueDate}
          </p>
        )}
      </div>

      {type !== 'insurance' &&
        type !== 'puc' &&
        type !== 'fitness' &&
        type !== 'licence' &&
        type !== 'road_tax' && (
          <div className="field">
            <label htmlFor="rem-km">Due odometer (km, optional)</label>
            <input
              id="rem-km"
              inputMode="numeric"
              value={dueKm}
              onChange={(e) => setDueKm(e.target.value)}
            />
            {errors.dueOdometerKm && (
              <p className="field-error" role="alert">
                {errors.dueOdometerKm}
              </p>
            )}
          </div>
        )}

      <div className="field">
        <label htmlFor="rem-lead">Lead time (days)</label>
        <input
          id="rem-lead"
          inputMode="numeric"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
        />
        {errors.leadDays && (
          <p className="field-error" role="alert">
            {errors.leadDays}
          </p>
        )}
      </div>

      {isInsurance && (
        <fieldset className="field">
          <legend>Policy details</legend>
          <label htmlFor="rem-insurer">Insurer</label>
          <input id="rem-insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
          <label htmlFor="rem-policy">Policy number</label>
          <input id="rem-policy" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
          <label htmlFor="rem-idv">IDV (₹)</label>
          <input
            id="rem-idv"
            inputMode="decimal"
            value={idv}
            onChange={(e) => setIdv(e.target.value)}
          />
          {errors.idvAmount && (
            <p className="field-error" role="alert">
              {errors.idvAmount}
            </p>
          )}
          <label htmlFor="rem-premium">Premium (₹)</label>
          <input
            id="rem-premium"
            inputMode="decimal"
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
          />
          {errors.premiumAmount && (
            <p className="field-error" role="alert">
              {errors.premiumAmount}
            </p>
          )}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="rem-notes">Notes (optional)</label>
        <input id="rem-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {errors.notes && (
          <p className="field-error" role="alert">
            {errors.notes}
          </p>
        )}
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save reminder'}
        </button>
      </div>
    </form>
  );
}
