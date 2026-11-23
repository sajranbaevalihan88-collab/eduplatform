import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

// Автоматический энергосберегающий режим для очень слабых ноутбуков/телефонов
// (<=2 ядер CPU, <=2 ГБ ОЗУ или включённая экономия трафика): убирает лишний GPU-блюр и фоновые циклы.
try {
  const nav: any = navigator
  const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
  const saveData = Boolean(nav.connection?.saveData)
  if (lowCpu || lowMem || saveData) {
    document.documentElement.classList.add('low-power')
  }
} catch {}

// Полноценная регистрация PWA Service Worker (деплой-безопасная: Network-First для HTML,
// Cache-First для хэшированных ассетов, офлайн-кэш GET-ответов уроков/тестов и авто-обновление).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Если уже ждёт новая версия SW — уведомляем UI
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('pwa-update-ready', { detail: reg.waiting }))
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('pwa-update-ready', { detail: installing }))
            }
          })
        })
        // Периодическая проверка обновлений раз в час
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
