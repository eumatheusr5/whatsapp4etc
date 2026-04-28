import { HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';
import { logger } from '../../lib/logger';

export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'atendente';
}

export interface UpdateUserInput {
  fullName?: string;
  role?: 'admin' | 'atendente';
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  private readonly log = logger.child({ component: 'UsersService' });

  async getMe(userId: string) {
    const supabase = getSupabaseAdmin();
    const { data: pub, error: pubErr } = await supabase
      .from('users')
      .select('id, full_name, role, avatar_url, is_online, last_seen_at, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (pubErr || !pub) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Usuário não encontrado', HttpStatus.NOT_FOUND);
    }
    const { data: auth } = await supabase.auth.admin.getUserById(userId);
    return {
      ...pub,
      email: auth.user?.email ?? null,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = {};
    if (input.fullName !== undefined) update.full_name = input.fullName.trim();
    if (input.avatarUrl !== undefined) update.avatar_url = input.avatarUrl;
    if (Object.keys(update).length === 0) return this.getMe(userId);

    const { error } = await supabase.from('users').update(update as never).eq('id', userId);
    if (error) throw error;

    if (input.fullName !== undefined) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: input.fullName.trim() },
      });
    }
    return this.getMe(userId);
  }

  async uploadAvatar(userId: string, buffer: Buffer, mimeType: string) {
    const supabase = getSupabaseAdmin();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: mimeType, upsert: true, cacheControl: '604800' });
    if (upErr) {
      this.log.error({ err: upErr, userId }, 'falha upload avatar');
      throw new AppException(
        ErrCodes.INTERNAL,
        'Falha ao enviar avatar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase
      .from('users')
      .update({ avatar_url: pub.publicUrl } as never)
      .eq('id', userId);
    return { avatar_url: pub.publicUrl };
  }

  async changePassword(userId: string, newPassword: string) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      throw new AppException(ErrCodes.VALIDATION, error.message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'user.password_change',
      entity: 'user',
      entity_id: userId,
    } as never);
    return { ok: true };
  }

  async list() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, avatar_url, is_online, last_seen_at, is_active, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const ids = (data ?? []).map((u) => u.id);
    const emailMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: authResp } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of authResp.users ?? []) {
        emailMap.set(u.id, u.email ?? null);
      }
    }
    return (data ?? []).map((u) => ({ ...u, email: emailMap.get(u.id) ?? null }));
  }

  async create(input: CreateUserInput, actorId: string) {
    const supabase = getSupabaseAdmin();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (createErr || !created.user) {
      throw new AppException(
        ErrCodes.VALIDATION,
        createErr?.message ?? 'Falha ao criar usuário',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const userId = created.user.id;
    await supabase
      .from('users')
      .upsert({
        id: userId,
        full_name: input.fullName,
        role: input.role,
        is_active: true,
      } as never);
    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'user.create',
      entity: 'user',
      entity_id: userId,
      meta: { email: input.email, role: input.role },
    } as never);
    return { id: userId };
  }

  async update(targetId: string, input: UpdateUserInput, actorId: string) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = {};
    if (input.fullName !== undefined) update.full_name = input.fullName.trim();
    if (input.role !== undefined) update.role = input.role;
    if (input.isActive !== undefined) update.is_active = input.isActive;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase.from('users').update(update as never).eq('id', targetId);
    if (error) throw error;

    if (input.isActive === false) {
      await supabase.auth.admin.updateUserById(targetId, { ban_duration: '876600h' });
    } else if (input.isActive === true) {
      await supabase.auth.admin.updateUserById(targetId, { ban_duration: 'none' });
    }

    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'user.update',
      entity: 'user',
      entity_id: targetId,
      meta: update,
    } as never);
    return { ok: true };
  }

  async remove(targetId: string, actorId: string) {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('users')
      .update({ is_active: false } as never)
      .eq('id', targetId);
    await supabase.auth.admin.updateUserById(targetId, { ban_duration: '876600h' });
    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'user.deactivate',
      entity: 'user',
      entity_id: targetId,
    } as never);
    return { ok: true };
  }

  async ensureAdmin(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (!data || data.role !== 'admin' || data.is_active === false) {
      throw new AppException(
        ErrCodes.FORBIDDEN,
        'Apenas administradores podem realizar esta ação',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
