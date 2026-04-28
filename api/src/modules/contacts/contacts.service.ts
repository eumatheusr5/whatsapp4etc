import { Injectable } from '@nestjs/common';
import { WASocket } from '@whiskeysockets/baileys';
import axios from 'axios';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';

const AVATAR_REFRESH_DAYS = 7;

interface UpsertOpts {
  instanceId: string;
  jid: string;
  pushName?: string | null;
  sock?: WASocket;
}

@Injectable()
export class ContactsService {
  private readonly log = logger.child({ component: 'ContactsService' });
  private readonly inflightAvatars = new Set<string>();

  /**
   * Insere ou atualiza o contato. Atualiza pushName a cada chamada.
   * Se a foto está velha (>7 dias) ou nunca foi baixada, dispara fetch assíncrono.
   * Retorna o id do contato.
   */
  async upsert({ instanceId, jid, pushName, sock }: UpsertOpts): Promise<string> {
    const supabase = getSupabaseAdmin();
    const phoneNumber = this.extractPhone(jid);

    const { data: existing, error: selErr } = await supabase
      .from('contacts')
      .select('id, push_name, avatar_url, avatar_updated_at')
      .eq('instance_id', instanceId)
      .eq('jid', jid)
      .maybeSingle();

    if (selErr) {
      this.log.error({ err: selErr, jid }, 'falha ao consultar contato');
      throw selErr;
    }

    let contactId: string;
    if (!existing) {
      const { data: created, error: insErr } = await supabase
        .from('contacts')
        .insert({
          instance_id: instanceId,
          jid,
          push_name: pushName ?? null,
          phone_number: phoneNumber,
        })
        .select('id')
        .single();
      if (insErr || !created) throw insErr ?? new Error('contact insert vazio');
      contactId = created.id;
    } else {
      contactId = existing.id;
      if (pushName && pushName !== existing.push_name) {
        await supabase
          .from('contacts')
          .update({ push_name: pushName, phone_number: phoneNumber })
          .eq('id', contactId);
      }
    }

    if (sock) {
      const isStale =
        !existing?.avatar_updated_at ||
        Date.now() - new Date(existing.avatar_updated_at).getTime() >
          AVATAR_REFRESH_DAYS * 24 * 3600 * 1000;
      if (isStale && !this.inflightAvatars.has(contactId)) {
        this.inflightAvatars.add(contactId);
        this.refreshAvatar(contactId, jid, sock).finally(() => {
          this.inflightAvatars.delete(contactId);
        });
      }
    }

    return contactId;
  }

  async refreshAvatar(contactId: string, jid: string, sock: WASocket): Promise<void> {
    try {
      const url = await sock.profilePictureUrl(jid, 'image').catch(() => null);
      if (!url) {
        await getSupabaseAdmin()
          .from('contacts')
          .update({
            avatar_url: null,
            avatar_updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        return;
      }
      const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const path = `${contactId}.jpg`;
      const supabase = getSupabaseAdmin();
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '604800',
        });
      if (upErr) {
        this.log.warn({ err: upErr, contactId }, 'falha upload avatar');
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase
        .from('contacts')
        .update({
          avatar_url: pub.publicUrl,
          avatar_updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);
    } catch (err) {
      this.log.warn({ err, contactId }, 'refreshAvatar falhou');
    }
  }

  async updatePresence(
    instanceId: string,
    jid: string,
    presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused',
    lastSeenAt?: number,
  ): Promise<void> {
    await getSupabaseAdmin()
      .from('contacts')
      .update({
        presence,
        presence_updated_at: new Date().toISOString(),
        last_seen_at: lastSeenAt ? new Date(lastSeenAt * 1000).toISOString() : undefined,
      })
      .eq('instance_id', instanceId)
      .eq('jid', jid);
  }

  private extractPhone(jid: string): string | null {
    // Remove sufixo de device (ex: 5511999999999:42@s.whatsapp.net) e id de grupo (ex: 5511999999999-1234567@g.us)
    const m = jid.match(/^(\d+)(?:[:\-]\d+)?@/);
    return m ? m[1] : null;
  }

  /**
   * Remove permanentemente um contato e todos os dados relacionados.
   * - Lista todas as mensagens do contato (via conversations) e remove media do Storage em batches.
   * - Remove o avatar do bucket avatars.
   * - Deleta o contato; o cascade do Postgres remove conversations, messages, notes, tags.
   */
  async purge(contactId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Lista paths de mídia das mensagens do contato (via conversations)
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId);
    const conversationIds = (convs ?? []).map((c) => c.id);

    const mediaPaths: string[] = [];
    if (conversationIds.length > 0) {
      const PAGE = 500;
      let offset = 0;
      // paginar pra não estourar memória em conversas longas
      while (true) {
        const { data: msgs, error } = await supabase
          .from('messages')
          .select('media_path')
          .in('conversation_id', conversationIds)
          .not('media_path', 'is', null)
          .range(offset, offset + PAGE - 1);
        if (error) {
          this.log.warn({ err: error, contactId }, 'falha ao listar mídia para purge');
          break;
        }
        const paths = (msgs ?? [])
          .map((m) => m.media_path as string | null)
          .filter((p): p is string => !!p);
        mediaPaths.push(...paths);
        if (!msgs || msgs.length < PAGE) break;
        offset += PAGE;
      }
    }

    // 2. Remove arquivos do Storage em batches de 100 (limite do Supabase)
    if (mediaPaths.length > 0) {
      for (let i = 0; i < mediaPaths.length; i += 100) {
        const batch = mediaPaths.slice(i, i + 100);
        try {
          await supabase.storage.from('media').remove(batch);
        } catch (err) {
          this.log.warn({ err, count: batch.length }, 'falha ao remover batch de mídia');
        }
      }
    }

    // 3. Remove avatar do contato (se houver)
    try {
      await supabase.storage.from('avatars').remove([`${contactId}.jpg`]);
    } catch {
      // ignore — pode não existir
    }

    // 4. Deleta o contato. Cascade do Postgres remove o resto.
    const { error: delErr } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);
    if (delErr) throw delErr;

    this.log.info(
      { contactId, mediaCount: mediaPaths.length, conversations: conversationIds.length },
      'contato purgado',
    );
  }
}
