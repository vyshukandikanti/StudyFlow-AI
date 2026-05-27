// StudyFlow AI — Service Worker
const CACHE_NAME = 'studyflow-v3';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

// Install — cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate — clean old caches and claim immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — always check network for HTML and app code, cache static assets
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Don't cache Groq API calls
  if (event.request.url.includes('api.groq.com')) return;

  // Always fetch from network for: HTML, app.js, CSS, manifest, service-worker
  if (event.request.url.includes('index.html') ||
      event.request.url.includes('app.js') ||
      event.request.url.includes('style.css') ||
      event.request.url.includes('manifest.json') ||
      event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Cache static assets (CSS, icons, etc.)
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

// Click on notification → open the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// Allow the page to ask SW to show a notification right now
self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      tag: tag || 'studyflow',
      icon: 'icon.svg',
      badge: 'icon.svg',
      vibrate: [200, 100, 200]
    });
  }
});
