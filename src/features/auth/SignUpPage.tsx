import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PASSWORD_MIN_LENGTH } from './schemas';

export function SignUpPage() {
  const { session, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  if (session && !created) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signUp({ displayName, email, password });
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.needsConfirmation) setConfirmSent(true);
    else setCreated(true);
  }

  if (created) {
    return (
      <main className="auth-page">
        <h1>Account created</h1>
        <p>Your account is ready. Go to Home to start tracking your vehicle spend.</p>
        <p>
          <Link to="/" className="btn-primary">
            Go to Home
          </Link>
        </p>
      </main>
    );
  }

  if (confirmSent) {
    return (
      <main className="auth-page">
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your
          account.
        </p>
        <p>
          <Link to="/login">Back to sign in</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>Create account</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Name <span className="hint">(optional)</span>
          <input
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password <span className="hint">(at least {PASSWORD_MIN_LENGTH} characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
