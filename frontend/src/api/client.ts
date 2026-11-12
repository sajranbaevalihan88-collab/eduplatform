import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// База для WebSocket: из того же API-хоста (на проде фронт и бэк на разных
// доменах — брать window.location.host нельзя, сокет улетит не туда).
// http://x -> ws://x, https://x -> wss://x
export const WS_BASE = API.replace(/^http/, 'ws')
export const API_BASE = API

// Enforce https in production
if (API.startsWith('http://') && window.location.protocol === 'https:') {
  console.warn('API URL использует http при https — замени на https')
}

const client = axios.create({
  baseURL: `${API}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// singleflight для refresh: параллельные 401 ждут один запрос
let _refreshPromise: Promise<any> | null = null
function doRefresh(api: string, refresh: string) {
  if (!_refreshPromise) {
    _refreshPromise = axios.post(`${api}/api/auth/jwt/refresh/`, { refresh }).finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}
async function refreshPromiseGuard() {
  if (_refreshPromise) {
    try {
      await _refreshPromise
    } catch {
      // игнор — вызывающий сам попробует refresh
    }
  }
}

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access') || localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

function cacheKeyFor(cfg: any): string | null {
  if (!cfg || (cfg.method && cfg.method.toLowerCase() !== 'get')) return null
  if (cfg.responseType === 'blob') return null
  const u = String(cfg.url || '')
  const p = cfg.params ? JSON.stringify(cfg.params) : ''
  return `offline_cache:${u}:${p}`
}

client.interceptors.response.use(
  res => {
    try {
      const k = cacheKeyFor(res.config)
      if (k && res.data !== undefined) {
        const raw = JSON.stringify(res.data)
        if (raw.length < 120000) localStorage.setItem(k, raw)
      }
    } catch {}
    return res
  },
  async err => {
    const original = err.config as any
    // Работа при слабом интернете / офлайн: если сеть недоступна на GET-запросе, отдаём кеш из памяти браузера
    if (!err.response && original) {
      try {
        const k = cacheKeyFor(original)
        if (k) {
          const cached = localStorage.getItem(k)
          if (cached) {
            return {
              data: JSON.parse(cached),
              status: 200,
              statusText: 'OK (offline cache)',
              headers: {},
              config: original,
            }
          }
        }
      } catch {}
    }
    const status = err.response?.status
    const detail = err.response?.data?.detail || err.response?.data?.code || ''
    // Если токен ссылается на несуществующего пользователя (после пересоздания БД) — сразу логаут
    const isUserNotFound = typeof detail === 'string' && (detail.includes('User not found') || detail.includes('No active account') || detail.includes('not found'))
    if (status === 401 && isUserNotFound) {
      localStorage.removeItem('access'); localStorage.removeItem('refresh'); localStorage.removeItem('token'); localStorage.removeItem('user')
      window.dispatchEvent(new Event('auth-change'))
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
    if (status === 401 && !original._retry) {
      original._retry = true
      // singleflight: параллельные 401 ждут один refresh
      try {
        await refreshPromiseGuard()
      } catch {
        // refresh уже упал — разлогиниваем ниже
      }
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const r = await doRefresh(API, refresh)
          localStorage.setItem('access', r.data.access)
          if (r.data.refresh) localStorage.setItem('refresh', r.data.refresh)
          // token для совместимости
          localStorage.setItem('token', r.data.access)
          original.headers.Authorization = `Bearer ${r.data.access}`
          return client(original)
        } catch (e) {
          console.error('JWT refresh failed', e)
        }
      }
      // refresh не сработал — сессия истекла, разлогиниваем
      const isAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register')
      if (!isAuthPage && original.url && !String(original.url).includes('/auth/jwt/refresh')) {
        localStorage.removeItem('access'); localStorage.removeItem('refresh'); localStorage.removeItem('token')
        // не трогаем user сразу — пусть PrivateRoute редиректнет
      }
    }
    return Promise.reject(err)
  }
)

export default client
export const mediaUrl = (path?: string) => {
  if (!path) return ''
  // Абсолютный http/https — уже готов (бэк на проде отдаёт https://your-api.onrender.com/media/...)
  // Для деплоя не режем по origin — Render/S3/Supabase могут быть на другом домене
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // блокируем только протокол-относительный и javascript:
    if (path.startsWith('javascript:')) return ''
    return path
  }
  if (path.startsWith('//')) return '' // block protocol-relative
  if (path.startsWith('javascript:') || path.startsWith('data:text/html')) return ''
  // Относительный /media/... — клеим к API origin (важно для прод: VITE_API_URL=https://api.yourdomain.com)
  if (path.startsWith('/')) return `${API}${path}`
  return `${API}/${path}`
}
// То же, но для показа ВНУТРИ СТРАНИЦЫ (iframe/img): в dev файл на localhost-бэкенде
// берём относительно текущего origin — vite проксирует /media на бэкенд. Chrome иногда
// отказывает iframe'ам в прямом коннекте к localhost:8001, а same-origin запрос идёт
// всегда (страница же открыта). В проде URL на другой домен — возвращаем как есть.
export const mediaSrc = (path?: string) => {
  const u = mediaUrl(path)
  if (!u) return ''
  try {
    const parsed = new URL(u, window.location.origin)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.pathname + parsed.search
    }
  } catch {}
  return u
}
