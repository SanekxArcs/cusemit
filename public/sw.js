/**
 * Service Worker for Digital Clock PWA
 * Enables offline support and caching strategy
 */

const CACHE_NAME = 'digital-clock-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install: Cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Some assets may fail (CDN, etc), but continue
        console.log('Some assets failed to cache')
      })
    })
  )
  self.skipWaiting()
})

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch: Stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  event.respondWith(
    // First try cache (for instant response)
    caches.match(event.request).then((cached) => {
      // Return cached if available
      if (cached) {
        // Revalidate in background without blocking
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              // Clone before caching to avoid "body already read" error
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone)
              })
            }
          })
          .catch(() => {
            // Network failed, we already have cached version, so ignore
          })
        return cached
      }

      // No cache, try network
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            // Clone before caching to avoid "body already read" error
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone)
            })
          }
          return response
        })
        .catch(() => {
          // Network failed and no cache available
          return new Response('Offline - App still works!', {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          })
        })
    })
  )
})

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
