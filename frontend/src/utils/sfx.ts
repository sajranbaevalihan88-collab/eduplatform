// sfx.ts — сочный WebAudio-синт для игр, свой дизайн у каждой игры.
// Без файлов — чистый синтез: корректно офлайн, нулевой вес, мгновенный отклик.
//см. палитру ниже: ws.* wordsearch, mem.* память, cm.* цвет, hm.* виселица,
// pairs.*, sprint.*, fb.* фермер. Общие аркан-звуки живут в sound.ts (mp3-стек).

export type Sfx =
  | 'ui.click' | 'ui.win' | 'ui.lose'
  | 'ws.select' | 'ws.found' | 'ws.wrong' | 'ws.hint' | 'ws.win' | 'ws.go'
  | 'mem.flip' | 'mem.match' | 'mem.miss' | 'mem.bonus' | 'mem.win' | 'mem.lose'
  | 'cm.tap' | 'cm.right' | 'cm.wrong' | 'cm.over'
  | 'hm.go' | 'hm.hit' | 'hm.miss' | 'hm.hint' | 'hm.win' | 'hm.lose'
  | 'pairs.flip' | 'pairs.match' | 'pairs.win'
  | 'sprint.key' | 'sprint.space' | 'sprint.miss' | 'sprint.fin' | 'clock'
  | 'fb.plant' | 'fb.pick' | 'fb.big' | 'fb.print' | 'fb.chip' | 'fb.level'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
try { muted = localStorage.getItem('edu-sfx-mute') === '1' } catch {}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const C = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!C) return null
      ctx = new C()
      master = ctx!.createGain()
      master.gain.value = 0.85
      const comp = ctx!.createDynamicsCompressor()
      comp.threshold.value = -18; comp.ratio.value = 6
      master.connect(comp); comp.connect(ctx!.destination)
    }
    if (ctx!.state === 'suspended') ctx!.resume().catch(() => {})
    return ctx
  } catch { return null }
}

// разблокировка первого жеста — как в sound.ts
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

interface Note { f0: number; f1?: number; t?: number; d: number; v?: number; type?: OscillatorType }
interface Ns { t: number; d: number; v: number; f0: number; f1: number; type?: BiquadFilterType }

function osc(c: AudioContext, n: Note, vol: number) {
  const t0 = (c.currentTime as number) + (n.t || 0)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = n.type || 'sine'
  const v = (n.v === undefined ? 0.5 : n.v) * vol
  o.frequency.setValueAtTime(n.f0, t0)
  if (n.f1 && n.f1 !== n.f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, n.f1), t0 + n.d)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, v), t0 + Math.min(0.02, n.d * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d)
  o.connect(g); g.connect(master!)
  o.start(t0); o.stop(t0 + n.d + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function noise(c: AudioContext, n: Ns, vol: number) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t0 = (c.currentTime as number) + n.t
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const fl = c.createBiquadFilter()
  fl.type = n.type || 'bandpass'
  fl.frequency.setValueAtTime(n.f0, t0)
  if (n.f1 !== n.f0) fl.frequency.exponentialRampToValueAtTime(Math.max(30, n.f1), t0 + n.d)
  fl.Q.value = 1.1
  const g = c.createGain()
  g.gain.setValueAtTime(Math.max(0.001, n.v * vol * 0.5), t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d)
  src.connect(fl); fl.connect(g); g.connect(master!)
  src.start(t0); src.stop(t0 + n.d + 0.05)
}

const A = Math.pow(2, 1 / 12) // полутона

export function sfx(name: Sfx, volume = 1, pitchMul = 1) {
  if (muted) return
  const c = ac()
  if (!c || !master) return
  const vol = Math.max(0.05, Math.min(1.4, volume))
  const p = (f: number) => Math.max(30, Math.min(6000, f * pitchMul))
  const O = (n: Note) => osc(c, n, vol)
  const N = (n: Ns) => noise(c, n, vol)

  switch (name) {
    // — общий UI —
    case 'ui.click': O({ f0: 1300, f1: 900, d: 0.06, v: 0.35, type: 'triangle' }); N({ t: 0, d: 0.03, v: 0.15, f0: 3000, f1: 1500 }); break
    case 'ui.win': {
      const m = [523, 659, 784, 1046]
      m.forEach((f, i) => O({ f0: p(f), t: i * 0.09, d: 0.42, v: 0.4, type: 'triangle' }))
      O({ f0: p(1318), t: 0.4, d: 0.9, v: 0.22 }); break
    }
    case 'ui.lose': {
      ;[392, 330, 262].forEach((f, i) => O({ f0: p(f), t: i * 0.16, d: 0.38, v: 0.4, type: 'sawtooth' }))
      N({ t: 0.4, d: 0.4, v: 0.2, f0: 400, f1: 120, type: 'lowpass' }); break
    }
    // — Найди слово: дерево-ксилофон + шиммер —
    case 'ws.select': O({ f0: 1750, f1: 1350, d: 0.05, v: 0.3, type: 'triangle' }); N({ t: 0, d: 0.03, v: 0.12, f0: 4200, f1: 2200 }); break
    case 'ws.found': {
      ;[660, 830, 1046, 1318].forEach((f, i) => O({ f0: p(f), t: i * 0.05, d: 0.26, v: 0.34, type: 'sine' }))
      O({ f0: p(2637), t: 0.18, d: 0.3, v: 0.1 })
      N({ t: 0.02, d: 0.22, v: 0.06, f0: 5200, f1: 2600, type: 'highpass' }); break
    }
    case 'ws.wrong': O({ f0: 180, f1: 90, d: 0.2, v: 0.5, type: 'sawtooth' }); N({ t: 0, d: 0.14, v: 0.28, f0: 300, f1: 120, type: 'lowpass' }); break
    case 'ws.hint': {
      ;[2093, 2637, 3136].forEach((f, i) => O({ f0: p(f), t: i * 0.06, d: 0.2, v: 0.2 }))
      N({ t: 0, d: 0.3, v: 0.08, f0: 4000, f1: 7000, type: 'highpass' }); break
    }
    case 'ws.win': case 'ws.go': {
      ;[523, 659, 880, 1046].forEach((f, i) => O({ f0: p(f), t: i * 0.08, d: 0.33, v: 0.36, type: 'triangle' }))
      O({ f0: p(1046), t: 0.32, d: 0.7, v: 0.2, type: 'sine' }); break
    }
    // — Память: flip-вжух, стеклянный колокольчик, монетка —
    case 'mem.flip': N({ t: 0, d: 0.12, v: 0.3, f0: 350, f1: 1400, type: 'bandpass' }); O({ f0: 320, f1: 640, t: 0.02, d: 0.09, v: 0.16, type: 'triangle' }); break
    case 'mem.match': {
      O({ f0: p(1318), t: 0, d: 0.34, v: 0.32 })
      O({ f0: p(1975), t: 0.05, d: 0.3, v: 0.2 })
      N({ t: 0, d: 0.2, v: 0.05, f0: 6000, f1: 3000, type: 'highpass' }); break
    }
    case 'mem.miss': O({ f0: 150, d: 0.09, v: 0.4, type: 'square' }); O({ f0: 118, t: 0.09, d: 0.12, v: 0.34, type: 'square' }); break
    case 'mem.bonus': O({ f0: p(1568), d: 0.07, v: 0.3, type: 'square' }); O({ f0: p(2093), t: 0.07, d: 0.16, v: 0.26, type: 'square' }); break
    case 'mem.win': {
      ;[1046, 1318, 1568, 2093].forEach((f, i) => O({ f0: p(f), t: i * 0.07, d: 0.3, v: 0.3, type: 'triangle' }))
      O({ f0: p(2637), t: 0.3, d: 0.6, v: 0.16 }); break
    }
    case 'mem.lose': {
      ;[330, 294, 233, 196].forEach((f, i) => O({ f0: p(f), t: i * 0.13, d: 0.32, v: 0.36, type: 'sawtooth' }))
      N({ t: 0.45, d: 0.35, v: 0.18, f0: 500, f1: 100, type: 'lowpass' }); break
    }
    // — Цвет и внимание: щелчки, поп, низкий буз —
    case 'cm.tap': O({ f0: 900, f1: 700, d: 0.045, v: 0.4, type: 'square' }); break
    case 'cm.right': {
      O({ f0: p(880), f1: p(1660), t: 0, d: 0.1, v: 0.35, type: 'triangle' })
      N({ t: 0, d: 0.06, v: 0.2, f0: 2600, f1: 5000, type: 'highpass' })
      O({ f0: p(2217), t: 0.08, d: 0.14, v: 0.16 }); break
    }
    case 'cm.wrong': O({ f0: 210, f1: 130, d: 0.22, v: 0.5, type: 'sawtooth' }); N({ t: 0, d: 0.12, v: 0.2, f0: 500, f1: 200, type: 'lowpass' }); break
    case 'cm.over': {
      ;[220, 220, 165].forEach((f, i) => O({ f0: p(f), t: i * 0.28, d: 0.24, v: 0.42, type: 'square' }))
      O({ f0: p(110), t: 0.84, d: 0.7, v: 0.4, type: 'sawtooth' }); break
    }
    // — Виселица: маримба / тромбон / труба —
    case 'hm.go': {
      ;[392, 523, 659].forEach((f, i) => O({ f0: p(f), t: i * 0.07, d: 0.2, v: 0.34, type: 'sawtooth' }))
      O({ f0: p(784), t: 0.21, d: 0.35, v: 0.2, type: 'sawtooth' }); break
    }
    case 'hm.hit': {
      O({ f0: p(988), f1: p(740), t: 0, d: 0.12, v: 0.4, type: 'triangle' })
      O({ f0: p(1480), t: 0.02, d: 0.1, v: 0.12, type: 'sine' }); break
    }
    case 'hm.miss': {
      O({ f0: 140, f1: 80, d: 0.24, v: 0.5, type: 'sawtooth' })
      N({ t: 0.03, d: 0.22, v: 0.3, f0: 900, f1: 300, type: 'bandpass' })
      O({ f0: 96, t: 0.2, d: 0.16, v: 0.34, type: 'square' }); break
    }
    case 'hm.hint': {
      ;[440, 660, 880, 1174].forEach((f, i) => O({ f0: p(f), t: i * 0.045, d: 0.18, v: 0.24, type: 'sine' }))
      N({ t: 0, d: 0.26, v: 0.06, f0: 5000, f1: 8000, type: 'highpass' }); break
    }
    case 'hm.win': {
      ;[523, 659, 784].forEach((f, i) => O({ f0: p(f), t: i * 0.08, d: 0.5, v: 0.3, type: 'sawtooth' }))
      O({ f0: p(1046), t: 0.24, d: 0.85, v: 0.24, type: 'sawtooth' })
      O({ f0: p(523 * 0.5), t: 0.24, d: 0.85, v: 0.18, type: 'triangle' }); break
    }
    case 'hm.lose': {
      ;[311, 294, 277, 233].forEach((f, i) => O({ f0: p(f), t: i * 0.17, d: 0.4, v: 0.34, type: 'sawtooth' }))
      N({ t: 0.6, d: 0.5, v: 0.16, f0: 260, f1: 80, type: 'lowpass' }); break
    }
    // — Быстрые пары: перелистывание и колокольчики —
    case 'pairs.flip': O({ f0: 520, f1: 990, t: 0, d: 0.07, v: 0.28, type: 'triangle' }); N({ t: 0, d: 0.05, v: 0.14, f0: 2200, f1: 3600 }); break
    case 'pairs.match': {
      O({ f0: p(1174), t: 0, d: 0.25, v: 0.3 })
      O({ f0: p(1568), t: 0.06, d: 0.3, v: 0.22 })
      O({ f0: p(2637), t: 0.1, d: 0.2, v: 0.1 }); break
    }
    case 'pairs.win': {
      ;[880, 1108, 1318, 1760].forEach((f, i) => O({ f0: p(f), t: i * 0.06, d: 0.26, v: 0.28, type: 'triangle' }))
      O({ f0: p(2217), t: 0.26, d: 0.5, v: 0.14 }); break
    }
    // — Спринт печати: мягкая клавиша, финальный аккорд —
    case 'sprint.key': O({ f0: 1500, f1: 1100, d: 0.03, v: 0.24, type: 'triangle' }); N({ t: 0, d: 0.02, v: 0.1, f0: 3800, f1: 2000 }); break
    case 'sprint.space': {
      ;[784, 1046, 1244].forEach((f, i) => O({ f0: p(f), t: i * 0.03, d: 0.14, v: 0.26, type: 'triangle' })); break
    }
    case 'sprint.miss': O({ f0: 160, f1: 110, d: 0.14, v: 0.36, type: 'square' }); N({ t: 0, d: 0.08, v: 0.14, f0: 400, f1: 180, type: 'lowpass' }); break
    case 'sprint.fin': {
      ;[523, 659, 988, 1318].forEach((f, i) => O({ f0: p(f), t: i * 0.06, d: 0.5, v: 0.3, type: 'triangle' }))
      N({ t: 0, d: 0.5, v: 0.14, f0: 600, f1: 5000, type: 'bandpass' })
      O({ f0: p(2637), t: 0.3, d: 0.8, v: 0.14 }); break
    }
    case 'clock': O({ f0: p(1200), d: 0.06, v: 0.3, type: 'square' }); O({ f0: p(800), t: 0.08, d: 0.05, v: 0.2, type: 'square' }); break
    // — Фермер Бала: комуз-ощущение + природа —
    case 'fb.plant': {
      O({ f0: 300, f1: 150, t: 0, d: 0.18, v: 0.4, type: 'sine' })
      O({ f0: 460, f1: 230, t: 0.04, d: 0.16, v: 0.2, type: 'triangle' })
      N({ t: 0, d: 0.12, v: 0.12, f0: 500, f1: 200, type: 'lowpass' }); break
    }
    case 'fb.pick': {
      O({ f0: p(1046), t: 0, d: 0.1, v: 0.3, type: 'triangle' })
      O({ f0: p(1568), t: 0.06, d: 0.12, v: 0.2, type: 'triangle' })
      N({ t: 0.02, d: 0.08, v: 0.1, f0: 4000, f1: 2000 }); break
    }
    case 'fb.big': {
      O({ f0: 200, f1: 95, t: 0, d: 0.3, v: 0.5, type: 'sine' })
      O({ f0: 520, f1: 260, t: 0.05, d: 0.2, v: 0.2, type: 'triangle' })
      N({ t: 0, d: 0.2, v: 0.2, f0: 300, f1: 120, type: 'lowpass' }); break
    }
    case 'fb.print': O({ f0: p(1318), t: 0, d: 0.12, v: 0.3, type: 'square' }); N({ t: 0.02, d: 0.18, v: 0.16, f0: 1200, f1: 500, type: 'bandpass' }); break
    case 'fb.chip': O({ f0: 1400, f1: 1000, t: 0, d: 0.04, v: 0.3, type: 'triangle' }); break
    case 'fb.level': {
      const mel = [587, 698, 880, 1046, 1397]
      mel.forEach((f, i) => O({ f0: p(f), t: i * 0.11, d: 0.4, v: 0.3, type: 'triangle' }))
      O({ f0: p(1749), t: 0.55, d: 0.9, v: 0.15 }); break
    }
  }
}

export type { Sfx as SfxName }
