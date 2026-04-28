import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { ConversationsList } from '../features/conversations/ConversationsList';
import { ConversationView } from '../features/conversations/ConversationView';
import { getSocket } from '../lib/socket';
import { useChatBreakpoint } from '../hooks/useChatPanels';

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const bp = useChatBreakpoint();
  const [showDetails, setShowDetails] = useState(false);

  // Em desktop large, mantém detalhes abertos por padrão
  useEffect(() => {
    if (bp === 'lg') setShowDetails(true);
    else setShowDetails(false);
  }, [bp]);

  useEffect(() => {
    let cancelled = false;
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null;
    void (async () => {
      sock = await getSocket();
      if (cancelled) return;
      const onMsg = () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        if (conversationId) {
          qc.invalidateQueries({ queryKey: ['messages', conversationId] });
        }
      };
      sock.on('message:new', onMsg);
      sock.on('message:updated', onMsg);
      sock.on('message:reaction', onMsg);
      sock.on('message:transcript_done', onMsg);
      const onAssignChange = (payload: { conversationId?: string }) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        if (payload?.conversationId) {
          qc.invalidateQueries({ queryKey: ['conversation', payload.conversationId] });
        }
        if (conversationId) {
          qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
        }
      };
      sock.on('conversation:assigned', onAssignChange);
      sock.on('conversation:released', onAssignChange);
      sock.on('conversation:read', onAssignChange);
      const onContactDeleted = (payload: { contactId?: string }) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        if (payload?.contactId && conversationId) {
          // se a conversa atual é do contato deletado, navegar pra lista
          navigate('/conversas');
        }
      };
      sock.on('contact:deleted', onContactDeleted);
    })();
    return () => {
      cancelled = true;
      if (sock) {
        sock.off('message:new');
        sock.off('message:updated');
        sock.off('message:reaction');
        sock.off('message:transcript_done');
        sock.off('conversation:assigned');
        sock.off('conversation:released');
        sock.off('conversation:read');
        sock.off('contact:deleted');
      }
    };
  }, [qc, conversationId, navigate]);

  // === MOBILE (sm) === stack: lista OR chat
  if (bp === 'sm') {
    return (
      <div className="h-full bg-bg">
        {conversationId ? (
          <ConversationView
            conversationId={conversationId}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            onBack={() => navigate('/conversas')}
            detailsAsPanel={false}
          />
        ) : (
          <div className="h-full">
            <ConversationsList selectedId={conversationId} />
          </div>
        )}
      </div>
    );
  }

  // === DESKTOP MD (768–1279): lista + chat (detalhes em modal) ===
  if (bp === 'md') {
    return (
      <div className="h-full flex bg-bg">
        <div className="w-[340px] shrink-0 border-r border-border">
          <ConversationsList selectedId={conversationId} />
        </div>
        <div className="flex-1 min-w-0">
          {conversationId ? (
            <ConversationView
              conversationId={conversationId}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails((v) => !v)}
              detailsAsPanel={false}
            />
          ) : (
            <EmptyChat />
          )}
        </div>
      </div>
    );
  }

  // === DESKTOP LG (≥1280): lista + chat + detalhes ===
  return (
    <div className="h-full flex bg-bg">
      <div className="w-[360px] shrink-0 border-r border-border">
        <ConversationsList selectedId={conversationId} />
      </div>
      <div className="flex-1 min-w-0">
        {conversationId ? (
          <ConversationView
            conversationId={conversationId}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            detailsAsPanel
          />
        ) : (
          <EmptyChat />
        )}
      </div>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 py-10">
      <div className="w-20 h-20 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
        <MessageCircle className="w-10 h-10" />
      </div>
      <h2 className="text-lg font-semibold text-text">Selecione uma conversa</h2>
      <p className="text-sm text-text-muted mt-1.5 max-w-md">
        Escolha um cliente na lista ao lado para visualizar e responder.
      </p>
    </div>
  );
}
