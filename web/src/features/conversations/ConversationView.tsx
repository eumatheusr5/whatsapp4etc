import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, MoreVertical, ArrowLeft, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { MessagesList } from '../messages/MessagesList';
import { Composer } from '../messages/Composer';
import { ContactPanel } from '../contacts/ContactPanel';
import { formatPhone } from '../../lib/format';

interface ConvDetail {
  id: string;
  instance_id: string;
  contact_id: string;
  assigned_to: string | null;
  contact: {
    id: string;
    push_name: string | null;
    custom_name: string | null;
    avatar_url: string | null;
    phone_number: string | null;
    presence: string;
    presence_updated_at: string | null;
    last_seen_at: string | null;
    jid: string;
  };
  instance: { name: string; status: string };
  assignee?: { id: string; full_name: string } | null;
}

export function ConversationView({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: conv } = useQuery<ConvDetail>({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `id, instance_id, contact_id, assigned_to,
           contact:contacts!inner (id, push_name, custom_name, avatar_url, phone_number, presence, presence_updated_at, last_seen_at, jid),
           instance:instances!inner (name, status),
           assignee:assigned_to (id, full_name)`,
        )
        .eq('id', conversationId)
        .single();
      if (error) throw error;
      return data as unknown as ConvDetail;
    },
  });

  // Marca como lida ao abrir
  useEffect(() => {
    if (!conversationId) return;
    void api.post(`/conversations/${conversationId}/read`).catch(() => undefined);
  }, [conversationId]);

  const assign = useMutation({
    mutationFn: () => api.post(`/conversations/${conversationId}/assign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Você assumiu a conversa');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: () => api.post(`/conversations/${conversationId}/release`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa liberada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!conv) return null;

  const phoneFmt = formatPhone(conv.contact?.phone_number ?? conv.contact?.jid ?? null);
  const name =
    conv.contact?.custom_name || conv.contact?.push_name || phoneFmt || '?';
  const initials = name.slice(0, 2).toUpperCase();
  const isMine = conv.assigned_to === me;
  const isLockedByOther = !!conv.assigned_to && !isMine;
  const presenceText = getPresenceText(conv.contact);
  const showPhoneLine = phoneFmt && phoneFmt !== name;

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-4 flex items-center gap-3 border-b border-wa-divider dark:border-wa-divider-dark bg-wa-panel dark:bg-wa-panel-dark">
          <button
            onClick={() => navigate('/conversas')}
            className="md:hidden p-1 hover:bg-wa-divider dark:hover:bg-wa-divider-dark rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80"
          >
            {conv.contact.avatar_url ? (
              <img
                src={conv.contact.avatar_url}
                alt={name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm font-medium">
                {initials}
              </div>
            )}
            <div className="text-left min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                <span className="truncate">{name}</span>
                {showPhoneLine && (
                  <span className="hidden sm:inline text-xs font-normal text-wa-muted truncate">
                    {phoneFmt}
                  </span>
                )}
              </div>
              <div className="text-xs text-wa-muted truncate">
                {showPhoneLine && (
                  <span className="sm:hidden mr-2">{phoneFmt} ·</span>
                )}
                {presenceText ? `${presenceText} · ` : ''}
                {conv.instance.name}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {isLockedByOther ? (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full px-3 py-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {conv.assignee?.full_name}
              </span>
            ) : isMine ? (
              <button
                onClick={() => release.mutate()}
                className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full px-3 py-1 flex items-center gap-1 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                disabled={release.isPending}
              >
                <Unlock className="w-3 h-3" /> Liberar
              </button>
            ) : (
              <button
                onClick={() => assign.mutate()}
                className="text-xs bg-wa-green-dark text-white rounded-full px-3 py-1 hover:bg-wa-green-darker"
                disabled={assign.isPending}
              >
                Assumir
              </button>
            )}
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="p-2 hover:bg-wa-divider dark:hover:bg-wa-divider-dark rounded-lg"
              title="Perfil"
            >
              <Info className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-wa-divider dark:hover:bg-wa-divider-dark rounded-lg">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>

        <MessagesList conversationId={conversationId} contactJid={conv.contact.jid} />
        <Composer
          conversationId={conversationId}
          locked={isLockedByOther}
          assignedToOther={!!conv.assignee && conv.assignee.id !== me ? conv.assignee.full_name : null}
          instanceStatus={conv.instance.status}
        />
      </div>

      {showProfile && (
        <ContactPanel
          contactId={conv.contact.id}
          conversationId={conversationId}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}

function getPresenceText(c: { presence: string; last_seen_at: string | null }): string {
  if (c.presence === 'composing') return 'digitando...';
  if (c.presence === 'recording') return 'gravando áudio...';
  if (c.presence === 'available') return 'online';
  if (c.last_seen_at) {
    return `visto por último ${new Date(c.last_seen_at).toLocaleString('pt-BR')}`;
  }
  return '';
}
