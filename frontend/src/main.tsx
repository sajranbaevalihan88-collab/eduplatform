import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

// PWA убран: снимаем старый сервис-воркер и чистим его кэш, чтобы браузер
// больше не предлагал «Установить приложение» и не отдавал устаревший офлайн-кэш.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .then(() => ('caches' in window)
        ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        : undefined)
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
