import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import { api } from './api';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  return reg;
}

export async function ensurePushSubscription(): Promise<void> {
  if (!VAPID_PUBLIC) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;

  const reg = await ensureServiceWorker();
  if (!reg) return;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(0) as ArrayBuffer,
    });
  }
  await api.post('/push/subscribe', sub.toJSON());
}

/**
 * Hook que:
 * - Toca um som curto a cada nova mensagem recebida
 * - Pisca o título da aba quando há mensagem nova e a aba não está ativa
 * - Registra service worker
 */
export function useInAppNotifications() {
  const [unread, setUnread] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalTitleRef = useRef<string>('');
  const blinkTimer = useRef<number | null>(null);

  useEffect(() => {
    void ensureServiceWorker();
    audioRef.current = new Audio(
      'data:audio/wav;base64,UklGRl9vAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT5vAAA=',
    );
    audioRef.current.volume = 0.4;
    originalTitleRef.current = document.title;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null;
    void (async () => {
      sock = await getSocket();
      if (cancelled) return;
      sock.on('message:new', (p: { fromMe: boolean }) => {
        if (p.fromMe) return;
        if (!document.hidden) return;
        setUnread((x) => x + 1);
        try {
          void audioRef.current?.play().catch(() => undefined);
        } catch {
          /* ignore */
        }
      });
    })();
    return () => {
      cancelled = true;
      sock?.off('message:new');
    };
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) {
        setUnread(0);
        document.title = originalTitleRef.current;
        if (blinkTimer.current) {
          window.clearInterval(blinkTimer.current);
          blinkTimer.current = null;
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (unread === 0) {
      document.title = originalTitleRef.current;
      if (blinkTimer.current) {
        window.clearInterval(blinkTimer.current);
        blinkTimer.current = null;
      }
      return;
    }
    if (blinkTimer.current) return;
    let toggle = false;
    blinkTimer.current = window.setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `(${unread}) Nova(s) mensagem(ns)`
        : originalTitleRef.current;
    }, 1500);
    return () => {
      if (blinkTimer.current) {
        window.clearInterval(blinkTimer.current);
        blinkTimer.current = null;
      }
    };
  }, [unread]);
}
