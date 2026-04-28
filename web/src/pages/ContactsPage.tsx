import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  FileText,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Tag as TagIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatPhone, cn } from '../lib/format';
import {
  Card,
  Button,
  Input,
  Select,
  Avatar,
  Badge,
  Skeleton,
  EmptyState,
  ConfirmDialog,
} from '../components/ui';

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
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tagId, setTagId] = useState<string>('');
  const [instanceId, setInstanceId] = useState<string>('');
  const [hasNotes, setHasNotes] = useState<'all' | 'true' | 'false'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

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

  const items = data?.items ?? [];

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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((c) => c.id)));
  }

  function exportCSV() {
    const target = selected.size > 0 ? items.filter((c) => selected.has(c.id)) : items;
    if (target.length === 0) {
      toast.error('Nada para exportar');
      return;
    }
    const header = ['Nome', 'Telefone', 'Número de origem', 'Tags', 'Notas', 'Criado em'];
    const rows = target.map((c) => [
      c.custom_name || c.push_name || '',
      formatPhone(c.phone_number),
      c.instance_name || '',
      c.tags.map((t) => t.name).join('; '),
      String(c.notes_count),
      c.created_at,
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(',')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${target.length} contato(s) exportados`);
  }

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      setBulkProgress({ done: 0, total: ids.length });
      let done = 0;
      // sequencial para não sobrecarregar storage cleanup
      for (const id of ids) {
        await api.delete(`/contacts/${id}`);
        done += 1;
        setBulkProgress({ done, total: ids.length });
      }
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} contato(s) excluído(s) permanentemente`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setBulkProgress(null);
      setConfirmBulk(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setBulkProgress(null);
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-info-soft text-info inline-flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Contatos</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {data?.total ?? 0} contato(s) cadastrado(s).
            </p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="p-3 sm:p-4 mb-4 space-y-3">
          <Input
            iconLeft={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
              <option value="">Todos os números</option>
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <Select value={tagId} onChange={(e) => setTagId(e.target.value)}>
              <option value="">Todas as tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select value={hasNotes} onChange={(e) => setHasNotes(e.target.value as typeof hasNotes)}>
              <option value="all">Todos</option>
              <option value="true">Com observações</option>
              <option value="false">Sem observações</option>
            </Select>
          </div>
        </Card>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bg-accent-soft border border-accent/30 rounded-lg px-3 py-2.5 mb-4 flex items-center justify-between gap-3 animate-fade-in">
            <span className="text-sm font-medium text-accent">
              {selected.size} selecionado{selected.size > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" iconLeft={<Download className="w-3.5 h-3.5" />} onClick={exportCSV}>
                Exportar CSV
              </Button>
              <Button
                size="sm"
                variant="danger"
                iconLeft={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setConfirmBulk(true)}
              >
                Excluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Limpar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="w-7 h-7" />}
              title="Nenhum contato encontrado"
              description={debouncedSearch ? 'Tente outro termo de busca.' : 'Os contatos aparecem aqui conforme você recebe mensagens.'}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden md:block overflow-hidden p-0">
              <div className="px-3 py-2 border-b border-border flex items-center gap-3 bg-surface-2/50">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="w-7 h-7 rounded-md hover:bg-surface-3 inline-flex items-center justify-center text-text-muted"
                  aria-label={selected.size === items.length ? 'Desmarcar todos' : 'Selecionar todos'}
                >
                  {selected.size === items.length && items.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-accent" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide flex-1">Contato</p>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide w-40">Telefone</p>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide w-40">Número</p>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide w-48">Tags</p>
                <span className="w-8" />
              </div>
              <ul className="divide-y divide-border">
                {items.map((c) => {
                  const phoneFmt = formatPhone(c.phone_number);
                  const name = c.custom_name || c.push_name || phoneFmt || 'Sem nome';
                  const isSel = selected.has(c.id);
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors',
                        isSel && 'bg-accent-soft/50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(c.id)}
                        className="w-7 h-7 rounded-md hover:bg-surface-3 inline-flex items-center justify-center text-text-muted"
                        aria-label={isSel ? 'Desmarcar' : 'Selecionar'}
                      >
                        {isSel ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openConversation(c)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <Avatar src={c.avatar_url} name={name} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text truncate">{name}</span>
                            {c.notes_count > 0 && (
                              <Badge tone="warning" size="xs">
                                <FileText className="w-3 h-3" /> {c.notes_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                      <p className="w-40 text-sm text-text-muted truncate">{phoneFmt}</p>
                      <p className="w-40 text-sm text-text-muted truncate">{c.instance_name ?? '—'}</p>
                      <div className="w-48 flex flex-wrap gap-1">
                        {c.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {c.tags.length > 2 && (
                          <span className="text-[10px] text-text-subtle">+{c.tags.length - 2}</span>
                        )}
                      </div>
                      <span className="w-8 flex justify-end">
                        <TagIcon className="w-3.5 h-3.5 text-text-subtle" />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* Mobile cards */}
            <ul className="md:hidden space-y-2">
              {items.map((c) => {
                const phoneFmt = formatPhone(c.phone_number);
                const name = c.custom_name || c.push_name || phoneFmt || 'Sem nome';
                const isSel = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <Card
                      className={cn(
                        'p-3 flex items-center gap-3',
                        isSel && 'bg-accent-soft/40 border-accent/30',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(c.id)}
                        className="w-8 h-8 rounded-md hover:bg-surface-2 inline-flex items-center justify-center text-text-muted shrink-0"
                      >
                        {isSel ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openConversation(c)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <Avatar src={c.avatar_url} name={name} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text truncate">{name}</span>
                            {c.notes_count > 0 && (
                              <FileText className="w-3.5 h-3.5 text-warning shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-text-muted truncate">
                            {phoneFmt}
                            {c.instance_name && ` · ${c.instance_name}`}
                          </p>
                          {c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.tags.slice(0, 3).map((t) => (
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
                      </button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => !bulkDelete.isPending && setConfirmBulk(false)}
        onConfirm={() => bulkDelete.mutateAsync(Array.from(selected))}
        title={`Excluir ${selected.size} contato(s) permanentemente?`}
        description={
          <>
            Vai apagar todas as conversas, mensagens e arquivos do sistema.{' '}
            <span className="text-text-subtle">Não reflete no WhatsApp do celular.</span>
            {bulkProgress && (
              <p className="mt-2 text-text font-medium">
                {bulkProgress.done} de {bulkProgress.total} excluídos…
              </p>
            )}
          </>
        }
        confirmLabel={bulkProgress ? `Excluindo… (${bulkProgress.done}/${bulkProgress.total})` : 'Excluir definitivamente'}
        tone="danger"
        requireText="EXCLUIR"
        loading={bulkDelete.isPending}
      />
    </div>
  );
}
