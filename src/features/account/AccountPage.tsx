import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAccount } from '../../data/account';
import { DELETE_CONFIRM_WORD, isDeleteConfirmed } from '../../core/account/delete';
import { useSignOut } from '../../components/AppShell';

/** Permanent account deletion with a typed confirmation (FR-DATA-03). */
export function AccountPage() {
  const signOut = useSignOut();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the account. Please try again.');
      setBusy(false);
      return;
    }
    // The account is gone, so the session is no longer valid. Sign out locally and go to login.
    await signOut().catch(() => undefined);
  }

  const ready = isDeleteConfirmed(typed);

  return (
    <>
      <h1>Delete account</h1>
      <section className="dashboard-card" aria-labelledby="delete-warning">
        <h2 id="delete-warning">This cannot be undone</h2>
        <p>
          Deleting your account permanently removes your vehicles, expenses, fuel logs, loans,
          reminders, custom categories and receipt photos. Your sign-in is removed too, so you will
          not be able to sign in again with this email.
        </p>
        <p>
          <Link to="/backup">Download a backup first</Link>, if you may want your data later.
        </p>
      </section>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="report-exports">
        <label>
          Type {DELETE_CONFIRM_WORD} to confirm{' '}
          <input
            type="text"
            aria-label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </label>{' '}
        <button
          type="button"
          className="btn-danger"
          onClick={() => void remove()}
          disabled={!ready || busy}
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </>
  );
}
