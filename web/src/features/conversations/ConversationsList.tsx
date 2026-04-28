import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { cn, formatTime } from '../../lib/format';

interface ConversationListItem {
  id: string;
  instance_id: string;
  contact_id: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  archived: boolean;
  pinned: boolean;
  assigned_to: string | null;
  contacts: {
    push_name: string | null;
    custom_name: string | null;
    avatar_url: string | null;
    phone_number: string | null;
  } | null;
  instances: { name: string } | null;
  assignee?: { full_name: string } | null;
}

type Filter = 'all' | 'unread' | 'mine' | 'unassigned';

export function ConversationsList({ selectedId }: { selectedId?: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [me, setMe] = useState<string | null>(null);

  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
      return data.user;
    },
  });

  const { data: conversations = [], isLoading } = useQuery<ConversationListItem[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `id, instance_id, contact_id, unread_count, last_message_at, last_message_preview,
           archived, pinned, assigned_to,
           contacts (push_name, custom_name, avatar_url, phone_number),
           instances (name),
           assignee:assigned_to (full_name)`,
        )
        .eq('archived', false)
        .order('pinned', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<
        Omit<ConversationListItem, 'contacts' | 'instances' | 'assignee'> & {
          contacts: ConversationListItem['contacts'] | ConversationListItem['contacts'][];
          instances: ConversationListItem['instances'] | ConversationListItem['instances'][];
          assignee?: ConversationListItem['assignee'] | ConversationListItem['assignee'][];
        }
      >;
      return rows.map((r) => ({
        ...r,
        contacts: Array.isArray(r.contacts) ? r.contacts[0] ?? null : r.contacts,
        instances: Array.isArray(r.instances) ? r.instances[0] ?? null : r.instances,
        assignee: Array.isArray(r.assignee) ? r.assignee[0] ?? null : r.assignee,
      })) as ConversationListItem[];
    },
  });

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => c.unread_count > 0);
    if (filter === 'mine') list = list.filter((c) => c.assigned_to === me);
    if (filter === 'unassigned') list = list.filter((c) => !c.assigned_to);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const name =
          c.contacts?.custom_name || c.contacts?.push_name || c.contacts?.phone_number || '';
        const preview = c.last_message_preview || '';
        return (
          name.toLowerCase().includes(q) ||
          preview.toLowerCase().includes(q) ||
          (c.contacts?.phone_number ?? '').includes(q)
        );
      });
    }
    return list;
  }, [conversations, filter, search, me]);

  return (
    <>
      <div className="h-14 px-4 flex items-center border-b border-wa-divider dark:border-wa-divider-dark">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="w-5 h-5" /> Conversas
        </h2>
      </div>

      <div className="p-3 border-b border-wa-divider dark:border-wa-divider-dark space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-wa-muted" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {([
            ['all', 'Todas'],
            ['unread', 'Não lidas'],
            ['mine', 'Minhas'],
            ['unassigned', 'Livres'],
          ] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'text-xs px-3 py-1 rounded-full transition-colors',
                filter === key
                  ? 'bg-wa-green-dark text-white'
                  : 'bg-wa-divider dark:bg-wa-divider-dark text-wa-muted hover:text-wa-text dark:hover:text-wa-text-dark',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-wa-divider dark:bg-wa-divider-dark animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-wa-muted text-sm">Nenhuma conversa</div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              selected={conv.id === selectedId}
              currentUserId={me}
            />
          ))
        )}
      </div>
    </>
  );
}

function ConversationItem({
  conv,
  selected,
  currentUserId,
}: {
  conv: ConversationListItem;
  selected: boolean;
  currentUserId: string | null;
}) {
  const name =
    conv.contacts?.custom_name ||
    conv.contacts?.push_name ||
    conv.contacts?.phone_number ||
    'Sem nome';
  const initials = name.slice(0, 2).toUpperCase();
  const isMine = conv.assigned_to === currentUserId;
  const isLockedByOther = conv.assigned_to && !isMine;

  return (
    <Link
      to={`/conversas/${conv.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-3 border-b border-wa-divider dark:border-wa-divider-dark cursor-pointer hover:bg-wa-divider dark:hover:bg-wa-divider-dark transition-colors',
        selected && 'bg-wa-divider dark:bg-wa-divider-dark',
      )}
    >
      <div className="relative shrink-0">
        {conv.contacts?.avatar_url ? (
          <img
            src={conv.contacts.avatar_url}
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{name}</span>
          <span className="text-xs text-wa-muted shrink-0">
            {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-wa-muted truncate">
            {conv.last_message_preview ?? '...'}
          </span>
          {conv.unread_count > 0 && (
            <span className="bg-wa-green-dark text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-wa-muted">{conv.instances?.name}</span>
          {isLockedByOther && (
            <span className="text-[10px] text-amber-600 truncate">
              · {conv.assignee?.full_name || 'Em atendimento'}
            </span>
          )}
          {isMine && (
            <span className="text-[10px] text-emerald-600 font-medium">· Sua</span>
          )}
        </div>
      </div>
    </Link>
  );
}
