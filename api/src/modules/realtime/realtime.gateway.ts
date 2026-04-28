import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtAuthService, AuthUser } from '../auth/jwt.service';
import { logger } from '../../lib/logger';
import { getSupabaseAdmin } from '../../lib/supabase-admin';

interface AuthedSocket extends Socket {
  user?: AuthUser;
}

@Injectable()
@WebSocketGateway({ namespace: '/', transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly online = new Map<string, Set<string>>();

  constructor(private readonly jwt: JwtAuthService) {}

  async handleConnection(socket: AuthedSocket): Promise<void> {
    const token =
      (socket.handshake.auth?.token as string) ||
      (typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);

    try {
      const user = await this.jwt.verify(token ?? '');
      socket.user = user;
      this.addOnline(user.id, socket.id);
      socket.join(`user:${user.id}`);
      socket.join('all');
      await this.markOnline(user.id, true);
      this.server.to('all').emit('user:online', { userId: user.id });
      logger.debug({ userId: user.id, socketId: socket.id }, 'socket connected');
    } catch (err) {
      logger.warn({ err, socketId: socket.id }, 'socket auth failed');
      socket.emit('error', { code: 'ERR_UNAUTHORIZED', message: 'Token inválido' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthedSocket): Promise<void> {
    const userId = socket.user?.id;
    if (!userId) return;
    this.removeOnline(userId, socket.id);
    if (!this.isOnline(userId)) {
      await this.markOnline(userId, false);
      this.server.to('all').emit('user:offline', { userId });
    }
  }

  // ===== Helpers para outros módulos emitirem =====
  emitAll(event: string, payload: unknown): void {
    this.server.to('all').emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  isOnline(userId: string): boolean {
    return (this.online.get(userId)?.size ?? 0) > 0;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.online.keys()).filter((id) => this.isOnline(id));
  }

  private addOnline(userId: string, socketId: string): void {
    if (!this.online.has(userId)) this.online.set(userId, new Set());
    this.online.get(userId)!.add(socketId);
  }

  private removeOnline(userId: string, socketId: string): void {
    const set = this.online.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this.online.delete(userId);
  }

  private async markOnline(userId: string, isOnline: boolean): Promise<void> {
    try {
      await getSupabaseAdmin()
        .from('users')
        .update({
          is_online: isOnline,
          last_seen_at: isOnline ? null : new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (err) {
      logger.warn({ err, userId }, 'falha ao atualizar presence');
    }
  }
}
