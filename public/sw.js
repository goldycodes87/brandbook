/*
 * BrandBook service worker.
 *
 * Hand-written rather than generated. next-pwa was in package.json and never
 * wired into next.config, so there has never been a service worker at all —
 * and next-pwa 5.6 predates the App Router and this version of Next by several
 * majors. Twenty lines we understand beat a build plugin we do not.
 *
 * What it is for: opening the app at all in a dead spot. Not offline data.
 *
 * THE RULE THAT MATTERS: /api/ is never cached, ever. Herd counts, an owner's
 * balance and a withdrawal date are wrong the moment they are stale, and a
 * stale withdrawal date is the one that gets an animal sold when it should not
 * be. A person seeing an error knows to try again; a person seeing yesterday's
 * number does not.
 */

const VERSION = 'brandbook-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

const OFFLINE_URL = '/offline.html'

const PRECACHE = [OFFLINE_URL, '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(PRECACHE))
      // A missing icon must not stop the worker installing.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Same origin only. A cross-origin request is somebody else's to answer.
  if (url.origin !== self.location.origin) return

  // Never the API. See the note at the top — this is the whole safety story.
  if (url.pathname.startsWith('/api/')) return

  // Navigations: try the network, fall back to a page that says why it is
  // empty rather than to the browser's own error.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(r => r ?? new Response('Offline', { status: 503 })),
      ),
    )
    return
  }

  // Build output is content-hashed, so a hit is always the right file and a
  // cached one can be trusted indefinitely.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(hit =>
        hit ?? fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(ASSETS).then(c => c.put(request, copy))
          }
          return response
        }),
      ),
    )
    return
  }

  // Everything else static: network first, cache as a backstop.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(ASSETS).then(c => c.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then(hit => hit ?? Response.error())),
  )
})
