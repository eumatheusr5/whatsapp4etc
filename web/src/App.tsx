import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { AppLayout } from './layouts/AppLayout';
import { useSession } from './lib/auth';
import { useThemeBootstrap } from './lib/theme';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ContactsPage = lazy(() =>
  import('./pages/ContactsPage').then((m) => ({ default: m.ContactsPage })),
);
const InstancesPage = lazy(() =>
  import('./pages/InstancesPage').then((m) => ({ default: m.InstancesPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function PageFallback() {
  return (
    <div className="h-full flex items-center justify-center text-text-muted text-sm">
      Carregando…
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">Carregando…</div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  useThemeBootstrap();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppLayout>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/inicio" replace />} />
                  <Route path="/inicio" element={<DashboardPage />} />
                  <Route path="/conversas" element={<ChatPage />} />
                  <Route path="/conversas/:conversationId" element={<ChatPage />} />
                  <Route path="/contatos" element={<ContactsPage />} />
                  <Route path="/numeros" element={<InstancesPage />} />
                  <Route path="/configuracoes" element={<SettingsPage />} />
                  {/* Compatibilidade com URLs antigas */}
                  <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
                  <Route path="/instancias" element={<Navigate to="/numeros" replace />} />
                  <Route path="/saude" element={<Navigate to="/inicio" replace />} />
                  <Route path="/estatisticas" element={<Navigate to="/inicio" replace />} />
                  <Route path="*" element={<Navigate to="/inicio" replace />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </Protected>
        }
      />
    </Routes>
  );
}

export default App;
