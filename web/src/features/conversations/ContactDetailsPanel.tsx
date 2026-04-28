import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  Image as ImageIcon,
  Mic,
  FileText,
  Clock,
  Phone,
  X,
  Trash,
  StickyNote,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { formatPhone, formatRelative, cn } from '../../lib/format';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Textarea,
  Tabs,
  EmptyState,
} from '../../components/ui';
import { useLightbox } from '../../components/LightboxProvider';

interface Contact {
  id: string;
  push_name: string | null;
  custom_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  jid: string;
  custom_fields: Record<string, string>;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  user?: { full_name: string } | null;
}

interface MediaItem {
  id: string;
  type: string;
  media_path: string | null;
  media_url: string | null;
  body: string | null;
  wa_timestamp: string;
  duration_sec: number | null;
}

type SubTab = 'info' | 'media' | 'audio' | 'docs' | 'history';

interface Props {
  contactId: string;
  conversationId: string;
  onClose?: () => void;
  variant?: 'panel' | 'modal';
}

export function ContactDetailsPanel({ contactId, conversationId, onClose, variant = 'panel' }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SubTab>('info');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: contact } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, push_name, custom_name, avatar_url, phone_number, jid, custom_fields')
        .eq('id', contactId)
        .single();
      if (error) throw error;
      return data as Contact;
    },
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('*').order('name');
      return (data ?? []) as Tag[];
    },
  });

  const { data: contactTagIds = [] } = useQuery<string[]>({
    queryKey: ['contact-tags', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId);
      return (data ?? []).map((r) => r.tag_id);
    },
  });

  const { data: contactNotes = [] } = useQuery<NoteRow[]>({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_notes')
        .select('id, body, created_at, user_id, user:user_id (full_name)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      return (data ?? []) as unknown as NoteRow[];
    },
  });

  const { data: media = [] } = useQuery<MediaItem[]>({
    queryKey: ['contact-media', contactId, tab],
    enabled: tab === 'media' || tab === 'audio' || tab === 'docs',
    queryFn: async () => {
      const wantedTypes =
        tab === 'media'
          ? ['image', 'video', 'sticker']
          : tab === 'audio'
            ? ['audio', 'ptt']
            : ['document'];
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId);
      const convIds = (convs ?? []).map((c) => c.id);
      if (convIds.length === 0) return [];
      const { data } = await supabase
        .from('messages')
        .select('id, type, media_path, media_url, body, wa_timestamp, duration_sec')
        .in('conversation_id', convIds)
        .in('type', wantedTypes)
        .order('wa_timestamp', { ascending: false })
        .limit(120);
      return (data ?? []) as MediaItem[];
    },
  });

  const updateName = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from('contacts').update({ custom_name: n }).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] });
      qc.invalidateQueries({ queryKey: ['conversation'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setEditingName(false);
      toast.success('Nome atualizado');
    },
  });

  const toggleTag = useMutation({
    mutationFn: async ({ tagId, has }: { tagId: string; has: boolean }) => {
      if (has) {
        const { error } = await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId)
          .eq('tag_id', tagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contact_tags')
          .insert({ contact_id: contactId, tag_id: tagId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tags', contactId] }),
  });

  const addNote = useMutation({
    mutationFn: async (body: string) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('contact_notes')
        .insert({ contact_id: contactId, body, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      setContactNote('');
      qc.invalidateQueries({ queryKey: ['contact-notes', contactId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contact_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-notes', contactId] }),
  });

  const deleteContact = useMutation({
    mutationFn: () => api.delete(`/contacts/${contactId}`),
    onSuccess: () => {
      toast.success('Contato excluído permanentemente');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      void conversationId;
      navigate('/conversas');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayName = useMemo(
    () =>
      contact?.custom_name ||
      contact?.push_name ||
      formatPhone(contact?.phone_number ?? null) ||
      'Contato',
    [contact],
  );

  if (!contact) {
    return (
      <div className={cn(variant === 'panel' && 'w-[340px] border-l border-border')}>
        <div className="p-4 text-text-muted text-sm">Carregando…</div>
      </div>
    );
  }

  const phoneFmt = formatPhone(contact.phone_number);

  return (
    <aside
      className={cn(
        'bg-surface flex flex-col h-full',
        variant === 'panel' && 'w-[340px] shrink-0 border-l border-border',
      )}
    >
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-text">Detalhes do contato</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-text-muted hover:bg-surface-2 inline-flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-4 py-5 flex flex-col items-center text-center border-b border-border">
        <Avatar src={contact.avatar_url} name={displayName} size="2xl" />
        <div className="mt-3 w-full">
          {editingName ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && updateName.mutate(name.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) updateName.mutate(name.trim());
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="text-center"
            />
          ) : (
            <button
              onClick={() => {
                setName(displayName);
                setEditingName(true);
              }}
              className="inline-flex items-center gap-2 text-base font-semibold text-text hover:text-accent"
            >
              <span className="truncate max-w-[220px]">{displayName}</span>
              <Pencil className="w-3.5 h-3.5 text-text-muted shrink-0" />
            </button>
          )}
        </div>
        {phoneFmt && (
          <a
            href={`tel:+${(contact.phone_number || '').replace(/\D/g, '')}`}
            className="mt-1 text-sm text-text-muted hover:text-accent inline-flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" />
            {phoneFmt}
          </a>
        )}
      </div>

      <div className="px-2 pt-2 border-b border-border">
        <Tabs
          variant="underline"
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as SubTab)}
          fullWidth
          items={[
            { id: 'info', label: 'Info', icon: <StickyNote className="w-3.5 h-3.5" /> },
            { id: 'media', label: 'Mídia', icon: <ImageIcon className="w-3.5 h-3.5" /> },
            { id: 'audio', label: 'Áudios', icon: <Mic className="w-3.5 h-3.5" /> },
            { id: 'docs', label: 'Docs', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'history', label: 'Histórico', icon: <Clock className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'info' && (
          <div className="p-4 space-y-5">
            <Section title="Tags">
              {tags.length === 0 ? (
                <p className="text-xs text-text-subtle">Nenhuma tag cadastrada. Crie em Configurações.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const has = contactTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTag.mutate({ tagId: t.id, has })}
                        className={cn(
                          'inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-all',
                          has ? 'shadow-soft' : 'opacity-70 hover:opacity-100',
                        )}
                        style={{
                          backgroundColor: has ? t.color : 'transparent',
                          color: has ? '#fff' : t.color,
                          borderColor: t.color,
                        }}
                      >
                        <TagIcon className="w-3 h-3" />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title="Observações">
              <Textarea
                placeholder="Adicione uma observação sobre este contato…"
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                fullWidth
                className="mt-2"
                disabled={!contactNote.trim()}
                onClick={() => addNote.mutate(contactNote.trim())}
                loading={addNote.isPending}
                iconLeft={<Plus className="w-3.5 h-3.5" />}
              >
                Adicionar observação
              </Button>
              <NotesList notes={contactNotes} onRemove={(id) => removeNote.mutate(id)} />
            </Section>

            <Section title="Zona de risco">
              <Button
                variant="danger"
                size="sm"
                fullWidth
                iconLeft={<Trash className="w-4 h-4" />}
                onClick={() => setConfirmDelete(true)}
              >
                Excluir contato permanentemente
              </Button>
              <p className="text-[11px] text-text-subtle mt-2">
                Apaga o contato, todas as mensagens, conversas e arquivos do sistema. Não afeta o WhatsApp do celular.
              </p>
            </Section>
          </div>
        )}

        {tab === 'media' && <MediaGrid items={media} type="media" />}
        {tab === 'audio' && <AudioList items={media} />}
        {tab === 'docs' && <DocsList items={media} />}
        {tab === 'history' && (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="Histórico"
            description="Eventos de atribuição e arquivamento aparecerão aqui."
            className="py-10"
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteContact.mutateAsync().then(() => setConfirmDelete(false))}
        title="Excluir contato permanentemente?"
        description={
          <>
            Isso vai apagar o contato <strong>{displayName}</strong>, todas as conversas, mensagens
            e arquivos do sistema. <br />
            <span className="text-text-subtle">Não reflete no WhatsApp do celular.</span>
          </>
        }
        confirmLabel="Excluir definitivamente"
        tone="danger"
        requireText={displayName}
        loading={deleteContact.isPending}
      />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function NotesList({ notes, onRemove }: { notes: NoteRow[]; onRemove: (id: string) => void }) {
  if (notes.length === 0) {
    return <p className="text-xs text-text-subtle mt-3">Nenhuma observação ainda.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      {notes.map((n) => (
        <div
          key={n.id}
          className="bg-surface-2 border border-border rounded-lg p-2.5 text-sm group relative"
        >
          <div className="whitespace-pre-wrap break-words text-text">{n.body}</div>
          <div className="text-[10px] text-text-subtle mt-1.5">
            {n.user?.full_name ?? 'Usuário'} · {formatRelative(n.created_at)}
          </div>
          <button
            onClick={() => onRemove(n.id)}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-danger hover:bg-danger-soft rounded p-1 transition-opacity"
            aria-label="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function MediaGrid({ items, type }: { items: MediaItem[]; type: 'media' }) {
  void type;
  const lightbox = useLightbox();
  const images = useMemo(
    () => items.filter((m) => (m.type === 'image' || m.type === 'sticker') && m.media_url),
    [items],
  );
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="w-6 h-6" />}
        title="Nenhuma mídia"
        description="Imagens e vídeos compartilhados aparecerão aqui."
        className="py-10"
      />
    );
  }
  return (
    <div className="p-3 grid grid-cols-3 gap-1.5">
      {items.map((m) => {
        if ((m.type === 'image' || m.type === 'sticker') && m.media_url) {
          return (
            <button
              key={m.id}
              onClick={() =>
                lightbox.open({
                  images: images.map((im) => ({ url: im.media_url!, caption: im.body ?? undefined })),
                  startIndex: images.findIndex((im) => im.id === m.id),
                })
              }
              className="aspect-square bg-surface-2 rounded-md overflow-hidden hover:opacity-90"
            >
              <img src={m.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          );
        }
        if (m.type === 'video' && m.media_url) {
          return (
            <a
              key={m.id}
              href={m.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square bg-black rounded-md overflow-hidden text-white text-xs flex items-center justify-center"
            >
              ▶ Vídeo
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}

function AudioList({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Mic className="w-6 h-6" />}
        title="Nenhum áudio"
        description="Áudios e mensagens de voz aparecerão aqui."
        className="py-10"
      />
    );
  }
  return (
    <div className="p-3 space-y-2">
      {items.map((m) => (
        <div key={m.id} className="bg-surface-2 border border-border rounded-lg p-2.5">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Mic className="w-3.5 h-3.5 text-accent" />
            <span>{m.type === 'ptt' ? 'Mensagem de voz' : 'Áudio'}</span>
            {m.duration_sec ? <Badge tone="neutral" size="xs">{m.duration_sec}s</Badge> : null}
            <span className="ml-auto text-text-subtle">{formatRelative(m.wa_timestamp)}</span>
          </div>
          {m.media_url && (
            <audio controls preload="none" className="w-full mt-2 h-8">
              <source src={m.media_url} />
            </audio>
          )}
        </div>
      ))}
    </div>
  );
}

function DocsList({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-6 h-6" />}
        title="Nenhum documento"
        description="PDFs e arquivos compartilhados aparecerão aqui."
        className="py-10"
      />
    );
  }
  return (
    <ul className="p-3 space-y-1.5">
      {items.map((m) => (
        <li key={m.id}>
          <a
            href={m.media_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-surface hover:bg-surface-2"
          >
            <div className="w-9 h-9 rounded-md bg-info-soft text-info-fg flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text truncate">{m.body || 'Documento'}</p>
              <p className="text-xs text-text-subtle">{formatRelative(m.wa_timestamp)}</p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
