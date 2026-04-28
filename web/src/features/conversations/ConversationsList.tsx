import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MessageCircle, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { cn, formatPhone, formatTime } from '../../lib/format';
import { Avatar, Badge, CountBadge, Input, Tabs, EmptyState, Skeleton } from '../../components/ui';

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

type FilterId = 'all' | 'unread' | 'mine' | 'unassigned';

export function ConversationsList({ selectedId }: { selectedId?: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

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

  const counts = useMemo(() => {
    const unread = conversations.filter((c) => c.unread_count > 0).length;
    const mine = conversations.filter((c) => c.assigned_to === me).length;
    return { unread, mine };
  }, [conversations, me]);

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
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text">Conversas</h2>
          {counts.unread > 0 && (
            <Badge tone="accent" size="sm" dot>
              {counts.unread} não lida{counts.unread > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <Input
          iconLeft={<Search className="w-4 h-4" />}
          placeholder="Pesquisar conversas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-3 -mx-1">
          <Tabs
            variant="pill"
            size="sm"
            value={filter}
            onChange={(v) => setFilter(v as FilterId)}
            items={[
              { id: 'all', label: 'Todas' },
              {
                id: 'unread',
                label: 'Não lidas',
                badge: counts.unread > 0 ? <CountBadge count={counts.unread} /> : undefined,
              },
              {
                id: 'mine',
                label: 'Minhas',
                badge: counts.mine > 0 ? <CountBadge count={counts.mine} /> : undefined,
              },
              { id: 'unassigned', label: 'Livres' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-11 h-11 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-7 h-7" />}
            title={search ? 'Nada encontrado' : 'Sem conversas aqui'}
            description={search ? 'Tente outro termo de busca.' : 'Conversas novas aparecerão aqui.'}
          />
        ) : (
          <ul className="py-1">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                currentUserId={me}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
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
  const phoneFmt = formatPhone(conv.contacts?.phone_number ?? null);
  const name =
    conv.contacts?.custom_name ||
    conv.contacts?.push_name ||
    phoneFmt ||
    'Sem nome';
  const isMine = conv.assigned_to === currentUserId;
  const isLockedByOther = conv.assigned_to && !isMine;
  const showPhone = phoneFmt && phoneFmt !== name;

  return (
    <li>
      <Link
        to={`/conversas/${conv.id}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors',
          selected
            ? 'bg-accent-soft'
            : 'hover:bg-surface-2',
        )}
      >
        <Avatar src={conv.contacts?.avatar_url} name={name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('font-semibold text-sm truncate', selected ? 'text-accent' : 'text-text')}>
              {name}
            </span>
            <span className="text-[11px] text-text-subtle shrink-0">
              {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
            </span>
          </div>
          {showPhone && (
            <p className="text-[11px] text-text-subtle truncate -mt-0.5">{phoneFmt}</p>
          )}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn(
              'text-xs truncate',
              conv.unread_count > 0 ? 'text-text font-medium' : 'text-text-muted',
            )}>
              {conv.last_message_preview ?? '—'}
            </span>
            {conv.unread_count > 0 && <CountBadge count={conv.unread_count} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
            {conv.instances?.name && (
              <span className="text-[10px] text-text-subtle truncate">{conv.instances.name}</span>
            )}
            {isLockedByOther && (
              <Badge tone="warning" size="xs">
                {conv.assignee?.full_name || 'Em atendimento'}
              </Badge>
            )}
            {isMine && <Badge tone="success" size="xs">Sua</Badge>}
          </div>
        </div>
      </Link>
    </li>
  );
}

export { MessageCircle };
