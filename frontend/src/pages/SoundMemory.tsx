import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { sfx, isSfxMuted } from '../utils/sfx'
import { useLang } from '../context/LangContext'
import { Volume2, Play, RotateCcw, Trophy, Headphones, Music, Grid, Disc, Sparkles } from 'lucide-react'

type Mode = 'simon4' | 'grid9' | 'ear' | 'melody' | 'jam'
type Timbre = 'marimba' | 'piano' | 'bells' | 'synth'
type Speed = 'slow' | 'normal' | 'fast'
type Phase = 'idle' | 'listen' | 'input' | 'over' | 'melody_win'

type PadMeta = {
  id: number
  note: string
  solfege: string
  freq: number
  color: string
  activeCls: string
  borderCls: string
  keyHint: string
}

const PADS_4: PadMeta[] = [
  {
    id: 0, note: 'C4', solfege: 'ДО', freq: 261.63, keyHint: '1',
    color: 'from-emerald-500 to-teal-600',
    activeCls: 'ring-4 ring-emerald-300 brightness-125 scale-[1.04] shadow-[0_0_35px_rgba(16,185,129,0.85)]',
    borderCls: 'border-emerald-400/50',
  },
  {
    id: 1, note: 'E4', solfege: 'МИ', freq: 329.63, keyHint: '2',
    color: 'from-rose-500 to-red-600',
    activeCls: 'ring-4 ring-rose-300 brightness-125 scale-[1.04] shadow-[0_0_35px_rgba(244,63,94,0.85)]',
    borderCls: 'border-rose-400/50',
  },
  {
    id: 2, note: 'G4', solfege: 'СОЛЬ', freq: 392.00, keyHint: '3',
    color: 'from-amber-400 to-orange-500',
    activeCls: 'ring-4 ring-amber-200 brightness-125 scale-[1.04] shadow-[0_0_35px_rgba(245,158,11,0.85)]',
    borderCls: 'border-amber-300/60',
  },
  {
    id: 3, note: 'C5', solfege: 'ДО²', freq: 523.25, keyHint: '4',
    color: 'from-blue-500 to-indigo-600',
    activeCls: 'ring-4 ring-sky-300 brightness-125 scale-[1.04] shadow-[0_0_35px_rgba(59,130,246,0.85)]',
    borderCls: 'border-blue-400/50',
  },
]

const PADS_9: PadMeta[] = [
  {
    id: 0, note: 'C4', solfege: 'ДО', freq: 261.63, keyHint: '1',
    color: 'from-rose-500 to-red-600',
    activeCls: 'ring-4 ring-rose-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(244,63,94,0.85)]',
    borderCls: 'border-rose-400/50',
  },
  {
    id: 1, note: 'D4', solfege: 'РЕ', freq: 293.66, keyHint: '2',
    color: 'from-orange-500 to-amber-600',
    activeCls: 'ring-4 ring-orange-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(249,115,22,0.85)]',
    borderCls: 'border-orange-400/50',
  },
  {
    id: 2, note: 'E4', solfege: 'МИ', freq: 329.63, keyHint: '3',
    color: 'from-amber-400 to-yellow-500',
    activeCls: 'ring-4 ring-yellow-200 brightness-125 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.85)]',
    borderCls: 'border-amber-300/60',
  },
  {
    id: 3, note: 'F4', solfege: 'ФА', freq: 349.23, keyHint: '4',
    color: 'from-emerald-500 to-green-600',
    activeCls: 'ring-4 ring-emerald-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.85)]',
    borderCls: 'border-emerald-400/50',
  },
  {
    id: 4, note: 'G4', solfege: 'СОЛЬ', freq: 392.00, keyHint: '5',
    color: 'from-teal-500 to-cyan-600',
    activeCls: 'ring-4 ring-cyan-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(6,182,212,0.85)]',
    borderCls: 'border-teal-400/50',
  },
  {
    id: 5, note: 'A4', solfege: 'ЛЯ', freq: 440.00, keyHint: '6',
    color: 'from-sky-500 to-blue-600',
    activeCls: 'ring-4 ring-sky-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(59,130,246,0.85)]',
    borderCls: 'border-sky-400/50',
  },
  {
    id: 6, note: 'B4', solfege: 'СИ', freq: 493.88, keyHint: '7',
    color: 'from-indigo-500 to-violet-600',
    activeCls: 'ring-4 ring-indigo-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(99,102,241,0.85)]',
    borderCls: 'border-indigo-400/50',
  },
  {
    id: 7, note: 'C5', solfege: 'ДО²', freq: 523.25, keyHint: '8',
    color: 'from-purple-500 to-fuchsia-600',
    activeCls: 'ring-4 ring-fuchsia-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(192,38,211,0.85)]',
    borderCls: 'border-purple-400/50',
  },
  {
    id: 8, note: 'D5', solfege: 'РЕ²', freq: 587.33, keyHint: '9',
    color: 'from-pink-500 to-rose-600',
    activeCls: 'ring-4 ring-pink-300 brightness-125 scale-105 shadow-[0_0_30px_rgba(236,72,153,0.85)]',
    borderCls: 'border-pink-400/50',
  },
]

// Известные мелодии на 9-пэдовой клавиатуре (индексы 0..8 = ДО..РЕ²)
const FAMOUS_MELODIES = [
  {
    id: 'karajorgo',
    title: '🏔️ Кыргыз көчү (Кара Жорго)',
    desc: 'Народный ритмический мотив Ала-Тоо на пентатонике',
    notes: [0, 2, 4, 5, 4, 2, 0, 4, 4, 5, 7, 5, 4, 2, 0],
  },
  {
    id: 'ode',
    title: '🎼 Ода к радости (Л. Бетховен)',
    desc: 'Знаменитая классическая тема симфонии №9',
    notes: [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1],
  },
  {
    id: 'star',
    title: '✨ Мерцай, звёздочка (Twinkle Star)',
    desc: 'Классическая мелодия для тренировки музыкального слуха',
    notes: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0],
  },
  {
    id: 'imperial',
    title: '🚀 Космический марш',
    desc: 'Эпическая тема для проверки ритма и интервалов',
    notes: [2, 2, 2, 0, 4, 2, 0, 4, 2, 6, 6, 6, 7, 4, 2],
  },
]

// Студийный синтезатор музыкальных нот с поддержкой 4 тембров
let audioCtx: AudioContext | null = null
function playStudioPadNote(freq: number, timbre: Timbre, duration = 0.42) {
  if (isSfxMuted()) return
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const ctx = audioCtx
    const now = ctx.currentTime

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'

    if (timbre === 'marimba') {
      // Деревянный тёплый тембр маримбы/комуза
      filter.frequency.setValueAtTime(freq * 4.8, now)
      filter.frequency.exponentialRampToValueAtTime(freq * 1.3, now + duration)
      master.gain.linearRampToValueAtTime(0.32, now + 0.008)
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      const osc1 = ctx.createOscillator()
      osc1.type = 'triangle'
      osc1.frequency.setValueAtTime(freq, now)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(freq * 4, now) // деревянный обертон 2 октавы выше
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0.11, now)
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

      osc1.connect(filter)
      osc2.connect(g2)
      g2.connect(filter)
      osc1.start(now); osc1.stop(now + duration + 0.04)
      osc2.start(now); osc2.stop(now + 0.1)
    } else if (timbre === 'piano') {
      // Кристальное акустическое пианино (Rhodes)
      filter.frequency.setValueAtTime(freq * 6, now)
      filter.frequency.exponentialRampToValueAtTime(freq * 1.6, now + duration * 1.25)
      master.gain.linearRampToValueAtTime(0.28, now + 0.01)
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.3)

      const osc1 = ctx.createOscillator()
      osc1.type = 'triangle'
      osc1.frequency.setValueAtTime(freq, now)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(freq * 2, now)
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0.14, now)

      const osc3 = ctx.createOscillator()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(freq * 3, now)
      const g3 = ctx.createGain()
      g3.gain.setValueAtTime(0.05, now)

      osc1.connect(filter)
      osc2.connect(g2); g2.connect(filter)
      osc3.connect(g3); g3.connect(filter)
      osc1.start(now); osc1.stop(now + duration * 1.35)
      osc2.start(now); osc2.stop(now + duration * 1.1)
      osc3.start(now); osc3.stop(now + duration * 0.7)
    } else if (timbre === 'bells') {
      // Стеклянные колокольчики / челеста
      filter.frequency.setValueAtTime(7500, now)
      master.gain.linearRampToValueAtTime(0.25, now + 0.005)
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.45)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, now)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(freq * 2.756, now) // колокольный обертон
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0.09, now)
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

      osc1.connect(filter)
      osc2.connect(g2); g2.connect(filter)
      osc1.start(now); osc1.stop(now + duration * 1.5)
      osc2.start(now); osc2.stop(now + 0.18)
    } else {
      // Мягкий аналоговый синтвейв-лид
      filter.frequency.setValueAtTime(freq * 5.2, now)
      filter.frequency.exponentialRampToValueAtTime(freq * 1.8, now + duration)
      filter.Q.setValueAtTime(2.4, now)
      master.gain.linearRampToValueAtTime(0.22, now + 0.015)
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration * 1.15)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(freq, now)

      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 1.004, now) // лёгкий detune для объёма хоруса

      osc1.connect(filter)
      osc2.connect(filter)
      osc1.start(now); osc1.stop(now + duration * 1.2)
      osc2.start(now); osc2.stop(now + duration * 1.2)
    }

    filter.connect(master)
    master.connect(ctx.destination)
  } catch { }
}

export default function SoundMemory() {
  const { t } = useLang()
  const [mode, setMode] = useState<Mode>('simon4')
  const [timbre, setTimbre] = useState<Timbre>('marimba')
  const [speed, setSpeed] = useState<Speed>('normal')
  const [phase, setPhase] = useState<Phase>('idle')
  const [seq, setSeq] = useState<number[]>([])
  const [userIdx, setUserIdx] = useState(0)
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [replaysLeft, setReplaysLeft] = useState(2)
  const [activePad, setActivePad] = useState<number | null>(null)
  const [activeFreq, setActiveFreq] = useState<number | null>(null)
  const [wrongPad, setWrongPad] = useState<number | null>(null)
  const [melodyId, setMelodyId] = useState(FAMOUS_MELODIES[0].id)
  const [jamHistory, setJamHistory] = useState<string[]>([])
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem('edu-soundmem-best') || 0))

  const timersRef = useRef<number[]>([])
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  const pads = mode === 'simon4' ? PADS_4 : PADS_9
  const stepMs = speed === 'fast' ? 390 : speed === 'slow' ? 680 : 520

  const saveBestScore = (lv: number) => {
    setBest(prev => {
      const next = Math.max(prev, lv)
      try { localStorage.setItem('edu-soundmem-best', String(next)) } catch { }
      return next
    })
  }

  // Проигрывание последовательности нот
  const playSequence = useCallback((sequence: number[], currentPads: PadMeta[], currentMode: Mode, currentTimbre: Timbre) => {
    clearAllTimers()
    setPhase('listen')
    setActivePad(null)
    setWrongPad(null)

    sequence.forEach((padIdx, i) => {
      const startDelay = 420 + i * stepMs
      const t1 = window.setTimeout(() => {
        const p = currentPads[padIdx] || currentPads[0]
        playStudioPadNote(p.freq, currentTimbre, stepMs * 0.00078)
        setActiveFreq(p.freq)
        // В режиме «Слепой слух» (ear) пэды НЕ подсвечиваются при проигрывании — только эквалайзер!
        if (currentMode !== 'ear') {
          setActivePad(padIdx)
        }
      }, startDelay)

      const t2 = window.setTimeout(() => {
        setActivePad(null)
        setActiveFreq(null)
      }, startDelay + stepMs * 0.72)

      timersRef.current.push(t1, t2)
    })

    const finishDelay = 460 + sequence.length * stepMs
    const tEnd = window.setTimeout(() => {
      setActivePad(null)
      setActiveFreq(null)
      setUserIdx(0)
      setPhase('input')
    }, finishDelay)
    timersRef.current.push(tEnd)
  }, [clearAllTimers, stepMs])

  const startGame = (targetMode: Mode = mode) => {
    clearAllTimers()
    if (targetMode === 'jam') {
      setPhase('input')
      setJamHistory([])
      return
    }
    const currentPads = targetMode === 'simon4' ? PADS_4 : PADS_9
    setLives(3)
    setReplaysLeft(2)
    setScore(0)
    setLevel(1)

    if (targetMode === 'melody') {
      const mel = FAMOUS_MELODIES.find(m => m.id === melodyId) || FAMOUS_MELODIES[0]
      const firstChunk = mel.notes.slice(0, 3)
      setSeq(firstChunk)
      playSequence(firstChunk, currentPads, targetMode, timbre)
    } else {
      const firstNote = Math.floor(Math.random() * currentPads.length)
      const initialSeq = [firstNote]
      setSeq(initialSeq)
      playSequence(initialSeq, currentPads, targetMode, timbre)
    }
  }

  const replayCurrentSequence = () => {
    if (phase !== 'input' || replaysLeft <= 0 || !seq.length) return
    setReplaysLeft(r => r - 1)
    playSequence(seq, pads, mode, timbre)
  }

  const onPadPress = (padIdx: number) => {
    const p = pads[padIdx]
    if (!p) return

    // Свободный режим пианино/маримбы
    if (mode === 'jam' || phase === 'idle') {
      playStudioPadNote(p.freq, timbre, 0.45)
      setActivePad(padIdx)
      setActiveFreq(p.freq)
      if (mode === 'jam') {
        setJamHistory(h => [...h.slice(-15), `${p.solfege} (${p.note})`])
      }
      setTimeout(() => {
        setActivePad(prev => (prev === padIdx ? null : prev))
        setActiveFreq(null)
      }, 260)
      return
    }

    if (phase !== 'input') return

    const expected = seq[userIdx]
    if (padIdx === expected) {
      playStudioPadNote(p.freq, timbre, 0.38)
      setActivePad(padIdx)
      setActiveFreq(p.freq)
      setTimeout(() => {
        setActivePad(prev => (prev === padIdx ? null : prev))
        setActiveFreq(null)
      }, 220)

      const nextUserIdx = userIdx + 1
      setUserIdx(nextUserIdx)
      setScore(s => s + 25 * level)

      // Уровень успешно повторён!
      if (nextUserIdx >= seq.length) {
        const nextLv = level + 1
        saveBestScore(level)
        setPhase('listen')

        if (mode === 'melody') {
          const mel = FAMOUS_MELODIES.find(m => m.id === melodyId) || FAMOUS_MELODIES[0]
          if (seq.length >= mel.notes.length) {
            setTimeout(() => {
              sfx('lq.podium')
              setPhase('melody_win')
            }, 420)
            return
          }
          const nextChunkLen = Math.min(mel.notes.length, seq.length + 2)
          const nextSeq = mel.notes.slice(0, nextChunkLen)
          setLevel(nextLv)
          setSeq(nextSeq)
          const tNext = window.setTimeout(() => {
            playSequence(nextSeq, pads, mode, timbre)
          }, 680)
          timersRef.current.push(tNext)
        } else {
          const nextNote = Math.floor(Math.random() * pads.length)
          const nextSeq = [...seq, nextNote]
          setLevel(nextLv)
          setSeq(nextSeq)
          const tNext = window.setTimeout(() => {
            playSequence(nextSeq, pads, mode, timbre)
          }, 680)
          timersRef.current.push(tNext)
        }
      }
    } else {
      // Ошибка!
      sfx('cm.wrong')
      setWrongPad(padIdx)
      const remLives = lives - 1
      setLives(remLives)
      if (remLives <= 0) {
        saveBestScore(level)
        setTimeout(() => {
          sfx('hm.lose')
          setPhase('over')
        }, 480)
      } else {
        // Повторяем текущую последовательность после ошибки
        const tRetry = window.setTimeout(() => {
          playSequence(seq, pads, mode, timbre)
        }, 900)
        timersRef.current.push(tRetry)
      }
    }
  }

  // Клавиатурное управление (1..9)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= pads.length) {
        onPadPress(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, timbre, seq, userIdx, lives, pads])

  return (
    <div className="max-w-4xl mx-auto space-y-5" data-testid="sound-memory-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          ← {t('games')}
        </Link>
        {best > 0 && (
          <div className="px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-extrabold flex items-center gap-1.5">
            <Trophy size={14} /> Рекорд: уровень {best}
          </div>
        )}
      </div>

      {/* Шапка со студийным эквалайзером */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white p-5 sm:p-6 border border-indigo-500/30 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 shadow-lg">
                <Music size={22} />
              </span>
              Звуковая память Studio
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1">
              Слушай живые музыкальные ноты, запоминай мелодию и повторяй в такт (клавиши 1–{pads.length} или клик)
            </p>
          </div>

          {/* 16-полосный живой спектроанализатор */}
          <div className="flex items-end gap-1 h-12 px-3 py-2 rounded-2xl bg-slate-950/70 border border-white/10">
            {Array.from({ length: 16 }, (_, i) => {
              const active = activeFreq !== null
              const center = activeFreq ? Math.min(15, Math.max(0, Math.round(((activeFreq - 240) / 360) * 15))) : 7
              const dist = Math.abs(i - center)
              const hPct = active ? Math.max(20, 100 - dist * 16) : 18 + ((i * 7) % 16)
              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${active ? 'bg-gradient-to-t from-emerald-400 via-amber-300 to-rose-400' : 'bg-indigo-500/40'
                    }`}
                  style={{ height: `${hPct}%` }}
                />
              )
            })}
          </div>
        </div>

        {/* Выбор режима игры */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'simon4', icon: <Disc size={15} />, label: 'Саймон 4 пэда', sub: 'Классика До-Ми-Соль-До' },
            { id: 'grid9', icon: <Grid size={15} />, label: 'Маримба 3×3', sub: '9 нот полной октавы' },
            { id: 'ear', icon: <Headphones size={15} />, label: 'Слепой слух', sub: 'Без подсветки — по слуху!' },
            { id: 'melody', icon: <Sparkles size={15} />, label: 'Сыграй мелодию', sub: 'Кара Жорго, Бетховен…' },
            { id: 'jam', icon: <Volume2 size={15} />, label: 'Свободный Джем', sub: 'Играй сам как на пианино' },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { clearAllTimers(); setMode(m.id as Mode); setPhase(m.id === 'jam' ? 'input' : 'idle'); sfx('ui.click') }}
              className={`p-2.5 rounded-2xl border text-left transition ${mode === m.id
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg font-black'
                  : 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                }`}
            >
              <div className="text-xs font-extrabold flex items-center gap-1.5">{m.icon} {m.label}</div>
              <div className={`text-[10px] mt-0.5 ${mode === m.id ? 'text-slate-800 font-semibold' : 'text-indigo-200'}`}>{m.sub}</div>
            </button>
          ))}
        </div>

        {/* Выбор инструмента (тембра) и скорости */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-indigo-300 font-bold mr-1">Инструмент:</span>
            {([
              ['marimba', '🪵 Маримба / Комуз'],
              ['piano', '🎹 Пианино'],
              ['bells', '🔔 Колокольчики'],
              ['synth', '🚀 Синтвейв'],
            ] as Array<[Timbre, string]>).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setTimbre(k); playStudioPadNote(392, k, 0.35) }}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${timbre === k ? 'bg-indigo-500 text-white shadow' : 'bg-white/10 text-indigo-200 hover:bg-white/20'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-indigo-300 font-bold">Темп:</span>
            {([
              ['slow', 'Спокойно'],
              ['normal', 'Бодро'],
              ['fast', 'Турбо'],
            ] as Array<[Speed, string]>).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSpeed(k)}
                className={`px-2.5 py-1 rounded-lg font-bold ${speed === k ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-indigo-200'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Если выбран режим «Сыграй мелодию» — выбор произведения */}
        {mode === 'melody' && (
          <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-white/10">
            {FAMOUS_MELODIES.map(mel => (
              <button
                key={mel.id}
                type="button"
                onClick={() => { setMelodyId(mel.id); setPhase('idle'); sfx('ui.click') }}
                className={`p-3 rounded-2xl border text-left transition ${melodyId === mel.id ? 'bg-indigo-600/80 border-amber-300 text-white' : 'bg-slate-900/60 border-white/10 text-indigo-200'
                  }`}
              >
                <div className="font-bold text-sm">{mel.title} ({mel.notes.length} нот)</div>
                <div className="text-xs opacity-80">{mel.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Панель статуса раунда */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 font-bold text-sm dark:text-white">
          <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            Уровень: {level} ({seq.length || 1} нот)
          </span>
          <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-mono">
            ⭐ {score} очк.
          </span>
          {mode !== 'jam' && (
            <span className="text-base" aria-label={`Жизней: ${lives}`}>
              {'❤️'.repeat(Math.max(0, lives))}{'🖤'.repeat(Math.max(0, 3 - lives))}
            </span>
          )}
        </div>

        {/* Статус-подсказка в центре */}
        <div className="font-extrabold text-sm">
          {phase === 'idle' && <span className="text-slate-500">Нажми «Начать игру» или потрогай пэды для проверки звука</span>}
          {phase === 'listen' && (
            <span className="px-3.5 py-1.5 rounded-full bg-amber-400 text-slate-950 animate-pulse">
              👂 Слушай внимательно мелодию… ({seq.length} нот)
            </span>
          )}
          {phase === 'input' && mode !== 'jam' && (
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-500 text-white">
              🎹 Твой ход! Повтори ноты: {userIdx} / {seq.length}
            </span>
          )}
          {mode === 'jam' && (
            <span className="text-indigo-600 dark:text-indigo-400">
              🎶 Свободная игра: играй любую мелодию мышкой или клавишами 1–9
            </span>
          )}
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center gap-2">
          {phase === 'input' && mode !== 'jam' && (
            <button
              type="button"
              onClick={replayCurrentSequence}
              disabled={replaysLeft <= 0}
              className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-bold disabled:opacity-40"
            >
              🔄 Послушать ещё раз (×{replaysLeft})
            </button>
          )}
          {mode !== 'jam' && (
            <button
              type="button"
              onClick={() => startGame(mode)}
              data-testid="sm-start-btn"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-1.5 shadow"
            >
              {phase === 'idle' ? <><Play size={16} /> Начать игру</> : <><RotateCcw size={15} /> Заново</>}
            </button>
          )}
        </div>
      </div>

      {/* Сетка музыкальных пэдов (2x2 для Саймона или 3x3 для Маримбы) */}
      <div
        className={`grid gap-3.5 sm:gap-4 mx-auto ${mode === 'simon4' ? 'grid-cols-2 max-w-lg' : 'grid-cols-3 max-w-xl'
          }`}
      >
        {pads.map((pad, idx) => {
          const isLit = activePad === idx
          const isErr = wrongPad === idx
          return (
            <button
              key={pad.id}
              type="button"
              onClick={() => onPadPress(idx)}
              data-testid={`sm-pad-${idx}`}
              className={`relative min-h-[115px] sm:min-h-[135px] rounded-3xl bg-gradient-to-br ${pad.color} border-2 ${pad.borderCls} text-white p-4 flex flex-col items-center justify-center gap-1 select-none transition-all duration-150 active:scale-95 shadow-xl ${isLit ? pad.activeCls : 'opacity-90 hover:opacity-100'
                } ${isErr ? 'ring-4 ring-rose-500 animate-shake' : ''}`}
            >
              <span className="absolute top-2.5 left-3 px-2 py-0.5 rounded-lg bg-black/25 text-[11px] font-mono font-bold">
                [{pad.keyHint}]
              </span>
              <span className="absolute top-2.5 right-3 text-xs font-mono opacity-80">
                {pad.note}
              </span>
              <span className="font-display font-black text-2xl sm:text-3xl tracking-wide drop-shadow">
                {pad.solfege}
              </span>
              <span className="text-[11px] font-semibold opacity-80">
                {Math.round(pad.freq)} Гц
              </span>
            </button>
          )
        })}
      </div>

      {/* Лента сыгранных нот в режиме Джем */}
      {mode === 'jam' && jamHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1">Сыгранные ноты:</span>
          {jamHistory.map((n, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Финал победы в режиме мелодии */}
      {phase === 'melody_win' && (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 text-center space-y-3 shadow-2xl">
          <div className="text-5xl">🏆🎼</div>
          <h2 className="font-display font-black text-2xl">Браво! Мелодия сыграна целиком!</h2>
          <p className="text-sm text-emerald-100">
            Ты безошибочно исполнил всю композицию ({seq.length} нот) и набрал <b>{score}</b> очков!
          </p>
          <button
            type="button"
            onClick={() => startGame(mode)}
            className="px-6 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black inline-flex items-center gap-2"
          >
            <RotateCcw size={18} /> Сыграть ещё раз
          </button>
        </div>
      )}

      {/* Экран завершения игры */}
      {phase === 'over' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 text-center space-y-3 shadow-xl">
          <div className="text-5xl">🎧</div>
          <h2 className="font-display font-black text-2xl dark:text-white">Игра окончена!</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Достигнут <b>уровень {level}</b> ({seq.length} нот подряд) · Счёт: <b>{score}</b> очков
          </p>
          <button
            type="button"
            onClick={() => startGame(mode)}
            className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold inline-flex items-center gap-2"
          >
            <RotateCcw size={17} /> Попробовать снова
          </button>
        </div>
      )}
    </div>
  )
}
