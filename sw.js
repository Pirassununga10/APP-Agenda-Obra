const CACHE_NAME = 'agenda-obra-v1';
const APP_SHELL = [
  './agenda-obra.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});

function triggersSupported() {
  try {
    return ('Notification' in self) && ('showTrigger' in Notification.prototype);
  } catch (e) {
    return false;
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'schedule') {
    event.waitUntil(scheduleNotifications(data.items || []));
  } else if (data.type === 'cancel-all') {
    event.waitUntil(cancelAll());
  }
});

async function scheduleNotifications(items) {
  // Clear any previously scheduled notification for the same entries first,
  // so re-saving an entry replaces its reminder instead of duplicating it.
  try {
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    existing.forEach((n) => {
      if (items.some((i) => i.id === n.tag)) n.close();
    });
  } catch (e) { /* ignore */ }

  if (!triggersSupported()) return; // no background scheduling possible on this browser

  for (const item of items) {
    if (!item.timestamp || item.timestamp <= Date.now()) continue;
    try {
      await self.registration.showNotification(item.title, {
        body: item.body || '',
        tag: item.id,
        icon: './icon-192.png',
        badge: './icon-192.png',
        showTrigger: new TimestampTrigger(item.timestamp),
        data: { id: item.id }
      });
    } catch (e) { /* individual scheduling failure shouldn't block the rest */ }
  }
}

async function cancelAll() {
  try {
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    existing.forEach((n) => n.close());
  } catch (e) { /* ignore */ }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./agenda-obra.html');
    })
  );
});
