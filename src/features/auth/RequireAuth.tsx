import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Redirects signed-out users to /login (FR-AUTH-02). Waits while the stored session loads. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (session === undefined) return <p className="loading" role="status">Loading…</p>;
  if (session === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
