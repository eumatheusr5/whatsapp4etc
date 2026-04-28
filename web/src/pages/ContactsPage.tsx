import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, FileText, Tag as TagIcon } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/format';

interface ContactItem {
  id: string;
  jid: string;
  push_name: string | null;
  custom_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  is_blocked: boolean;
  instance_id: string;
  instance_name: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  notes_count: number;
  created_at: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface Instance {
  id: string;
  name: string;
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tagId, setTagId] = useState<string>('');
  const [instanceId, setInstanceId] = useState<string>('');
  const [hasNotes, setHasNotes] = useState<'all' | 'true' | 'false'>('all');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('limit', '100');
    if (debouncedSearch) sp.set('search', debouncedSearch);
    if (tagId) sp.set('tagId', tagId);
    if (instanceId) sp.set('instanceId', instanceId);
    if (hasNotes !== 'all') sp.set('hasNotes', hasNotes);
    return sp.toString();
  }, [debouncedSearch, tagId, instanceId, hasNotes]);

  const { data, isLoading } = useQuery<{ items: ContactItem[]; total: number }>({
    queryKey: ['contacts', params],
    queryFn: () => api.get(`/contacts?${params}`),
    staleTime: 60_000,
  });

  const { data: tags = [] } = useQuery<TagItem[]>({
    queryKey: ['tags'],
    queryFn: () => api.get<TagItem[]>('/tags'),
    staleTime: 5 * 60_000,
  });

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: () => api.get<Instance[]>('/instances'),
    staleTime: 60_000,
  });

  async function openConversation(contact: ContactItem) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (conv?.id) {
      navigate(`/conversas/${conv.id}`);
      return;
    }
    navigate('/conversas');
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Users className="w-6 h-6" />
        <h1 className="text-xl sm:text-2xl font-semibold">Contatos</h1>
        <span className="text-sm text-wa-muted">({data?.total ?? 0})</span>
      </div>

      <div className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark p-3 sm:p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-wa-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-[180px] text-sm"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
          >
            <option value="">Todos os números</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[180px] text-sm"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">Todas as tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[180px] text-sm"
            value={hasNotes}
            onChange={(e) => setHasNotes(e.target.value as 'all' | 'true' | 'false')}
          >
            <option value="all">Todos</option>
            <option value="true">Com observações</option>
            <option value="false">Sem observações</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-wa-divider dark:bg-wa-divider-dark animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-8 text-center text-wa-muted border border-wa-divider dark:border-wa-divider-dark">
          Nenhum contato encontrado.
        </div>
      ) : (
        <div className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark divide-y divide-wa-divider dark:divide-wa-divider-dark overflow-hidden">
          {data!.items.map((c) => {
            const phoneFmt = formatPhone(c.phone_number);
            const name = c.custom_name || c.push_name || phoneFmt || 'Sem nome';
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => void openConversation(c)}
                className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-wa-divider dark:hover:bg-wa-divider-dark text-left transition-colors"
              >
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={name}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm font-medium shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{name}</span>
                    {c.notes_count > 0 && (
                      <span title={`${c.notes_count} observação(ões)`}>
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-wa-muted truncate">
                    {phoneFmt && phoneFmt !== name ? phoneFmt : ''}
                    {c.instance_name ? ` · ${c.instance_name}` : ''}
                  </div>
                  {c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.tags.map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <TagIcon className="w-4 h-4 text-wa-muted shrink-0 hidden sm:block" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
