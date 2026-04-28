import { useParams } from 'react-router-dom';
import { ConversationsList } from '../features/conversations/ConversationsList';
import { ConversationView } from '../features/conversations/ConversationView';
import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useQueryClient } from '@tanstack/react-query';

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const qc = useQueryClient();

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
      }
    };
  }, [qc, conversationId]);

  return (
    <div className="h-full flex">
      <div className="w-[380px] shrink-0 border-r border-wa-divider dark:border-wa-divider-dark flex flex-col bg-wa-panel dark:bg-wa-panel-dark">
        <ConversationsList selectedId={conversationId} />
      </div>
      <div className="flex-1 min-w-0 bg-wa-chat dark:bg-wa-chat-dark flex flex-col">
        {conversationId ? (
          <ConversationView conversationId={conversationId} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-wa-muted p-8">
      <div className="w-32 h-32 rounded-full bg-wa-panel dark:bg-wa-bubble-dark flex items-center justify-center mb-6">
        <svg className="w-16 h-16 text-wa-green-dark" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l4.94-1.38C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-light mb-2">Selecione uma conversa</h2>
      <p className="text-sm text-center max-w-md">
        Escolha uma conversa ao lado para visualizar e responder mensagens dos seus clientes.
      </p>
    </div>
  );
}
