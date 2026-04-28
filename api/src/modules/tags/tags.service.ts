import { HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { AppException, ErrCodes } from '../../lib/errors';

export interface TagInput {
  name: string;
  color: string;
}

@Injectable()
export class TagsService {
  async list() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('tags').select('id, name, color, created_at').order('name');
    if (error) throw error;
    if (!data?.length) return [];

    const ids = data.map((t) => t.id);
    const { data: counts } = await supabase
      .from('contact_tags')
      .select('tag_id')
      .in('tag_id', ids);
    const usage = new Map<string, number>();
    for (const c of counts ?? []) usage.set(c.tag_id, (usage.get(c.tag_id) ?? 0) + 1);

    return data.map((t) => ({ ...t, usage_count: usage.get(t.id) ?? 0 }));
  }

  async create(input: TagInput, actorId: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: input.name.trim(), color: input.color } as never)
      .select('id, name, color, created_at')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new AppException(
          ErrCodes.CONFLICT,
          'Já existe uma tag com esse nome',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
    const tag = data as { id: string; name: string; color: string; created_at: string };
    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'tag.create',
      entity: 'tag',
      entity_id: tag.id,
    } as never);
    return { ...tag, usage_count: 0 };
  }

  async update(id: string, input: Partial<TagInput>, actorId: string) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.color !== undefined) update.color = input.color;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase.from('tags').update(update as never).eq('id', id);
    if (error) {
      if (error.code === '23505') {
        throw new AppException(ErrCodes.CONFLICT, 'Nome já em uso', HttpStatus.CONFLICT);
      }
      throw error;
    }
    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'tag.update',
      entity: 'tag',
      entity_id: id,
      meta: update,
    } as never);
    return { ok: true };
  }

  async remove(id: string, actorId: string) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw error;
    await supabase.from('audit_log').insert({
      user_id: actorId,
      action: 'tag.delete',
      entity: 'tag',
      entity_id: id,
    } as never);
    return { ok: true };
  }

  async assign(contactId: string, tagId: string) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('contact_tags')
      .upsert({ contact_id: contactId, tag_id: tagId } as never);
    if (error) throw error;
    return { ok: true };
  }

  async unassign(contactId: string, tagId: string) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId);
    if (error) throw error;
    return { ok: true };
  }
}
