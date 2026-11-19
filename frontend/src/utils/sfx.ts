// sfx.ts — Студийный WebAudio-движок продуктового уровня (в стиле Duolingo / Kahoot / Apple UI).
// Тёплый динамический low-pass фильтр, мягкие ADSR-огибающие, обертоны маримбы/колокольчиков
// и лёгкое пространственное эхо — никаких резких 8-битных писков.

export type Sfx =
  | 'ui.click' | 'ui.win' | 'ui.lose'
  | 'ui.success' | 'ui.error' | 'ui.notify'
  | 'ws.select' | 'ws.found' | 'ws.wrong' | 'ws.hint' | 'ws.win' | 'ws.go'
  | 'mem.flip' | 'mem.match' | 'mem.miss' | 'mem.bonus' | 'mem.win' | 'mem.lose'
  | 'cm.tap' | 'cm.right' | 'cm.wrong' | 'cm.over'
  | 'hm.go' | 'hm.hit' | 'hm.miss' | 'hm.hint' | 'hm.win' | 'hm.lose'
  | 'pairs.flip' | 'pairs.match' | 'pairs.win'
  | 'sprint.key' | 'sprint.space' | 'sprint.miss' | 'sprint.fin' | 'clock'
  | 'fb.plant' | 'fb.pick' | 'fb.big' | 'fb.print' | 'fb.chip' | 'fb.level'
  | 'mb.strike' | 'mb.crit' | 'mb.ko'
  | 'lq.join' | 'lq.tick' | 'lq.reveal' | 'lq.podium'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let dryBus: GainNode | null = null
let wetBus: GainNode | null = null
let muted = false
try { muted = localStorage.getItem('edu-sfx-mute') === '1' } catch {}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const C = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!C) return null
      ctx = new C()
      master = ctx!.createGain()
      master.gain.value = 0.82

      // Мягкий студийный лимитер-компрессор
      const comp = ctx!.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.knee.value = 12
      comp.ratio.value = 4
      comp.attack.value = 0.004
      comp.release.value = 0.18

      // Сухая шина + тёплая пространственная комната (stereo feedback delay + lowpass)
      dryBus = ctx!.createGain()
      dryBus.gain.value = 0.9

      wetBus = ctx!.createGain()
      wetBus.gain.value = 0.16
      const delayL = ctx!.createDelay(0.5)
      delayL.delayTime.value = 0.055
      const delayR = ctx!.createDelay(0.5)
      delayR.delayTime.value = 0.092
      const fb = ctx!.createGain()
      fb.gain.value = 0.24
      const damp = ctx!.createBiquadFilter()
      damp.type = 'lowpass'
      damp.frequency.value = 2400

      wetBus.connect(delayL)
      delayL.connect(delayR)
      delayR.connect(damp)
      damp.connect(fb)
      fb.connect(delayL)
      damp.connect(master)

      dryBus.connect(master)
      master.connect(comp)
      comp.connect(ctx!.destination)
    }
    if (ctx!.state === 'suspended') ctx!.resume().catch(() => {})
    return ctx
  } catch { return null }
}

try {
  if (typeof window !== 'undefined') {
    const once = () => { ac(); window.removeEventListener('pointerdown', once) }
    window.addEventListener('pointerdown', once, { once: true })
  }
} catch {}

export function sfxVolume(v: number) {
  muted = v <= 0
  try { localStorage.setItem('edu-sfx-mute', muted ? '1' : '0') } catch {}
}

export const isSfxMuted = () => muted
export const setSfxMuted = (m: boolean) => {
  muted = m
  try { localStorage.setItem('edu-sfx-mute', m ? '1' : '0') } catch {}
  if (m) stopBgMusic()
}

interface ToneSpec {
  f0: number
  f1?: number
  t?: number
  d: number
  v?: number
  type?: OscillatorType
  lp0?: number       // начальная частота среза фильтра
  lp1?: number       // конечная частота среза фильтра
  attack?: number    // время атаки (с)
  overtone?: number  // относительная громкость 2-й гармоники (маримба/колокольчик)
  reverb?: boolean   // посылать ли в пространственную шину
}

/** Тёплый студийный тон с динамическим фильтром и мягким обертоном. */
function playTone(c: AudioContext, s: ToneSpec, vol: number) {
  const t0 = c.currentTime + (s.t || 0)
  const dur = Math.max(0.025, s.d)
  const v = Math.max(0.001, (s.v ?? 0.35) * vol)
  const atk = s.attack ?? Math.min(0.012, dur * 0.18)

  const o = c.createOscillator()
  // Заменяем резкие square/sawtooth на благородные triangle/sine с фильтрацией
  const rawType = s.type || 'triangle'
  o.type = rawType === 'square' ? 'triangle' : rawType

  o.frequency.setValueAtTime(Math.max(24, s.f0), t0)
  if (s.f1 && s.f1 !== s.f0) {
    o.frequency.exponentialRampToValueAtTime(Math.max(24, s.f1), t0 + dur)
  }

  const flt = c.createBiquadFilter()
  flt.type = 'lowpass'
  const lpStart = s.lp0 ?? Math.min(7500, s.f0 * 4.2)
  const lpEnd = s.lp1 ?? Math.min(3200, s.f0 * 1.9)
  flt.frequency.setValueAtTime(Math.max(120, lpStart), t0)
  flt.frequency.exponentialRampToValueAtTime(Math.max(100, lpEnd), t0 + dur)
  flt.Q.value = 0.85

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(v, t0 + atk)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  o.connect(flt)
  flt.connect(g)
  g.connect(dryBus!)
  if (s.reverb !== false && wetBus) g.connect(wetBus)

  o.start(t0)
  o.stop(t0 + dur + 0.04)

  // Мягкий обертон (октава/квинта) для живого тембра маримбы или колокольчика
  const ov = s.overtone ?? 0.14
  if (ov > 0.01 && s.f0 < 2200) {
    const o2 = c.createOscillator()
    const g2 = c.createGain()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(s.f0 * 2, t0)
    if (s.f1 && s.f1 !== s.f0) {
      o2.frequency.exponentialRampToValueAtTime(Math.max(40, s.f1 * 2), t0 + dur * 0.65)
    }
    g2.gain.setValueAtTime(0.0001, t0)
    g2.gain.linearRampToValueAtTime(v * ov, t0 + atk * 0.8)
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.55)
    o2.connect(flt)
    o2.start(t0)
    o2.stop(t0 + dur * 0.6 + 0.03)
  }
}

let noiseBuf: AudioBuffer | null = null
function playAir(c: AudioContext, t: number, d: number, v: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass', vol = 1) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7
  }
  const t0 = c.currentTime + t
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const fl = c.createBiquadFilter()
  fl.type = type
  fl.frequency.setValueAtTime(Math.max(60, f0), t0)
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + d)
  fl.Q.value = 1.4
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(Math.max(0.001, v * vol * 0.35), t0 + Math.min(0.01, d * 0.25))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
  src.connect(fl)
  fl.connect(g)
  g.connect(dryBus!)
  src.start(t0)
  src.stop(t0 + d + 0.03)
}

export function sfx(name: Sfx, volume = 1, pitchMul = 1) {
  if (muted) return
  const c = ac()
  if (!c || !master) return
  const vol = Math.max(0.05, Math.min(1.25, volume))
  const p = (f: number) => Math.max(35, Math.min(5500, f * pitchMul))
  const T = (s: ToneSpec) => playTone(c, s, vol)
  const A = (t: number, d: number, v: number, f0: number, f1: number, tp: BiquadFilterType = 'bandpass') =>
    playAir(c, t, d, v, f0, f1, tp, vol)

  switch (name) {
    // ── ПРОДУКТОВЫЕ ЗВУКИ ИНТЕРФЕЙСА (Duolingo / Apple iOS стиль) ──
    case 'ui.click':
    case 'fb.chip':
    case 'cm.tap':
    case 'ws.select': {
      // Мягкий тактильный wooden-tap
      T({ f0: p(680), f1: p(340), d: 0.042, v: 0.22, type: 'sine', overtone: 0.08, reverb: false })
      A(0, 0.02, 0.08, 2400, 1200)
      break
    }

    case 'ui.notify':
    case 'lq.join': {
      // Кристальный двухнотный колокольчик (C6 -> G6)
      T({ f0: p(1046.5), d: 0.16, v: 0.22, type: 'sine', overtone: 0.22 })
      T({ f0: p(1567.98), t: 0.075, d: 0.28, v: 0.24, type: 'sine', overtone: 0.18 })
      break
    }

    case 'ui.success':
    case 'cm.right':
    case 'hm.hit':
    case 'fb.pick':
    case 'mem.match':
    case 'pairs.match': {
      // Фирменный сочный мажорный аккорд успеха (C5 -> E5 -> G5 -> C6)
      T({ f0: p(523.25), t: 0, d: 0.22, v: 0.26, type: 'triangle', overtone: 0.2 })
      T({ f0: p(659.25), t: 0.055, d: 0.24, v: 0.28, type: 'triangle', overtone: 0.2 })
      T({ f0: p(783.99), t: 0.11, d: 0.3, v: 0.3, type: 'triangle', overtone: 0.22 })
      T({ f0: p(1046.5), t: 0.165, d: 0.42, v: 0.32, type: 'sine', overtone: 0.15 })
      break
    }

    case 'ui.error':
    case 'cm.wrong':
    case 'ws.wrong':
    case 'hm.miss':
    case 'mem.miss':
    case 'sprint.miss': {
      // Мягкий бархатный деревянный «тук-тук» вниз (без режущего писка!)
      T({ f0: p(311.13), f1: p(277.18), t: 0, d: 0.14, v: 0.3, type: 'triangle', lp0: 950, lp1: 420, overtone: 0.05 })
      T({ f0: p(233.08), f1: p(196.0), t: 0.11, d: 0.24, v: 0.32, type: 'triangle', lp0: 820, lp1: 320, overtone: 0.04 })
      break
    }

    case 'ui.win':
    case 'fb.level':
    case 'ws.win':
    case 'mem.win':
    case 'hm.win':
    case 'pairs.win':
    case 'sprint.fin':
    case 'lq.podium': {
      // Торжественная фанфара победы (C5 - E5 - G5 - B5 - C6 + тёплый бас)
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]
      notes.forEach((f, i) => {
        T({ f0: p(f), t: i * 0.085, d: 0.46, v: 0.28, type: 'triangle', overtone: 0.24 })
      })
      // Тёплый аккорд в финале
      T({ f0: p(261.63), t: 0.34, d: 0.85, v: 0.22, type: 'triangle', lp0: 1200, lp1: 600 })
      T({ f0: p(523.25), t: 0.34, d: 0.85, v: 0.2, type: 'sine' })
      T({ f0: p(1567.98), t: 0.36, d: 0.75, v: 0.16, type: 'sine' })
      break
    }

    case 'ui.lose':
    case 'mem.lose':
    case 'hm.lose':
    case 'cm.over': {
      // Мягкий кинематографичный минорный спад (A4 -> G4 -> F4 -> E4)
      ;[440, 392, 349.23, 329.63].forEach((f, i) => {
        T({ f0: p(f), t: i * 0.14, d: 0.34, v: 0.26, type: 'triangle', lp0: 1400, lp1: 500 })
      })
      break
    }

    // ── ИГРОВЫЕ СПЕЦ-ЭФФЕКТЫ ──
    case 'ws.found':
    case 'mem.bonus': {
      ;[587.33, 739.99, 880, 1174.66].forEach((f, i) =>
        T({ f0: p(f), t: i * 0.055, d: 0.3, v: 0.27, type: 'sine', overtone: 0.22 })
      )
      break
    }

    case 'ws.hint':
    case 'hm.hint': {
      // Волшебный перелив арфы
      ;[659.25, 880, 1174.66, 1318.5].forEach((f, i) =>
        T({ f0: p(f), t: i * 0.05, d: 0.28, v: 0.2, type: 'sine', overtone: 0.25 })
      )
      break
    }

    case 'ws.go':
    case 'hm.go': {
      ;[440, 554.37, 659.25, 880].forEach((f, i) =>
        T({ f0: p(f), t: i * 0.065, d: 0.28, v: 0.26, type: 'triangle' })
      )
      break
    }

    case 'mem.flip':
    case 'pairs.flip': {
      A(0, 0.07, 0.16, 600, 1800)
      T({ f0: p(420), f1: p(680), t: 0.01, d: 0.065, v: 0.18, type: 'sine', reverb: false })
      break
    }

    case 'sprint.key': {
      // Благородный звук механической клавиатуры (Topre / Holy Panda thock)
      T({ f0: p(320), f1: p(140), d: 0.028, v: 0.18, type: 'sine', overtone: 0, reverb: false })
      A(0, 0.018, 0.12, 2200, 1100)
      break
    }

    case 'sprint.space': {
      T({ f0: p(523.25), d: 0.09, v: 0.2, type: 'triangle' })
      T({ f0: p(783.99), t: 0.035, d: 0.14, v: 0.22, type: 'sine' })
      break
    }

    case 'clock':
    case 'lq.tick': {
      // Мягкий деревянный метроном Kahoot
      T({ f0: p(880), f1: p(520), d: 0.045, v: 0.22, type: 'sine', overtone: 0.12, reverb: false })
      break
    }

    case 'fb.plant': {
      // Мягкий звук посадки / капли воды
      T({ f0: p(360), f1: p(580), t: 0, d: 0.11, v: 0.26, type: 'sine' })
      T({ f0: p(720), f1: p(980), t: 0.05, d: 0.12, v: 0.2, type: 'sine' })
      break
    }

    case 'fb.big':
    case 'mb.strike': {
      // Энергетический удар в Математическом бою и комбо в Фермере!
      A(0, 0.12, 0.25, 1800, 420)
      T({ f0: p(220), f1: p(85), t: 0, d: 0.18, v: 0.38, type: 'triangle', lp0: 1200, lp1: 280 })
      T({ f0: p(587.33), t: 0.02, d: 0.18, v: 0.26, type: 'triangle', overtone: 0.2 })
      T({ f0: p(880), t: 0.07, d: 0.24, v: 0.28, type: 'sine', overtone: 0.22 })
      break
    }

    case 'mb.crit': {
      // Мощный КРИТ-УДАР (молния + аккорд!)
      A(0, 0.16, 0.35, 3200, 350)
      T({ f0: p(180), f1: p(65), t: 0, d: 0.24, v: 0.45, type: 'triangle', lp0: 1400, lp1: 240 })
      ;[587.33, 880, 1174.66, 1760].forEach((f, i) =>
        T({ f0: p(f), t: i * 0.035, d: 0.28, v: 0.28, type: 'triangle', overtone: 0.25 })
      )
      break
    }

    case 'mb.ko':
    case 'lq.reveal': {
      // Драматичный гонг / раскрытие ответа
      T({ f0: p(196), f1: p(130.81), t: 0, d: 0.45, v: 0.36, type: 'triangle', lp0: 900, lp1: 300 })
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        T({ f0: p(f), t: 0.08 + i * 0.06, d: 0.45, v: 0.26, type: 'sine', overtone: 0.2 })
      )
      break
    }

    case 'fb.print': {
      T({ f0: p(783.99), d: 0.09, v: 0.22, type: 'sine' })
      T({ f0: p(1174.66), t: 0.05, d: 0.14, v: 0.2, type: 'sine' })
      break
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ФОНЫ ДЛЯ LIVE-КВИЗА (КАХУТ) И МАТЕМАТИЧЕСКОГО БОЯ (процедурный маримба-грув)
   ═══════════════════════════════════════════════════════════════════════ */
let bgTimer: number | null = null
let bgStep = 0

export function startBgMusic(style: 'lobby' | 'battle' = 'lobby') {
  stopBgMusic()
  if (muted) return
  const c = ac()
  if (!c) return
  bgStep = 0
  // Тёплая пентатоника маримбы в духе Kahoot!
  const lobbyNotes = [261.63, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 329.63]
  const battleNotes = [220.0, 261.63, 329.63, 392.0, 329.63, 293.66, 261.63, 196.0]
  const notes = style === 'battle' ? battleNotes : lobbyNotes
  const stepMs = style === 'battle' ? 210 : 260

  bgTimer = window.setInterval(() => {
    if (muted) { stopBgMusic(); return }
    const cNow = ac()
    if (!cNow || !dryBus) return
    const freq = notes[bgStep % notes.length]
    playTone(cNow, {
      f0: freq,
      d: 0.2,
      v: bgStep % 4 === 0 ? 0.12 : 0.075,
      type: 'sine',
      overtone: 0.15,
      lp0: 1400,
      lp1: 600,
    }, 1)
    if (bgStep % 4 === 0) {
      playTone(cNow, { f0: freq * 0.5, d: 0.24, v: 0.09, type: 'triangle', lp0: 500, lp1: 220, overtone: 0 }, 1)
    }
    bgStep++
  }, stepMs)
}

export function stopBgMusic() {
  if (bgTimer !== null) {
    window.clearInterval(bgTimer)
    bgTimer = null
  }
}

export function isBgMusicPlaying() {
  return bgTimer !== null
}

export type { Sfx as SfxName }
