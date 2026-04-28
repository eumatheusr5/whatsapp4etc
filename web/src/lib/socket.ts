import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';
import { API_URL } from './api';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 20_000,
  });
  if (import.meta.env.DEV) {
    socket.on('connect', () => console.debug('[socket] connected', socket?.id));
    socket.on('connect_error', (err) => console.debug('[socket] connect_error', err.message));
    socket.io.on('reconnect_attempt', (n) => console.debug('[socket] reconnect_attempt', n));
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
