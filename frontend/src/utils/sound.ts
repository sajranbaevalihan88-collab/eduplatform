// Звуки игр и уведомлений: сначала пробуем MP3 из /sounds, иначе — встроенный WebAudio-синт.
// MP3 лежат в frontend/public/sounds/*.mp3 (генерируются локально, см. gen_sounds.py).
export type GameSound = 'correct' | 'wrong' | 'win' | 'tick' | 'go'
export type NotifySound = 'notify' | 'standard' | 'wave' | 'alarm'

const cache = new Map<string, HTMLAudioElement>()

function mp3(name: string, volume = 0.8): boolean {
  try {
    let el = cache.get(name)
    if (!el) {
      el = new Audio(`/sounds/${name}.mp3`)
      el.preload = 'auto'
      cache.set(name, el)
    }
    el.volume = Math.max(0.01, Math.min(1, volume))
    el.currentTime = 0
    const p = el.play()
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => synthFallback(name, volume))
    return true
  } catch {
    return false
  }
}

// Прогрев кэша после первого клика (браузеры режут autoplay до жеста)
try {
  const warm = () => {
    ;['correct', 'wrong', 'win', 'tick', 'go', 'type', 'notify', 'arkan-correct', 'arkan-wrong', 'arkan-win', 'arkan-tick', 'arkan-go'].forEach(n => {
      try {
        const el = new Audio(`/sounds/${n}.mp3`)
        el.preload = 'auto'
        el.volume = 0
        cache.set(n, el)
      } catch {}
    })
    window.removeEventListener('pointerdown', warm)
  }
  if (typeof window !== 'undefined') window.addEventListener('pointerdown', warm, { once: true })
} catch {}

function tone(freq: number, start: number, dur: number, vol: number, ctx: AudioContext, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = type
  o.frequency.value = freq
  const t = ctx.currentTime + start
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t); o.stop(t + dur + 0.05)
}

function synthFallback(name: string, volume = 0.8) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const vol = Math.max(0.01, Math.min(1, volume)) * 0.25
    if (name === 'correct') { tone(660, 0, 0.15, vol, ctx); tone(880, 0.15, 0.3, vol, ctx) }
    else if (name === 'wrong') { tone(220, 0, 0.35, vol, ctx, 'sawtooth') }
    else if (name === 'win') { tone(523, 0, 0.2, vol, ctx); tone(659, 0.2, 0.2, vol, ctx); tone(784, 0.4, 0.2, vol, ctx); tone(1047, 0.6, 0.5, vol, ctx) }
    else if (name === 'tick') { tone(990, 0, 0.08, vol * 0.7, ctx) }
    else if (name === 'go') { tone(784, 0, 0.15, vol, ctx); tone(1047, 0.15, 0.3, vol, ctx) }
    else if (name === 'standard') { tone(880, 0, 0.9, vol, ctx) }
    else if (name === 'wave') { tone(660, 0, 0.35, vol, ctx); tone(880, 0.4, 0.35, vol, ctx); tone(1100, 0.8, 0.5, vol, ctx) }
    else if (name === 'alarm') { for (let i = 0; i < 3; i++) tone(990, i * 0.5, 0.3, vol, ctx) }
    else if (name === 'notify') { tone(880, 0, 0.5, vol, ctx) }
    setTimeout(() => { try { ctx.close() } catch {} }, 2500)
  } catch {}
}

export function playGameSound(name: GameSound, volume = 0.8) {
  if (!mp3(name, volume)) synthFallback(name, volume)
}

export type ArkanSound = 'correct' | 'wrong' | 'win' | 'tick' | 'go'

// Свои звуки Аркан тартыш: комуз + барабан (arkan-*.mp3).
// Нет файла — тихо падаем на общие игровые звуки.
export function playArkanSound(name: ArkanSound, volume = 0.85) {
  try {
    let el = cache.get('arkan-' + name)
    if (!el) {
      el = new Audio(`/sounds/arkan-${name}.mp3`)
      el.preload = 'auto'
      cache.set('arkan-' + name, el)
    }
    el.volume = Math.max(0.01, Math.min(1, volume))
    el.currentTime = 0
    const p = el.play()
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => playGameSound(name as GameSound, volume))
    return
  } catch {
    playGameSound(name as GameSound, volume)
  }
}

export function playNotifySound(name: NotifySound = 'notify', volume = 0.9) {
  if (!mp3(name, volume)) synthFallback(name, volume)
}

// Клик клавиши для спринта печати — тихий и троттлится вызывающей стороной
let lastType = 0
export function playTypeSound(volume = 0.35) {
  const now = Date.now()
  if (now - lastType < 55) return
  lastType = now
  if (!mp3('type', volume)) synthFallback('tick', volume * 0.5)
}
