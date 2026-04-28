import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { supabase } from '../../lib/supabase';
import { MessageBubble, type MessageRow } from './MessageBubble';
import { formatDay } from '../../lib/format';

const PAGE_SIZE = 50;

interface Page {
  rows: MessageRow[];
  cursor: string | null;
}

export function MessagesList({
  conversationId,
  contactJid,
}: {
  conversationId: string;
  contactJid: string;
}) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<Page>({
    queryKey: ['messages', conversationId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('wa_timestamp', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt('wa_timestamp', pageParam as string);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as MessageRow[];
      const cursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].wa_timestamp : null;
      return { rows, cursor };
    },
    getNextPageParam: (last) => last.cursor,
  });

  // Mensagens em ordem cronológica (mais antigas primeiro)
  const messages = (data?.pages ?? [])
    .flatMap((p) => p.rows)
    .reverse();

  useEffect(() => {
    if (messages.length === 0) return;
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'auto' });
  }, [conversationId]);

  // Inserção de itens "separadores de dia"
  const items = withDayDividers(messages);

  return (
    <div
      className="flex-1 min-h-0 relative"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><circle cx='1' cy='1' r='1' fill='%23000' opacity='0.04'/></svg>\")",
        backgroundRepeat: 'repeat',
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={items}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        followOutput="auto"
        initialTopMostItemIndex={items.length - 1}
        itemContent={(_idx, item) => {
          if (item.kind === 'divider') {
            return (
              <div className="flex justify-center py-3">
                <span className="text-xs bg-wa-bubble dark:bg-wa-bubble-dark text-wa-muted px-3 py-1 rounded-full shadow-sm">
                  {item.label}
                </span>
              </div>
            );
          }
          return <MessageBubble msg={item.msg} contactJid={contactJid} />;
        }}
        className="h-full"
      />
    </div>
  );
}

type Item =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: MessageRow };

function withDayDividers(messages: MessageRow[]): Item[] {
  const out: Item[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const day = m.wa_timestamp.slice(0, 10);
    if (day !== lastDay) {
      out.push({ kind: 'divider', key: `d:${day}`, label: formatDay(m.wa_timestamp) });
      lastDay = day;
    }
    out.push({ kind: 'msg', key: m.id, msg: m });
  }
  return out;
}
