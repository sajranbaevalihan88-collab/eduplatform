/* EduPlatform PWA Service Worker v3
 * - Deploy-safe: Network-First for HTML navigation so new deploys load immediately.
 * - Dev-safe: ignores Vite HMR / @vite / /src/ requests so dev mode never breaks.
 * - Real offline: caches hashed static bundles, icons, fonts, and safe GET API reads
 *   (lessons, subjects, presentations, tests, code-tasks, classrooms, programs).
 * - Privacy-safe: clears API cache on logout via postMessage({ type: 'CLEAR_API_CACHE' }).
 */

const CACHE_VERSION = 'edu-v6'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const ASSET_CACHE = `${CACHE_VERSION}-assets`
const API_CACHE = `${CACHE_VERSION}-api`
const VALID_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, API_CACHE])

const PRECACHE_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>EduPlatform — Офлайн</title>
<style>
  body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#0f172a; color:#f8fafc; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { max-width:420px; width:100%; background:#1e293b; border:1px solid #334155; border-radius:20px; padding:28px; text-align:center; }
  h1 { margin:0 0 8px; font-size:20px; }
  p { margin:0 0 20px; color:#94a3b8; font-size:14px; line-height:1.5; }
  button { background:#4f46e5; color:#fff; border:0; border-radius:12px; padding:12px 20px; font-weight:700; font-size:14px; cursor:pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>Нет подключения к интернету</h1>
    <p>Эта страница ещё не сохранена в памяти устройства. Подключитесь к сети или откройте ранее загруженные уроки.</p>
    <button onclick="location.reload()">Попробовать снова</button>
  </div>
</body>
</html>`

// Кэшируем ТОЛЬКО публичные образовательные справочники (никогда /api/auth, /api/classrooms, /api/messages, /api/portfolio!)
const CACHEABLE_API_PREFIXES = [
  '/api/subjects',
  '/api/lessons',
  '/api/presentations',
  '/api/code-tasks',
  '/api/programs',
]

const PRIVATE_MEDIA_PREFIXES = [
  '/media/uploads/',
  '/media/payment_receipts/',
  '/media/achievements/',
]

function isDevAsset(url) {
  const p = url.pathname
  return (
    p.startsWith('/@') ||
    p.startsWith('/__vite') ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('v') ||
    url.searchParams.has('import')
  )
}

function isImmutableStatic(url) {
  const p = url.pathname
  return (
    p.startsWith('/assets/') ||
    p.startsWith('/icons/') ||
    p.startsWith('/fonts/') ||
    p.startsWith('/avatars/') ||
    p.startsWith('/audio/') ||
    p === '/logo.svg' ||
    p === '/favicon.svg' ||
    p === '/manifest.webmanifest'
  )
}

function isCacheableApi(url) {
  return CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

async function fetchWithTimeout(request, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(request, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !VALID_CACHES.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (msg.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).catch(() => {})
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  // Only handle http/https requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Never intercept Vite dev HMR / module transforms
  if (isDevAsset(url)) return

  // 1. Navigation requests (SPA pages): Network-First -> cached App Shell -> offline HTML
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(req, 4500)
          if (fresh && fresh.ok && url.origin === self.location.origin) {
            const cache = await caches.open(SHELL_CACHE)
            cache.put('/', fresh.clone()).catch(() => {})
          }
          return fresh
        } catch {
          const cachedShell =
            (await caches.match(req)) ||
            (await caches.match('/'))
          if (cachedShell) return cachedShell
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      })()
    )
    return
  }

  // 2. Same-origin hashed/static assets: Cache-First (immutable hashed bundles)
  if (url.origin === self.location.origin && isImmutableStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        try {
          const fresh = await fetch(req)
          // Cache only full 200 responses (skip 206 Partial Content from <audio> range requests)
          if (fresh && fresh.status === 200) {
            const cache = await caches.open(ASSET_CACHE)
            cache.put(req, fresh.clone()).catch(() => {})
          }
          return fresh
        } catch {
          return new Response('', { status: 504 })
        }
      })()
    )
    return
  }

  // 3. Safe read-only public API endpoints (never cache authenticated / private / no-store responses!)
  if (isCacheableApi(url)) {
    const hasAuth = req.headers.has('Authorization')
    if (hasAuth) return
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(req, 5000)
          const cc = (fresh.headers.get('Cache-Control') || '').toLowerCase()
          if (fresh && fresh.status === 200 && !cc.includes('no-store') && !cc.includes('private')) {
            const cache = await caches.open(API_CACHE)
            cache.put(req, fresh.clone()).catch(() => {})
          }
          return fresh
        } catch {
          const cached = await caches.match(req)
          if (cached) return cached
          return new Response(JSON.stringify({ detail: 'Офлайн: данные недоступны' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          })
        }
      })()
    )
    return
  }

  // 4. Google Fonts / strictly public media only (NEVER cache private uploads, payment receipts, or achievements!)
  const isPrivateMedia = PRIVATE_MEDIA_PREFIXES.some((p) => url.pathname.startsWith(p))
  if (
    !isPrivateMedia &&
    !req.headers.has('Authorization') &&
    (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com' ||
      url.pathname.startsWith('/media/pptx_images/'))
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE)
        const cached = await cache.match(req)
        const networkPromise = fetch(req)
          .then((fresh) => {
            const cc = (fresh.headers.get('Cache-Control') || '').toLowerCase()
            if (fresh && (fresh.status === 200 || fresh.type === 'opaque') && !cc.includes('no-store') && !cc.includes('private')) {
              cache.put(req, fresh.clone()).catch(() => {})
            }
            return fresh
          })
          .catch(() => null)
        return cached || (await networkPromise) || new Response('', { status: 504 })
      })()
    )
  }
})
