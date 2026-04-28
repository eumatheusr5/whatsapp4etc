import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageCircle,
  Smartphone,
  Activity,
  BarChart3,
  Sun,
  Moon,
  LogOut,
  AlertCircle,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { signOut } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useInstancesHealth } from '../hooks/useInstancesHealth';
import { cn } from '../lib/format';
import { ensurePushSubscription, useInAppNotifications } from '../lib/notifications';

const NAV = [
  { to: '/conversas', label: 'Conversas', icon: MessageCircle },
  { to: '/instancias', label: 'Números', icon: Smartphone },
  { to: '/saude', label: 'Saúde', icon: Activity },
  { to: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { hasIssue, message } = useInstancesHealth();
  const [collapsed, setCollapsed] = useState(false);

  useInAppNotifications();

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function activateNotifications() {
    try {
      await ensurePushSubscription();
      toast.success('Notificações ativadas!');
    } catch (err) {
      toast.error('Falha ao ativar notificações: ' + (err as Error).message);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {hasIssue && (
        <div className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-200 border-b border-red-200 dark:border-red-800 px-4 py-2 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{message}</span>
          <Link to="/saude" className="underline hover:no-underline">
            Ver detalhes
          </Link>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <aside
          className={cn(
            'flex flex-col bg-wa-panel dark:bg-wa-panel-dark border-r border-wa-divider dark:border-wa-divider-dark transition-all',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <div className="h-14 flex items-center gap-2 px-4 border-b border-wa-divider dark:border-wa-divider-dark">
            <div className="w-9 h-9 rounded-lg bg-wa-green-dark text-white flex items-center justify-center text-lg">
              W
            </div>
            {!collapsed && <span className="font-semibold">WhatsApp4etc</span>}
          </div>
          <nav className="flex-1 py-3">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                    active
                      ? 'bg-wa-divider dark:bg-wa-divider-dark text-wa-green-dark dark:text-wa-green'
                      : 'text-wa-text dark:text-wa-text-dark hover:bg-wa-divider dark:hover:bg-wa-divider-dark',
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-wa-divider dark:border-wa-divider-dark p-2 flex items-center justify-around">
            <button
              onClick={() => void activateNotifications()}
              className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
              title="Ativar notificações"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => void signOut()}
              className="p-2 rounded-lg hover:bg-wa-divider dark:hover:bg-wa-divider-dark text-red-500"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
