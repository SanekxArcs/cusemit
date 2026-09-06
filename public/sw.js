// The production build injects every emitted asset and a content-based revision.
// Installation succeeds only when the complete app shell is available offline.
const REVISION = '__BUILD_REVISION__';
const APP_CACHE = 'cusemit-app-' + REVISION;
const ASSETS = /* __PRECACHE__ */ [
  '/',
  '/index.html',
  '/manifest.json',
  '/clock-96.png',
  '/clock-192.png',
  '/clock-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Font libraries are owned by the font loader and survive app updates.
      for (const key of await caches.keys()) {
        if (
          (key.startsWith('cusemit-app-') || key === 'digital-clock-v1') &&
          key !== APP_CACHE
        )
          await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).pathname.startsWith('/api/') ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // Keep the HTML and hashed chunks from the same complete installed release.
      if (event.request.mode === 'navigate')
        return (await cache.match('/index.html')) || fetch(event.request);
      // The preview server varies responses by Origin. Precache requests have no
      // Origin while module scripts do; immutable same-origin assets are identical.
      const cached = await cache.match(event.request, { ignoreVary: true });
      if (cached) return cached;
      return fetch(event.request);
    })()
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
