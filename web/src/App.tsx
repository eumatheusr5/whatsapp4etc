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
    <div className="h-full flex items-center justify-center text-wa-muted text-sm">
      Carregando...
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-wa-muted">Carregando...</div>
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
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/conversas" element={<ChatPage />} />
                  <Route path="/conversas/:conversationId" element={<ChatPage />} />
                  <Route path="/contatos" element={<ContactsPage />} />
                  <Route path="/instancias" element={<InstancesPage />} />
                  {/* compatibilidade com link antigo */}
                  <Route path="/saude" element={<Navigate to="/instancias?tab=saude" replace />} />
                  <Route path="/estatisticas" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/configuracoes" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
