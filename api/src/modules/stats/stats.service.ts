import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';

@Injectable()
export class StatsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private readonly log = logger.child({ component: 'StatsService' });

  onApplicationBootstrap(): void {
    // Roda agregação a cada 1h. Em produção, idealmente um cron Render dedicado.
    this.timer = setInterval(() => {
      this.aggregateToday().catch((err) =>
        this.log.warn({ err }, 'falha na agregação stats'),
      );
    }, 60 * 60 * 1000);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async overview(days = 30) {
    const supabase = getSupabaseAdmin();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [statsResp, openConvResp] = await Promise.all([
      supabase
        .from('daily_stats')
        .select('*')
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: true }),
      supabase
        .from('conversations')
        .select('id, archived', { count: 'exact', head: true })
        .eq('archived', false),
    ]);

    return {
      stats: statsResp.data ?? [],
      openConversations: openConvResp.count ?? 0,
    };
  }

  /**
   * Agrega contadores do dia atual.
   * Conta mensagens enviadas e recebidas por usuário/instância.
   */
  async aggregateToday(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = `${today}T00:00:00Z`;

    const { data: msgs } = await supabase
      .from('messages')
      .select('from_me, sent_by_user_id, conversation_id, conversations:conversation_id(instance_id)')
      .gte('wa_timestamp', startOfDay);

    if (!msgs?.length) return;

    const buckets = new Map<string, { user_id: string | null; instance_id: string; sent: number; received: number; conv: Set<string> }>();
    for (const m of msgs) {
      const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
      const instanceId = conv?.instance_id;
      if (!instanceId) continue;
      const userId = m.sent_by_user_id;
      const key = `${userId ?? 'system'}::${instanceId}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          user_id: userId,
          instance_id: instanceId,
          sent: 0,
          received: 0,
          conv: new Set(),
        });
      }
      const b = buckets.get(key)!;
      if (m.from_me) b.sent += 1;
      else b.received += 1;
      if (m.conversation_id) b.conv.add(m.conversation_id);
    }

    for (const b of buckets.values()) {
      if (!b.user_id) continue;
      await supabase.from('daily_stats').upsert({
        date: today,
        user_id: b.user_id,
        instance_id: b.instance_id,
        messages_sent: b.sent,
        messages_received: b.received,
        conversations_handled: b.conv.size,
      });
    }
  }
}
