import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  MessageCircle,
  Users,
  Smartphone,
  Settings,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  Bell,
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
import { useUnreadSummary } from '../hooks/useUnreadSummary';
import { Avatar, Tooltip, CountBadge } from '../components/ui';

interface MeResponse {
  id: string;
  full_name: string;
  role: 'admin' | 'atendente';
  avatar_url: string | null;
  email: string | null;
}

interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: typeof Home;
  matches?: string[];
}

const NAV: NavItem[] = [
  { to: '/inicio', label: 'Início', icon: Home, matches: ['/inicio', '/dashboard'] },
  { to: '/conversas', label: 'Conversas', icon: MessageCircle },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/numeros', label: 'Números', icon: Smartphone, matches: ['/numeros', '/instancias'] },
  { to: '/configuracoes', label: 'Configurações', shortLabel: 'Config.', icon: Settings },
];

const PREFETCHERS: Record<string, () => Promise<unknown>> = {
  '/inicio': () => api.get('/stats/overview?days=30'),
  '/contatos': () => api.get('/contacts?limit=50'),
  '/numeros': () => api.get('/instances'),
  '/configuracoes': () => api.get('/users/me'),
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { hasIssue, message } = useInstancesHealth();
  const qc = useQueryClient();
  const unreadCount = useUnreadSummary();

  useInAppNotifications();

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeResponse>('/users/me'),
    staleTime: 5 * 60_000,
  });

  const [authMeta, setAuthMeta] = useState<{ email: string | null }>({ email: null });
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setAuthMeta({ email: data.user?.email ?? null });
    });
  }, []);

  const isOnChat = useMemo(
    () => location.pathname.startsWith('/conversas/') && location.pathname.length > '/conversas/'.length,
    [location.pathname],
  );

  async function activateNotifications() {
    try {
      await ensurePushSubscription();
      toast.success('Notificações ativadas');
    } catch (err) {
      toast.error('Falha ao ativar notificações: ' + (err as Error).message);
    }
  }

  function prefetch(path: string) {
    const fn = PREFETCHERS[path];
    if (!fn) return;
    void qc.prefetchQuery({ queryKey: [`prefetch:${path}`], queryFn: fn, staleTime: 60_000 });
  }

  function isActive(item: NavItem): boolean {
    const matches = item.matches ?? [item.to];
    return matches.some((m) => location.pathname === m || location.pathname.startsWith(`${m}/`));
  }

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      {hasIssue && (
        <div className="bg-warning-soft text-warning-fg border-b border-warning/30 px-3 sm:px-4 py-2 text-xs sm:text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{message}</span>
          <Link to="/inicio" className="underline hover:no-underline whitespace-nowrap font-medium">
            Ver detalhes
          </Link>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar slim Desktop */}
        <aside className="hidden md:flex w-[76px] shrink-0 flex-col items-center bg-surface border-r border-border">
          <div className="h-16 flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-accent text-accent-fg flex items-center justify-center font-bold text-lg shadow-soft">
              W
            </div>
          </div>

          <nav className="flex-1 w-full py-2 flex flex-col items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              const showBadge = item.to === '/conversas' && unreadCount > 0;
              return (
                <Tooltip key={item.to} content={item.label} side="right">
                  <Link
                    to={item.to}
                    onMouseEnter={() => prefetch(item.to)}
                    onFocus={() => prefetch(item.to)}
                    className={cn(
                      'relative w-14 h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                      active
                        ? 'bg-accent-soft text-accent'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">
                      {item.shortLabel ?? item.label}
                    </span>
                    {showBadge && (
                      <span className="absolute top-1.5 right-1.5">
                        <CountBadge count={unreadCount} />
                      </span>
                    )}
                  </Link>
                </Tooltip>
              );
            })}
          </nav>

          <div className="w-full py-2 flex flex-col items-center gap-1 border-t border-border">
            <Tooltip content="Notificações" side="right">
              <button
                onClick={() => void activateNotifications()}
                className="w-10 h-10 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text inline-flex items-center justify-center"
              >
                <Bell className="w-4.5 h-4.5" />
              </button>
            </Tooltip>
            <Tooltip content={theme === 'light' ? 'Modo escuro' : 'Modo claro'} side="right">
              <button
                onClick={toggle}
                className="w-10 h-10 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text inline-flex items-center justify-center"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </Tooltip>
            <Tooltip content="Sair" side="right">
              <button
                onClick={() => void signOut()}
                className="w-10 h-10 rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger inline-flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content={me?.full_name ?? authMeta.email ?? 'Você'} side="right">
              <Link to="/configuracoes" className="mt-1 mb-2">
                <Avatar src={me?.avatar_url} name={me?.full_name ?? authMeta.email} size="md" />
              </Link>
            </Tooltip>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-bg">
          <div className="flex-1 min-h-0">{children}</div>

          {/* Bottom nav mobile - oculto dentro do chat */}
          {!isOnChat && (
            <nav className="md:hidden grid grid-cols-5 border-t border-border bg-surface safe-bottom">
              {NAV.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const showBadge = item.to === '/conversas' && unreadCount > 0;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'relative flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors',
                      active
                        ? 'text-accent'
                        : 'text-text-muted',
                    )}
                  >
                    <span className="relative">
                      <Icon className={cn('w-5 h-5', active && 'scale-110')} />
                      {showBadge && (
                        <span className="absolute -top-1.5 -right-2">
                          <CountBadge count={unreadCount} />
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-medium">
                      {item.shortLabel ?? item.label}
                    </span>
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
