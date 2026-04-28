import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Smartphone,
  Settings,
  Sun,
  Moon,
  LogOut,
  AlertCircle,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useInstancesHealth } from '../hooks/useInstancesHealth';
import { cn } from '../lib/format';
import { ensurePushSubscription, useInAppNotifications } from '../lib/notifications';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

interface MeResponse {
  id: string;
  full_name: string;
  role: 'admin' | 'atendente';
  avatar_url: string | null;
  email: string | null;
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/conversas', label: 'Conversas', icon: MessageCircle },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/instancias', label: 'Números', icon: Smartphone },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const PREFETCHERS: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => api.get('/stats/overview?days=30'),
  '/contatos': () => api.get('/contacts?limit=50'),
  '/instancias': () => api.get('/instances'),
  '/configuracoes': () => api.get('/users/me'),
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { hasIssue, message } = useInstancesHealth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const qc = useQueryClient();

  useInAppNotifications();

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeResponse>('/users/me'),
    staleTime: 5 * 60_000,
  });

  // Avatar fallback: tenta supabase auth metadata se backend ainda não retornou
  const [authMeta, setAuthMeta] = useState<{ email: string | null }>({ email: null });
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setAuthMeta({ email: data.user?.email ?? null });
    });
  }, []);

  // Fecha drawer ao trocar rota
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isOnChat = useMemo(
    () => location.pathname.startsWith('/conversas/') && location.pathname.length > '/conversas/'.length,
    [location.pathname],
  );

  async function activateNotifications() {
    try {
      await ensurePushSubscription();
      toast.success('Notificações ativadas!');
    } catch (err) {
      toast.error('Falha ao ativar notificações: ' + (err as Error).message);
    }
  }

  function prefetch(path: string) {
    const fn = PREFETCHERS[path];
    if (!fn) return;
    void qc.prefetchQuery({ queryKey: [`prefetch:${path}`], queryFn: fn, staleTime: 60_000 });
  }

  return (
    <div className="h-full flex flex-col">
      {hasIssue && (
        <div className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-200 border-b border-red-200 dark:border-red-800 px-3 sm:px-4 py-2 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{message}</span>
          <Link to="/instancias?tab=saude" className="underline hover:no-underline whitespace-nowrap">
            Ver detalhes
          </Link>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex w-60 lg:w-64 flex-col bg-wa-panel dark:bg-wa-panel-dark border-r border-wa-divider dark:border-wa-divider-dark">
          <SidebarContent
            location={location.pathname}
            me={me}
            authEmail={authMeta.email}
            theme={theme}
            onToggleTheme={toggle}
            onActivateNotifications={activateNotifications}
            onSignOut={() => void signOut()}
            onPrefetch={prefetch}
          />
        </aside>

        {/* Drawer Mobile */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute top-0 left-0 bottom-0 w-72 bg-wa-panel dark:bg-wa-panel-dark border-r border-wa-divider dark:border-wa-divider-dark animate-slide-in flex flex-col">
              <SidebarContent
                location={location.pathname}
                me={me}
                authEmail={authMeta.email}
                theme={theme}
                onToggleTheme={toggle}
                onActivateNotifications={activateNotifications}
                onSignOut={() => void signOut()}
                onPrefetch={prefetch}
                onClose={() => setDrawerOpen(false)}
              />
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0 flex flex-col">
          {/* Topbar mobile */}
          <header
            className={cn(
              'md:hidden h-12 flex items-center gap-2 px-3 bg-wa-panel dark:bg-wa-panel-dark border-b border-wa-divider dark:border-wa-divider-dark',
              isOnChat && 'hidden',
            )}
          >
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold">WhatsApp4etc</span>
          </header>

          <div className="flex-1 min-h-0">{children}</div>

          {/* Bottom nav mobile (oculto dentro da conversa) */}
          {!isOnChat && (
            <nav className="md:hidden grid grid-cols-5 border-t border-wa-divider dark:border-wa-divider-dark bg-wa-panel dark:bg-wa-panel-dark">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'flex flex-col items-center justify-center py-2 text-[10px] gap-0.5',
                      active
                        ? 'text-wa-green-dark dark:text-wa-green'
                        : 'text-wa-muted',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label === 'Configurações' ? 'Config' : label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}

interface SidebarProps {
  location: string;
  me: MeResponse | undefined;
  authEmail: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onActivateNotifications: () => Promise<void>;
  onSignOut: () => void;
  onPrefetch: (path: string) => void;
  onClose?: () => void;
}

function SidebarContent({
  location,
  me,
  authEmail,
  theme,
  onToggleTheme,
  onActivateNotifications,
  onSignOut,
  onPrefetch,
  onClose,
}: SidebarProps) {
  const initials = (me?.full_name || authEmail || '??').trim().slice(0, 2).toUpperCase();
  return (
    <>
      <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-wa-divider dark:border-wa-divider-dark">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-wa-green-dark text-white flex items-center justify-center text-lg shrink-0">
            W
          </div>
          <span className="font-semibold truncate">WhatsApp4etc</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Link
        to="/configuracoes"
        className="flex items-center gap-3 px-4 py-3 border-b border-wa-divider dark:border-wa-divider-dark hover:bg-wa-divider dark:hover:bg-wa-divider-dark transition-colors"
      >
        {me?.avatar_url ? (
          <img src={me.avatar_url} alt={me.full_name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{me?.full_name || 'Carregando...'}</div>
          <div className="text-xs text-wa-muted truncate">
            {me?.email || authEmail || ''}
            {me?.role === 'admin' ? ' · Admin' : ''}
          </div>
        </div>
      </Link>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onMouseEnter={() => onPrefetch(to)}
              onFocus={() => onPrefetch(to)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                active
                  ? 'bg-wa-divider dark:bg-wa-divider-dark text-wa-green-dark dark:text-wa-green font-medium'
                  : 'text-wa-text dark:text-wa-text-dark hover:bg-wa-divider dark:hover:bg-wa-divider-dark',
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-wa-divider dark:border-wa-divider-dark p-2 flex items-center justify-around">
        <button
          onClick={() => void onActivateNotifications()}
          className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
          title="Ativar notificações"
        >
          <Bell className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
          title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        <button
          onClick={onSignOut}
          className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark text-red-500"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
