// sfx.ts — Продуктовый аудио-движок EduPlatform (CC0 студийные сэмплы + фоновая музыка).
// Лёгкий для слабых ноутбуков: сэмплы подгружаются лениво один раз в память AudioBuffer,
// музыка стримится через один <audio preload="none"> только по запросу пользователя.

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

export type BgMusicStyle = 'arkan' | 'battle' | 'lobby' | 'farm' | 'sprint' | 'arcade' | 'puzzle' | 'strategy'

type SampleKey =
  | 'click' | 'success' | 'save' | 'error' | 'notify' | 'hint'
  | 'win' | 'lose' | 'bonus' | 'go' | 'tick' | 'key' | 'flip'
  | 'hit' | 'crit' | 'plant'

const SFX_MAP: Record<Sfx, { sample: SampleKey; gain?: number; rate?: number }> = {
  // Интерфейс и уведомления
  'ui.click':    { sample: 'click', gain: 0.65 },
  'ui.success':  { sample: 'success', gain: 0.85 },
  'ui.error':    { sample: 'error', gain: 0.8 },
  'ui.notify':   { sample: 'notify', gain: 0.85 },
  'ui.win':      { sample: 'win', gain: 0.9 },
  'ui.lose':     { sample: 'lose', gain: 0.8 },

  // Поиск слов / Виселица / Цвета
  'ws.select':   { sample: 'click', gain: 0.55, rate: 1.08 },
  'ws.found':    { sample: 'bonus', gain: 0.85 },
  'ws.wrong':    { sample: 'error', gain: 0.7 },
  'ws.hint':     { sample: 'hint', gain: 0.8 },
  'ws.win':      { sample: 'win', gain: 0.9 },
  'ws.go':       { sample: 'go', gain: 0.85 },

  'hm.go':       { sample: 'go', gain: 0.85 },
  'hm.hit':      { sample: 'success', gain: 0.8 },
  'hm.miss':     { sample: 'error', gain: 0.75 },
  'hm.hint':     { sample: 'hint', gain: 0.8 },
  'hm.win':      { sample: 'win', gain: 0.9 },
  'hm.lose':     { sample: 'lose', gain: 0.8 },

  'cm.tap':      { sample: 'click', gain: 0.6 },
  'cm.right':    { sample: 'success', gain: 0.85 },
  'cm.wrong':    { sample: 'error', gain: 0.75 },
  'cm.over':     { sample: 'lose', gain: 0.85 },

  // Карточки / Память / Пары
  'mem.flip':    { sample: 'flip', gain: 0.8 },
  'mem.match':   { sample: 'success', gain: 0.85 },
  'mem.miss':    { sample: 'error', gain: 0.65 },
  'mem.bonus':   { sample: 'bonus', gain: 0.9 },
  'mem.win':     { sample: 'win', gain: 0.9 },
  'mem.lose':    { sample: 'lose', gain: 0.8 },
  'pairs.flip':  { sample: 'flip', gain: 0.8 },
  'pairs.match': { sample: 'success', gain: 0.85 },
  'pairs.win':   { sample: 'win', gain: 0.9 },

  // Спринт печати и таймер
  'sprint.key':   { sample: 'key', gain: 0.5 },
  'sprint.space': { sample: 'bonus', gain: 0.55, rate: 1.15 },
  'sprint.miss':  { sample: 'error', gain: 0.55 },
  'sprint.fin':   { sample: 'win', gain: 0.9 },
  'clock':        { sample: 'tick', gain: 0.75 },

  // Фермер Бала
  'fb.plant':    { sample: 'plant', gain: 0.8 },
  'fb.pick':     { sample: 'success', gain: 0.8 },
  'fb.big':      { sample: 'hit', gain: 0.85 },
  'fb.print':    { sample: 'save', gain: 0.75 },
  'fb.chip':     { sample: 'click', gain: 0.6 },
  'fb.level':    { sample: 'win', gain: 0.9 },

  // Математический бой и Live-квиз (Кахут)
  'mb.strike':   { sample: 'hit', gain: 0.9 },
  'mb.crit':     { sample: 'crit', gain: 0.95 },
  'mb.ko':       { sample: 'crit', gain: 0.95, rate: 0.9 },
  'lq.join':     { sample: 'notify', gain: 0.8 },
  'lq.tick':     { sample: 'tick', gain: 0.8 },
  'lq.reveal':   { sample: 'bonus', gain: 0.9 },
  'lq.podium':   { sample: 'win', gain: 0.95 },
}

const MUSIC_URLS: Record<BgMusicStyle, string> = {
  arkan:    '/audio/music/arkan.mp3',
  battle:   '/audio/music/battle.mp3',
  lobby:    '/audio/music/lobby.mp3',
  farm:     '/audio/music/farm.mp3',
  sprint:   '/audio/music/sprint.mp3',
  arcade:   '/audio/music/arcade.mp3',
  puzzle:   '/audio/music/puzzle.mp3',
  strategy: '/audio/music/strategy.mp3',
}

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
const bufferCache = new Map<SampleKey, AudioBuffer>()
const pendingLoads = new Map<SampleKey, Promise<AudioBuffer | null>>()

let muted = false
let musicVolume = 0.24
try {
  muted = localStorage.getItem('edu-sfx-mute') === '1'
  const savedVol = parseFloat(localStorage.getItem('edu-music-vol') || '')
  if (!Number.isNaN(savedVol)) musicVolume = Math.max(0.05, Math.min(0.8, savedVol))
} catch {}

function emitAudioState() {
  try { window.dispatchEvent(new Event('audio-state-change')) } catch {}
}

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const C = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!C) return null
      ctx = new C()
      masterGain = ctx!.createGain()
      masterGain.gain.value = 0.85
      masterGain.connect(ctx!.destination)
    }
    if (ctx!.state === 'suspended') ctx!.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

async function loadSample(key: SampleKey, c: AudioContext): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(key)
  if (cached) return cached
  const inflight = pendingLoads.get(key)
  if (inflight) return inflight

  const p = fetch(`/audio/sfx/${key}.mp3`)
    .then(r => {
      if (!r.ok) throw new Error('audio fetch failed')
      return r.arrayBuffer()
    })
    .then(buf => c.decodeAudioData(buf))
    .then(decoded => {
      bufferCache.set(key, decoded)
      pendingLoads.delete(key)
      return decoded
    })
    .catch(() => {
      pendingLoads.delete(key)
      return null
    })

  pendingLoads.set(key, p)
  return p
}

function playFallbackTone(c: AudioContext, sample: SampleKey, vol: number) {
  if (!masterGain) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  const freq = sample === 'error' || sample === 'lose' ? 280 : sample === 'win' || sample === 'bonus' ? 784 : 587
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(Math.max(0.01, vol * 0.22), t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
  osc.connect(g)
  g.connect(masterGain)
  osc.start(t0)
  osc.stop(t0 + 0.18)
}

function triggerBuffer(c: AudioContext, buf: AudioBuffer, vol: number, rate: number) {
  if (!masterGain) return
  const src = c.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = Math.max(0.65, Math.min(1.6, rate))
  const g = c.createGain()
  g.gain.value = Math.max(0.02, Math.min(1.2, vol))
  src.connect(g)
  g.connect(masterGain)
  src.start()
}

export function sfx(name: Sfx, volume = 1, pitchMul = 1) {
  if (muted) return
  const c = getCtx()
  if (!c) return
  const spec = SFX_MAP[name] || { sample: 'click' as SampleKey }
  const vol = Math.max(0.05, Math.min(1.2, volume * (spec.gain ?? 0.85)))
  const rate = (spec.rate ?? 1) * pitchMul

  const cached = bufferCache.get(spec.sample)
  if (cached) {
    triggerBuffer(c, cached, vol, rate)
    return
  }

  // Первый вызов подгружает лёгкий MP3 (3-15 КБ) и сразу проигрывает его
  loadSample(spec.sample, c).then(buf => {
    if (muted) return
    if (buf) triggerBuffer(c, buf, vol, rate)
    else playFallbackTone(c, spec.sample, vol)
  })
}

export function sfxVolume(v: number) {
  muted = v <= 0
  try { localStorage.setItem('edu-sfx-mute', muted ? '1' : '0') } catch {}
  if (muted) stopBgMusic()
  emitAudioState()
}

export const isSfxMuted = () => muted
export const setSfxMuted = (m: boolean) => {
  muted = m
  try { localStorage.setItem('edu-sfx-mute', m ? '1' : '0') } catch {}
  if (m) stopBgMusic()
  emitAudioState()
}

/* ═══════════════════════════════════════════════════════════════════════
   ФОНОВАЯ МУЗЫКА (студийные CC0-треки: Учёба / Викторина / Бой)
   Один лёгкий HTMLAudioElement с плавным fade-in и нулевой нагрузкой на CPU.
   ═══════════════════════════════════════════════════════════════════════ */
let bgAudio: HTMLAudioElement | null = null
let bgStyle: BgMusicStyle | null = null
let fadeTimer: number | null = null

function clearFade() {
  if (fadeTimer !== null) {
    window.clearInterval(fadeTimer)
    fadeTimer = null
  }
}

export function startBgMusic(style: BgMusicStyle = 'lobby') {
  if (muted) return
  if (bgAudio && bgStyle === style && !bgAudio.paused) return

  stopBgMusic(false)
  try {
    const audio = new Audio(MUSIC_URLS[style])
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.01
    bgAudio = audio
    bgStyle = style

    audio.play().then(() => {
      if (bgAudio !== audio) return
      clearFade()
      const target = musicVolume
      const step = Math.max(0.01, target / 12)
      fadeTimer = window.setInterval(() => {
        if (!bgAudio || bgAudio !== audio) { clearFade(); return }
        if (audio.volume + step >= target) {
          audio.volume = target
          clearFade()
        } else {
          audio.volume = Math.min(target, audio.volume + step)
        }
      }, 40)
    }).catch(() => {
      if (bgAudio === audio) {
        bgAudio = null
        bgStyle = null
        emitAudioState()
      }
    })
    emitAudioState()
  } catch {
    bgAudio = null
    bgStyle = null
  }
}

export function stopBgMusic(notify = true) {
  clearFade()
  if (bgAudio) {
    try {
      bgAudio.pause()
      bgAudio.currentTime = 0
      bgAudio.src = ''
    } catch {}
    bgAudio = null
  }
  bgStyle = null
  if (notify) emitAudioState()
}

export function isBgMusicPlaying() {
  return bgAudio !== null && bgStyle !== null && !bgAudio.paused
}

export function getBgMusicStyle(): BgMusicStyle | null {
  return isBgMusicPlaying() ? bgStyle : null
}

export function getBgMusicVolume() {
  return musicVolume
}

export function setBgMusicVolume(v: number) {
  musicVolume = Math.max(0.05, Math.min(0.8, v))
  try { localStorage.setItem('edu-music-vol', String(musicVolume)) } catch {}
  if (bgAudio && !bgAudio.paused) {
    bgAudio.volume = musicVolume
  }
  emitAudioState()
}

export type { Sfx as SfxName }
