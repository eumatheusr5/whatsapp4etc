import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  User,
  Tag as TagIcon,
  MessageSquare,
  Users as UsersIcon,
  Palette,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { ProfileTab } from '../features/settings/ProfileTab';
import { TagsTab } from '../features/settings/TagsTab';
import { QuickRepliesTab } from '../features/settings/QuickRepliesTab';
import { AttendantsTab } from '../features/settings/AttendantsTab';
import { AppearanceTab } from '../features/settings/AppearanceTab';
import { NotificationsTab } from '../features/settings/NotificationsTab';
import { AuditTab } from '../features/settings/AuditTab';
import { cn } from '../lib/format';

interface MeResponse {
  id: string;
  role: 'admin' | 'atendente';
}

type TabKey =
  | 'conta'
  | 'aparencia'
  | 'notificacoes'
  | 'tags'
  | 'respostas'
  | 'equipe'
  | 'auditoria';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Settings;
  show: boolean;
}

export function SettingsPage() {
  const [search, setSearch] = useSearchParams();
  const tab = (search.get('tab') as TabKey) || 'conta';

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeResponse>('/users/me'),
    staleTime: 5 * 60_000,
  });

  const isAdmin = me?.role === 'admin';

  const allTabs: TabDef[] = [
    { key: 'conta', label: 'Conta', icon: User, show: true },
    { key: 'aparencia', label: 'Aparência', icon: Palette, show: true },
    { key: 'notificacoes', label: 'Notificações', icon: Bell, show: true },
    { key: 'tags', label: 'Tags', icon: TagIcon, show: true },
    { key: 'respostas', label: 'Respostas rápidas', icon: MessageSquare, show: true },
    { key: 'equipe', label: 'Equipe', icon: UsersIcon, show: !!isAdmin },
    { key: 'auditoria', label: 'Auditoria', icon: ShieldCheck, show: !!isAdmin },
  ];
  const tabs = allTabs.filter((t) => t.show);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-surface-2 text-text-muted inline-flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Configurações</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Personalize sua conta e o sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 lg:gap-6">
          {/* Sidebar navegação - desktop */}
          <nav className="hidden lg:flex flex-col bg-surface border border-border rounded-xl p-2 h-fit sticky top-4">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setSearch({ tab: key })}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    active
                      ? 'bg-accent-soft text-accent font-medium'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Mobile/tablet: tabs horizontais */}
          <div className="lg:hidden -mx-1">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none px-1 pb-2">
              {tabs.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSearch({ tab: key })}
                    className={cn(
                      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent text-accent-fg shadow-soft'
                        : 'bg-surface text-text-muted border border-border hover:bg-surface-2',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            {tab === 'conta' && <ProfileTab />}
            {tab === 'aparencia' && <AppearanceTab />}
            {tab === 'notificacoes' && <NotificationsTab />}
            {tab === 'tags' && <TagsTab />}
            {tab === 'respostas' && <QuickRepliesTab />}
            {tab === 'equipe' && isAdmin && me && <AttendantsTab currentUserId={me.id} />}
            {tab === 'auditoria' && isAdmin && <AuditTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
