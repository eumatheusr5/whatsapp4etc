import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatPhone, formatRelative } from '../../lib/format';

interface Contact {
  id: string;
  push_name: string | null;
  custom_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
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
  user?: { full_name: string };
}

export function ContactPanel({
  contactId,
  conversationId,
  onClose,
}: {
  contactId: string;
  conversationId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [convNote, setConvNote] = useState('');

  const { data: contact } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, push_name, custom_name, avatar_url, phone_number, custom_fields')
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

  const { data: contactTags = [] } = useQuery<string[]>({
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

  const { data: convNotes = [] } = useQuery<NoteRow[]>({
    queryKey: ['conv-notes', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_notes')
        .select('id, body, created_at, user_id, user:user_id (full_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      return (data ?? []) as unknown as NoteRow[];
    },
  });

  const updateName = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ custom_name: n })
        .eq('id', contactId);
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

  const addContactNote = useMutation({
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

  const addConvNote = useMutation({
    mutationFn: async (body: string) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('conversation_notes')
        .insert({ conversation_id: conversationId, body, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      setConvNote('');
      qc.invalidateQueries({ queryKey: ['conv-notes', conversationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async ({ table, id }: { table: 'contact_notes' | 'conversation_notes'; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.table === 'contact_notes')
        qc.invalidateQueries({ queryKey: ['contact-notes', contactId] });
      else qc.invalidateQueries({ queryKey: ['conv-notes', conversationId] });
    },
  });

  if (!contact) return null;

  const displayName = contact.custom_name || contact.push_name || formatPhone(contact.phone_number);
  const initials = (displayName || '??').slice(0, 2).toUpperCase();

  return (
    <aside className="w-80 shrink-0 border-l border-wa-divider dark:border-wa-divider-dark bg-wa-panel dark:bg-wa-panel-dark overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b border-wa-divider dark:border-wa-divider-dark">
        <h3 className="font-semibold">Perfil do contato</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-wa-divider dark:hover:bg-wa-divider-dark">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col items-center border-b border-wa-divider dark:border-wa-divider-dark">
        {contact.avatar_url ? (
          <img src={contact.avatar_url} className="w-24 h-24 rounded-full object-cover" alt={displayName} />
        ) : (
          <div className="w-24 h-24 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-2xl font-medium">
            {initials}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {editingName ? (
            <>
              <input
                autoFocus
                value={name || displayName || ''}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name && updateName.mutate(name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name) updateName.mutate(name);
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="input"
              />
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <button onClick={() => { setName(displayName ?? ''); setEditingName(true); }} className="p-1">
                <Pencil className="w-3.5 h-3.5 text-wa-muted" />
              </button>
            </>
          )}
        </div>
        <p className="text-sm text-wa-muted">{formatPhone(contact.phone_number)}</p>
      </div>

      <Section title="Tags">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const has = contactTags.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTag.mutate({ tagId: t.id, has })}
                className="text-xs rounded-full px-2.5 py-1 transition-opacity"
                style={{
                  backgroundColor: has ? t.color : 'transparent',
                  color: has ? '#fff' : t.color,
                  border: `1px solid ${t.color}`,
                  opacity: has ? 1 : 0.7,
                }}
              >
                <TagIcon className="w-3 h-3 inline mr-1" />
                {t.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Notas do contato">
        <textarea
          placeholder="Adicione uma nota sobre este contato (visível em todas as conversas dele)..."
          value={contactNote}
          onChange={(e) => setContactNote(e.target.value)}
          rows={2}
          className="input mb-2 resize-none"
        />
        <button
          disabled={!contactNote.trim()}
          onClick={() => addContactNote.mutate(contactNote.trim())}
          className="btn-primary text-xs w-full"
        >
          <Plus className="w-3 h-3" /> Adicionar nota
        </button>
        <NotesList
          notes={contactNotes}
          onRemove={(id) => removeNote.mutate({ table: 'contact_notes', id })}
        />
      </Section>

      <Section title="Notas da conversa">
        <textarea
          placeholder="Notas internas desta conversa..."
          value={convNote}
          onChange={(e) => setConvNote(e.target.value)}
          rows={2}
          className="input mb-2 resize-none"
        />
        <button
          disabled={!convNote.trim()}
          onClick={() => addConvNote.mutate(convNote.trim())}
          className="btn-primary text-xs w-full"
        >
          <Plus className="w-3 h-3" /> Adicionar nota
        </button>
        <NotesList
          notes={convNotes}
          onRemove={(id) => removeNote.mutate({ table: 'conversation_notes', id })}
        />
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-wa-divider dark:border-wa-divider-dark">
      <h4 className="text-xs font-semibold text-wa-muted uppercase mb-3">{title}</h4>
      {children}
    </div>
  );
}

function NotesList({ notes, onRemove }: { notes: NoteRow[]; onRemove: (id: string) => void }) {
  if (!notes.length) return <p className="text-xs text-wa-muted mt-3">Nenhuma nota ainda.</p>;
  return (
    <div className="mt-3 space-y-2">
      {notes.map((n) => (
        <div
          key={n.id}
          className="bg-wa-bubble dark:bg-wa-bubble-dark border border-wa-divider dark:border-wa-divider-dark rounded-lg p-2 text-sm group relative"
        >
          <div className="whitespace-pre-wrap break-words">{n.body}</div>
          <div className="text-[10px] text-wa-muted mt-1">
            {n.user?.full_name ?? 'Usuário'} · {formatRelative(n.created_at)}
          </div>
          <button
            onClick={() => onRemove(n.id)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded p-1"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
