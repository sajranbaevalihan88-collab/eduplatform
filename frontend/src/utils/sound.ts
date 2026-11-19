// sound.ts — Единый продуктовый аудио-слой сайта (тосты, уведомления, Аркан тартыш, тесты).
// Маршрутизируется через студийный WebAudio-движок sfx.ts (тёплая маримба, фильтр и реверб
// вместо старых резких mp3-писков).

import { sfx, isSfxMuted } from './sfx'

export type GameSound = 'correct' | 'wrong' | 'win' | 'tick' | 'go'
export type NotifySound = 'notify' | 'standard' | 'wave' | 'alarm'
export type ArkanSound = 'correct' | 'wrong' | 'win' | 'tick' | 'go'
export type UiSound = 'ui-success' | 'ui-error' | 'ui-notify' | 'ui-win' | 'ui-save' | 'ui-pop'

export function playGameSound(name: GameSound, volume = 0.85) {
  if (isSfxMuted()) return
  if (name === 'correct') sfx('ui.success', volume)
  else if (name === 'wrong') sfx('ui.error', volume)
  else if (name === 'win') sfx('ui.win', volume)
  else if (name === 'tick') sfx('clock', volume * 0.75)
  else if (name === 'go') sfx('ws.go', volume)
}

export function playArkanSound(name: ArkanSound, volume = 0.9) {
  if (isSfxMuted()) return
  if (name === 'correct') sfx('mb.strike', volume)
  else if (name === 'wrong') sfx('ui.error', volume)
  else if (name === 'win') sfx('ui.win', volume)
  else if (name === 'tick') sfx('clock', volume * 0.75)
  else if (name === 'go') sfx('ws.go', volume)
}

export function playNotifySound(name: NotifySound = 'notify', volume = 0.85) {
  if (isSfxMuted()) return
  if (name === 'alarm') sfx('mb.crit', volume * 0.8)
  else if (name === 'wave') sfx('ws.hint', volume)
  else sfx('ui.notify', volume)
}

export function playUiSound(name: UiSound, volume = 0.8) {
  if (isSfxMuted()) return
  if (name === 'ui-success') sfx('ui.success', volume)
  else if (name === 'ui-error') sfx('ui.error', volume)
  else if (name === 'ui-notify') sfx('ui.notify', volume)
  else if (name === 'ui-win') sfx('ui.win', volume)
  else if (name === 'ui-save') sfx('fb.print', volume * 0.75)
  else if (name === 'ui-pop') sfx('ui.click', volume)
}

let lastType = 0
export function playTypeSound(volume = 0.45) {
  if (isSfxMuted()) return
  const now = Date.now()
  if (now - lastType < 45) return
  lastType = now
  sfx('sprint.key', volume)
}
