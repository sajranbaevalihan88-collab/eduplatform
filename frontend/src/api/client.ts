import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// Enforce https in production
if (API.startsWith('http://') && window.location.protocol === 'https:') {
  console.warn('API URL использует http при https — замени на https')
}

const client = axios.create({
  baseURL: `${API}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

client.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access') || localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
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
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const r = await axios.post(`${API}/api/auth/jwt/refresh/`, {refresh})
          localStorage.setItem('access', r.data.access)
          if (r.data.refresh) localStorage.setItem('refresh', r.data.refresh)
          // token для совместимости
          localStorage.setItem('token', r.data.access)
          original.headers.Authorization = `Bearer ${r.data.access}`
          return client(original)
        } catch {}
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
