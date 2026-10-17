import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'
import { playArkanSound } from '../utils/sound'
import { READY_TOPICS } from '../data/readyTopics'
import { isStudent, isGuest } from '../utils/role'
import { Play, Volume2, ArrowRight, RotateCcw } from 'lucide-react'
import { useLang } from '../context/LangContext'

type Opt = { id?: number; text: string; is_correct: boolean }
type Q = { id?: number; text: string; type: string; points: number; options: Opt[]; explanation?: string }
type TestT = { id: number | string; title: string; questions?: Q[] }

const PULL_CORRECT = 12
const PULL_MISS = 5

const MASCOTS = ['🦅', '🐺', '🐴', '🐆', '🏔️']

function loadMascot(key: string, fallback: string) {
  try {
    const v = localStorage.getItem(key)
    return v && MASCOTS.includes(v) ? v : fallback
  } catch { return fallback }
}

// Демо-бой: работает сразу, без тестов и сети — для стенда и проверки
const DEMO_QS: Q[] = [
  {
    text: 'Что выводит print(2 + 2 * 2)?', type: 'single', points: 1,
    options: [
      { text: '6', is_correct: true }, { text: '8', is_correct: false },
      { text: '4', is_correct: false }, { text: 'Ошибка', is_correct: false },
    ],
  },
  {
    text: 'Python — компилируемый язык. Верно?', type: 'true_false', points: 1,
    options: [{ text: 'Верно', is_correct: false }, { text: 'Неверно', is_correct: true }],
  },
  {
    text: 'Какой тег делает текст жирным в HTML?', type: 'single', points: 1,
    options: [
      { text: '<b>', is_correct: true }, { text: '<i>', is_correct: false },
      { text: '<u>', is_correct: false }, { text: '<p>', is_correct: false },
    ],
  },
  {
    text: 'Столица Кыргызстана?', type: 'single', points: 1,
    options: [
      { text: 'Бишкек', is_correct: true }, { text: 'Ош', is_correct: false },
      { text: 'Ташкент', is_correct: false }, { text: 'Алматы', is_correct: false },
    ],
  },
  {
    text: 'Список в Python изменяемый. Верно?', type: 'true_false', points: 1,
    options: [{ text: 'Верно', is_correct: true }, { text: 'Неверно', is_correct: false }],
  },
]

export default function Arkan() {
  const { speak, speech, autoRead, toggleAutoRead } = useAccessibility()
const tr = useLang().t
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<'lobby' | 'battle' | 'result'>('lobby')
  const [tab, setTab] = useState<'topics' | 'mine' | 'public'>('topics')
  const student = isStudent()
  const noMine = student || isGuest()
  const [mine, setMine] = useState<TestT[]>([])
  const [pub, setPub] = useState<TestT[]>([])
  const [sel, setSel] = useState<TestT | null>(null)
  const [busy, setBusy] = useState(false)
  const [teamA, setTeamA] = useState('Көк')
  const [teamB, setTeamB] = useState('Кызыл')
  const [mascA, setMascA] = useState(() => loadMascot('edu-arkan-mascA', '🦅'))
  const [mascB, setMascB] = useState(() => loadMascot('edu-arkan-mascB', '🐺'))
  const [qtime, setQtime] = useState(15)

  const pickMasc = (team: 'A' | 'B', m: string) => {
    if (team === 'A') { setMascA(m); try { localStorage.setItem('edu-arkan-mascA', m) } catch {} }
    else { setMascB(m); try { localStorage.setItem('edu-arkan-mascB', m) } catch {} }
  }

  // бой
  const [qs, setQs] = useState<Q[]>([])
  const [testId, setTestId] = useState<number | string | null>(null)
  const [qi, setQi] = useState(0)
  const [rope, setRope] = useState(0)
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [turn, setTurn] = useState<'A' | 'B'>('A')
  const [left, setLeft] = useState(15)
  const [lock, setLock] = useState<null | { ok: boolean; pick: number }>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [combo, setCombo] = useState(0)
  const [lastGain, setLastGain] = useState<string | null>(null)
  const qStartRef = useRef(0)
  const ropeRef = useRef<HTMLDivElement>(null)
  const shakeRope = () => {
    // перезапуск CSS-анимации без перемонтирования узла (иначе двоится канат)
    requestAnimationFrame(() => {
      const el = ropeRef.current
      if (!el) return
      el.classList.remove('rope-shake')
      void el.offsetWidth
      el.classList.add('rope-shake')
    })
  }
  const tickRef = useRef(0)

  useEffect(() => {
    // гостям — только Даяр-темы и демо-бой, без входа
    if (!isGuest()) client.get('/tests/?owner=me').then(r => setMine(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    client.get('/tests/?is_public=true').then(r => setPub(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
  }, [])

  // авто-чтение управляется из контекста доступности (тумблер «Доступность» и кнопка 🔊 Авто в тестах)

  // вход по прямой ссылке: /games/arkan?test=<id> (учитель поделился — играет любой)
  useEffect(() => {
    const tid = searchParams.get('test')
    if (!tid) return
    client.get(`/tests/${tid}/`).then(r => {
      const full : TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      if (playable(full).length) {
        setSel(full)
        setTab(isStudent() ? 'public' : 'mine')
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playable = (test: TestT): Q[] =>
    (test.questions || []).filter((qq: Q) => (qq.type === 'single' || qq.type === 'true_false') && qq.options && qq.options.length >= 2)

  const pickTest = async (tests: TestT) => {
    setBusy(true)
    try {
      const r = await client.get(`/tests/${tests.id}/`)
      const full : TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      const pl = playable(full)
      if (!pl.length) { alert(tr('arkan_no_opts')); return }
      setSel(full)
    } catch { alert(tr('arkan_open_err')) } finally { setBusy(false) }
  }

  // --- бой ---
  const resetBattle = (list: Q[], tid: number | string) => {
    setQs(list); setTestId(tid)
    setQi(0); setRope(0); setScoreA(0); setScoreB(0)
    setTurn('A'); setLeft(qtime); setLock(null); setWinner(null)
    tickRef.current = 0
    setPhase('battle')
    setCountdown(3)
    setCombo(0)
    setLastGain(null)
    qStartRef.current = 0
    playArkanSound('tick')
  }

  const demoBattle = () => resetBattle(DEMO_QS.map(q => ({ ...q })), 'demo')

  const pickTopic = (topicId: string) => {
    const topic = READY_TOPICS.find(t => t.id === topicId)
    if (!topic) return
    const tq : TestT = {
      id: `ready-${topic.id}`,
      title: `${topic.icon} ${topic.title} (${tr('arkan_ready_badge')})`,
      questions: topic.questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) })),
    }
    setSel(tq)
  }

  const startBattle = async () => {
    const cur = sel
    if (!cur) { alert(tr('arkan_pick_first')); return }
    // готовая тема — играем сразу, без сети
    if (typeof cur.id === 'string' && cur.id.startsWith('ready-')) {
      const pl = playable(cur)
      if (!pl.length) { alert(tr('arkan_no_playable')); return }
      resetBattle(pl, cur.id)
      return
    }
    setBusy(true)
    try {
      const r = await client.get(`/tests/${cur.id}/`)
      const full : TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      const pl = playable(full)
      if (!pl.length) { alert(tr('arkan_no_opts_short')); return }
      resetBattle(pl, full.id)
    } catch { alert(tr('arkan_open_err')) } finally { setBusy(false) }
  }

  useEffect(() => {
    if (phase !== 'battle' || lock || countdown !== null) return
    if (left <= 0) { onTimeout(); return }
    if (left <= 5 && tickRef.current !== left) { tickRef.current = left; playArkanSound('tick') }
    const iv = setInterval(() => setLeft(v => v - 1), 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left, lock, qi, countdown])

  useEffect(() => {
    if (phase !== 'battle' || countdown === null) return
    if (countdown > 0) {
      const timeout = setTimeout(() => {
        setCountdown(c => (c !== null && c > 0 ? c - 1 : c))
        playArkanSound('tick')
      }, 700)
      return () => clearTimeout(timeout)
    }
    const timeout = setTimeout(() => {
      setCountdown(null)
      tickRef.current = 0
      setLeft(qtime)
      qStartRef.current = Date.now()
      playArkanSound('go')
    }, 600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  const finish = (r: number, a: number, b: number) => {
    const w = r >= 100 ? teamA : r <= -100 ? teamB : r > 0 ? teamA : r < 0 ? teamB : 'Ничья'
    setWinner(w)
    if (w !== 'Ничья') {
      playArkanSound('win')
      try { localStorage.setItem('edu-arkan-best', `${w} ${a}:${b} • ${new Date().toLocaleDateString()}`) } catch {}
    }
    setPhase('result')
  }

  useEffect(() => {
    if (phase !== 'result' || !speech) return
    const timeout = setTimeout(() => playArkanSound('win'), 400)
    try {
      const msg = winner === 'Ничья' ? tr('arkan_draw') : `${tr('arkan_winner_a')}${winner}!`
      speak(msg)
    } catch {}
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // автопереход: верно — быстро, неверно — дать время увидеть правильный
  useEffect(() => {
    if (phase !== 'battle' || !lock || countdown !== null) return
    const timeout = setTimeout(() => {
      applyResult(lock.ok)
    }, lock.ok ? 1000 : 1800)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lock, countdown])

  // авто-чтение вопроса для незрячих: каждый новый вопрос — вслух
  useEffect(() => {
    if (phase !== 'battle' || !speech || !autoRead || countdown !== null || lock) return
    const q = qs[qi]
    if (!q) return
    speak(`${q.text}. Варианты: ${q.options.map(o => o.text).join(', ')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qi, countdown, autoRead, speech])

  const applyResult = (ok: boolean) => {
    const elapsed = qStartRef.current ? (Date.now() - qStartRef.current) / 1000 : 999
    const speedBonus = ok ? (elapsed <= 3 ? 6 : elapsed <= 6 ? 3 : 0) : 0
    const newCombo = ok ? combo + 1 : 0
    const comboBonus = ok ? Math.min(Math.max(newCombo - 1, 0), 5) * 2 : 0
    const pull = ok ? PULL_CORRECT + speedBonus + comboBonus : -PULL_MISS
    const dir = turn === 'A' ? 1 : -1
    const nr = Math.max(-100, Math.min(100, rope + dir * pull))
    const na = scoreA + (ok && turn === 'A' ? 1 : 0)
    const nb = scoreB + (ok && turn === 'B' ? 1 : 0)
    setRope(nr); setScoreA(na); setScoreB(nb)
    setCombo(newCombo)
    shakeRope()
    if (ok) {
      const parts = [`+${PULL_CORRECT + speedBonus + comboBonus}`]
      if (speedBonus > 0) parts.push(`⚡${elapsed.toFixed(1)}${tr('arkan_sec_short')}`)
      if (newCombo >= 2) parts.push(`🔥x${newCombo}`)
      setLastGain(parts.join(' '))
      setTimeout(() => setLastGain(null), 1400)
    } else {
      setLastGain(null)
    }
    playArkanSound(ok ? 'correct' : 'wrong')
    if (nr >= 100 || nr <= -100) { finish(nr, na, nb); return }
    if (qi + 1 >= qs.length) { finish(nr, na, nb); return }
    setQi(qi + 1); setTurn(turn === 'A' ? 'B' : 'A'); setLeft(qtime); setLock(null)
    tickRef.current = 0
    qStartRef.current = Date.now()
  }

  const answer = async (optIdx: number) => {
    if (lock || countdown !== null) return
    const q = qs[qi]
    const opt = q.options[optIdx]
    // серверная проверка (античит для публичных)
    try {
      if (typeof testId === 'number' && typeof q.id === 'number' && typeof opt.id === 'number') {
        const r = await client.post(`/tests/${testId}/answer/`, { question_id: q.id, option_id: opt.id })
        const ok = !!r.data.correct
        playArkanSound(ok ? 'correct' : 'wrong')
        setLock({ ok, pick: optIdx })
        return
      }
      throw new Error('local')
    } catch (e: any) {
      if (e.response) { alert(tr('arkan_offline')); return }
      // офлайн-фолбэк: свои тесты (ответы известны)
      if (typeof opt.is_correct === 'boolean') {
        const ok = opt.is_correct
        playArkanSound(ok ? 'correct' : 'wrong')
        setLock({ ok, pick: optIdx })
      }
    }
  }

  const onTimeout = () => {
    if (lock) return
    playArkanSound('wrong')
    setLock({ ok: false, pick: -1 })
  }

  const correctIdx = (q: Q) => q.options.findIndex(o => o.is_correct)

  if (phase === 'result') {
    const wMasc = winner === teamA ? mascA : winner === teamB ? mascB : '🤝'
    const isDraw = winner === 'Ничья'
    const confetti = isDraw ? [] : Array.from({ length: 70 }, (_, i) => {
      const colors = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#fde047']
      return {
        left: (i * 97) % 100,
        delay: ((i * 37) % 20) / 10,
        dur: 2.6 + ((i * 53) % 20) / 10,
        size: 6 + ((i * 29) % 8),
        color: colors[i % colors.length],
        round: i % 3 === 0,
      }
    })
    const rematch = () => {
      setQi(0); setRope(0); setScoreA(0); setScoreB(0)
      setTurn('A'); setLeft(qtime); setLock(null); setWinner(null)
      setCombo(0); setLastGain(null)
      tickRef.current = 0
      qStartRef.current = 0
      setPhase('battle')
      setCountdown(3)
      playArkanSound('tick')
    }
    return (
      <div className="max-w-2xl mx-auto text-center space-y-5 py-8 relative">
        {!isDraw && (
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.round ? c.size : c.size * 0.55,
                  background: c.color,
                  borderRadius: c.round ? '50%' : '2px',
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.dur}s`,
                }}
              />
            ))}
          </div>
        )}
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
          {tr('arkan_to_games')}
        </Link>
        <div className="arkan-arena p-8 space-y-4">
          <div className="oimo-strip" />
          <div className="text-8xl animate-enter">{wMasc}</div>
          <h1 className="font-display font-bold text-4xl text-slate-900">
            {isDraw ? tr('arkan_draw') : `${tr('arkan_winner_a')}${winner}!`}
          </h1>
          <div className="text-2xl text-slate-800 font-bold">{mascA} {teamA} {scoreA} : {scoreB} {teamB} {mascB}</div>
          {!isDraw && <div className="font-bold text-amber-700">{tr('arkan_congrats')}</div>}
          <div className="oimo-strip" />
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={rematch}
            className="px-6 py-3 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold flex items-center gap-2">
            <RotateCcw size={18} /> {tr('arkan_rematch')}
          </button>
          <button onClick={() => setPhase('lobby')} className="px-6 py-3 min-h-[56px] rounded-2xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-bold">
            {tr('arkan_to_topics')}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'battle') {
    const q = qs[qi]
    const ci = correctIdx(q)
    const marker = 50 + rope / 2
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => setPhase('lobby')}
          className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
          {tr('arkan_exit_battle')}
        </button>
        <div className="arkan-arena p-4 sm:p-6 space-y-4">
          <div className="oimo-strip" />
          {/* счёт + канат */}
          <div className="flex items-center gap-3 font-display font-bold text-xl sm:text-2xl">
            <span className={`px-3 py-1 rounded-xl bg-white/70 ${turn === 'A' ? 'text-blue-700' : 'text-slate-500'}`}>{mascA} {teamA} {scoreA}</span>
            <span className="ml-auto px-3 py-1 rounded-xl bg-white/70 text-slate-500">{scoreB} {teamB} {mascB}</span>
          </div>
        <div ref={ropeRef} className="relative h-14 rounded-2xl overflow-hidden border dark:border-slate-700" aria-label={tr('arkan_rope')}>
          <div className="absolute inset-y-0 left-0 bg-blue-500/80 transition-all duration-500" style={{ width: `${marker}%` }} />
          <div className="absolute inset-y-0 right-0 bg-red-500/80 transition-all duration-500" style={{ width: `${100 - marker}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-1 bg-white" />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-3xl transition-all duration-500" style={{ left: `${marker}%` }}>🪢</div>
          {lastGain && (
            <div className="absolute top-1 right-2 font-display font-bold text-lg text-amber-300 drop-shadow animate-enter" aria-live="polite">
              {lastGain}
            </div>
          )}
        </div>
        {combo >= 2 && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-bold w-fit" aria-live="polite">
            {tr('arkan_combo_a')}{combo}{tr('arkan_combo_b')}
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-xl font-bold ${turn === 'A' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
            {tr('arkan_answering')} {turn === 'A' ? `${mascA} ${teamA}` : `${mascB} ${teamB}`}
          </span>
          <span className="ml-auto flex items-center gap-2" role="timer" aria-label={`${tr('arkan_time_a')}${left}${tr('arkan_time_b')}`}>
            <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(15,23,42,.12)" strokeWidth="5" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke={left <= 5 ? '#dc2626' : '#0d9488'}
                strokeWidth="5" strokeLinecap="round"
                className="timer-ring"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - Math.max(0, left) / Math.max(1, qtime))}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <span className={`font-mono font-bold text-2xl ${left <= 5 ? 'text-red-600' : 'text-slate-900'}`}>0:{String(Math.max(0, left)).padStart(2, '0')}</span>
          </span>
          <button onClick={() => speak(q.text)} className="p-2.5 rounded-xl bg-white/80 text-slate-800 border border-sky-200" aria-label={tr('arkan_speak_q')}><Volume2 size={18} /></button>
          <button onClick={toggleAutoRead} aria-pressed={autoRead} title={tr('arkan_autoread_title')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${autoRead ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/80 text-slate-800 border-sky-200'}`}>
            {autoRead ? tr('arkan_auto_on') : tr('arkan_auto_off')}
          </button>
        </div>
        {countdown !== null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 rounded-2xl" aria-live="assertive">
            <div key={countdown} className="count-pop font-display font-bold text-7xl text-white drop-shadow-lg">
              {countdown > 0 ? countdown : tr('arkan_go')}
            </div>
          </div>
        )}
        <div className="text-sm text-slate-600 font-semibold">{tr('arkan_q')} {qi + 1} {tr('arkan_of')} {qs.length}</div>
        <div key={qi} className="motion-safe:animate-slide space-y-3">
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 leading-snug">{q.text}</h2>
        <div className="grid gap-3">
          {q.options.map((o, i) => {
            const show = lock && (i === lock.pick || i === ci)
            const cls = !lock
              ? 'bg-white text-slate-900 hover:border-amber-400 shadow-sm'
              : i === ci
                ? 'bg-emerald-100 border-emerald-500 text-slate-900'
                : i === lock.pick
                  ? 'bg-red-100 border-red-500 text-slate-900'
                  : 'bg-white opacity-50 text-slate-900'
            return (
              <button key={i} disabled={!!lock || countdown !== null} onClick={() => answer(i)}
                className={`text-left px-5 py-4 min-h-[72px] rounded-2xl border-2 border-sky-200 font-bold text-lg sm:text-xl transition ${cls}`}>
                {o.text}
              </button>
            )
          })}
        </div>
        {lock && (
          <div className="w-full px-6 py-4 min-h-[64px] rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center gap-2 animate-enter" aria-live="polite">
            {lock.ok ? tr('arkan_correct') : lock.pick === -1 ? tr('arkan_timeout') : tr('arkan_wrong')}
            <span className="text-amber-300">
              {tr('arkan_next')} {turn === 'A' ? `${mascB} ${teamB}` : `${mascA} ${teamA}`} <ArrowRight size={20} className="inline" />
            </span>
          </div>
        )}
        </div>
        </div>
      </div>
    )
  }

  // --- лобби ---
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {tr('arkan_to_games')}
      </Link>
      <div className="arkan-arena p-5 sm:p-7 text-center space-y-2">
        <div className="oimo-strip" />
        <div className="text-5xl sm:text-6xl">{mascA} 🤼 {mascB}</div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900">Аркан тартыш</h1>
        <p className="text-slate-700 font-semibold">{tr('arkan_sub')}</p>
        <div className="oimo-strip" />
      </div>

      <button onClick={demoBattle}
        className="w-full px-6 py-4 min-h-[64px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xl flex items-center justify-center gap-2">
        {tr('arkan_demo')}
      </button>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="text-sm dark:text-slate-300">{tr('arkan_team_left')}
          <div className="mt-1 flex gap-1">
            <input value={teamA} onChange={e => setTeamA(e.target.value.slice(0, 20))} aria-label={tr('arkan_team_left')} className="flex-1 min-w-0 px-3 py-2.5 min-h-[48px] rounded-xl border dark:bg-slate-700 dark:text-white" />
          </div>
          <div className="mt-1 flex gap-1" role="group" aria-label={tr('arkan_masc_left')}>
            {MASCOTS.map(m => (
              <button key={m} onClick={() => pickMasc('A', m)} aria-pressed={mascA === m}
                className={`flex-1 min-h-[44px] rounded-xl text-xl border ${mascA === m ? 'bg-amber-200 border-amber-500' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="text-sm dark:text-slate-300">{tr('arkan_team_right')}
          <div className="mt-1 flex gap-1">
            <input value={teamB} onChange={e => setTeamB(e.target.value.slice(0, 20))} aria-label={tr('arkan_team_right')} className="flex-1 min-w-0 px-3 py-2.5 min-h-[48px] rounded-xl border dark:bg-slate-700 dark:text-white" />
          </div>
          <div className="mt-1 flex gap-1" role="group" aria-label={tr('arkan_masc_right')}>
            {MASCOTS.map(m => (
              <button key={m} onClick={() => pickMasc('B', m)} aria-pressed={mascB === m}
                className={`flex-1 min-h-[44px] rounded-xl text-xl border ${mascB === m ? 'bg-amber-200 border-amber-500' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>{m}</button>
            ))}
          </div>
        </div>
        <label className="text-sm dark:text-slate-300">{tr('arkan_sec_per_q')}
          <select value={qtime} onChange={e => setQtime(parseInt(e.target.value))} className="mt-1 w-full px-3 py-2.5 min-h-[48px] rounded-xl border dark:bg-slate-700 dark:text-white">
            <option value={10}>10</option><option value={15}>15</option><option value={30}>30</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2" role="tablist" aria-label={tr('arkan_src')}>
        {((noMine ? [['topics', tr('arkan_tab_topics')], ['public', tr('arkan_tab_public')]] : [['topics', tr('arkan_tab_topics')], ['mine', tr('arkan_tab_mine')], ['public', tr('arkan_tab_public')]]) as Array<['topics' | 'mine' | 'public', string]>).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}
            className={`flex-1 px-4 py-3 min-h-[52px] rounded-xl font-bold ${tab === k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'topics' && (
        <div className="grid gap-2">
          {READY_TOPICS.map(topic => (
            <button key={topic.id} onClick={() => pickTopic(topic.id)} disabled={busy}
              className={`w-full text-left px-4 py-3 min-h-[64px] rounded-xl border dark:text-white ${sel?.id === `ready-${topic.id}` ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
              <div className="font-bold">{topic.icon} {topic.title} <span className="text-xs font-semibold text-amber-600">{tr('arkan_ready_badge')}</span></div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{topic.desc}</div>
            </button>
          ))}
          <div className="text-xs text-slate-500 text-center">{tr('arkan_profile_hint')}</div>
        </div>
      )}

      {tab !== 'topics' && (
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {(tab === 'mine' ? mine : pub).length === 0 && <div className="text-slate-400 text-center py-4">{tr('arkan_empty_mine')}</div>}
          {(tab === 'mine' ? mine : pub).map(t => (
            <button key={t.id} onClick={() => pickTest(t)} disabled={busy}
              className={`w-full text-left px-4 py-3 min-h-[56px] rounded-xl border font-semibold dark:text-white ${sel?.id === t.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <button onClick={startBattle} disabled={busy || !sel}
        className="w-full px-6 py-4 min-h-[64px] rounded-2xl bg-emerald-600 text-white font-bold text-xl flex items-center justify-center gap-2 disabled:opacity-50">
        <Play size={22} /> {`${tr('arkan_play')}${sel ? `: ${sel.title.slice(0, 40)}` : ''}`}
      </button>
    </div>
  )
}
