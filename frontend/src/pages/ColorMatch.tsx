import { useEffect, useRef, useState } from 'react'
import { sfx } from '../utils/sfx'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Phase = 'idle' | 'play' | 'over'
type Mode = 'odd' | 'stroop'

const TIMES = [
  { v: 20, label: '20' },
  { v: 30, label: '30' },
  { v: 60, label: '1' },
  { v: 120, label: '2' },
]

// Струп: цвет слова ≠ цвет чернил — игрок выбирает ЦВЕТ ЧЕРНИЛ
const STROOP_COLORS: { hex: string; ru: string; en: string; kg: string }[] = [
  { hex: '#dc2626', ru: 'КРАСНЫЙ', en: 'RED', kg: 'КЫЗЫЛ' },
  { hex: '#2563eb', ru: 'СИНИЙ', en: 'BLUE', kg: 'КӨК' },
  { hex: '#16a34a', ru: 'ЗЕЛЁНЫЙ', en: 'GREEN', kg: 'ЖАШЫЛ' },
  { hex: '#ca8a04', ru: 'ЖЁЛТЫЙ', en: 'YELLOW', kg: 'САРЫ' },
  { hex: '#ea580c', ru: 'ОРАНЖЕВЫЙ', en: 'ORANGE', kg: 'КЫЗЫЛ САРЫ' },
]

function gridFor(correct: number): number {
  return Math.min(2 + Math.floor(correct / 4), 6)
}

function deltaFor(correct: number): number {
  return Math.max(20 - correct * 1.6, 6)
}

function makeRound(correct: number): { n: number; colors: string[]; odd: number } {
  const n = gridFor(correct)
  const total = n * n
  const hue = Math.floor(Math.random() * 360)
  const sat = 55 + Math.floor(Math.random() * 25)
  const light = 42 + Math.floor(Math.random() * 16)
  const d = deltaFor(correct)
  const other = Math.random() > 0.5 ? light + d : light - d
  const odd = Math.floor(Math.random() * total)
  const colors: string[] = []
  for (let i = 0; i < total; i++) {
    colors.push(i === odd ? `hsl(${hue} ${sat}% ${other}%)` : `hsl(${hue} ${sat}% ${light}%)`)
  }
  return { n, colors, odd }
}

export default function ColorMatch() {
  const { t, lang } = useLang()
  const { speak, speech } = useAccessibility()
  const say = (s: string) => { try { if (speech) speak(s) } catch {} }
  const [phase, setPhase] = useState<Phase>('idle')
  const [mode, setMode] = useState<Mode>('odd')
  const [timePick, setTimePick] = useState(30)
  const [secs, setSecs] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [best, setBest] = useState<string | null>(null)
  const [round, setRound] = useState<{ n: number; colors: string[]; odd: number } | null>(null)
  const [sround, setSround] = useState<{ answers: { hex: string; label: string }[]; ink: string; word: string } | null>(null)
  const [flash, setFlash] = useState('')
  const ivRef = useRef<any>(null)

  useEffect(() => { try { setBest(localStorage.getItem('edu-colormatch-best')) } catch {} }, [])

  useEffect(() => {
    ;(window as any).__cm = { phase, mode, score, streak: maxStreak, secs }
  })

  useEffect(() => {
    if (phase !== 'play') return
    ivRef.current = setInterval(() => setSecs(s => s - 1), 1000)
    return () => clearInterval(ivRef.current)
  }, [phase])

  useEffect(() => {
    if (phase !== 'play' || secs > 0) return
    clearInterval(ivRef.current)
    setPhase('over')
    sfx('cm.over')
    say(`${t('cm_gameover')} ${score}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs])

  const mkStroop = (c: number) => {
    const pool = c < 6 ? STROOP_COLORS.slice(0, 4) : STROOP_COLORS
    const wi = Math.floor(Math.random() * pool.length)
    let ii = Math.floor(Math.random() * pool.length)
    while (ii === wi) ii = Math.floor(Math.random() * pool.length)
    const word = (pool[wi] as any)[lang] || pool[wi].ru
    const ink = pool[ii].hex
    // 3 варианта: верный (цвет чернил) + 2 случайных других
    const others = pool.filter(p => p.hex !== ink).sort(() => Math.random() - 0.5).slice(0, 2)
    const answers = [pool[ii], ...others].sort(() => Math.random() - 0.5) as any[]
    return { answers: answers.map((p: any) => ({ hex: p.hex, label: p[lang] || p.ru })), ink, word }
  }

  const startGame = () => {
    setScore(0); setStreak(0); setMaxStreak(0); setSecs(timePick)
    if (mode === 'odd') setRound(makeRound(0))
    else setSround(mkStroop(0))
    setPhase('play')
    setFlash('')
    sfx('ws.go')
    say(mode === 'odd' ? t('cm_hint') : t('cm_stroop_hint'))
  }

  const endSave = (sc: number) => {
    setBest(prev => {
      const p = prev ? parseInt(prev, 10) : 0
      if (sc > p) {
        try { localStorage.setItem('edu-colormatch-best', String(sc)) } catch {}
        return String(sc)
      }
      return prev
    })
  }

  const tapOdd = (idx: number) => {
    if (!round) return
    if (idx === round.odd) {
      sfx('cm.right', 1, 1 + 0.052 * Math.min(streak, 12))
      const ns = score + 1
      setScore(ns)
      const nstr = streak + 1
      setStreak(nstr)
      setMaxStreak(m => Math.max(m, nstr))
      setFlash('')
      setRound(makeRound(ns))
    } else {
      sfx('cm.wrong')
      try { navigator.vibrate && navigator.vibrate(50) } catch {}
      setStreak(0)
      setSecs(s => Math.max(1, s - 3))
      setFlash(t('cm_wrong'))
      setTimeout(() => setFlash(''), 700)
    }
  }

  const tapWord = (hex: string) => {
    if (!sround) return
    if (hex === sround.ink) {
      sfx('cm.right', 1, 1 + 0.052 * Math.min(streak, 12))
      const ns = score + 1
      setScore(ns)
      const nstr = streak + 1
      setStreak(nstr)
      setMaxStreak(m => Math.max(m, nstr))
      setSround(mkStroop(ns))
    } else {
      sfx('cm.wrong')
      try { navigator.vibrate && navigator.vibrate(50) } catch {}
      setStreak(0)
      setSecs(s => Math.max(1, s - 3))
      setFlash(t('cm_wrong'))
      setTimeout(() => setFlash(''), 700)
    }
  }

  useEffect(() => { if (phase === 'over') endSave(score) }, [phase])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {t('cm_to_games')}
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">{t('cm_title')} 🎨</h1>

      {phase === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400">{t('cm_desc')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode('odd')} aria-pressed={mode === 'odd'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${mode === 'odd' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              🎨 {t('cm_mode_odd')}
            </button>
            <button onClick={() => setMode('stroop')} aria-pressed={mode === 'stroop'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${mode === 'stroop' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              🔤 {t('cm_mode_stroop')}
            </button>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 space-y-1.5 text-sm dark:text-slate-200">
            <div>• {mode === 'odd' ? t('cm_rule1') : t('cm_stroop_rule')}</div>
            <div>• {t('cm_rule2')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{t('cm_time')}:</span>
            {TIMES.map(x => (
              <button key={x.v} onClick={() => setTimePick(x.v)}
                className={`px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold border ${timePick === x.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
                {x.label}{x.v >= 60 ? t('cm_min') : t('cm_sec')}
              </button>
            ))}
          </div>
          <button onClick={startGame} className="w-full px-6 py-4 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold text-lg">
            🎨 {t('cm_start')}
          </button>
          {best && <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Trophy size={15} /> {t('cm_best')}: {best}</div>}
        </>
      )}

      {phase === 'play' && (mode === 'odd' ? round : sround) && (
        <>
          <div className="flex flex-wrap gap-3 items-center font-bold dark:text-white" aria-live="polite">
            <span className={secs <= 5 ? 'text-rose-600 dark:text-rose-400' : ''}>⏱ {Math.max(0, secs)}s</span>
            <span>{t('cm_score')}: {score}</span>
            {streak >= 3 && <span className="text-amber-600 dark:text-amber-400">🔥 {streak}</span>}
            <button onClick={startGame} className="ml-auto px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm inline-flex items-center gap-1"><RotateCcw size={15} /> {t('cm_again')}</button>
          </div>
          {flash && <div className="rounded-xl px-4 py-2 text-sm font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">{flash}</div>}

          {mode === 'odd' && round && (
            <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${round.n}, minmax(0, 1fr))` }} role="group" aria-label={t('cm_board_aria')}>
              {round.colors.map((col, i) => (
                <button key={i} onClick={() => tapOdd(i)} aria-label={`${t('cm_cell')} ${i + 1}`}
                  className="rounded-xl aspect-square w-full border-0 transition-transform active:scale-95"
                  style={{ background: col }} />
              ))}
            </div>
          )}

          {mode === 'stroop' && sround && (
            <div className="text-center space-y-4" data-testid="cm-stroop">
              <div className="font-display font-black tracking-wide" style={{ color: sround.ink, fontSize: 48 }}>
                {sround.word}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('cm_stroop_task')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sround.answers.map((a, i) => (
                  <button key={i} onClick={() => tapWord(a.hex)}
                    className="px-4 py-4 min-h-[56px] rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold text-lg transition-transform active:scale-95">
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { say(mode === 'odd' ? t('cm_hint') : t('cm_stroop_hint')) }} className="text-xs text-slate-400">{t('cm_speak_hint')}</button>
        </>
      )}

      {phase === 'over' && (
        <div className="text-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6">
          <div className="text-5xl">🎨</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('cm_gameover')}</div>
          <div className="text-slate-500 dark:text-slate-400">{t('cm_score')}: {score} • 🔥 {t('cm_maxstreak')}: {maxStreak}</div>
          {best && <div className="font-bold text-amber-600 dark:text-amber-400 mt-1">{t('cm_best')}: {best}</div>}
          <button onClick={startGame} className="mt-4 px-6 py-3 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold inline-flex items-center gap-2 mx-auto"><RotateCcw size={17} /> {t('cm_start')}</button>
        </div>
      )}
    </div>
  )
}
