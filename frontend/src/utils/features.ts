import { getRole } from './role'

// ИИ-помощник включён ТОЛЬКО для учителей и администрации.
export const AI_FEATURES = true

export function isTeacherAIAllowed(): boolean {
  const r = getRole()
  return r === 'teacher' || r === 'admin'
}
