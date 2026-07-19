import { Suspense, lazy } from 'react';
import { LinearProgress } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Diagnostic from './pages/Diagnostic';
import DiagnosticWizard from './pages/DiagnosticWizard';
import Player from './pages/Player';
import Library from './pages/Library';
import Settings from './pages/Settings';
import { db } from './db';

// The charts library is heavy and only needed on the Progress screen.
const ProgressPage = lazy(() => import('./pages/Progress'));

/** Sends first-time users through onboarding before anything else. */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // `get` resolves to undefined when the row is absent, which is exactly the
  // sentinel useLiveQuery uses while loading. Map "absent" to null so a
  // first-run user (no plan row yet) isn't stuck on the loader forever.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], undefined);

  if (plan === undefined) return <LinearProgress />;

  const onboarded = !!plan?.onboardedAt;
  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <OnboardingGate>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/diagnostic/:goalId" element={<DiagnosticWizard />} />
          <Route path="/player" element={<Player />} />
          <Route
            path="/progress"
            element={
              <Suspense fallback={<LinearProgress sx={{ mt: 4 }} />}>
                <ProgressPage />
              </Suspense>
            }
          />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OnboardingGate>
  );
}
