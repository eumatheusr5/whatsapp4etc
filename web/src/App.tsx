import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { InstancesPage } from './pages/InstancesPage';
import { StatsPage } from './pages/StatsPage';
import { HealthPage } from './pages/HealthPage';
import { AppLayout } from './layouts/AppLayout';
import { useSession } from './lib/auth';
import { useThemeBootstrap } from './lib/theme';

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
              <Routes>
                <Route path="/" element={<Navigate to="/conversas" replace />} />
                <Route path="/conversas" element={<ChatPage />} />
                <Route path="/conversas/:conversationId" element={<ChatPage />} />
                <Route path="/instancias" element={<InstancesPage />} />
                <Route path="/saude" element={<HealthPage />} />
                <Route path="/estatisticas" element={<StatsPage />} />
                <Route path="*" element={<Navigate to="/conversas" replace />} />
              </Routes>
            </AppLayout>
          </Protected>
        }
      />
    </Routes>
  );
}

export default App;
