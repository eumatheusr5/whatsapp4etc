import { HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';
import { SessionManager } from '../../baileys/session-manager';

interface CreateOpts {
  name: string;
  userId: string;
}

@Injectable()
export class InstancesService {
  constructor(private readonly sessionManager: SessionManager) {}

  async list() {
    const { data, error } = await getSupabaseAdmin()
      .from('instances')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async get(id: string) {
    const { data, error } = await getSupabaseAdmin()
      .from('instances')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Instância não encontrada', HttpStatus.NOT_FOUND);
    }
    return data;
  }

  async create({ name, userId }: CreateOpts) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('instances')
      .insert({ name, status: 'disconnected' })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('insert vazio');
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'instance.create',
      entity: 'instance',
      entity_id: data.id,
      meta: { name } as never,
    });
    return data;
  }

  async connect(id: string, userId: string) {
    await this.get(id);
    await this.sessionManager.start(id);
    await getSupabaseAdmin().from('audit_log').insert({
      user_id: userId,
      action: 'instance.connect',
      entity: 'instance',
      entity_id: id,
    });
    return { ok: true };
  }

  async disconnect(id: string, userId: string) {
    await this.get(id);
    await this.sessionManager.stop(id);
    await getSupabaseAdmin().from('audit_log').insert({
      user_id: userId,
      action: 'instance.disconnect',
      entity: 'instance',
      entity_id: id,
    });
    return { ok: true };
  }

  async logout(id: string, userId: string) {
    await this.get(id);
    await this.sessionManager.logout(id);
    await getSupabaseAdmin().from('audit_log').insert({
      user_id: userId,
      action: 'instance.logout',
      entity: 'instance',
      entity_id: id,
    });
    return { ok: true };
  }

  async remove(id: string, userId: string) {
    await this.get(id);
    await this.sessionManager.logout(id).catch(() => undefined);
    const { error } = await getSupabaseAdmin().from('instances').delete().eq('id', id);
    if (error) throw error;
    await getSupabaseAdmin().from('audit_log').insert({
      user_id: userId,
      action: 'instance.delete',
      entity: 'instance',
      entity_id: id,
    });
    return { ok: true };
  }

  async healthEvents(id: string, limit = 50) {
    const { data, error } = await getSupabaseAdmin()
      .from('instance_health_events')
      .select('*')
      .eq('instance_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
