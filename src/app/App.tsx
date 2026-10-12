import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { AppShell } from '../components/AppShell';
import { HomePage, MorePage } from '../features/placeholders/Screens';
import { LoansPage } from '../features/loans/LoansPage';
import { LoanDetailPage } from '../features/loans/LoanDetailPage';
import { RemindersPage } from '../features/reminders/RemindersPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { BackupPage } from '../features/backup/BackupPage';
import { QuickAddPage } from '../features/expenses/QuickAddPage';
import { FuelPage } from '../features/fuel/FuelPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { VehicleProvider } from '../features/vehicles/VehicleContext';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { isConfigured } from '../data/supabase';

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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <VehicleProvider>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/loans" element={<LoansPage />} />
                      <Route path="/loans/:loanId" element={<LoanDetailPage />} />
                      <Route path="/reminders" element={<RemindersPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/backup" element={<BackupPage />} />
                      <Route path="/add" element={<QuickAddPage />} />
                      <Route path="/more" element={<MorePage />} />
                      <Route path="/vehicles" element={<VehiclesPage />} />
                      <Route path="/fuel" element={<FuelPage />} />
                    </Routes>
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
