import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

interface UnreadSummary {
  count: number;
}

/**
 * Retorna a quantidade de conversas com mensagens não lidas (clientes que
 * enviaram e ainda não foram visualizados).
 * Atualiza-se em tempo real via socket events.
 */
export function useUnreadSummary() {
  const qc = useQueryClient();
  const query = useQuery<UnreadSummary>({
    queryKey: ['conversations', 'unread-summary'],
    queryFn: () => api.get<UnreadSummary>('/conversations/unread-summary'),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const sock = await getSocket();
      if (cancelled) return;
      const handler = () => {
        qc.invalidateQueries({ queryKey: ['conversations', 'unread-summary'] });
      };
      sock.on('conversation:unread-changed', handler);
      sock.on('conversation:read', handler);
      sock.on('message:new', handler);
      cleanup = () => {
        sock.off('conversation:unread-changed', handler);
        sock.off('conversation:read', handler);
        sock.off('message:new', handler);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [qc]);

  return query.data?.count ?? 0;
}
