import { useState, type FormEvent } from 'react';
import { computeTotals, serviceBillSchema } from '../../core/bills/bill';
import { formatINR } from '../../core/money/money';
import { createServiceBill } from '../../data/serviceBills';

interface ItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

const blankItem = (): ItemDraft => ({ description: '', quantity: '1', unitPrice: '' });

/** Empty text becomes NaN, so the schema reports it as "enter a value" rather than 0. */
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Form for one service bill (FR-INV, vehicle scope). Totals update live; saving goes through the schema and the RPC. */
export function BillForm({
  vehicleId,
  onSaved,
  onCancel,
}: {
  vehicleId: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [billNo, setBillNo] = useState('');
  const [vendor, setVendor] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = computeTotals(
    items.map((i) => ({
      quantity: Number.isFinite(num(i.quantity)) ? num(i.quantity) : 0,
      unitPrice: Number.isFinite(num(i.unitPrice)) ? num(i.unitPrice) : 0,
    })),
    Number.isFinite(num(tax)) ? num(tax) : 0
  );

  function update(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = serviceBillSchema.safeParse({
      vehicleId,
      billNo,
      vendor,
      issueDate,
      dueDate: dueDate || null,
      tax: num(tax),
      notes: notes.trim() || undefined,
      items: items.map((i) => ({
        description: i.description,
        quantity: num(i.quantity),
        unitPrice: num(i.unitPrice),
      })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the bill.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await createServiceBill(parsed.data);
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the bill.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="bill-form-title">
      <h1 id="bill-form-title">New service bill</h1>
      <form onSubmit={onSubmit} noValidate className="form-stack">
        <div className="field">
          <label htmlFor="bill-no">Bill number</label>
          <input id="bill-no" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bill-vendor">Garage or service centre</label>
          <input id="bill-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bill-issue">Issue date</label>
          <input
            id="bill-issue"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bill-due">Due date (optional)</label>
          <input
            id="bill-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <fieldset className="bill-items">
          <legend>Items</legend>
          {items.map((it, index) => (
            <div key={index} className="bill-item-row">
              <div className="field">
                <label htmlFor={`item-desc-${index}`}>Item description</label>
                <input
                  id={`item-desc-${index}`}
                  value={it.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`item-qty-${index}`}>Quantity</label>
                <input
                  id={`item-qty-${index}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={it.quantity}
                  onChange={(e) => update(index, { quantity: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`item-price-${index}`}>Unit price (₹)</label>
                <input
                  id={`item-price-${index}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={it.unitPrice}
                  onChange={(e) => update(index, { unitPrice: e.target.value })}
                />
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove item
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setItems((prev) => [...prev, blankItem()])}>
            Add item
          </button>
        </fieldset>

        <div className="field">
          <label htmlFor="bill-tax">Tax (₹)</label>
          <input
            id="bill-tax"
            type="number"
            inputMode="decimal"
            step="any"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bill-notes">Notes (optional)</label>
          <textarea id="bill-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <p className="bill-total">
          <span>Subtotal {formatINR(totals.subtotal)}</span>
          <br />
          <strong>Total {formatINR(totals.total)}</strong>
        </p>

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            Save bill
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
