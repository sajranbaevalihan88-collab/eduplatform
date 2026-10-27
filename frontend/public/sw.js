// Kill-switch вместо прежнего PWA-сервис-воркера: браузер сам обновляет sw.js,
// этот скрипт снимает регистрацию и удаляет старые офлайн-кэши («edu-v2» и др.).
// Новые регистрации не выполняются — index.html больше не вызывает register().
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {}
      try {
        await self.registration.unregister()
      } catch {}
      try {
        await self.clients.claim()
      } catch {}
    })()
  )
})
