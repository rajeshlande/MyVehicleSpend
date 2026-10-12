import { useState } from 'react';
import { useVehicles } from '../vehicles/VehicleContext';
import {
  createReminder,
  deleteReminder,
  updateReminder,
  type Reminder,
} from '../../data/reminders';
import { formatDMY } from '../../core/dates/dates';
import { formatINR } from '../../core/money/money';
import type { ReminderInput } from '../../core/reminders/schema';
import { EmptyState } from '../placeholders/Screens';
import { ReminderForm } from './ReminderForm';
import { useReminders, type ReminderView } from './useReminders';
import { STATUS_BADGE, timingText } from './reminderText';
import type { ReminderStatus } from '../../core/reminders/due';

const GROUPS: { status: ReminderStatus; title: string }[] = [
  { status: 'overdue', title: 'Overdue' },
  { status: 'due_soon', title: 'Due soon' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'done', title: 'Done' },
];

/** Reminders for the active vehicle, grouped by due state (FR-REM-01, FR-REM-02, FR-REM-05). */
export function RemindersPage() {
  const { activeVehicle, vehicles } = useVehicles();
  const { items, error, reload } = useReminders(activeVehicle);
  const [mode, setMode] = useState<
    { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; id: string }
  >({ kind: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (vehicles === undefined) return <p role="status">Loading…</p>;
  if (!activeVehicle) {
    return (
      <>
        <h1>Reminders</h1>
        <EmptyState title="Add a vehicle first">
          <p>Reminders belong to a vehicle. Add your car or bike to start.</p>
        </EmptyState>
      </>
    );
  }

  const vehicleId = activeVehicle.id;

  async function save(input: ReminderInput, id?: string): Promise<Reminder> {
    return id ? updateReminder(id, input) : createReminder(input);
  }

  async function remove(r: Reminder) {
    if (!window.confirm(`Delete “${r.title}”?`)) return;
    try {
      await deleteReminder(r.id);
      setNotice('Reminder deleted.');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the reminder.');
    }
  }

  if (mode.kind === 'add' || mode.kind === 'edit') {
    const editing = mode.kind === 'edit' ? items?.find((r) => r.id === mode.id) : undefined;
    return (
      <ReminderForm
        vehicleId={vehicleId}
        initial={editing}
        onSubmit={(input) => save(input, editing?.id)}
        onSaved={() => {
          setNotice(editing ? 'Reminder updated.' : 'Reminder saved.');
          setMode({ kind: 'list' });
          void reload();
        }}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  const list = items ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Reminders</h1>
        <button type="button" className="btn-primary" onClick={() => setMode({ kind: 'add' })}>
          Add reminder
        </button>
      </div>
      <p className="muted">{activeVehicle.registrationNo}</p>

      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {(error || actionError) && (
        <p role="alert" className="field-error">
          {actionError ?? error}
        </p>
      )}

      {items === undefined ? (
        <p role="status">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyState title="No reminders yet">
          <p>Add an insurance, PUC, fitness or service reminder so nothing lapses.</p>
        </EmptyState>
      ) : (
        GROUPS.map((g) => {
          const rows = list.filter((r) => r.state.status === g.status);
          if (rows.length === 0) return null;
          return (
            <section key={g.status} aria-label={g.title}>
              <h2>{g.title}</h2>
              <ul className="expense-list">
                {rows.map((r) => (
                  <ReminderItem
                    key={r.id}
                    r={r}
                    onEdit={() => setMode({ kind: 'edit', id: r.id })}
                    onDelete={() => void remove(r)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

function ReminderItem({
  r,
  onEdit,
  onDelete,
}: {
  r: ReminderView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = STATUS_BADGE[r.state.status];
  return (
    <li className="expense-row" aria-label={r.title}>
      <div>
        <strong>{r.title}</strong> <span className={`badge badge-${r.state.status}`}>{badge}</span>
      </div>
      <div className="muted">
        {timingText(r, r.state).join(' · ')}
        {r.dueDate ? ` · due ${formatDMY(r.dueDate)}` : ''}
      </div>
      {r.reminderType === 'insurance' && (
        <div className="muted">
          {[
            r.insurer,
            r.policyNo && `Policy ${r.policyNo}`,
            r.idvAmount !== undefined && `IDV ${formatINR(r.idvAmount)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onEdit}>
          Edit {r.title}
        </button>
        <button type="button" className="btn-secondary" onClick={onDelete}>
          Delete {r.title}
        </button>
      </div>
    </li>
  );
}
