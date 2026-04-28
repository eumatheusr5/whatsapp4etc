import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings, User, Tag as TagIcon, MessageSquare, Users as UsersIcon } from 'lucide-react';
import { cn } from '../lib/format';
import { api } from '../lib/api';
import { ProfileTab } from '../features/settings/ProfileTab';
import { TagsTab } from '../features/settings/TagsTab';
import { QuickRepliesTab } from '../features/settings/QuickRepliesTab';
import { AttendantsTab } from '../features/settings/AttendantsTab';

interface MeResponse {
  id: string;
  role: 'admin' | 'atendente';
}

type TabKey = 'perfil' | 'tags' | 'respostas' | 'atendentes';

export function SettingsPage() {
  const [search, setSearch] = useSearchParams();
  const tab = (search.get('tab') as TabKey) || 'perfil';

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeResponse>('/users/me'),
    staleTime: 5 * 60_000,
  });

  const isAdmin = me?.role === 'admin';

  const TABS: Array<{ key: TabKey; label: string; icon: typeof Settings; show: boolean }> = [
    { key: 'perfil', label: 'Perfil', icon: User, show: true },
    { key: 'tags', label: 'Tags', icon: TagIcon, show: true },
    { key: 'respostas', label: 'Respostas rápidas', icon: MessageSquare, show: true },
    { key: 'atendentes', label: 'Atendentes', icon: UsersIcon, show: !!isAdmin },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Settings className="w-6 h-6" />
        <h1 className="text-xl sm:text-2xl font-semibold">Configurações</h1>
      </div>

      <div className="flex gap-1 mb-4 border-b border-wa-divider dark:border-wa-divider-dark overflow-x-auto">
        {TABS.filter((t) => t.show).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSearch({ tab: key })}
            className={cn(
              'flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap',
              tab === key
                ? 'border-wa-green-dark text-wa-green-dark dark:text-wa-green font-medium'
                : 'border-transparent text-wa-muted hover:text-wa-text dark:hover:text-wa-text-dark',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && <ProfileTab />}
      {tab === 'tags' && <TagsTab />}
      {tab === 'respostas' && <QuickRepliesTab />}
      {tab === 'atendentes' && isAdmin && me && <AttendantsTab currentUserId={me.id} />}
    </div>
  );
}
