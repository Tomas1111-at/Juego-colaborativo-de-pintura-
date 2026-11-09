const CACHE_NAME = 'pincelada-colab-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.url.includes('/api/') || req.url.includes('/ws')) {
    return;
  }
  // Network-first to guarantee latest code and parameters are always served
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
