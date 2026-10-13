import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { routerBasename } from './basename';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { WhatsNewPage } from '../features/about/WhatsNewPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { RecoverPage } from '../features/auth/RecoverPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { AppShell } from '../components/AppShell';
import { HomePage, MorePage } from '../features/placeholders/Screens';
import { RemindersPage } from '../features/reminders/RemindersPage';
import { BackupPage } from '../features/backup/BackupPage';
import { AccountPage } from '../features/account/AccountPage';
import { QuickAddPage } from '../features/expenses/QuickAddPage';
import { FuelPage } from '../features/fuel/FuelPage';
import { InvoicesPage } from '../features/invoices/InvoicesPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { VehicleProvider } from '../features/vehicles/VehicleContext';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { isConfigured } from '../data/supabase';

// T32: Reports and Loans are off the first-load path. They load when the route is opened.
const ReportsPage = lazy(() =>
  import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const LoansPage = lazy(() =>
  import('../features/loans/LoansPage').then((m) => ({ default: m.LoansPage }))
);
const LoanDetailPage = lazy(() =>
  import('../features/loans/LoanDetailPage').then((m) => ({ default: m.LoanDetailPage }))
);

function ConfigMissing() {
  return (
    <main className="auth-page">
      <h1>Setup needed</h1>
      <p>
        This build has no Supabase settings. Copy <code>.env.example</code> to{' '}
        <code>.env.local</code> and fill in <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>.
      </p>
    </main>
  );
}

export function App() {
  if (!isConfigured()) return <ConfigMissing />;
  return (
    <BrowserRouter basename={routerBasename(import.meta.env.BASE_URL)}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/recover" element={<RecoverPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <VehicleProvider>
                  <AppShell>
                    <Suspense
                      fallback={
                        <p className="hint" role="status">
                          Loading…
                        </p>
                      }
                    >
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/expenses" element={<ExpensesPage />} />
                        <Route path="/loans" element={<LoansPage />} />
                        <Route path="/loans/:loanId" element={<LoanDetailPage />} />
                        <Route path="/invoices" element={<InvoicesPage />} />
                        <Route path="/reminders" element={<RemindersPage />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/backup" element={<BackupPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="/add" element={<QuickAddPage />} />
                        <Route path="/more" element={<MorePage />} />
                        <Route path="/vehicles" element={<VehiclesPage />} />
                        <Route path="/fuel" element={<FuelPage />} />
                        <Route path="/whats-new" element={<WhatsNewPage />} />
                      </Routes>
                    </Suspense>
                  </AppShell>
                </VehicleProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
