import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAccessibility } from '../context/UIContext'
import client from '../api/client'
import { WORD_PACKS, shuffle, wordsFromText } from '../utils/words'
import { playGameSound, playTypeSound } from '../utils/sound'
import { RotateCcw, Trophy, MousePointerClick } from 'lucide-react'

type Src = 'ru' | 'kg' | 'en' | 'custom' | 'lesson'

export default function Sprint() {
  const { speak } = useAccessibility()
  const [mode, setMode] = useState(60)
  const [src, setSrc] = useState<Src>('ru')
  const [custom, setCustom] = useState('')
  const [lessons, setLessons] = useState<any[]>([])
  const [lessonId, setLessonId] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [wi, setWi] = useState(0)
  const [typed, setTyped] = useState('')
  const [wordOk, setWordOk] = useState<boolean[]>([])
  const [wordTyped, setWordTyped] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [left, setLeft] = useState(60)
  const [started, setStarted] = useState(false)
  const [focused, setFocused] = useState(false)
  const [correctChars, setCorrectChars] = useState(0)
  const [totalChars, setTotalChars] = useState(0)
  const [ghost, setGhost] = useState(true)
  const [best, setBest] = useState<Record<number, number>>({})
  const [caret, setCaret] = useState({ left: 0, top: 0, h: 28 })
  const [ghostPos, setGhostPos] = useState<{ left: number; top: number; h: number } | null>(null)
  const [shiftY, setShiftY] = useState(0)
  const [loading, setLoading] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef('') // что было в поле до этого кейстрока — для честного счёта
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const startRef = useRef(0)
  const stateRef = useRef({ started: false, done: false, words: [] as string[] })
  stateRef.current = { started, done, words }

  useEffect(() => {
    client.get('/lessons/?owner=me').then(r => setLessons(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    try {
      const b: Record<number, number> = {}
      ;[15, 30, 60].forEach(m => {
        const v = parseFloat(localStorage.getItem(`edu-sprint-best-${m}`) || '')
        if (!isNaN(v)) b[m] = v
      })
      setBest(b)
    } catch {}
  }, [])

  const buildWords = async (): Promise<string[]> => {
    if (src === 'custom') {
      const arr = custom.split(/[\s,;|]+/).map(s => s.trim()).filter(s => s.length >= 2)
      return shuffle(arr.length >= 10 ? arr : [...WORD_PACKS.ru.words])
    }
    if (src === 'lesson' && lessonId) {
      try {
        const r = await client.get(`/lessons/${lessonId}/`)
        const parts: string[] = []
        for (const b of (r.data.blocks || [])) {
          if (b?.type === 'text') {
            if (b.data?.title) parts.push(b.data.title)
            if (b.data?.content) parts.push(b.data.content)
          }
        }
        const got = wordsFromText(parts.join('\n'))
        if (got.length >= 10) return shuffle(got)
      } catch {}
    }
    return shuffle([...WORD_PACKS[src === 'lesson' ? 'ru' : src].words])
  }

  const start = async (m: number = mode) => {
    setLoading(true)
    const w = await buildWords()
    const need = Math.ceil((m / 60) * 140) + 40
    const looped: string[] = []
    while (looped.length < need) looped.push(...w)
    letterRefs.current = []
    wordRefs.current = []
    setWords(looped.slice(0, need))
    setWi(0); setTyped(''); setWordOk([]); setWordTyped([])
    prevRef.current = ''
    setDone(false); setLeft(m); setStarted(false)
    setCorrectChars(0); setTotalChars(0)
    setShiftY(0); setGhostPos(null)
    startRef.current = 0
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  useEffect(() => { start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // таймер идёт только в фокусе (как в monkeytype — blur ставит на паузу)
  useEffect(() => {
    if (!started || done || !focused) return
    if (left <= 0) { finish(); return }
    if (left <= 5) playGameSound('tick')
    const iv = setInterval(() => setLeft(v => v - 1), 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, left, focused])

  const elapsedMin = () => {
    if (!startRef.current) return mode / 60
    return Math.max((Date.now() - startRef.current) / 60000, 1 / 60)
  }

  const finish = () => {
    setDone(true)
    const wpm = Math.round((correctChars / 5) / (mode / 60))
    playGameSound('win')
    try {
      const prev = parseFloat(localStorage.getItem(`edu-sprint-best-${mode}`) || '0')
      if (wpm > prev) localStorage.setItem(`edu-sprint-best-${mode}`, String(wpm))
      setBest(b => ({ ...b, [mode]: Math.max(wpm, prev || 0) }))
    } catch {}
  }

  const onType = (v: string) => {
    if (done) return
    if (!started) { setStarted(true); startRef.current = Date.now(); playGameSound('go') }
    else playTypeSound()
    const cur = words[wi] || ''
    // лишние буквы сверх слова — игнор (как в monkeytype)
    if (!v.endsWith(' ') && v.length > cur.length + 10) return
    if (v.endsWith(' ') || v.endsWith('\n')) {
      const word = v.trim()
      if (!word) { setTyped(''); prevRef.current = ''; return }
      const ok = word === cur
      // пробел: 1 символ всего, 1 верный — только если слово сошлось
      setTotalChars(c => c + 1)
      if (ok) setCorrectChars(c => c + 1)
      playGameSound(ok ? 'correct' : 'wrong')
      setWordOk(a => [...a, ok])
      setWordTyped(a => [...a, word])
      prevRef.current = ''
      if (wi + 1 >= words.length) { setWi(wi + 1); setTyped(''); finish(); return }
      setWi(i => i + 1)
      setTyped('')
      return
    }
    // честный monkeytype-счёт: считаем только что допечатанные символы
    const prev = prevRef.current
    if (v.length > prev.length) {
      const added = v.slice(prev.length)
      setTotalChars(c => c + added.length)
      let ok = 0
      for (let k = 0; k < added.length; k++) {
        if (cur[prev.length + k] === added[k]) ok++
      }
      if (ok) setCorrectChars(c => c + ok)
    }
    // стирание — не считаем (как в monkeytype: net wpm по верным)
    prevRef.current = v
    setTyped(v)
  }

  const acc = totalChars ? Math.round((correctChars / totalChars) * 100) : 100
  const wpm = Math.round((correctChars / 5) / elapsedMin())
  const ghostWpm = 71 // личный рекорд автора — призрак-соперник

  // плоский индекс букв считается прямо в renderWord (массив letterRefs)
  let flat = 0

  // индекс текущей буквы среди всех отрендеренных
  const caretIndex = () => {
    let s = 0
    for (let i = 0; i < wi; i++) s += (words[i]?.length || 0) + 1
    return s + typed.length
  }

  // позиции каретки, призрака и прокрутка строк
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    const place = (idx: number) => {
      const el = letterRefs.current[idx]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left - wr.left, top: r.top - wr.top, h: r.height || 28 }
    }
    const c = place(caretIndex())
    if (c) setCaret(prev => (Math.abs(prev.left - c.left) < 0.5 && Math.abs(prev.top - c.top) < 0.5 && prev.h === c.h ? prev : c))
    // призрак: сколько символов успел бы напечатать темп 71
    if (ghost && started && !done) {
      const gChars = Math.floor(ghostWpm * 5 * elapsedMin())
      const g = place(Math.min(gChars, flat - 1))
      setGhostPos(g)
    } else setGhostPos(null)
    // строки едут вверх, текущая — вторая (как в monkeytype)
    const cur = wordRefs.current[wi]
    const first = wordRefs.current[0]
    if (cur && first) {
      const lineH = cur.offsetHeight || 40
      const line = Math.round((cur.offsetTop - first.offsetTop) / lineH)
      setShiftY(prev => {
        const next = line <= 0 ? 0 : (line - 1) * lineH
        return next === prev ? prev : next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const renderWord = (w: string, i: number) => {
    let letters: React.ReactNode
    if (i < wi) {
      const ok = wordOk[i]
      const tw = wordTyped[i] || ''
      letters = w.split('').map((ch, j) => {
        const tch = tw[j]
        const cls = tch === undefined
          ? (ok ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100')
          : tch === ch
            ? 'text-slate-900 dark:text-slate-100'
            : 'text-red-500'
        return <span key={j} ref={el => { letterRefs.current[flat + j] = el }}>{ch}</span>
      })
      const extra = !ok && tw.length > w.length
        ? <span className="text-red-500">{tw.slice(w.length)}</span> : null
      flat += w.length + 1
      return (
        <span key={i} ref={el => { wordRefs.current[i] = el }}
          className={!ok ? 'underline decoration-red-500 decoration-2 underline-offset-4' : ''}>
          {letters}{extra}{' '}
        </span>
      )
    }
    if (i === wi) {
      const nodes = w.split('').map((ch, j) => {
        let cls = 'text-slate-400 dark:text-slate-500'
        if (j < typed.length) cls = typed[j] === ch ? 'text-slate-900 dark:text-slate-100' : 'text-red-500'
        return <span key={j} ref={el => { letterRefs.current[flat + j] = el }} className={cls}>{ch}</span>
      })
      const extra = typed.length > w.length
        ? <span ref={el => { letterRefs.current[flat + w.length] = el }} className="text-red-500 bg-red-100 dark:bg-red-900/50 rounded">{typed.slice(w.length)}</span>
        : <span ref={el => { letterRefs.current[flat + typed.length] = el }} className="inline-block w-px" />
      flat += w.length + 1
      return (
        <span key={i} ref={el => { wordRefs.current[i] = el }} className="bg-amber-100/60 dark:bg-amber-900/20 rounded px-0.5">
          {nodes}{extra}{' '}
        </span>
      )
    }
    const nodes = w.split('').map((ch, j) => (
      <span key={j} ref={el => { letterRefs.current[flat + j] = el }} className="text-slate-400 dark:text-slate-500">{ch}</span>
    ))
    flat += w.length + 1
    return <span key={i} ref={el => { wordRefs.current[i] = el }}>{nodes} </span>
  }

  if (done) {
    const isRecord = best[mode] !== undefined && wpm >= best[mode] && wpm > 0
    return (
      <div className="max-w-xl mx-auto text-center space-y-4 py-8" onClick={() => inputRef.current?.focus()}>
        <div className="text-6xl">{wpm >= ghostWpm ? '🏆' : '⌨️'}</div>
        <div className="flex items-end justify-center gap-6">
          <div><div className="font-display font-bold text-6xl dark:text-white">{wpm}</div><div className="text-slate-400 text-sm">wpm</div></div>
          <div><div className="font-display font-bold text-6xl dark:text-white">{acc}<span className="text-2xl">%</span></div><div className="text-slate-400 text-sm">acc</div></div>
        </div>
        <div className="text-slate-500 dark:text-slate-400">символы {correctChars}/{totalChars} • {mode}с</div>
        <div><button onClick={() => speak(`Финиш. Скорость ${wpm} слов в минуту, точность ${acc} процентов.`)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm font-bold" aria-label="Озвучить результат">🔊 Озвучить результат</button></div>
        {isRecord && <div className="font-bold text-amber-600">Новый рекорд режима {mode}с!</div>}
        {wpm >= ghostWpm
          ? <div className="font-bold text-emerald-600">Ты обогнал автора (71)! Легенда ⌨️</div>
          : <div className="text-slate-500 dark:text-slate-400">До автора (71 WPM) не хватило {ghostWpm - wpm}. Ещё круг?</div>}
        <div className="flex gap-3 justify-center">
          <button onClick={() => start()} autoFocus className="px-6 py-3 min-h-[56px] rounded-2xl bg-violet-600 text-white font-bold flex items-center gap-2">
            <RotateCcw size={18} /> Ещё раз (Enter)
          </button>
          <a href="/games" className="px-6 py-3 min-h-[56px] rounded-2xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-bold">К играм</a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="sr-only">Спринт печати — скорость набора</h1>
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-violet-600 dark:text-violet-400">
        ← К играм
      </a>
      <div className="flex flex-wrap items-center gap-2">
        {[15, 30, 60].map(m => (
          <button key={m} onClick={() => { setMode(m); start(m) }}
            className={`px-4 py-2.5 min-h-[48px] rounded-xl font-bold ${mode === m ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700'}`}>{m}с</button>
        ))}
        <select value={src} onChange={e => setSrc(e.target.value as Src)} aria-label="Набор слов"
          className="px-3 py-2.5 min-h-[48px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] font-bold">
          <option value="ru">Русские</option>
          <option value="kg">Кыргызча</option>
          <option value="en">English</option>
          <option value="custom">Свои слова</option>
          <option value="lesson">Из моего урока</option>
        </select>
        <label className="flex items-center gap-2 text-sm font-bold dark:text-slate-200">
          <button onClick={() => setGhost(g => !g)} aria-pressed={ghost}
            className={`w-12 h-7 rounded-full transition ${ghost ? 'bg-violet-600' : 'bg-slate-300'} relative`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${ghost ? 'left-6' : 'left-1'}`} />
          </button>
          Призрак 71
        </label>
        <span className="ml-auto font-mono font-bold text-3xl dark:text-white" role="timer">{left}</span>
        {best[mode] !== undefined && <span className="text-sm font-bold text-amber-600 flex items-center gap-1"><Trophy size={15} /> {best[mode]}</span>}
      </div>

      {src === 'custom' && (
        <textarea value={custom} onChange={e => setCustom(e.target.value)} placeholder="Свои слова через пробел (мин 10)..."
          className="w-full h-20 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:text-white text-sm" />
      )}
      {src === 'lesson' && (
        <select value={lessonId} onChange={e => setLessonId(e.target.value)} aria-label="Урок"
          className="w-full px-3 py-2.5 min-h-[48px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]">
          <option value="">Выбери урок…</option>
          {lessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 sm:p-8 relative"
        onClick={() => inputRef.current?.focus()}>
        {loading ? (
          <div className="text-center text-slate-400 py-10">Готовлю слова…</div>
        ) : (
          <>
            <div className="overflow-hidden" style={{ height: 3 * 48 }}>
              <div ref={wrapRef} className="relative text-2xl sm:text-3xl leading-[48px] font-medium select-none transition-transform duration-150"
                style={{ transform: `translateY(${-shiftY}px)` }}>
                {words.map((w, i) => renderWord(w, i))}
                <div className="mt-caret bg-violet-600" style={{
                  position: 'absolute', left: caret.left, top: caret.top,
                  width: 3, height: caret.h, borderRadius: 2,
                }} />
                {ghostPos && (
                  <div style={{ position: 'absolute', left: ghostPos.left, top: ghostPos.top, width: 3, height: ghostPos.h, borderRadius: 2, opacity: 0.45 }} className="bg-emerald-500" />
                )}
              </div>
            </div>
            <input ref={inputRef} value={typed} onChange={e => onType(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); start() } }}
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              aria-label="Печатай слова"
              className="absolute opacity-0 pointer-events-none w-px h-px" />
            {!focused && started && (
              <button onClick={() => inputRef.current?.focus()}
                className="absolute inset-0 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm flex items-center justify-center gap-2 font-bold text-lg dark:text-white">
                <MousePointerClick size={22} /> Кликни чтобы продолжить
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-lg font-bold dark:text-white" aria-live="polite">
        <span>WPM: {wpm}</span>
        <span>Точность: {acc}%</span>
        <span className="text-sm font-normal text-slate-400">tab — заново</span>
      </div>
    </div>
  )
}
