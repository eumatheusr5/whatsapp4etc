import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  default as makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  Browsers,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { useSupabaseAuthState } from './supabase-auth-state';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { logger } from '../lib/logger';
import { RealtimeGateway } from '../modules/realtime/realtime.gateway';
import { EventHandlersService } from './event-handlers.service';
import { ContactsService } from '../modules/contacts/contacts.service';

interface ManagedSession {
  id: string;
  sock: WASocket;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'banned';
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
  reconnectAttempt: number;
}

@Injectable()
export class SessionManager implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly log = logger.child({ component: 'SessionManager' });

  constructor(
    private readonly realtime: RealtimeGateway,
    @Inject(forwardRef(() => EventHandlersService))
    private readonly eventHandlers: EventHandlersService,
    @Inject(forwardRef(() => ContactsService))
    private readonly contacts: ContactsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('instances')
      .select('id, name, status')
      .in('status', ['connected', 'connecting', 'qr']);
    if (error) {
      this.log.error({ err: error }, 'falha ao listar instâncias para bootstrap');
      return;
    }
    if (!rows || rows.length === 0) return;
    this.log.info({ count: rows.length }, 'restaurando instâncias do banco');
    for (const row of rows) {
      this.start(row.id).catch((err) => {
        this.log.error({ err, instanceId: row.id }, 'falha no bootstrap da instância');
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.log.info('encerrando sessões');
    for (const session of this.sessions.values()) {
      try {
        session.sock.end(undefined);
      } catch {
        /* ignore */
      }
    }
  }

  has(instanceId: string): boolean {
    return this.sessions.has(instanceId);
  }

  get(instanceId: string): ManagedSession | undefined {
    return this.sessions.get(instanceId);
  }

  /**
   * Inicia (ou reinicia) uma sessão para a instância.
   */
  async start(instanceId: string): Promise<ManagedSession> {
    const existing = this.sessions.get(instanceId);
    if (existing) {
      try {
        existing.sock.end(undefined);
      } catch {
        /* ignore */
      }
      this.sessions.delete(instanceId);
    }

    const supabase = getSupabaseAdmin();
    const { state, saveCreds, clear } = await useSupabaseAuthState(instanceId);
    const { version } = await fetchLatestBaileysVersion();

    await this.updateInstanceStatus(instanceId, 'connecting');
    await this.recordHealth(instanceId, 'session_loaded', { version });

    const sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.macOS('Desktop'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      shouldIgnoreJid: (jid) => typeof jid === 'string' && jid.endsWith('@broadcast'),
      logger: logger.child({ baileys: instanceId }) as never,
    });

    const managed: ManagedSession = {
      id: instanceId,
      sock,
      status: 'connecting',
      saveCreds,
      clear,
      reconnectAttempt: existing?.reconnectAttempt ?? 0,
    };
    this.sessions.set(instanceId, managed);

    sock.ev.on('creds.update', () => {
      saveCreds().catch((err) => this.log.warn({ err, instanceId }, 'saveCreds error'));
    });

    sock.ev.on('connection.update', (update) => {
      this.onConnectionUpdate(instanceId, update).catch((err) =>
        this.log.error({ err, instanceId }, 'erro em connection.update'),
      );
    });

    this.eventHandlers.bind(instanceId, sock);

    return managed;
  }

  /**
   * Encerra a sessão (logout do WhatsApp e limpa creds para forçar novo QR).
   */
  async logout(instanceId: string): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (session) {
      try {
        await session.sock.logout();
      } catch (err) {
        this.log.warn({ err, instanceId }, 'logout falhou, prosseguindo');
      }
      try {
        session.sock.end(undefined);
      } catch {
        /* ignore */
      }
      await session.clear();
      this.sessions.delete(instanceId);
    } else {
      const { state, clear } = await useSupabaseAuthState(instanceId);
      void state;
      await clear();
    }
    await this.updateInstanceStatus(instanceId, 'disconnected', { last_qr: null });
    await this.recordHealth(instanceId, 'disconnected', { reason: 'manual_logout' });
    this.realtime.emitAll('instance:status_changed', { instanceId, status: 'disconnected' });
  }

  /**
   * Apenas desconecta socket sem limpar creds (mantém para reconexão posterior).
   */
  async stop(instanceId: string): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (!session) return;
    try {
      session.sock.end(undefined);
    } catch {
      /* ignore */
    }
    this.sessions.delete(instanceId);
    await this.updateInstanceStatus(instanceId, 'disconnected');
    this.realtime.emitAll('instance:status_changed', { instanceId, status: 'disconnected' });
  }

  private async onConnectionUpdate(instanceId: string, update: Partial<ConnectionState>): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (!session) return;

    if (update.qr) {
      const qrDataUrl = await QRCode.toDataURL(update.qr, { margin: 1, scale: 6 });
      session.status = 'qr';
      await this.updateInstanceStatus(instanceId, 'qr', {
        last_qr: qrDataUrl,
        last_qr_at: new Date().toISOString(),
      });
      await this.recordHealth(instanceId, 'qr_generated', {});
      this.realtime.emitAll('instance:qr', { instanceId, qr: qrDataUrl });
      this.realtime.emitAll('instance:status_changed', { instanceId, status: 'qr' });
    }

    if (update.connection === 'open') {
      const me = session.sock.user;
      const phoneNumber = me?.id ? me.id.split(':')[0].split('@')[0] : null;
      // Nome do PERFIL PROPRIO da instancia. Usado pelo ContactsService para
      // descartar pushName recebido em mensagens fromMe (ex: status de pedido
      // enviado por sistema externo via essa mesma conta) — assim o nome do
      // cliente nunca eh contaminado pelo nome da empresa.
      const selfPushName = (me as { name?: string } | undefined)?.name ?? null;
      const selfVerifiedName =
        (me as { verifiedName?: string } | undefined)?.verifiedName ?? null;
      session.status = 'connected';
      session.reconnectAttempt = 0;
      await this.updateInstanceStatus(instanceId, 'connected', {
        last_qr: null,
        last_connected_at: new Date().toISOString(),
        phone_number: phoneNumber,
        disconnect_reason: null,
        self_push_name: selfPushName,
        self_verified_name: selfVerifiedName,
      });
      await this.recordHealth(instanceId, 'connected', { phoneNumber });
      this.realtime.emitAll('instance:connected', { instanceId, phoneNumber });
      this.realtime.emitAll('instance:status_changed', { instanceId, status: 'connected' });
      this.contacts.invalidateSelfNames(instanceId);
      this.log.info({ instanceId, phoneNumber, selfPushName }, 'instância conectada');
    }

    if (update.connection === 'close') {
      const reason = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const reasonText = DisconnectReason[reason as number] ?? 'unknown';
      this.log.warn({ instanceId, reason, reasonText }, 'connection closed');

      const isLoggedOut = reason === DisconnectReason.loggedOut;
      const isBanned =
        reason === DisconnectReason.forbidden ||
        reason === DisconnectReason.connectionReplaced;

      if (isLoggedOut) {
        await session.clear();
        this.sessions.delete(instanceId);
        await this.updateInstanceStatus(instanceId, 'disconnected', {
          last_qr: null,
          last_disconnected_at: new Date().toISOString(),
          disconnect_reason: 'logged_out',
        });
        await this.recordHealth(instanceId, 'disconnected', { reason: 'logged_out' });
        this.realtime.emitAll('instance:status_changed', { instanceId, status: 'disconnected' });
        return;
      }

      if (isBanned) {
        this.sessions.delete(instanceId);
        await this.updateInstanceStatus(instanceId, 'banned', {
          last_disconnected_at: new Date().toISOString(),
          disconnect_reason: reasonText,
        });
        await this.recordHealth(instanceId, 'banned', { reason: reasonText });
        this.realtime.emitAll('instance:status_changed', { instanceId, status: 'banned' });
        return;
      }

      // Reconexão automática com backoff exponencial
      session.reconnectAttempt += 1;
      const delay = Math.min(60_000, 1000 * Math.pow(2, session.reconnectAttempt - 1));
      await this.updateInstanceStatus(instanceId, 'connecting', {
        last_disconnected_at: new Date().toISOString(),
        disconnect_reason: reasonText,
      });
      await this.recordHealth(instanceId, 'reconnecting', {
        attempt: session.reconnectAttempt,
        delayMs: delay,
        reason: reasonText,
      });
      this.realtime.emitAll('instance:status_changed', {
        instanceId,
        status: 'connecting',
        reconnectAttempt: session.reconnectAttempt,
      });
      this.log.info({ instanceId, delay, attempt: session.reconnectAttempt }, 'reconectando');
      setTimeout(() => {
        this.start(instanceId).catch((err) =>
          this.log.error({ err, instanceId }, 'falha ao reconectar'),
        );
      }, delay);
    }
  }

  private async updateInstanceStatus(
    instanceId: string,
    status: ManagedSession['status'],
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('instances')
      .update({ status, ...extra } as never)
      .eq('id', instanceId);
    if (error) this.log.warn({ err: error, instanceId }, 'falha ao atualizar status');
  }

  private async recordHealth(
    instanceId: string,
    eventType: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await getSupabaseAdmin().from('instance_health_events').insert({
        instance_id: instanceId,
        event_type: eventType,
        detail: detail as never,
      });
    } catch (err) {
      this.log.warn({ err, instanceId }, 'falha ao registrar health event');
    }
  }
}
