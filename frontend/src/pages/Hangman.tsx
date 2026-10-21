import { useEffect, useRef, useState } from 'react'
import { WORD_PACKS, wordsFromText } from '../utils/words'
import { sfx } from '../utils/sfx'
import { Sparkles, X, Trash2, Share2, Save, Play } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Phase = 'idle' | 'play' | 'over'
type Diff = 'easy' | 'hard'
type HmSet = { id: string; name: string; words: string[]; lang: string }

const LIVES = 6
const SETS_KEY = 'edu-hm-sets'

const hum = (ms: number | number[]) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} }

function loadSets(): HmSet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SETS_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function b64uEncode(str: string): string {
  const b = btoa(unescape(encodeURIComponent(str)))
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64uDecode(str: string): string | null {
  try {
    const s = str.replace(/-/g, '+').replace(/_/g, '/')
    return decodeURIComponent(escape(atob(s + '='.repeat((4 - (s.length % 4)) % 4))))
  } catch { return null }
}

function detectLang(words: string[]): string {
  const join = words.join('').toLowerCase()
  if (/[a-z]/.test(join)) return 'en'
  if (/[үө]/.test(join)) return 'kg'
  return 'ru'
}

function presetBank(lang: string): { label: string; words: string[] }[] {
  const l = lang === 'kg' ? 'kg' : lang === 'en' ? 'en' : 'ru'
  const ok = ['ru', 'kg'].includes(l) ? /^[а-яёүө]+$/ : /^[a-z]+$/
  const raw = [...new Set((WORD_PACKS[l] || WORD_PACKS.ru).words.map(w => w.toLowerCase()))].filter(w => ok.test(w) && w.length >= 3 && w.length <= 10)
  const out: { label: string; words: string[] }[] = []
  const chunks = [raw.slice(0, 8), raw.slice(8, 16), raw.slice(16, 24)]
  chunks.forEach((c, i) => { if (c.length >= 4) out.push({ label: `📖 #${i + 1}`, words: c }) })
  if (!out.length) out.push({ label: '📖', words: raw.slice(0, 8) })
  return out
}


function pickBank(lang: string, diff: Diff): string[] {
  const key = lang === 'kg' ? 'kg' : lang === 'en' ? 'en' : 'ru'
  const raw = (WORD_PACKS[key] || WORD_PACKS.ru).words
  const ok = ['ru', 'kg'].includes(key) ? /^[а-яёүө]+$/ : /^[a-z]+$/
  const lo = diff === 'easy' ? 4 : 6
  const hi = diff === 'easy' ? 5 : 8
  return [...new Set(raw.map(w => w.toLowerCase()))].filter(w => w.length >= lo && w.length <= hi && ok.test(w))
}

function alphabetOf(bank: string[]): string[] {
  const set = new Set(bank.join('').split(''))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
}

function drawFor(wrong: number) {
  return {
    head: wrong >= 1,
    body: wrong >= 2,
    armL: wrong >= 3,
    armR: wrong >= 4,
    legL: wrong >= 5,
    legR: wrong >= 6,
  }
}

export default function Hangman() {
  const { t, lang } = useLang()
  const { speak, speech } = useAccessibility()
  const say = (s: string) => { try { if (speech) speak(s) } catch {} }
  const [phase, setPhase] = useState<Phase>('idle')
  const [diff, setDiff] = useState<Diff>('easy')
  const [word, setWord] = useState('')
  const [guessed, setGuessed] = useState<string[]>([])
  const [solved, setSolved] = useState(0)
  const [best, setBest] = useState<string | null>(null)
  const [bestDiff, setBestDiff] = useState<string | null>(null)
  const [hintsLeft, setHintsLeft] = useState(2)
  const [flash, setFlash] = useState('')
  const [custom, setCustom] = useState<HmSet | null>(null)
  const [panel, setPanel] = useState<null | 'build'>(null)
  // стартовый выбор «как играем»: pick — готовые vs свой, ready — встроенные коллекции
  const [entry, setEntry] = useState<null | 'pick' | 'ready'>(null)
  // ИИ-подбор слов в билдере
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiSrc, setAiSrc] = useState<string | null>(null)
  const [sets, setSets] = useState<HmSet[]>(loadSets)
  const [cName, setCName] = useState('')
  const [cWords, setCWords] = useState('')
  const [cErr, setCErr] = useState('')
  const [shared, setShared] = useState('')
  const [lessons, setLessons] = useState<{ id: number; title: string }[]>([])
  const [lessonId, setLessonId] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const bankRef = useRef(pickBank(lang, 'easy'))
  const seqRef = useRef<string[]>([])
  const seqIdx = useRef(0)

  useEffect(() => {
    try { setBest(localStorage.getItem('edu-hangman-best')) } catch {}
    try { setBestDiff(localStorage.getItem(`edu-hangman-best-${diff}`)) } catch {}
  }, [diff])

  useEffect(() => { (window as any).__hm = { word, guessed, solved, phase, diff, hints: hintsLeft, set: custom?.name || null } })

  // вход по ссылке ?c=<набор>
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('c')
    const json = q ? b64uDecode(q) : null
    if (json) {
      try {
        const d = JSON.parse(json)
        if (d && Array.isArray(d.words) && d.words.length >= 3) {
          playCustomSilent(d)
          return
        }
      } catch {}
    }
    setEntry('pick')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playCustomSilent = (d: any) => {
    try {
      const set: HmSet = {
        id: 'shared',
        name: String(d.name || '✨').slice(0, 40),
        words: d.words.map(String),
        lang: d.lang || detectLang(d.words),
      }
      playCustom(set)
    } catch {}
  }


  const alphabet = alphabetOf(bankRef.current)

  const nextWord = () => {
    if (seqIdx.current >= seqRef.current.length) {
      seqRef.current = bankRef.current.slice().sort(() => Math.random() - 0.5)
      seqIdx.current = 0
    }
    setWord(seqRef.current[seqIdx.current++])
    setGuessed([])
    setHintsLeft(2)
    setFlash('')
  }

  const playCustom = (set: HmSet) => {
    const words = [...new Set(set.words.map(w => w.trim().toLowerCase()).filter(w => w.length >= 3))]
    if (!words.length) { setCustom(null); return }
    setCustom(set)
    bankRef.current = words
    seqRef.current = []
    seqIdx.current = 0
    setSolved(0)
    nextWord()
    setPhase('play')
    sfx('hm.go')
  }

  const exitCustom = () => {
    setCustom(null)
    setPhase('idle')
    sfx('ui.click')
  }

  // уроки для «из урока»
  useEffect(() => {
    import('../api/client').then(({ default: client }) =>
      client.get('/lessons/?owner=me').then(r => {
        const d = Array.isArray(r.data) ? r.data : r.data.results || []
        setLessons(d.slice(0, 40).map((x: any) => ({ id: x.id, title: x.title })))
      }).catch(() => {}))
  }, [])

  const parseSetInput = (): { words: string[] } | { words: null; err: string } => {
    const words = [...new Set(cWords.split(/[\s,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean))]
    if (words.length < 3) return { words: null, err: t('ws_err_few') }
    if (words.length > 14) return { words: null, err: '≤ 14' }
    for (const w of words) {
      if (w.length < 3 || w.length > 12) return { words: null, err: `“${w}” — 3–12` }
      const hasCyr = /[а-яүөё]/.test(w)
      const hasLat = /[a-z]/.test(w)
      if (hasCyr === hasLat) return { words: null, err: `“${w}” — ${t('ws_err_mixed')}` }
    }
    // весь набор — один алфавит (иначе клавиатура игры смешает языки)
    const anyCyr = words.some(w => /[а-яүөё]/.test(w))
    const anyLat = words.some(w => /[a-z]/.test(w))
    if (anyCyr && anyLat) return { words: null, err: t('ws_err_mixed') }
    return { words }
  }

  const genWordsAI = async () => {
    if (aiBusy) return
    if (aiPrompt.trim().length < 3) { setCErr(t('aiw_need_topic') || 'Напиши тему'); return }
    setAiBusy(true); setCErr('')
    try {
      const { default: client } = await import('../api/client')
      const r = await client.post('/ai/words/', { prompt: aiPrompt.trim(), count: aiCount })
      const words: string[] = (r.data.words || []).map(String)
      if (!words.length) throw new Error('empty')
      setCWords(words.join(', '))
      if (!cName.trim()) setCName(aiPrompt.trim().slice(0, 30))
      setAiSrc(typeof r.data.source === 'string' ? r.data.source : null)
      sfx('fb.pick')
    } catch (e: any) {
      setCErr(e?.response?.data?.error || t('aiw_fail') || 'ИИ не смог — напиши слова сам')
    }
    setAiBusy(false)
  }

  const saveSet = () => {
    const p = parseSetInput()
    if (!p.words) { setCErr((p as any).err); return }
    const set: HmSet = {
      id: 'u' + Date.now().toString(36),
      name: (cName.trim() || '✨').slice(0, 40),
      words: p.words,
      lang: detectLang(p.words),
    }
    const next = [set, ...sets].slice(0, 30)
    setSets(next)
    try { localStorage.setItem(SETS_KEY, JSON.stringify(next)) } catch {}
    sfx('fb.chip')
    setCName(''); setCWords(''); setCErr('')
    setPanel(null)
    playCustom(set)
  }

  const playNow = () => {
    const p = parseSetInput()
    if (!p.words) { setCErr((p as any).err); return }
    const set: HmSet = {
      id: 'tmp',
      name: (cName.trim() || '✨').slice(0, 40),
      words: p.words,
      lang: detectLang(p.words),
    }
    setPanel(null)
    playCustom(set)
  }

  const shareSet = (set: HmSet) => {
    const code = b64uEncode(JSON.stringify({ name: set.name, words: set.words, lang: set.lang }))
    const url = `${location.origin}/games/hangman?c=${code}`
    try {
      navigator.clipboard.writeText(url).then(() => {
        sfx('fb.chip'); hum(15)
        setShared(set.id)
        setTimeout(() => setShared(''), 2200)
      }).catch(() => prompt('🔗', url))
    } catch { prompt('🔗', url) }
  }

  const delSet = (id: string) => {
    const next = sets.filter(s => s.id !== id)
    setSets(next)
    try { localStorage.setItem(SETS_KEY, JSON.stringify(next)) } catch {}
    sfx('cm.wrong')
  }

  const fromLesson = async () => {
    if (!lessonId || genBusy) return
    setGenBusy(true); setCErr('')
    try {
      const { default: client } = await import('../api/client')
      const r = await client.get(`/lessons/${lessonId}/`)
      const parts: string[] = []
      for (const b of (r.data.blocks || [])) {
        if (b?.type === 'text') {
          if (b.data?.title) parts.push(b.data.title)
          if (b.data?.content) parts.push(b.data.content)
        }
      }
      const words = [...new Set(wordsFromText(parts.join('\n'), 400)
        .map(w => w.trim().toLowerCase())
        .filter(w => /^[а-яүөёa-z]{3,12}$/.test(w)))].slice(0, 10)
      if (words.length < 3) { setCErr(t('ws_err_few')); return }
      setCWords(words.join(', '))
      if (!cName.trim()) setCName(`${t('hm_from_lesson')}: ${String(r.data.title || '').slice(0, 20)}`)
      sfx('hm.hint')
    } catch { setCErr('⚠️') } finally { setGenBusy(false) }
  }


  const startGame = () => {
    setSolved(0)
    if (!custom) bankRef.current = pickBank(lang, diff)
    seqRef.current = []
    seqIdx.current = 0
    nextWord()
    setPhase('play')
    sfx('hm.go')
    say(t('hm_hint'))
  }

  const saveBest = (n: number) => {
    setBest(prev => {
      const p = prev ? parseInt(prev, 10) : 0
      if (n > p) {
        try { localStorage.setItem('edu-hangman-best', String(n)) } catch {}
        return String(n)
      }
      return prev
    })
    setBestDiff(prev => {
      const p = prev ? parseInt(prev, 10) : 0
      if (n > p) {
        try { localStorage.setItem(`edu-hangman-best-${diff}`, String(n)) } catch {}
        return String(n)
      }
      return prev
    })
  }

  const isWin = word && word.length > 0 && word.split('').every(ch => guessed.includes(ch))

  useEffect(() => {
    if (phase !== 'play' || !word || guessed.length === 0) return
    if (isWin) {
      sfx('hm.win')
      hum(15)
      setFlash(t('hm_solved'))
      const ns = solved + 1
      setSolved(ns)
      saveBest(ns)
      say(`${t('hm_solved')} ${word}`)
      const x = setTimeout(() => { nextWord() }, 1100)
      return () => clearTimeout(x)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWin])

  const wrong = alphabet.filter(al => guessed.includes(al) && !word.includes(al)).length
  const alive = wrong < LIVES

  useEffect(() => {
    if (phase !== 'play' || alive || !word) return
    sfx('hm.lose')
    hum(60)
    say(`${t('hm_lost')} ${word}`)
    setPhase('over')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive])

  const guess = (al: string) => {
    if (phase !== 'play' || !alive || word === '' || guessed.includes(al)) return
    if (word.includes(al)) { sfx('hm.hit'); hum(12) } else { sfx('hm.miss'); hum(35) }
    setGuessed(g => [...g, al])
  }

  const useHint = () => {
    if (phase !== 'play' || hintsLeft <= 0 || !word || alive === false) return
    const cand = [...new Set(word.split(''))].filter(ch => !guessed.includes(ch))
    if (!cand.length) return
    const pick = cand.sort(() => Math.random() - 0.5)[0]
    setGuessed(g => [...g, pick])
    setHintsLeft(h => h - 1)
    sfx('hm.hint')
    hum(15)
    say(pick)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase()
      if (k.length === 1 && alphabet.includes(k)) guess(k)
      if (k === 'Enter' && phase === 'over') startGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, word, guessed])

  const parts = drawFor(wrong)
  const d = parts

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {t('hm_to_games')}
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">{t('hm_title')} 🎯</h1>

      {phase === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400">{t('hm_desc')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDiff('easy')} aria-pressed={diff === 'easy'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${diff === 'easy' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              {t('hm_diff_e')} (4–5)
            </button>
            <button onClick={() => setDiff('hard')} aria-pressed={diff === 'hard'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${diff === 'hard' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              {t('hm_diff_h')} (6–8)
            </button>
            <button onClick={() => { setPanel('build'); setCErr(''); sfx('ui.click') }}
              data-testid="hm-build"
              className="px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold bg-indigo-600 text-white hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-1.5">
              ✏️ {t('hm_build')}
            </button>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 space-y-1.5 text-sm dark:text-slate-200">
            <div>• {t('hm_rule1')}</div>
            <div>• {t('hm_rule2')}</div>
          </div>
          <button onClick={startGame} className="w-full px-6 py-4 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold text-lg">
            🎯 {t('hm_start')}
          </button>
          {(bestDiff || best) && <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Trophy size={15} /> {t('hm_best')}: {bestDiff || best} {t('hm_solved_n')}</div>}
        </>
      )}

      {phase !== 'idle' && (
        <>
          <div className="flex flex-wrap gap-3 items-center font-bold dark:text-white">
            {custom && (
              <button onClick={exitCustom} data-testid="hm-set-badge"
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center gap-1">
                ✨ {custom.name} <X size={13} />
              </button>
            )}
            <span>{t('hm_solved_n')}: {solved}</span>
            <span className={wrong >= 4 ? 'text-rose-600 dark:text-rose-400' : ''}>{t('hm_missing')}: {LIVES - wrong}</span>
            {phase === 'play' && (
              <button onClick={useHint} disabled={hintsLeft <= 0}
                className="px-3 py-2 min-h-[44px] rounded-xl bg-amber-400 text-amber-950 border border-amber-500 text-sm font-bold flex items-center gap-1 disabled:opacity-40">
                💡 {t('hm_hint_use')} ×{hintsLeft}
              </button>
            )}
            <button onClick={startGame} className="ml-auto px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm inline-flex items-center gap-1"><RotateCcw size={15} /> {t('hm_again')}</button>
          </div>
          {flash && <div className="rounded-xl px-4 py-2 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{flash}</div>}
          <div className="flex items-start gap-4">
            <svg viewBox="0 0 120 140" className="w-28 shrink-0" aria-hidden="true">
              <line x1="10" y1="130" x2="80" y2="130" stroke="#94a3b8" strokeWidth="4" />
              <line x1="30" y1="130" x2="30" y2="10" stroke="#94a3b8" strokeWidth="4" />
              <line x1="30" y1="10" x2="86" y2="10" stroke="#94a3b8" strokeWidth="4" />
              <line x1="86" y1="10" x2="86" y2="26" stroke="#94a3b8" strokeWidth="3" />
              {d.head && <circle cx="86" cy="40" r="14" fill="none" stroke="#ef4444" strokeWidth="3.5" />}
              {d.body && <line x1="86" y1="54" x2="86" y2="94" stroke="#ef4444" strokeWidth="3.5" />}
              {d.armL && <line x1="86" y1="62" x2="70" y2="78" stroke="#ef4444" strokeWidth="3.5" />}
              {d.armR && <line x1="86" y1="62" x2="102" y2="78" stroke="#ef4444" strokeWidth="3.5" />}
              {d.legL && <line x1="86" y1="94" x2="70" y2="112" stroke="#ef4444" strokeWidth="3.5" />}
              {d.legR && <line x1="86" y1="94" x2="102" y2="112" stroke="#ef4444" strokeWidth="3.5" />}
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5" aria-label={t('hm_word_aria')}>
                {word.split('').map((ch, i) => (
                  <span key={i} className={`w-8 h-11 sm:w-10 sm:h-14 rounded-lg border-2 flex items-center justify-center font-display font-bold text-xl sm:text-2xl ${guessed.includes(ch) ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/40 text-slate-800 dark:text-white' : phase === 'over' ? 'bg-rose-50 border-rose-400 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' : 'border-slate-300 dark:border-slate-700 border-b-4 dark:text-white'}`}>
                    {guessed.includes(ch) ? ch : phase === 'over' ? ch : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {phase === 'play' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('hm_alpha_aria')}>
              {alphabet.map(al => {
                const used = guessed.includes(al)
                const good = used && word.includes(al)
                return (
                  <button key={al} onClick={() => guess(al)} disabled={used}
                    className={`w-10 h-10 sm:w-11 sm:h-11 min-[412px]:w-12 min-[412px]:h-12 rounded-xl font-display font-bold text-lg border-2 transition-colors ${good
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : used
                        ? 'bg-rose-100 border-rose-200 text-rose-400 dark:bg-rose-950/40 dark:border-rose-900'
                        : 'bg-white border-slate-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                    {al}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {phase === 'over' && (
        <div className="text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <div className="text-5xl">🎯</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('hm_lost')}</div>
          <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">{word}</div>
          <div className="text-slate-500 dark:text-slate-400">{t('hm_solved_n')}: {solved}{best ? ` • ${t('hm_best')}: ${best}` : ''}</div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={startGame} className="px-6 py-3 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold inline-flex items-center justify-center gap-2"><RotateCcw size={17} /> {t('hm_again')}</button>
            {custom && (
              <button onClick={exitCustom} className="px-4 py-3 min-h-[52px] rounded-xl bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-bold">✏️ {t('hm_build')}</button>
            )}
          </div>
        </div>
      )}

        {/* стартовый выбор: готовые наборы или свой */}
        {entry === 'pick' && phase === 'idle' && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" data-testid="hm-entry">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-4" data-testid="hm-entry-card">
              <div className="text-center">
                <div className="text-5xl mb-1">🎯</div>
                <div className="font-display font-extrabold text-xl text-slate-900 dark:text-white">{t('gsel_title')}</div>
              </div>
              <button onClick={() => { setEntry('ready'); sfx('ui.click') }}
                className="w-full text-left px-5 py-4 min-h-[84px] rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-500 flex items-center gap-4 transition-colors">
                <span className="text-4xl">🏫</span>
                <span>
                  <span className="block font-extrabold text-lg text-slate-900 dark:text-white">{t('gsel_ready')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('gsel_ready_sub')}</span>
                </span>
              </button>
              <button onClick={() => { setEntry(null); setPanel('build'); sfx('ui.click') }}
                className="w-full text-left px-5 py-4 min-h-[84px] rounded-2xl border-2 border-indigo-400/60 bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-500 flex items-center gap-4 transition-colors">
                <span className="text-4xl">✏️</span>
                <span>
                  <span className="block font-extrabold text-lg text-slate-900 dark:text-white">{t('gsel_build')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('gsel_build_sub')}</span>
                </span>
              </button>
              <button onClick={() => setEntry(null)}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm font-bold">
                {t('gsel_just_play')}
              </button>
            </div>
          </div>
        )}

        {/* готовые коллекции слов */}
        {entry === 'ready' && phase === 'idle' && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto px-4 py-6" data-testid="hm-ready">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl w-full max-w-lg space-y-3" data-testid="hm-ready-card">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-lg dark:text-white">🏫 {t('gsel_ready')}</div>
                <button onClick={() => setEntry(null)} aria-label="×" className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white inline-flex items-center justify-center"><X size={18} /></button>
              </div>
              <div className="grid gap-2">
                {presetBank(lang).map(pr => (
                  <button key={pr.label} onClick={() => { playCustomSilent({ name: pr.label, words: pr.words, lang }); setEntry(null) }}
                    className="w-full text-left px-4 py-3 min-h-[64px] rounded-xl border dark:text-white bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <div className="font-extrabold">{pr.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{pr.words.slice(0, 4).join(' · ')}…</div>
                  </button>
                ))}
              </div>
              {sets.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-sm mb-2 dark:text-white">🗂 {t('hm_my_sets')} ({sets.length})</div>
                  <div className="space-y-1.5 max-h-40 overflow-auto">
                    {sets.map(set => (
                      <button key={set.id} onClick={() => { playCustom(set); setEntry(null) }}
                        className="w-full flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-left">
                        <span className="flex-1 min-w-0 truncate font-bold text-sm dark:text-white">✨ {set.name} <span className="text-slate-400 font-normal">({set.words.length})</span></span>
                        <span className="p-1.5 rounded-lg bg-blue-600 text-white"><Play size={12} /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {panel === 'build' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto px-4 py-6" data-testid="hm-builder">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl w-full max-w-lg space-y-3" data-testid="hm-builder-card">
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-lg dark:text-white">✏️ {t('hm_build')}</div>
              <button onClick={() => setPanel(null)} aria-label="×" className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white inline-flex items-center justify-center"><X size={18} /></button>
            </div>
            <input value={cName} onChange={e => setCName(e.target.value)} placeholder={t('hm_name_ph')}
              className="w-full px-4 py-2.5 min-h-[48px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white font-bold" />
            <textarea value={cWords} onChange={e => { setCWords(e.target.value); setCErr('') }} placeholder={t('hm_words_ph')}
              data-testid="hm-builder-words"
              className="w-full h-24 px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white text-sm" />
            {cErr && <div className="text-sm text-rose-600 dark:text-rose-400 font-bold">⚠️ {cErr}</div>}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-2" data-testid="hm-ai">
              <button onClick={() => { setAiOpen(v => !v); sfx('ui.click') }}
                className="px-3 py-2 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold flex items-center gap-1.5">
                <Sparkles size={15} /> {t('aiw_title')} {aiOpen ? '▾' : '▸'}
              </button>
              {aiOpen && (
                <div className="flex flex-wrap items-center gap-2" data-testid="hm-ai-panel">
                  <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder={t('aiw_ph')}
                    className="flex-1 min-w-[180px] px-3 py-2.5 min-h-[48px] rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-sm" />
                  <input type="number" min={3} max={20} value={aiCount} onChange={e => setAiCount(Math.max(3, Math.min(20, parseInt(e.target.value) || 10)))}
                    aria-label={t('aiw_count')} className="w-16 px-2 py-2.5 min-h-[48px] rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-sm" />
                  <button onClick={genWordsAI} disabled={aiBusy}
                    className="px-4 py-2.5 min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                    {aiBusy ? '⏳' : t('aiw_gen')}
                  </button>
                  {aiSrc && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 w-full">{t('aiw_src')}</span>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={playNow} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-blue-600 text-white font-bold flex items-center gap-1.5"><Play size={15} /> {t('hm_play_set')}</button>
              <button onClick={saveSet} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"><Save size={15} /> {t('hm_save_set')}</button>
              {lessonId && (
                <button onClick={fromLesson} disabled={genBusy} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold flex items-center gap-1.5 disabled:opacity-50">
                  <Sparkles size={15} /> {t('hm_from_lesson')}
                </button>
              )}
            </div>
            <select value={lessonId} onChange={e => setLessonId(e.target.value)} aria-label={t('sprint_pick_lesson')}
              className="w-full px-3 py-2.5 min-h-[48px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] text-sm">
              <option value="">{t('sprint_pick_lesson')}</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {presetBank(lang).map((pr, i) => (
                <button key={i} onClick={() => { setCWords(pr.words.join(', ')); if (!cName.trim()) setCName(pr.label.replace(/^\S+\s/, '')); setCErr(''); sfx('ui.click') }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700">
                  {pr.label}
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="font-bold text-sm mb-2 dark:text-white">🗂 {t('hm_my_sets')} ({sets.length})</div>
              {sets.length === 0 && <div className="text-xs text-slate-400">{t('ws_no_sets')}</div>}
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {sets.map(set => (
                  <div key={set.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                    <span className="flex-1 min-w-0 truncate font-bold text-sm dark:text-white">✨ {set.name} <span className="text-slate-400 font-normal">({set.words.length})</span></span>
                    <button onClick={() => { setPanel(null); playCustom(set) }} aria-label={t('games_play')} className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-blue-600 text-white"><Play size={14} /></button>
                    <button onClick={() => shareSet(set)} aria-label={t('hm_share')} className={`p-2 min-h-[36px] min-w-[36px] rounded-lg ${shared === set.id ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}><Share2 size={14} /></button>
                    <button onClick={() => delSet(set.id)} aria-label={t('ws_del')} className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            {shared && <div className="text-xs text-center font-bold text-emerald-600 dark:text-emerald-400">🔗 {t('hm_shared')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
