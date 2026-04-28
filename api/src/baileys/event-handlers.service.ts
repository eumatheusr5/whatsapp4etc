import { Injectable } from '@nestjs/common';
import {
  WASocket,
  proto,
  WAMessage,
  WAMessageStubType,
  downloadMediaMessage,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { logger } from '../lib/logger';
import { ContactsService } from '../modules/contacts/contacts.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { MediaService } from '../modules/media/media.service';
import { TranscriptionService } from '../modules/transcription/transcription.service';
import { RealtimeGateway } from '../modules/realtime/realtime.gateway';
import * as mime from 'mime-types';

type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'system';

@Injectable()
export class EventHandlersService {
  private readonly log = logger.child({ component: 'EventHandlers' });

  constructor(
    private readonly contacts: ContactsService,
    private readonly conversations: ConversationsService,
    private readonly media: MediaService,
    private readonly transcription: TranscriptionService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Liga os listeners principais a uma sessão Baileys.
   * Chamado pelo SessionManager.start() após criar o socket.
   */
  bind(instanceId: string, sock: WASocket): void {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const msg of messages) {
        try {
          await this.onMessageUpsert(instanceId, sock, msg);
        } catch (err) {
          this.log.error({ err, instanceId, key: msg.key }, 'erro em messages.upsert');
        }
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      for (const upd of updates) {
        try {
          await this.onMessageUpdate(instanceId, upd);
        } catch (err) {
          this.log.error({ err, instanceId }, 'erro em messages.update');
        }
      }
    });

    sock.ev.on('messages.reaction', async (reactions) => {
      for (const r of reactions) {
        try {
          await this.onReaction(instanceId, r);
        } catch (err) {
          this.log.error({ err, instanceId }, 'erro em messages.reaction');
        }
      }
    });

    sock.ev.on('contacts.update', async (updates) => {
      for (const upd of updates) {
        try {
          await this.onContactUpdate(instanceId, sock, upd);
        } catch (err) {
          this.log.error({ err, instanceId }, 'erro em contacts.update');
        }
      }
    });

    sock.ev.on('presence.update', async ({ id, presences }) => {
      try {
        await this.onPresenceUpdate(instanceId, id, presences);
      } catch (err) {
        this.log.error({ err, instanceId }, 'erro em presence.update');
      }
    });
  }

  // ===================== MESSAGES UPSERT =====================
  private async onMessageUpsert(
    instanceId: string,
    sock: WASocket,
    msg: WAMessage,
  ): Promise<void> {
    if (!msg.key?.id || !msg.key.remoteJid) return;
    if (msg.key.remoteJid.endsWith('@broadcast')) return;
    if (msg.message?.protocolMessage) return; // mensagens de protocolo (delete, edit)
    if (msg.messageStubType === WAMessageStubType.CIPHERTEXT) return;

    const remoteJid = jidNormalizedUser(msg.key.remoteJid);
    const fromMe = !!msg.key.fromMe;
    const senderJid = fromMe
      ? jidNormalizedUser(sock.user?.id ?? '')
      : jidNormalizedUser(msg.key.participant ?? msg.key.remoteJid);

    const isGroup = remoteJid.endsWith('@g.us');
    if (isGroup) return; // Ignoramos grupos por enquanto (mantém escopo do projeto)

    const supabase = getSupabaseAdmin();

    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('wa_message_id', msg.key.id)
      .maybeSingle();
    if (existingMsg) return;

    const contactId = await this.contacts.upsert({
      instanceId,
      jid: remoteJid,
      pushName: msg.pushName ?? null,
      sock,
    });

    const conversationId = await this.conversations.upsert({
      instanceId,
      contactId,
    });

    const parsed = await this.parseMessage(instanceId, msg);

    const replyToWaId = this.getQuotedId(msg);
    let replyToMessageId: string | null = null;
    if (replyToWaId) {
      const { data: replyTo } = await supabase
        .from('messages')
        .select('id')
        .eq('wa_message_id', replyToWaId)
        .eq('conversation_id', conversationId)
        .maybeSingle();
      replyToMessageId = replyTo?.id ?? null;
    }

    const sentVia = fromMe ? 'phone' : null;
    const wsTimestampMs =
      typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp * 1000
        : (msg.messageTimestamp as { low: number } | undefined)?.low
          ? Number((msg.messageTimestamp as { low: number }).low) * 1000
          : Date.now();

    const { data: inserted, error: insErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        wa_message_id: msg.key.id,
        from_me: fromMe,
        sender_jid: senderJid,
        type: parsed.type,
        body: parsed.body,
        media_url: parsed.mediaUrl ?? null,
        media_path: parsed.mediaPath ?? null,
        media_mime: parsed.mediaMime ?? null,
        media_size_bytes: parsed.mediaSize ?? null,
        media_duration_seconds: parsed.mediaDuration ?? null,
        media_width: parsed.mediaWidth ?? null,
        media_height: parsed.mediaHeight ?? null,
        reply_to_message_id: replyToMessageId,
        forwarded: parsed.forwarded,
        status: fromMe ? 'sent' : 'delivered',
        sent_via: sentVia,
        transcript_status: parsed.type === 'audio' || parsed.type === 'ptt' ? 'pending' : 'skipped',
        wa_timestamp: new Date(wsTimestampMs).toISOString(),
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      this.log.error({ err: insErr, waId: msg.key.id }, 'falha ao inserir mensagem');
      return;
    }

    const previewBody = this.previewFor(parsed);
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date(wsTimestampMs).toISOString(),
        last_message_preview: previewBody,
        unread_count: fromMe
          ? undefined
          : (await this.incrementUnread(conversationId)) ?? undefined,
      } as never)
      .eq('id', conversationId);

    this.realtime.emitAll('message:new', {
      conversationId,
      messageId: inserted.id,
      fromMe,
    });

    if (parsed.type === 'audio' || parsed.type === 'ptt') {
      void this.transcription.enqueue(inserted.id);
    }

    void this.conversations.subscribePresence(instanceId, remoteJid);
  }

  private async incrementUnread(conversationId: string): Promise<number | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('id', conversationId)
      .single();
    return (data?.unread_count ?? 0) + 1;
  }

  // ===================== PARSE =====================
  private async parseMessage(
    instanceId: string,
    msg: WAMessage,
  ): Promise<{
    type: MessageType;
    body: string | null;
    mediaUrl?: string;
    mediaPath?: string;
    mediaMime?: string;
    mediaSize?: number;
    mediaDuration?: number;
    mediaWidth?: number;
    mediaHeight?: number;
    forwarded: boolean;
  }> {
    const m = msg.message;
    if (!m) return { type: 'system', body: null, forwarded: false };

    if (m.conversation || m.extendedTextMessage?.text) {
      return {
        type: 'text',
        body: m.conversation || m.extendedTextMessage?.text || null,
        forwarded:
          (m.extendedTextMessage?.contextInfo?.forwardingScore ?? 0) > 0,
      };
    }

    if (m.imageMessage) {
      const buffer = await this.downloadSafely(msg);
      const upload = buffer
        ? await this.media.upload({
            instanceId,
            messageId: msg.key.id ?? undefined,
            buffer,
            mimeType: m.imageMessage.mimetype ?? 'image/jpeg',
            extension: mime.extension(m.imageMessage.mimetype ?? 'image/jpeg') || 'jpg',
          })
        : null;
      return {
        type: 'image',
        body: m.imageMessage.caption ?? null,
        mediaUrl: upload?.url,
        mediaPath: upload?.path,
        mediaMime: m.imageMessage.mimetype ?? 'image/jpeg',
        mediaSize: upload?.size,
        mediaWidth: m.imageMessage.width ?? undefined,
        mediaHeight: m.imageMessage.height ?? undefined,
        forwarded: (m.imageMessage.contextInfo?.forwardingScore ?? 0) > 0,
      };
    }

    if (m.videoMessage) {
      const buffer = await this.downloadSafely(msg);
      const upload = buffer
        ? await this.media.upload({
            instanceId,
            messageId: msg.key.id ?? undefined,
            buffer,
            mimeType: m.videoMessage.mimetype ?? 'video/mp4',
            extension: mime.extension(m.videoMessage.mimetype ?? 'video/mp4') || 'mp4',
          })
        : null;
      return {
        type: 'video',
        body: m.videoMessage.caption ?? null,
        mediaUrl: upload?.url,
        mediaPath: upload?.path,
        mediaMime: m.videoMessage.mimetype ?? 'video/mp4',
        mediaSize: upload?.size,
        mediaWidth: m.videoMessage.width ?? undefined,
        mediaHeight: m.videoMessage.height ?? undefined,
        mediaDuration: m.videoMessage.seconds ?? undefined,
        forwarded: (m.videoMessage.contextInfo?.forwardingScore ?? 0) > 0,
      };
    }

    if (m.audioMessage) {
      const buffer = await this.downloadSafely(msg);
      const upload = buffer
        ? await this.media.upload({
            instanceId,
            messageId: msg.key.id ?? undefined,
            buffer,
            mimeType: m.audioMessage.mimetype ?? 'audio/ogg',
            extension: 'ogg',
          })
        : null;
      return {
        type: m.audioMessage.ptt ? 'ptt' : 'audio',
        body: null,
        mediaUrl: upload?.url,
        mediaPath: upload?.path,
        mediaMime: m.audioMessage.mimetype ?? 'audio/ogg',
        mediaSize: upload?.size,
        mediaDuration: m.audioMessage.seconds ?? undefined,
        forwarded: false,
      };
    }

    if (m.documentMessage || m.documentWithCaptionMessage) {
      const docMsg =
        m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage;
      const buffer = await this.downloadSafely(msg);
      const upload = buffer && docMsg
        ? await this.media.upload({
            instanceId,
            messageId: msg.key.id ?? undefined,
            buffer,
            mimeType: docMsg.mimetype ?? 'application/octet-stream',
            extension:
              mime.extension(docMsg.mimetype ?? '') ||
              (docMsg.fileName?.split('.').pop() ?? 'bin'),
          })
        : null;
      return {
        type: 'document',
        body: docMsg?.fileName ?? m.documentWithCaptionMessage?.message?.documentMessage?.caption ?? null,
        mediaUrl: upload?.url,
        mediaPath: upload?.path,
        mediaMime: docMsg?.mimetype ?? 'application/octet-stream',
        mediaSize: upload?.size,
        forwarded: false,
      };
    }

    if (m.stickerMessage) {
      const buffer = await this.downloadSafely(msg);
      const upload = buffer
        ? await this.media.upload({
            instanceId,
            messageId: msg.key.id ?? undefined,
            buffer,
            mimeType: 'image/webp',
            extension: 'webp',
          })
        : null;
      return {
        type: 'sticker',
        body: null,
        mediaUrl: upload?.url,
        mediaPath: upload?.path,
        mediaMime: 'image/webp',
        mediaSize: upload?.size,
        forwarded: false,
      };
    }

    if (m.locationMessage) {
      const { degreesLatitude, degreesLongitude, name, address } = m.locationMessage;
      return {
        type: 'location',
        body: JSON.stringify({ lat: degreesLatitude, lng: degreesLongitude, name, address }),
        forwarded: false,
      };
    }

    if (m.contactMessage || m.contactsArrayMessage) {
      return {
        type: 'contact',
        body: m.contactMessage?.displayName ?? 'Contato',
        forwarded: false,
      };
    }

    return { type: 'system', body: null, forwarded: false };
  }

  private async downloadSafely(msg: WAMessage): Promise<Buffer | null> {
    try {
      const stream = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: logger as never, reuploadRequest: async (m) => m },
      );
      return Buffer.isBuffer(stream) ? stream : Buffer.from(stream as unknown as ArrayBuffer);
    } catch (err) {
      this.log.warn({ err, key: msg.key }, 'downloadMediaMessage falhou');
      return null;
    }
  }

  private getQuotedId(msg: WAMessage): string | null {
    const ctx =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.audioMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo;
    return ctx?.stanzaId ?? null;
  }

  private previewFor(parsed: { type: MessageType; body: string | null }): string {
    if (parsed.body) return parsed.body.slice(0, 200);
    switch (parsed.type) {
      case 'image':
        return '🖼️ Imagem';
      case 'video':
        return '🎥 Vídeo';
      case 'audio':
      case 'ptt':
        return '🎤 Áudio';
      case 'document':
        return '📎 Documento';
      case 'sticker':
        return '🎴 Figurinha';
      case 'location':
        return '📍 Localização';
      case 'contact':
        return '👤 Contato';
      default:
        return '';
    }
  }

  // ===================== MESSAGES UPDATE =====================
  private async onMessageUpdate(
    instanceId: string,
    upd: { key: proto.IMessageKey; update: Partial<proto.IWebMessageInfo> },
  ): Promise<void> {
    if (!upd.key?.id) return;
    const supabase = getSupabaseAdmin();
    const { data: msg } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('wa_message_id', upd.key.id)
      .maybeSingle();
    if (!msg) return;

    const patch: Record<string, unknown> = {};
    if (upd.update.status !== undefined && upd.update.status !== null) {
      const map: Record<number, string> = {
        0: 'pending',
        1: 'sent',
        2: 'delivered',
        3: 'read',
        4: 'failed',
      };
      const mapped = map[upd.update.status as number];
      if (mapped) patch.status = mapped;
    }
    if (upd.update.message?.protocolMessage?.editedMessage) {
      const newBody =
        upd.update.message.protocolMessage.editedMessage.conversation ||
        upd.update.message.protocolMessage.editedMessage.extendedTextMessage?.text ||
        null;
      patch.body = newBody;
      patch.edited_at = new Date().toISOString();
    }
    if (upd.update.messageStubType === WAMessageStubType.REVOKE) {
      patch.deleted_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return;
    await supabase.from('messages').update(patch as never).eq('id', msg.id);
    this.realtime.emitAll('message:updated', {
      messageId: msg.id,
      conversationId: msg.conversation_id,
      patch,
    });
  }

  // ===================== REACTIONS =====================
  private async onReaction(
    _instanceId: string,
    r: { key: proto.IMessageKey; reaction: proto.IReaction },
  ): Promise<void> {
    const targetWaId = r.reaction.key?.id;
    if (!targetWaId) return;
    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from('messages')
      .select('id, reactions, conversation_id')
      .eq('wa_message_id', targetWaId)
      .maybeSingle();
    if (!target) return;

    const reactions = Array.isArray(target.reactions)
      ? (target.reactions as Array<{ jid: string; emoji: string; ts: number }>)
      : [];
    const reactorJid = jidNormalizedUser(
      r.reaction.key?.participant ?? r.reaction.key?.remoteJid ?? '',
    );
    const filtered = reactions.filter((x) => x.jid !== reactorJid);
    const emoji = r.reaction.text ?? '';
    if (emoji) {
      filtered.push({ jid: reactorJid, emoji, ts: Date.now() });
    }
    await supabase
      .from('messages')
      .update({ reactions: filtered as never })
      .eq('id', target.id);
    this.realtime.emitAll('message:reaction', {
      messageId: target.id,
      conversationId: target.conversation_id,
      reactions: filtered,
    });
  }

  // ===================== CONTACT UPDATE =====================
  private async onContactUpdate(
    instanceId: string,
    sock: WASocket,
    upd: { id?: string; name?: string; notify?: string; imgUrl?: string | null },
  ): Promise<void> {
    if (!upd.id) return;
    const jid = jidNormalizedUser(upd.id);
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (upd.name || upd.notify) {
      updates.push_name = upd.name ?? upd.notify;
    }
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('contacts')
        .update(updates as never)
        .eq('instance_id', instanceId)
        .eq('jid', jid);
    }
    if (upd.imgUrl !== undefined) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('jid', jid)
        .maybeSingle();
      if (contact) {
        void this.contacts.refreshAvatar(contact.id, jid, sock);
      }
    }
  }

  // ===================== PRESENCE =====================
  private async onPresenceUpdate(
    instanceId: string,
    id: string,
    presences: Record<string, { lastKnownPresence?: string; lastSeen?: number }>,
  ): Promise<void> {
    const jid = jidNormalizedUser(id);
    const top = Object.values(presences)[0];
    if (!top?.lastKnownPresence) return;
    const presence = top.lastKnownPresence as
      | 'available'
      | 'unavailable'
      | 'composing'
      | 'recording'
      | 'paused';
    await this.contacts.updatePresence(instanceId, jid, presence, top.lastSeen);
    this.realtime.emitAll('contact:presence', {
      jid,
      presence,
      lastSeenAt: top.lastSeen ? top.lastSeen * 1000 : null,
    });
  }
}
