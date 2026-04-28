// Service Worker para Web Push notifications
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Nova mensagem', body: event.data.text() };
  }
  const { title, body, url, tag, icon } = payload;
  event.waitUntil(
    self.registration.showNotification(title || 'WhatsApp4etc', {
      body: body || '',
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: tag || 'msg',
      data: { url: url || '/conversas' },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/conversas';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
