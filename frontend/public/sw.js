const CACHE = 'edu-v1'
const CORE = ['/', '/index.html', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const u = new URL(req.url)
  // API и всё постороннее — мимо кэша
  if (u.origin !== location.origin) return
  if (u.pathname.startsWith('/api/')) return

  // Переходы по страницам: сеть с фолбэком на закэшированный shell (черновик офлайна)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', cp)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html').then((m) => m || caches.match('/')))
    )
    return
  }

  // Статика (assets/icons/logo): сперва кэш, затем сеть с сохранением в кэш
  e.respondWith(
    caches.match(req).then(
      (m) =>
        m ||
        fetch(req).then((res) => {
          if (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/icons/') || u.pathname.startsWith('/logo')) {
            const cp = res.clone()
            caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {})
          }
          return res
        })
    )
  )
})
