import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { AppShell } from '../components/AppShell';
import { AddPage, ExpensesPage, HomePage, LoansPage, MorePage } from '../features/placeholders/Screens';
import { VehicleProvider } from '../features/vehicles/VehicleContext';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { isConfigured } from '../data/supabase';

function ConfigMissing() {
  return (
    <main className="auth-page">
      <h1>Setup needed</h1>
      <p>
        This build has no Supabase settings. Copy <code>.env.example</code> to <code>.env.local</code> and
        fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
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
                      <Route path="/add" element={<AddPage />} />
                      <Route path="/more" element={<MorePage />} />
                      <Route path="/vehicles" element={<VehiclesPage />} />
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
