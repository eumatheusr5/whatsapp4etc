import { HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SessionManager } from '../../baileys/session-manager';
import { logger } from '../../lib/logger';

interface UpsertOpts {
  instanceId: string;
  contactId: string;
}

@Injectable()
export class ConversationsService {
  private readonly log = logger.child({ component: 'ConversationsService' });

  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly sessionManager: SessionManager,
  ) {}

  async upsert({ instanceId, contactId }: UpsertOpts): Promise<string> {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('contact_id', contactId)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ instance_id: instanceId, contact_id: contactId })
      .select('id')
      .single();
    if (error || !created) throw error ?? new Error('conversation insert vazio');
    return created.id;
  }

  /**
   * Atribui a conversa ao usuário (lock atômico).
   * Se já estiver atribuída a outro, lança CONFLICT.
   */
  async assign(conversationId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: current, error: selErr } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', conversationId)
      .maybeSingle();
    if (selErr || !current) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Conversa não encontrada', HttpStatus.NOT_FOUND);
    }
    if (current.assigned_to && current.assigned_to !== userId) {
      throw new AppException(
        ErrCodes.CONVERSATION_LOCKED,
        'Conversa já está em atendimento por outro atendente',
        HttpStatus.CONFLICT,
        { assignedTo: current.assigned_to },
      );
    }
    if (current.assigned_to === userId) return;

    const now = new Date().toISOString();
    const { error: updErr, count } = await supabase
      .from('conversations')
      .update({ assigned_to: userId, assigned_at: now }, { count: 'exact' })
      .eq('id', conversationId)
      .is('assigned_to', null);
    if (updErr) throw updErr;
    if (count === 0) {
      throw new AppException(
        ErrCodes.CONVERSATION_LOCKED,
        'Conversa foi assumida por outro atendente',
        HttpStatus.CONFLICT,
      );
    }
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'conversation.assign',
      entity: 'conversation',
      entity_id: conversationId,
    });
    this.realtime.emitAll('conversation:assigned', {
      conversationId,
      userId,
      assignedAt: now,
    });
  }

  async release(conversationId: string, userId: string, isAdmin = false): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: current } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', conversationId)
      .maybeSingle();
    if (!current) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Conversa não encontrada', HttpStatus.NOT_FOUND);
    }
    if (!current.assigned_to) return;
    if (current.assigned_to !== userId && !isAdmin) {
      throw new AppException(
        ErrCodes.FORBIDDEN,
        'Apenas o atendente que assumiu pode liberar (ou um admin)',
        HttpStatus.FORBIDDEN,
      );
    }
    await supabase
      .from('conversations')
      .update({ assigned_to: null, assigned_at: null })
      .eq('id', conversationId);
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'conversation.release',
      entity: 'conversation',
      entity_id: conversationId,
    });
    this.realtime.emitAll('conversation:released', { conversationId });
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, instance_id, contact_id, unread_count')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Conversa não encontrada', HttpStatus.NOT_FOUND);
    }
    if (conv.unread_count === 0) return;

    const { data: contact } = await supabase
      .from('contacts')
      .select('jid')
      .eq('id', conv.contact_id)
      .single();

    const { data: pendingMsgs } = await supabase
      .from('messages')
      .select('wa_message_id, sender_jid, from_me')
      .eq('conversation_id', conversationId)
      .eq('from_me', false)
      .neq('status', 'read')
      .order('wa_timestamp', { ascending: false })
      .limit(50);

    const session = this.sessionManager.get(conv.instance_id);
    if (session && session.status === 'connected' && contact && pendingMsgs?.length) {
      try {
        const keys = pendingMsgs.map((m) => ({
          id: m.wa_message_id,
          remoteJid: contact.jid,
          fromMe: false,
          participant: m.sender_jid ?? undefined,
        }));
        await session.sock.readMessages(keys);
      } catch (err) {
        this.log.warn({ err, conversationId }, 'readMessages falhou');
      }
    }

    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', conversationId)
      .eq('from_me', false)
      .neq('status', 'read');

    this.realtime.emitAll('conversation:read', { conversationId, userId });
  }

  async sendTyping(
    conversationId: string,
    userId: string,
    state: 'composing' | 'paused',
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, instance_id, contact_id, assigned_to')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) return;
    if (conv.assigned_to && conv.assigned_to !== userId) return;
    const { data: contact } = await supabase
      .from('contacts')
      .select('jid')
      .eq('id', conv.contact_id)
      .single();
    if (!contact) return;
    const session = this.sessionManager.get(conv.instance_id);
    if (!session || session.status !== 'connected') return;
    try {
      await session.sock.sendPresenceUpdate(state, contact.jid);
    } catch (err) {
      this.log.debug({ err, conversationId }, 'sendPresenceUpdate falhou');
    }
  }

  async subscribePresence(instanceId: string, jid: string): Promise<void> {
    const session = this.sessionManager.get(instanceId);
    if (!session || session.status !== 'connected') return;
    try {
      await session.sock.presenceSubscribe(jid);
    } catch (err) {
      this.log.debug({ err, jid }, 'presenceSubscribe falhou');
    }
  }
}
