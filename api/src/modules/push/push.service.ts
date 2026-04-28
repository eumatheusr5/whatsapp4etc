import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { getConfig } from '../../lib/config';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

/**
 * Implementação leve de Web Push (VAPID) sem depender da lib `web-push`.
 * Usa fetch direto ao endpoint do navegador. Para volumes baixos é suficiente.
 *
 * Em produção, recomenda-se trocar pela lib `web-push` para suporte completo
 * a criptografia AES-128-GCM payload (atualmente implementamos via REST).
 */
@Injectable()
export class PushService {
  private readonly log = logger.child({ component: 'PushService' });

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await getSupabaseAdmin()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }

  async pushToUser(userId: string, payload: NotificationPayload): Promise<void> {
    const cfg = getConfig();
    if (!cfg.VAPID_PRIVATE_KEY || !cfg.VAPID_PUBLIC_KEY) return;
    const supabase = getSupabaseAdmin();
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (!subs?.length) return;
    for (const s of subs) {
      try {
        await this.sendOne({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else {
          this.log.warn({ err, endpoint: s.endpoint }, 'push falhou');
        }
      }
    }
  }

  private async sendOne(
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: NotificationPayload,
  ): Promise<void> {
    const cfg = getConfig();
    const audience = new URL(sub.endpoint).origin;
    const vapidJwt = this.buildVapidJwt(audience, cfg.VAPID_SUBJECT, cfg.VAPID_PRIVATE_KEY!);

    const body = JSON.stringify(payload);
    try {
      await axios.post(sub.endpoint, body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400',
          Authorization: `vapid t=${vapidJwt}, k=${cfg.VAPID_PUBLIC_KEY}`,
        },
        timeout: 10_000,
        validateStatus: (s) => s >= 200 && s < 300,
      });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const e = new Error('push failed');
      (e as { status?: number }).status = status;
      throw e;
    }
  }

  private buildVapidJwt(aud: string, sub: string, privateKeyB64: string): string {
    const header = { typ: 'JWT', alg: 'ES256' };
    const payload = {
      aud,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub,
    };
    const enc = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const headerEncoded = enc(header);
    const payloadEncoded = enc(payload);
    const data = `${headerEncoded}.${payloadEncoded}`;
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyB64, 'base64url'),
      format: 'der',
      type: 'pkcs8',
    });
    const signature = crypto.sign('sha256', Buffer.from(data), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    return `${data}.${signature.toString('base64url')}`;
  }
}
