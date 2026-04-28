import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AnyMessageContent,
  proto,
  WAMessageKey,
} from '@whiskeysockets/baileys';
import * as mime from 'mime-types';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';
import { SessionManager } from '../../baileys/session-manager';
import { MediaService } from '../media/media.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TranscriptionService } from '../transcription/transcription.service';
import { logger } from '../../lib/logger';

export interface SendTextOpts {
  conversationId: string;
  userId: string;
  body: string;
  replyToMessageId?: string;
}

export interface SendMediaOpts {
  conversationId: string;
  userId: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'ptt' | 'sticker';
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  replyToMessageId?: string;
}

@Injectable()
export class MessagesService {
  private readonly log = logger.child({ component: 'MessagesService' });

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly media: MediaService,
    private readonly realtime: RealtimeGateway,
    private readonly transcription: TranscriptionService,
  ) {}

  async sendText(opts: SendTextOpts) {
    const conv = await this.assertCanSend(opts.conversationId, opts.userId);
    const replyContext = await this.buildQuotedContext(opts.replyToMessageId);
    const content: AnyMessageContent = { text: opts.body };
    return this.dispatch(opts.conversationId, opts.userId, conv.contactJid, content, {
      type: 'text',
      body: opts.body,
      replyToMessageId: opts.replyToMessageId ?? null,
      quoted: replyContext,
    });
  }

  async sendMedia(opts: SendMediaOpts) {
    const conv = await this.assertCanSend(opts.conversationId, opts.userId);
    const replyContext = await this.buildQuotedContext(opts.replyToMessageId);

    let buffer = opts.buffer;
    let mimeType = opts.mimeType;
    let detectedType = opts.type;

    if (opts.type === 'ptt' || opts.type === 'audio') {
      buffer = await this.media.toOggOpus(buffer);
      mimeType = 'audio/ogg; codecs=opus';
    }

    if (opts.type === 'sticker') {
      buffer = await this.media.makeSticker(buffer);
      mimeType = 'image/webp';
    }

    let content: AnyMessageContent;
    switch (detectedType) {
      case 'image':
        content = { image: buffer, mimetype: mimeType, caption: opts.caption };
        break;
      case 'video':
        content = { video: buffer, mimetype: mimeType, caption: opts.caption };
        break;
      case 'document':
        content = {
          document: buffer,
          mimetype: mimeType ?? 'application/octet-stream',
          fileName: opts.fileName ?? 'arquivo',
          caption: opts.caption,
        };
        break;
      case 'audio':
        content = { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: false };
        break;
      case 'ptt':
        content = { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true };
        break;
      case 'sticker':
        content = { sticker: buffer };
        break;
      default:
        throw new AppException(ErrCodes.VALIDATION, 'Tipo inválido');
    }

    return this.dispatch(opts.conversationId, opts.userId, conv.contactJid, content, {
      type: detectedType,
      body: opts.caption ?? null,
      mediaBuffer: buffer,
      mediaMime: mimeType,
      fileName: opts.fileName,
      replyToMessageId: opts.replyToMessageId ?? null,
      quoted: replyContext,
    });
  }

  async react(messageId: string, userId: string, emoji: string) {
    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from('messages')
      .select('id, conversation_id, wa_message_id, from_me')
      .eq('id', messageId)
      .maybeSingle();
    if (!target) throw new AppException(ErrCodes.NOT_FOUND, 'Mensagem não encontrada', HttpStatus.NOT_FOUND);
    const conv = await this.loadConv(target.conversation_id);
    const session = this.sessionManager.get(conv.instanceId);
    if (!session || session.status !== 'connected') {
      throw new AppException(
        ErrCodes.INSTANCE_NOT_CONNECTED,
        'Instância desconectada',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const key: WAMessageKey = {
      remoteJid: conv.contactJid,
      id: target.wa_message_id,
      fromMe: target.from_me,
    };
    await session.sock.sendMessage(conv.contactJid, { react: { text: emoji, key } });
    void userId; // logged in audit through realtime path if needed
    return { ok: true };
  }

  async edit(messageId: string, userId: string, newBody: string) {
    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from('messages')
      .select('id, conversation_id, wa_message_id, from_me, sent_by_user_id')
      .eq('id', messageId)
      .maybeSingle();
    if (!target) throw new AppException(ErrCodes.NOT_FOUND, 'Mensagem não encontrada', HttpStatus.NOT_FOUND);
    if (!target.from_me) {
      throw new AppException(ErrCodes.FORBIDDEN, 'Só é possível editar mensagens próprias', HttpStatus.FORBIDDEN);
    }
    const conv = await this.loadConv(target.conversation_id);
    const session = this.sessionManager.get(conv.instanceId);
    if (!session || session.status !== 'connected') {
      throw new AppException(ErrCodes.INSTANCE_NOT_CONNECTED, 'Instância desconectada', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const key: WAMessageKey = {
      remoteJid: conv.contactJid,
      id: target.wa_message_id,
      fromMe: true,
    };
    await session.sock.sendMessage(conv.contactJid, { text: newBody, edit: key });
    await supabase
      .from('messages')
      .update({ body: newBody, edited_at: new Date().toISOString() })
      .eq('id', messageId);
    this.realtime.emitAll('message:updated', {
      messageId,
      conversationId: target.conversation_id,
      patch: { body: newBody, edited_at: new Date().toISOString() },
    });
    void userId;
    return { ok: true };
  }

  async deleteForAll(messageId: string, userId: string) {
    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from('messages')
      .select('id, conversation_id, wa_message_id, from_me')
      .eq('id', messageId)
      .maybeSingle();
    if (!target) throw new AppException(ErrCodes.NOT_FOUND, 'Mensagem não encontrada', HttpStatus.NOT_FOUND);
    if (!target.from_me) {
      throw new AppException(ErrCodes.FORBIDDEN, 'Só é possível apagar mensagens próprias', HttpStatus.FORBIDDEN);
    }
    const conv = await this.loadConv(target.conversation_id);
    const session = this.sessionManager.get(conv.instanceId);
    if (!session || session.status !== 'connected') {
      throw new AppException(ErrCodes.INSTANCE_NOT_CONNECTED, 'Instância desconectada', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const key: WAMessageKey = {
      remoteJid: conv.contactJid,
      id: target.wa_message_id,
      fromMe: true,
    };
    await session.sock.sendMessage(conv.contactJid, { delete: key });
    const now = new Date().toISOString();
    await supabase.from('messages').update({ deleted_at: now }).eq('id', messageId);
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'message.delete',
      entity: 'message',
      entity_id: messageId,
    });
    this.realtime.emitAll('message:updated', {
      messageId,
      conversationId: target.conversation_id,
      patch: { deleted_at: now },
    });
    return { ok: true };
  }

  async forward(messageId: string, targetConversationIds: string[], userId: string) {
    const supabase = getSupabaseAdmin();
    const { data: src } = await supabase
      .from('messages')
      .select(
        'id, conversation_id, type, body, media_path, media_mime, media_duration_seconds',
      )
      .eq('id', messageId)
      .maybeSingle();
    if (!src) throw new AppException(ErrCodes.NOT_FOUND, 'Mensagem não encontrada', HttpStatus.NOT_FOUND);

    const results: { conversationId: string; ok: boolean; error?: string }[] = [];

    let mediaBuffer: Buffer | null = null;
    if (src.media_path) {
      try {
        mediaBuffer = await this.media.download(src.media_path);
      } catch {
        // segue sem mídia
      }
    }

    for (const targetId of targetConversationIds) {
      try {
        if (src.type === 'text') {
          await this.sendText({
            conversationId: targetId,
            userId,
            body: src.body ?? '',
          });
        } else if (mediaBuffer) {
          await this.sendMedia({
            conversationId: targetId,
            userId,
            type: src.type as 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'sticker',
            buffer: mediaBuffer,
            mimeType: src.media_mime ?? undefined,
            caption: src.body ?? undefined,
          });
        } else {
          throw new Error('mídia indisponível para encaminhar');
        }
        results.push({ conversationId: targetId, ok: true });
      } catch (err) {
        results.push({
          conversationId: targetId,
          ok: false,
          error: (err as Error).message,
        });
      }
    }
    return { results };
  }

  // ===================== INTERNAL =====================
  private async assertCanSend(conversationId: string, userId: string) {
    const conv = await this.loadConv(conversationId);
    if (conv.assignedTo && conv.assignedTo !== userId) {
      throw new AppException(
        ErrCodes.CONVERSATION_LOCKED,
        'Conversa está em atendimento por outro atendente',
        HttpStatus.CONFLICT,
      );
    }
    if (!conv.assignedTo) {
      // Auto-assume implícito ao enviar primeira mensagem
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_to: userId, assigned_at: new Date().toISOString() })
        .eq('id', conversationId)
        .is('assigned_to', null);
      if (!error) {
        this.realtime.emitAll('conversation:assigned', {
          conversationId,
          userId,
          assignedAt: new Date().toISOString(),
        });
        conv.assignedTo = userId;
      }
    }
    return conv;
  }

  private async loadConv(conversationId: string) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('conversations')
      .select(
        'id, instance_id, contact_id, assigned_to, contact:contacts(jid, instance_id)',
      )
      .eq('id', conversationId)
      .maybeSingle();
    if (!data || !data.contact) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Conversa inválida', HttpStatus.NOT_FOUND);
    }
    const contact = Array.isArray(data.contact) ? data.contact[0] : data.contact;
    return {
      id: data.id,
      instanceId: data.instance_id,
      contactId: data.contact_id,
      contactJid: contact.jid,
      assignedTo: data.assigned_to,
    };
  }

  private async buildQuotedContext(replyToMessageId?: string | null) {
    if (!replyToMessageId) return null;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('messages')
      .select('wa_message_id, conversation_id, from_me, sender_jid, body, type')
      .eq('id', replyToMessageId)
      .maybeSingle();
    if (!data) return null;
    return {
      key: {
        id: data.wa_message_id,
        fromMe: data.from_me,
      },
      message: { conversation: data.body ?? '' },
    } as unknown as proto.IWebMessageInfo;
  }

  /**
   * Faz o envio efetivo via Baileys e persiste no banco.
   */
  private async dispatch(
    conversationId: string,
    userId: string,
    contactJid: string,
    content: AnyMessageContent,
    meta: {
      type: string;
      body: string | null;
      mediaBuffer?: Buffer;
      mediaMime?: string;
      fileName?: string;
      replyToMessageId: string | null;
      quoted?: proto.IWebMessageInfo | null;
    },
  ) {
    const supabase = getSupabaseAdmin();
    const conv = await this.loadConv(conversationId);
    const session = this.sessionManager.get(conv.instanceId);

    if (!session || session.status !== 'connected') {
      // Outbox: instância desconectada → enfileira
      const { data: outbox } = await supabase
        .from('message_outbox')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          payload: { ...meta, content: this.serializeContent(content) } as never,
          status: 'queued',
        })
        .select('id')
        .single();
      this.realtime.emitAll('outbox:queued', { conversationId, outboxId: outbox?.id });
      return { queued: true, outboxId: outbox?.id };
    }

    // Upload da mídia para Storage (se houver) antes do envio para já ter URL
    let mediaUploaded: { path: string; url: string; size: number } | null = null;
    if (meta.mediaBuffer) {
      const uploaded = await this.media.upload({
        instanceId: conv.instanceId,
        buffer: meta.mediaBuffer,
        mimeType: meta.mediaMime ?? 'application/octet-stream',
        extension: this.extensionFor(meta.type, meta.mediaMime),
      });
      mediaUploaded = { path: uploaded.path, url: uploaded.url, size: uploaded.size };
    }

    const sendOptions = meta.quoted ? { quoted: meta.quoted } : undefined;
    const sent = await session.sock.sendMessage(contactJid, content, sendOptions);
    if (!sent?.key?.id) {
      throw new AppException(
        ErrCodes.WHATSAPP_SEND_FAILED,
        'Envio falhou (sem key)',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const wsTimestamp = sent.messageTimestamp
      ? new Date(Number(sent.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        wa_message_id: sent.key.id,
        from_me: true,
        sender_jid: session.sock.user?.id ?? null,
        type: meta.type,
        body: meta.body,
        media_url: mediaUploaded?.url ?? null,
        media_path: mediaUploaded?.path ?? null,
        media_mime: meta.mediaMime ?? null,
        media_size_bytes: mediaUploaded?.size ?? null,
        reply_to_message_id: meta.replyToMessageId,
        status: 'sent',
        sent_by_user_id: userId,
        sent_via: 'dashboard',
        transcript_status:
          meta.type === 'audio' || meta.type === 'ptt' ? 'pending' : 'skipped',
        wa_timestamp: wsTimestamp,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      this.log.error({ err: error, waId: sent.key.id }, 'falha ao persistir mensagem enviada');
      throw new AppException(ErrCodes.INTERNAL, 'Falha ao persistir', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: wsTimestamp,
        last_message_preview: meta.body ?? this.previewForType(meta.type),
      })
      .eq('id', conversationId);

    this.realtime.emitAll('message:new', {
      conversationId,
      messageId: inserted.id,
      fromMe: true,
    });

    if (meta.type === 'audio' || meta.type === 'ptt') {
      void this.transcription.enqueue(inserted.id);
    }

    return { messageId: inserted.id, waMessageId: sent.key.id };
  }

  private extensionFor(type: string, mimeType?: string): string {
    if (type === 'sticker') return 'webp';
    if (type === 'ptt' || type === 'audio') return 'ogg';
    if (mimeType) {
      const ext = mime.extension(mimeType);
      if (ext) return ext;
    }
    if (type === 'image') return 'jpg';
    if (type === 'video') return 'mp4';
    return 'bin';
  }

  private serializeContent(content: AnyMessageContent): unknown {
    // Buffers não são JSON-friendly. Para outbox, descartamos buffers (precisariam ser refeitos).
    return JSON.parse(
      JSON.stringify(content, (_, v) =>
        Buffer.isBuffer(v) ? '[Buffer omitido - reenviar mídia]' : v,
      ),
    );
  }

  private previewForType(type: string): string {
    switch (type) {
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
      default:
        return '';
    }
  }
}
