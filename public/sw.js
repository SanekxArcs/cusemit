/**
 * Service Worker for Digital Clock PWA
 * Enables offline support and caching strategy
 */

const CACHE_NAME = 'digital-clock-v1'
const FONT_CACHE_NAME = 'digital-clock-fonts-v1'
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
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
          if (cacheName !== CACHE_NAME && cacheName !== FONT_CACHE_NAME) {
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

  const requestUrl = new URL(event.request.url)

  // Google Fonts: cache-first (content is versioned/immutable per URL), so a
  // cold app start never has to wait on a network round-trip before the
  // clock's chosen font is ready, avoiding a fallback-font flash at full scale.
  if (FONT_HOSTS.includes(requestUrl.hostname)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) {
          // Revalidate in background without blocking
          fetch(event.request)
            .then((response) => {
              // Font CSS is fetched no-cors (opaque, status 0) since the <link>
              // tag has no crossorigin attribute — status 0 is the success case there.
              if (response && (response.ok || response.status === 0)) {
                cache.put(event.request, response.clone())
              }
            })
            .catch(() => {})
          return cached
        }
        const response = await fetch(event.request)
        if (response && (response.ok || response.status === 0)) {
          cache.put(event.request, response.clone())
        }
        return response
      })
    )
    return
  }

  // Skip other cross-origin requests
  if (requestUrl.origin !== self.location.origin) {
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
