import { useEffect, useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import { listServiceBills, markServiceBillPaid, type ServiceBill } from '../../data/serviceBills';
import { formatINR } from '../../core/money/money';
import { formatDMY } from '../../core/dates/dates';
import { EmptyState } from '../placeholders/Screens';
import { BillForm } from './BillForm';

/** Service bills for the active vehicle (Invoice module, vehicle scope). Mark paid per bill. */
export function InvoicesPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const [bills, setBills] = useState<ServiceBill[] | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    setBills(undefined);
    listServiceBills(vehicleId)
      .then(setBills)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load bills.');
        setBills([]);
      });
  }, [vehicleId]);

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle || !vehicleId) {
    return (
      <>
        <h1>Invoices</h1>
        <EmptyState title="Add a vehicle first">
          <p>Service bills belong to a vehicle. Add your car or bike to start.</p>
        </EmptyState>
      </>
    );
  }

  if (adding) {
    return (
      <BillForm
        vehicleId={vehicleId}
        onSaved={() => {
          setAdding(false);
          setNotice('Bill saved.');
          listServiceBills(vehicleId)
            .then(setBills)
            .catch(() => setError('Saved, but the list could not refresh.'));
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  async function markPaid(bill: ServiceBill) {
    setError(null);
    try {
      await markServiceBillPaid(bill.id);
      setBills((prev) =>
        (prev ?? []).map((b) => (b.id === bill.id ? { ...b, status: 'paid' } : b))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark the bill as paid.');
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Invoices</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          Add bill
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

      {bills === undefined ? (
        <p role="status">Loading…</p>
      ) : bills.length === 0 ? (
        <EmptyState title="No service bills yet">
          <p>Add a garage or service centre bill to track what you owe.</p>
        </EmptyState>
      ) : (
        <ul className="expense-list" aria-label="Service bills">
          {bills.map((b) => (
            <li key={b.id} className="expense-row">
              <div>
                <strong>{b.billNo}</strong> · <span>{b.vendor}</span>
              </div>
              <div className="muted">
                Issued {formatDMY(b.issueDate)}
                {b.dueDate ? ` · Due ${formatDMY(b.dueDate)}` : ''} ·{' '}
                <span>{formatINR(b.total)}</span>
              </div>
              <div>
                <span className={b.status === 'paid' ? 'chip-ok' : 'chip-warn'}>
                  {b.status === 'paid' ? 'Paid' : 'Unpaid'}
                </span>{' '}
                {b.status === 'unpaid' && (
                  <button
                    type="button"
                    onClick={() => markPaid(b)}
                    aria-label={`Mark ${b.billNo} as paid`}
                  >
                    Mark paid
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
