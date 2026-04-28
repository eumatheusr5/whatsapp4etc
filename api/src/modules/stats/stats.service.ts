import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';

interface DailyRow {
  date: string;
  user_id: string | null;
  instance_id: string;
  messages_sent: number;
  messages_received: number;
  conversations_handled: number;
}

@Injectable()
export class StatsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private readonly log = logger.child({ component: 'StatsService' });

  onApplicationBootstrap(): void {
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

  /**
   * Retorna stats consolidados.
   * - Dias anteriores: lê de `daily_stats` (cron).
   * - Dia atual: calcula sob demanda direto em `messages` para o usuário sempre ver dados atualizados.
   */
  async overview(days = 30, userId?: string) {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [statsResp, openConvResp, mineResp, todayResp] = await Promise.all([
      supabase
        .from('daily_stats')
        .select('*')
        .gte('date', since.toISOString().slice(0, 10))
        .lt('date', today)
        .order('date', { ascending: true }),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('archived', false),
      userId
          ? supabase
              .from('conversations')
              .select('id', { count: 'exact', head: true })
              .eq('archived', false)
              .eq('assigned_to', userId)
          : Promise.resolve({ count: 0 }),
      this.computeDay(today),
    ]);

    const stats = (statsResp.data ?? []) as DailyRow[];
    const todayRows = todayResp;

    return {
      stats: [...stats, ...todayRows],
      openConversations: openConvResp.count ?? 0,
      mineConversations: (mineResp as { count: number | null }).count ?? 0,
      today: {
        sent: todayRows.reduce((acc, r) => acc + r.messages_sent, 0),
        received: todayRows.reduce((acc, r) => acc + r.messages_received, 0),
        activeAttendants: new Set(todayRows.map((r) => r.user_id).filter(Boolean)).size,
      },
    };
  }

  /**
   * Top contatos com mais mensagens nos últimos 7 dias.
   */
  async topContacts(limit = 5) {
    const supabase = getSupabaseAdmin();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, conversations:conversation_id(contact_id, contacts:contact_id(id, push_name, custom_name, phone_number, avatar_url))')
      .gte('wa_timestamp', since.toISOString())
      .limit(2000);

    const counts = new Map<string, { contact: { id: string; push_name: string | null; custom_name: string | null; phone_number: string | null; avatar_url: string | null }; total: number }>();
    for (const m of msgs ?? []) {
      const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
      const contact = conv && (Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts);
      if (!contact?.id) continue;
      const c = counts.get(contact.id);
      if (c) c.total += 1;
      else counts.set(contact.id, { contact, total: 1 });
    }
    return Array.from(counts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  /**
   * Calcula stats do dia consultando diretamente a tabela `messages`.
   */
  private async computeDay(date: string): Promise<DailyRow[]> {
    const supabase = getSupabaseAdmin();
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59.999Z`;

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('from_me, sent_by_user_id, conversation_id, conversations:conversation_id(instance_id)')
      .gte('wa_timestamp', start)
      .lte('wa_timestamp', end);

    if (error) {
      this.log.warn({ err: error }, 'computeDay falhou');
      return [];
    }

    const buckets = new Map<string, DailyRow & { conv: Set<string> }>();
    for (const m of msgs ?? []) {
      const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
      const instanceId = conv?.instance_id as string | undefined;
      if (!instanceId) continue;
      const userId = (m.sent_by_user_id as string | null) ?? null;
      const key = `${userId ?? 'system'}::${instanceId}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          date,
          user_id: userId,
          instance_id: instanceId,
          messages_sent: 0,
          messages_received: 0,
          conversations_handled: 0,
          conv: new Set(),
        });
      }
      const b = buckets.get(key)!;
      if (m.from_me) b.messages_sent += 1;
      else b.messages_received += 1;
      if (m.conversation_id) b.conv.add(m.conversation_id as string);
    }
    return Array.from(buckets.values()).map((b) => ({
      date: b.date,
      user_id: b.user_id,
      instance_id: b.instance_id,
      messages_sent: b.messages_sent,
      messages_received: b.messages_received,
      conversations_handled: b.conv.size,
    }));
  }

  /**
   * Persiste o dia atual em `daily_stats` (rodado pelo cron).
   */
  async aggregateToday(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.computeDay(today);
    for (const r of rows) {
      if (!r.user_id) continue;
      await supabase.from('daily_stats').upsert({
        date: r.date,
        user_id: r.user_id,
        instance_id: r.instance_id,
        messages_sent: r.messages_sent,
        messages_received: r.messages_received,
        conversations_handled: r.conversations_handled,
      });
    }
  }
}
