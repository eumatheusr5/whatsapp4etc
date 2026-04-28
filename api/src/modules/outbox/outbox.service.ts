import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';
import { SessionManager } from '../../baileys/session-manager';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AnyMessageContent } from '@whiskeysockets/baileys';

const MAX_ATTEMPTS = 3;

/**
 * Worker de outbox: drena mensagens enfileiradas (instância caiu durante envio)
 * quando a instância volta a ficar online.
 */
@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private readonly log = logger.child({ component: 'OutboxService' });

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly realtime: RealtimeGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      this.drain().catch((err) => this.log.warn({ err }, 'erro no drain de outbox'));
    }, 15_000);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async drain(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: queued } = await supabase
      .from('message_outbox')
      .select(
        'id, conversation_id, user_id, payload, attempts, conversations:conversation_id(instance_id, contacts:contact_id(jid))',
      )
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(20);

    if (!queued?.length) return;

    for (const item of queued) {
      const conv = Array.isArray(item.conversations) ? item.conversations[0] : item.conversations;
      if (!conv) continue;
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      if (!contact) continue;
      const session = this.sessionManager.get(conv.instance_id);
      if (!session || session.status !== 'connected') continue;

      await supabase
        .from('message_outbox')
        .update({ status: 'sending', attempts: item.attempts + 1 })
        .eq('id', item.id);

      try {
        const payload = item.payload as Record<string, unknown> & { content?: AnyMessageContent };
        if (!payload?.content) {
          throw new Error('payload sem content (mídia perdida no outbox)');
        }
        const sent = await session.sock.sendMessage(contact.jid, payload.content as AnyMessageContent);
        if (!sent?.key?.id) throw new Error('envio retornou sem key');

        const wsTimestamp = sent.messageTimestamp
          ? new Date(Number(sent.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        const meta = payload as { type?: string; body?: string | null };
        const { data: inserted } = await supabase
          .from('messages')
          .insert({
            conversation_id: item.conversation_id,
            wa_message_id: sent.key.id,
            from_me: true,
            sender_jid: session.sock.user?.id ?? null,
            type: meta.type ?? 'text',
            body: meta.body ?? null,
            status: 'sent',
            sent_by_user_id: item.user_id,
            sent_via: 'outbox',
            wa_timestamp: wsTimestamp,
          })
          .select('id')
          .single();

        await supabase
          .from('message_outbox')
          .update({ status: 'sent', sent_message_id: inserted?.id ?? null })
          .eq('id', item.id);

        await supabase
          .from('conversations')
          .update({
            last_message_at: wsTimestamp,
            last_message_preview: meta.body ?? '',
          })
          .eq('id', item.conversation_id);

        this.realtime.emitAll('message:new', {
          conversationId: item.conversation_id,
          messageId: inserted?.id,
          fromMe: true,
        });
        this.realtime.emitAll('outbox:sent', { outboxId: item.id });
      } catch (err) {
        const attempts = item.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
        await supabase
          .from('message_outbox')
          .update({
            status,
            attempts,
            last_error: (err as Error).message,
            scheduled_at: new Date(Date.now() + 30_000 * attempts).toISOString(),
          })
          .eq('id', item.id);
        this.log.warn({ err, outboxId: item.id, attempts }, 'envio do outbox falhou');
      }
    }
  }
}
