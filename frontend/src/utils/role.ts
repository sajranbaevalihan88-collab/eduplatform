/** Роль текущего пользователя из localStorage.
 * Ученик: только открывает (уроки/презентации/тесты/игры/код), Word — можно.
 * Учитель/админ: всё + создание. Гость (без входа): как ученик без личного. */

export type Role = 'teacher' | 'student' | 'admin' | null

export function getUser(): any | null {
  try {
    const raw = localStorage.getItem('user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function getRole(): Role {
  const u = getUser()
  const r = u?.role
  if (r === 'student' || r === 'teacher' || r === 'admin') return r
  // админы Django без role в профиле
  if (u && (u.is_staff || u.is_superuser)) return 'admin'
  return null
}

export function isStudent(): boolean {
  return getRole() === 'student'
}

export function isGuest(): boolean {
  try {
    return !(localStorage.getItem('token') || localStorage.getItem('access'))
  } catch { return true }
}

export function canTeach(): boolean {
  const r = getRole()
  return r === 'teacher' || r === 'admin'
}
