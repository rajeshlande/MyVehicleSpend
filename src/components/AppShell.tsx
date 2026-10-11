import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { OfflineBanner } from './OfflineBanner';
import { useAuth } from '../features/auth/AuthContext';

/** The five destinations from UI/UX §3. The + opens the quick-add sheet (placeholder until Phase 3). */
const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/expenses', label: 'Expenses', icon: '🧾' },
  { to: '/loans', label: 'Loans', icon: '🏦' },
  { to: '/more', label: 'More', icon: '⋯' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <nav className="side-nav" aria-label="Primary">
        <strong>My Vehicle Spend</strong>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => navigate('/add')}>
          <span aria-hidden="true">➕</span> Add entry
        </button>
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>
        <OfflineBanner />
        <main className="app-main">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="Primary mobile">
        <NavLink to="/" end>
          <span aria-hidden="true">{TABS[0].icon}</span>
          {TABS[0].label}
        </NavLink>
        <NavLink to="/expenses">
          <span aria-hidden="true">{TABS[1].icon}</span>
          {TABS[1].label}
        </NavLink>
        <button
          type="button"
          className="nav-add"
          onClick={() => navigate('/add')}
          aria-label="Add entry"
        >
          <span className="plus" aria-hidden="true">
            +
          </span>
          Add
        </button>
        <NavLink to="/loans">
          <span aria-hidden="true">{TABS[2].icon}</span>
          {TABS[2].label}
        </NavLink>
        <NavLink to="/more">
          <span aria-hidden="true">{TABS[3].icon}</span>
          {TABS[3].label}
        </NavLink>
      </nav>
    </div>
  );
}

export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
}
