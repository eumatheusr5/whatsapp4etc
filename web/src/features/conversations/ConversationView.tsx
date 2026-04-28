import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Unlock,
  ArrowLeft,
  Info,
  MoreVertical,
  Archive,
  Trash2,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { MessagesList } from '../messages/MessagesList';
import { Composer } from '../messages/Composer';
import { ContactDetailsPanel } from './ContactDetailsPanel';
import { formatPhone } from '../../lib/format';
import { translatePresence } from '../../lib/labels';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DropdownMenu,
} from '../../components/ui';

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

interface Props {
  conversationId: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  /** Em mobile sm, ao voltar pra lista. */
  onBack?: () => void;
  /** Se true, renderiza painel de detalhes inline (lg) em vez de modal. */
  detailsAsPanel?: boolean;
}

export function ConversationView({
  conversationId,
  showDetails,
  onToggleDetails,
  onBack,
  detailsAsPanel,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ archived: true })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa arquivada');
      navigate('/conversas');
    },
  });

  const deleteContact = useMutation({
    mutationFn: () => api.delete(`/contacts/${conv?.contact.id}`),
    onSuccess: () => {
      toast.success('Contato excluído permanentemente');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/conversas');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!conv) return null;

  const phoneFmt = formatPhone(conv.contact?.phone_number ?? conv.contact?.jid ?? null);
  const name = conv.contact?.custom_name || conv.contact?.push_name || phoneFmt || '?';
  const isMine = conv.assigned_to === me;
  const isLockedByOther = !!conv.assigned_to && !isMine;
  const presenceText = translatePresence(conv.contact.presence);

  return (
    <div className="h-full flex bg-bg">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-3 sm:px-4 flex items-center gap-2 sm:gap-3 border-b border-border bg-surface">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden w-9 h-9 rounded-md text-text-muted hover:bg-surface-2 inline-flex items-center justify-center"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onToggleDetails}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 text-left"
          >
            <Avatar src={conv.contact.avatar_url} name={name} size="md" status={conv.contact.presence === 'available' ? 'online' : null} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text truncate">{name}</span>
                {isMine && <Badge tone="success" size="xs">Sua</Badge>}
              </div>
              <div className="text-xs text-text-muted truncate flex items-center gap-1.5">
                {phoneFmt && <span>{phoneFmt}</span>}
                {presenceText && (
                  <>
                    <span className="text-text-subtle">·</span>
                    <span className={conv.contact.presence === 'composing' || conv.contact.presence === 'recording' ? 'text-accent font-medium' : ''}>
                      {presenceText}
                    </span>
                  </>
                )}
                <span className="text-text-subtle">·</span>
                <span className="truncate">{conv.instance.name}</span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            {isLockedByOther ? (
              <Badge tone="warning" size="sm">
                <Lock className="w-3 h-3" />
                <span className="hidden sm:inline">{conv.assignee?.full_name}</span>
              </Badge>
            ) : isMine ? (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Unlock className="w-3.5 h-3.5" />}
                onClick={() => release.mutate()}
                loading={release.isPending}
              >
                <span className="hidden sm:inline">Liberar</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<UserCheck className="w-3.5 h-3.5" />}
                onClick={() => assign.mutate()}
                loading={assign.isPending}
              >
                <span className="hidden sm:inline">Assumir</span>
              </Button>
            )}
            <button
              onClick={onToggleDetails}
              className={`w-9 h-9 rounded-md inline-flex items-center justify-center ${showDetails ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-2'}`}
              aria-label="Detalhes"
            >
              <Info className="w-5 h-5" />
            </button>
            <DropdownMenu
              trigger={
                <span className="w-9 h-9 rounded-md text-text-muted hover:bg-surface-2 inline-flex items-center justify-center">
                  <MoreVertical className="w-5 h-5" />
                </span>
              }
              items={[
                {
                  id: 'archive',
                  label: 'Arquivar conversa',
                  icon: <Archive className="w-4 h-4" />,
                  onClick: () => archive.mutate(),
                },
                { id: 'sep', label: '', separator: true },
                {
                  id: 'delete-contact',
                  label: 'Excluir contato permanentemente',
                  icon: <Trash2 className="w-4 h-4" />,
                  destructive: true,
                  onClick: () => setConfirmDelete(true),
                },
              ]}
            />
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

      {/* Painel de detalhes inline (lg) */}
      {detailsAsPanel && showDetails && (
        <ContactDetailsPanel
          contactId={conv.contact.id}
          conversationId={conversationId}
          onClose={onToggleDetails}
        />
      )}

      {/* Painel de detalhes em modal (sm/md) */}
      {!detailsAsPanel && (
        <Dialog
          open={showDetails}
          onClose={onToggleDetails}
          size="lg"
          className="!p-0 !rounded-2xl"
        >
          <ContactDetailsPanel
            contactId={conv.contact.id}
            conversationId={conversationId}
            onClose={onToggleDetails}
            variant="modal"
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteContact.mutateAsync().then(() => setConfirmDelete(false))}
        title="Excluir contato permanentemente?"
        description={
          <>
            Apaga <strong>{name}</strong>, todas as conversas, mensagens e arquivos do sistema.
            <br />
            <span className="text-text-subtle">Não reflete no WhatsApp do celular.</span>
          </>
        }
        confirmLabel="Excluir definitivamente"
        tone="danger"
        requireText={name}
        loading={deleteContact.isPending}
      />
    </div>
  );
}
