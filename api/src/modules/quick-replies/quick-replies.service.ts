import { HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';

export interface QuickReplyInput {
  shortcut: string;
  body: string;
  global?: boolean;
}

@Injectable()
export class QuickRepliesService {
  /**
   * Lista respostas rápidas do usuário + globais. Admin vê todas.
   */
  async list(userId: string, isAdmin: boolean) {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('quick_replies')
      .select('id, user_id, shortcut, body, media_url, created_at, updated_at')
      .order('shortcut');
    if (!isAdmin) {
      query = query.or(`user_id.is.null,user_id.eq.${userId}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(userId: string, isAdmin: boolean, input: QuickReplyInput) {
    if (input.global && !isAdmin) {
      throw new AppException(
        ErrCodes.FORBIDDEN,
        'Apenas admin pode criar respostas globais',
        HttpStatus.FORBIDDEN,
      );
    }
    const supabase = getSupabaseAdmin();
    const shortcut = input.shortcut.trim();
    if (!shortcut.startsWith('/')) {
      throw new AppException(
        ErrCodes.VALIDATION,
        'Shortcut deve começar com /',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const { data, error } = await supabase
      .from('quick_replies')
      .insert({
        user_id: input.global ? null : userId,
        shortcut,
        body: input.body,
      } as never)
      .select('id, user_id, shortcut, body, media_url, created_at, updated_at')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new AppException(
          ErrCodes.CONFLICT,
          'Já existe uma resposta rápida com esse shortcut',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
    const row = data as { id: string };
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'quick_reply.create',
      entity: 'quick_reply',
      entity_id: row.id,
    } as never);
    return data;
  }

  async update(
    userId: string,
    isAdmin: boolean,
    id: string,
    input: Partial<QuickReplyInput>,
  ) {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('quick_replies')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Resposta rápida não encontrada', HttpStatus.NOT_FOUND);
    }
    const isOwner = existing.user_id === userId;
    if (!isOwner && !isAdmin) {
      throw new AppException(ErrCodes.FORBIDDEN, 'Sem permissão', HttpStatus.FORBIDDEN);
    }

    const update: Record<string, unknown> = {};
    if (input.shortcut !== undefined) {
      const s = input.shortcut.trim();
      if (!s.startsWith('/')) {
        throw new AppException(
          ErrCodes.VALIDATION,
          'Shortcut deve começar com /',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      update.shortcut = s;
    }
    if (input.body !== undefined) update.body = input.body;

    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from('quick_replies')
      .update(update as never)
      .eq('id', id);
    if (error) {
      if (error.code === '23505') {
        throw new AppException(
          ErrCodes.CONFLICT,
          'Shortcut já em uso',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'quick_reply.update',
      entity: 'quick_reply',
      entity_id: id,
      meta: update,
    } as never);
    return { ok: true };
  }

  async remove(userId: string, isAdmin: boolean, id: string) {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('quick_replies')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Resposta rápida não encontrada', HttpStatus.NOT_FOUND);
    }
    const isOwner = existing.user_id === userId;
    if (!isOwner && !isAdmin) {
      throw new AppException(ErrCodes.FORBIDDEN, 'Sem permissão', HttpStatus.FORBIDDEN);
    }
    const { error } = await supabase.from('quick_replies').delete().eq('id', id);
    if (error) throw error;
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'quick_reply.delete',
      entity: 'quick_reply',
      entity_id: id,
    } as never);
    return { ok: true };
  }
}
