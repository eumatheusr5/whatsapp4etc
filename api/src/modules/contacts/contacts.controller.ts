import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { ZodValidationPipe } from '../../lib/zod-pipe';
import { AppException, ErrCodes } from '../../lib/errors';
import { getSupabaseAdmin } from '../../lib/supabase-admin';

const UpdateContactSchema = z.object({
  customName: z.string().max(120).nullable().optional(),
  isBlocked: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const NoteSchema = z.object({
  body: z.string().min(1).max(4000),
});

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  /**
   * Lista contatos com filtros opcionais.
   *  - search: substring em nome/push_name/phone_number
   *  - tagId: filtra por uma tag específica
   *  - instanceId: filtra por instância
   *  - hasNotes=true|false: contatos com observações
   */
  @Get()
  async list(
    @Query('search') search?: string,
    @Query('tagId') tagId?: string,
    @Query('instanceId') instanceId?: string,
    @Query('hasNotes') hasNotes?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = Math.min(200, Math.max(1, parseInt(limitStr ?? '50', 10) || 50));
    const offset = Math.max(0, parseInt(offsetStr ?? '0', 10) || 0);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('contacts')
      .select(
        `id, jid, push_name, custom_name, avatar_url, phone_number, is_blocked, instance_id, created_at,
         instances:instance_id (name),
         contact_tags (tag_id, tags:tag_id (id, name, color)),
         contact_notes (id)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (instanceId) query = query.eq('instance_id', instanceId);
    if (search?.trim()) {
      const s = search.trim().replace(/[%_]/g, ' ');
      query = query.or(
        `push_name.ilike.%${s}%,custom_name.ilike.%${s}%,phone_number.ilike.%${s}%`,
      );
    }
    if (tagId) {
      const { data: ids } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .eq('tag_id', tagId);
      const contactIds = (ids ?? []).map((r) => r.contact_id);
      if (contactIds.length === 0) return { items: [], total: 0 };
      query = query.in('id', contactIds);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const items = (data ?? []).map((c) => {
      const tags = ((c.contact_tags as unknown as Array<{ tags: { id: string; name: string; color: string } | null }>) ?? [])
        .map((ct) => ct.tags)
        .filter((t): t is { id: string; name: string; color: string } => !!t);
      const notesCount = ((c.contact_notes as unknown as Array<{ id: string }>) ?? []).length;
      const instance = Array.isArray(c.instances) ? c.instances[0] : c.instances;
      return {
        id: c.id,
        jid: c.jid,
        push_name: c.push_name,
        custom_name: c.custom_name,
        avatar_url: c.avatar_url,
        phone_number: c.phone_number,
        is_blocked: c.is_blocked,
        instance_id: c.instance_id,
        instance_name: instance?.name ?? null,
        tags,
        notes_count: notesCount,
        created_at: c.created_at,
      };
    });

    let filtered = items;
    if (hasNotes === 'true') filtered = filtered.filter((c) => c.notes_count > 0);
    if (hasNotes === 'false') filtered = filtered.filter((c) => c.notes_count === 0);

    return { items: filtered, total: count ?? items.length };
  }

  @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contacts')
      .select(
        `id, jid, push_name, custom_name, avatar_url, phone_number, is_blocked, instance_id,
         custom_fields, presence, presence_updated_at, last_seen_at, created_at,
         instances:instance_id (id, name),
         contact_tags (tag_id, tags:tag_id (id, name, color)),
         contact_notes (id, body, created_at, user_id)`,
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      throw new AppException(ErrCodes.NOT_FOUND, 'Contato não encontrado', HttpStatus.NOT_FOUND);
    }
    const tags = ((data.contact_tags as unknown as Array<{ tags: { id: string; name: string; color: string } | null }>) ?? [])
      .map((ct) => ct.tags)
      .filter((t): t is { id: string; name: string; color: string } => !!t);
    return { ...data, tags };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) body: z.infer<typeof UpdateContactSchema>,
  ) {
    const supabase = getSupabaseAdmin();
    const update: Record<string, unknown> = {};
    if (body.customName !== undefined) update.custom_name = body.customName;
    if (body.isBlocked !== undefined) update.is_blocked = body.isBlocked;
    if (body.customFields !== undefined) update.custom_fields = body.customFields;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from('contacts')
      .update(update as never)
      .eq('id', id);
    if (error) throw error;
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'contact.update',
      entity: 'contact',
      entity_id: id,
      meta: update,
    } as never);
    return { ok: true };
  }

  @Post(':id/notes')
  async addNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NoteSchema)) body: z.infer<typeof NoteSchema>,
  ) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('contact_notes')
      .insert({ contact_id: id, user_id: user.id, body: body.body } as never)
      .select('id, body, created_at, user_id')
      .single();
    if (error) throw error;
    return data;
  }

  @Delete(':id/notes/:noteId')
  async removeNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    void user;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId)
      .eq('contact_id', id);
    if (error) throw error;
    return { ok: true };
  }
}
