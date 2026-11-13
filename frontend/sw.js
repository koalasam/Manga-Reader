const STATIC_CACHE = 'manga-static-v1';
const OFFLINE_CHAPTER_CACHE = 'manga-offline-chapters-v1';

const ASSETS = ['/', '/index.html', '/css/styles.css', '/js/api.js', '/js/reader.js', '/js/app.js', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Serve offline cached chapter images & page lists first if downloaded on device
  if (url.pathname.startsWith('/api/read/')) {
    event.respondWith(
      caches.open(OFFLINE_CHAPTER_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return fetch(event.request);
      })
    );
    return;
  }

  // Network-first for API calls, cache-first for static UI
  if (!url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});