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
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
