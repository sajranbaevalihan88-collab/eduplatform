import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../context/LangContext'
import { sfx } from '../utils/sfx'
import { wordsFromText, WORD_PACKS } from '../utils/words'
import { X, Trash2, Share2, Save, Play, Sparkles } from 'lucide-react'

const hum = (ms: number | number[]) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} }

type Dir = { dx: number; dy: number }
const DIRS: Dir[] = [
  { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 },
  { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
]

const BANKS: Record<string, string[]> = {
  ru: ['КОД', 'ФАЙЛ', 'РОБОТ', 'ПИКСЕЛЬ', 'СЕТКА', 'ЛОГИКА', 'ДАННЫЕ', 'МОДЕЛЬ', 'ГРАФИК', 'ТОЧКА', 'ЦИКЛ', 'АТОМ'],
  kg: ['КОД', 'ФАЙЛ', 'БИЛИМ', 'ТОО', 'ТОР', 'СЕТКА', 'ЛОГИКА', 'ДАНА', 'БАЛА', 'ЭМГЕК', 'ЦИКЛ', 'ГРАФ'],
  en: ['CODE', 'FILE', 'ROBOT', 'PIXEL', 'GRID', 'LOGIC', 'DATA', 'MODEL', 'GRAPH', 'DOT', 'LOOP', 'ATOM'],
}

const SIZE = 10
const rnd = (n: number) => Math.floor(Math.random() * n)
const KG_LETTERS = 'АБВГДЕЖЗИЙКЛМНОӨПРСТУҮФХЦЧШ'
const RU_LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ'
const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const CYR = new Set((RU_LETTERS + KG_LETTERS).split(''))
const CYR_KG_ONLY = new Set('ҮӨҢӨ'.split(''))

function letterPool(lang: string) {
  return lang === 'kg' ? KG_LETTERS : lang === 'en' ? EN_LETTERS : RU_LETTERS
}

function placeWord(grid: (string | null)[][], word: string): { cells: [number, number][] } | null {
  for (let a = 0; a < 200; a++) {
    const d = DIRS[rnd(DIRS.length)]
    const sx = rnd(SIZE), sy = rnd(SIZE)
    const ex = sx + d.dx * (word.length - 1)
    const ey = sy + d.dy * (word.length - 1)
    if (ex < 0 || ex >= SIZE || ey < 0 || ey >= SIZE) continue
    const cells: [number, number][] = []
    let ok = true
    for (let i = 0; i < word.length; i++) {
      const x = sx + d.dx * i, y = sy + d.dy * i
      const cur = grid[y][x]
      if (cur && cur !== word[i]) { ok = false; break }
      cells.push([x, y])
    }
    if (ok) {
      cells.forEach(([x, y], i) => { grid[y][x] = word[i] })
      return { cells }
    }
  }
  return null
}

function buildBoard(lang: string, level: number, customWords?: string[]) {
  let pool: string[]
  if (customWords && customWords.length >= 2) {
    pool = [...customWords]
  } else {
    pool = [...(BANKS[lang] || BANKS.ru)].sort(() => Math.random() - 0.5)
  }
  const want = customWords && customWords.length >= 2
    ? Math.min(12, pool.length)
    : Math.min(4 + Math.floor(level / 2), 8)
  const words: string[] = []
  const src = pool.sort(() => Math.random() - 0.5)
  while (words.length < want && src.length) {
    words.push(src.splice(rnd(src.length), 1)[0])
  }
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null))
  const placed: Record<string, [number, number][]> = {}
  for (const w of words) {
    const p = placeWord(grid, w)
    if (p) placed[w] = p.cells
  }
  const letters = letterPool(lang)
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (!grid[y][x]) grid[y][x] = letters[rnd(letters.length)]
  return { grid: grid as string[][], words, placed, level }
}

type WsSet = { id: string; name: string; words: string[]; lang: string }

const SETS_KEY = 'edu-ws-sets'
function loadSets(): WsSet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SETS_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

const PRESETS: Record<string, { label: string; words: string[] }[]> = {
  ru: [
    { label: '🏫 Школа', words: ['УРОК', 'МЕЛ', 'ПЕРО', 'КНИГА', 'КАРАНДАШ', 'ЛИНЕЙКА', 'ТЕТРАДЬ', 'ЗВОНОК'] },
    { label: '🐶 Животные', words: ['КОШКА', 'СОБАКА', 'КОРОВА', 'ЛОШАДЬ', 'ЛИСА', 'ВОЛК', 'ЗАЯЦ', 'ТЮЛЕНЬ'] },
    { label: '🍎 Еда', words: ['ЯБЛОКО', 'ГРУША', 'АРБУЗ', 'ХЛЕБ', 'СУП', 'КАША', 'МОРКОВЬ', 'ФАСОЛЬ'] },
  ],
  en: [
    { label: '🏫 School', words: ['BOOK', 'PEN', 'DESK', 'SCHOOL', 'PAPER', 'RULER', 'LESSON', 'BELL'] },
    { label: '🐶 Animals', words: ['CAT', 'DOG', 'COW', 'HORSE', 'FOX', 'WOLF', 'RABBIT', 'SHEEP'] },
    { label: '🍎 Food', words: ['APPLE', 'PEAR', 'MELON', 'BREAD', 'SOUP', 'NOODLE', 'CARROT', 'BEANS'] },
  ],
}

// кг-пресеты: слова из реального словаря WORD_PACKS (без выдуманных)
try {
  const kgp = (WORD_PACKS.kg || WORD_PACKS.ru).words
    .filter(w => w.length >= 3 && w.length <= 10)
    .map(w => w.toUpperCase())
  PRESETS.kg = [
    { label: '📖 Сөздөр', words: [...new Set(kgp.slice(0, 10))].slice(0, 8) },
    { label: '📖 Дагы', words: [...new Set(kgp.slice(10, 20))].slice(0, 8) },
  ]
} catch {}

function detectLang(words: string[]): 'ru' | 'kg' | 'en' {
  const join = words.join('')
  if (!/[a-z]/i.test(join)) {
    if (/[үөңс]/i.test(join)) return 'kg'
    return 'ru'
  }
  return 'en'
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

export default function WordSearch() {
  const { t, lang } = useLang()
  const [level, setLevel] = useState(1)
  const [custom, setCustom] = useState<WsSet | null>(null)
  const [round, setRound] = useState(0)
  const [panel, setPanel] = useState<null | 'build'>(null)
  // стартовый выбор «как играем»: pick — мод входа (готовые / свой), ready — встроенные коллекции
  const [entry, setEntry] = useState<null | 'pick' | 'ready'>(null)
  // ИИ-подбор слов в билдере
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiSrc, setAiSrc] = useState<string | null>(null)
  const [sets, setSets] = useState<WsSet[]>(loadSets)
  const [cName, setCName] = useState('')
  const [cWords, setCWords] = useState('')
  const [cErr, setCErr] = useState('')
  const [shared, setShared] = useState('')
  const [lessons, setLessons] = useState<{ id: number; title: string }[]>([])
  const [lessonId, setLessonId] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [board, setBoard] = useState(() => buildBoard('ru', 1))
  const [found, setFound] = useState<Record<string, boolean>>({})
  const [foundCells, setFoundCells] = useState<[number, number][]>([])
  const [selPath, setSelPath] = useState<[number, number][]>([])
  const [dragging, setDragging] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [hintsLeft, setHintsLeft] = useState(3)
  const [hintCell, setHintCell] = useState<[number, number] | null>(null)
  const [secs, setSecs] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('edu-wordsearch-best') || 0))
  const boardRef = useRef<HTMLDivElement>(null)
  const hintTimer = useRef<any>(null)

  const parseInput = (): { words: string[]; lang: string; err: string } => {
    const words = [...new Set(cWords.split(/[\s,;\n]+/).map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0))]
    const fail = (e: string) => ({ words, lang: 'ru', err: e })
    if (words.length < 3) return fail(t('ws_err_few'))
    if (words.length > 12) return fail('≤ 12')
    let langWarned = false
    for (const w of words) {
      if (w.length < 2 || w.length > 10) return fail(`“${w}” — 2–10`)
      const hasCyr = [...w].some(ch => CYR.has(ch))
      const hasLat = /[A-Z]/.test(w)
      if (hasCyr === hasLat) return fail(`“${w}” — ${t('ws_err_mixed')}`)
      if (CYR_KG_ONLY.has(w[0])) langWarned = true
    }
    // весь набор — один алфавит (сетка строится под один язык)
    if (words.some(w => [...w].some(ch => CYR.has(ch))) && words.some(w => /[A-Z]/.test(w)))
      return fail(t('ws_err_mixed'))
    return { words: words.slice(0, 12), lang: detectLang(words), err: '' }
  }

  const applyCustom = (set: WsSet) => {
    setCustom(set)
    setRound(r => r + 1)
    setFound({}); setFoundCells([]); setSelPath([]); setSecs(0)
    setMistakes(0); setHintsLeft(3); setHintCell(null)
    setLevel(0)
  }

  const playSaved = (set: WsSet) => {
    applyCustom(set)
    setPanel(null)
  }

  // вход по ссылке ?c=<набор>
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('c')
    if (q) {
      const json = b64uDecode(q)
      if (json) {
        try {
          const d = JSON.parse(json)
          if (d && Array.isArray(d.words) && d.words.length >= 3) {
            const langs = ['ru', 'kg', 'en'].includes(d.lang) ? d.lang : detectLang(d.words)
            applyCustom({ id: 'shared', name: String(d.name || '✨'), words: d.words.map(String), lang: langs })
            return
          }
        } catch {}
      }
    }
    setEntry('pick')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // уроки для «из урока»
  useEffect(() => {
    import('../api/client').then(({ default: client }) =>
      client.get('/lessons/?owner=me').then(r => {
        const d = Array.isArray(r.data) ? r.data : r.data.results || []
        setLessons(d.slice(0, 40).map((x: any) => ({ id: x.id, title: x.title })))
      }).catch(() => {}))
  }, [])

  // обычные уровни: пересборка
  useEffect(() => {
    if (custom) return
    setBoard(buildBoard(lang, level))
    setFound({}); setFoundCells([]); setSelPath([]); setSecs(0)
    setMistakes(0); setHintsLeft(3); setHintCell(null)
  }, [level, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // кастомный набор: новый раунд при смене round
  useEffect(() => {
    if (!custom) return
    setBoard(buildBoard(custom.lang, 0, custom.words))
    setFound({}); setFoundCells([]); setSelPath([]); setSecs(0)
    setMistakes(0); setHintsLeft(3); setHintCell(null)
  }, [round]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current) }, [])

  const allDone = useMemo(
    () => board.words.length > 0 && board.words.every(w => found[w]),
    [board, found],
  )

  useEffect(() => {
    ;(window as any).__ws = {
      words: board.words, found: Object.keys(found), level: custom ? -1 : level, grid: board.grid,
      mistakes, hints_left: hintsLeft, done: allDone, secs, name: custom?.name || null,
    }
  })

  useEffect(() => {
    const iv = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const cellAt = (e: React.PointerEvent): [number, number] | null => {
    const el = ((e.target as HTMLElement).closest('[data-c]')
      || document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-c]')) as HTMLElement | null
    if (!el) return null
    const [x, y] = (el as HTMLElement).dataset.c!.split(',').map(Number)
    return [x, y]
  }

  const onCellDown = (e: React.PointerEvent) => {
    const c = cellAt(e)
    if (!c) return
    sfx('ws.select')
    setDragging(true)
    setSelPath([c])
  }

  const onCellMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const c = cellAt(e)
    if (!c) return
    setSelPath(p => {
      const [sx, sy] = p[0]
      const dx = c[0] - sx, dy = c[1] - sy
      if (dx === 0 && dy === 0) return p
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return p
      const len = Math.max(Math.abs(dx), Math.abs(dy))
      const ux = Math.sign(dx), uy = Math.sign(dy)
      const path: [number, number][] = []
      for (let i = 0; i <= len; i++) path.push([sx + ux * i, sy + uy * i])
      if (path.length === p.length && path.every((c2, i) => p[i][0] === c2[0] && p[i][1] === c2[1])) return p
      return path
    })
  }

  const finish = () => {
    setDragging(false)
    const path = selPath
    if (path.length < 2) return
    const word = path.map(([x, y]) => board.grid[y][x]).join('')
    const rev = [...word].reverse().join('')
    const hit = board.words.find(w => (w === word || w === rev) && !found[w])
    if (hit) {
      sfx('ws.found')
      hum(15)
      setFound(f => ({ ...f, [hit]: true }))
      setFoundCells(fc => [...fc, ...path])
    } else {
      sfx('ws.wrong')
      hum(60)
      setMistakes(m => m + 1)
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 450)
    }
    setSelPath([])
  }

  const advancedRef = useRef(false)
  useEffect(() => { if (!allDone) advancedRef.current = false }, [allDone])

  const nextLevel = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    sfx('ws.go')
    hum(20)
    if (custom) {
      setRound(r => r + 1)
      return
    }
    setBest(b => {
      const nb = Math.max(b, level)
      try { localStorage.setItem('edu-wordsearch-best', String(nb)) } catch {}
      return nb
    })
    setLevel(l => l + 1)
  }, [level, custom])

  useEffect(() => {
    if (!allDone) return
    sfx('ws.win')
    hum([30, 40, 30])
    const x = setTimeout(nextLevel, 4000)
    return () => clearTimeout(x)
  }, [allDone, nextLevel])

  const useHint = () => {
    if (hintsLeft <= 0 || allDone) return
    const left = board.words.filter(w => !found[w])
    if (!left.length) return
    const w = left[rnd(left.length)]
    const c = board.placed[w]?.[0]
    if (!c) return
    const nl = hintsLeft - 1
    setHintsLeft(nl)
    setHintCell(c)
    sfx('ws.hint')
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHintCell(null), 2000)
  }

  // ——— конструктор набора ———
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
    const p = parseInput()
    if (p.err) { setCErr(p.err); return }
    const set: WsSet = { id: 'u' + Date.now().toString(36), name: (cName.trim() || '✨').slice(0, 40), words: p.words, lang: detectLang(p.words) }
    const next = [set, ...sets].slice(0, 30)
    setSets(next)
    try { localStorage.setItem(SETS_KEY, JSON.stringify(next)) } catch {}
    sfx('fb.chip')
    setCName(''); setCWords(''); setCErr('')
    playSaved(set)
  }

  const playNow = () => {
    const p = parseInput()
    if (p.err) { setCErr(p.err); return }
    const set: WsSet = { id: 'tmp', name: (cName.trim() || '✨').slice(0, 40), words: p.words, lang: detectLang(p.words) }
    applyCustom(set)
    setPanel(null)
  }

  const shareSet = (set: WsSet) => {
    const code = b64uEncode(JSON.stringify({ name: set.name, words: set.words, lang: set.lang }))
    const url = `${location.origin}/games/word-search?c=${code}`
    try {
      navigator.clipboard.writeText(url).then(() => {
        sfx('fb.chip'); hum(15)
        setShared(set.id)
        setTimeout(() => setShared(''), 2200)
      }).catch(() => {
        prompt('🔗', url)
      })
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
      const raw = wordsFromText(parts.join('\n'), 400)
      const words = [...new Set(raw.map(w => w.trim().toUpperCase()).filter(w => w.length >= 3 && w.length <= 10))]
        .slice(0, 10)
      if (words.length < 3) { setCErr(t('ws_err_few')); return }
      setCWords(words.join(', '))
      if (!cName.trim()) setCName(`${t('ws_from_lesson')}: ${String(r.data.title || '').slice(0, 20)}`)
      sfx('hm.hint')
    } catch { setCErr('⚠️') } finally { setGenBusy(false) }
  }

  const inSel = useCallback((x: number, y: number) => selPath.some(c => c[0] === x && c[1] === y), [selPath])
  const inFound = useCallback((x: number, y: number) => foundCells.some(c => c[0] === x && c[1] === y), [foundCells])

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-slate-100 dark:bg-slate-950 px-3 py-6 lg:px-8" data-page="wordsearch">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
            {t('hm_to_games')}
          </a>
        </div>
        <h1 className="text-3xl font-extrabold text-center mb-1 text-slate-900 dark:text-white">🔎 {t('games_wordsearch')}</h1>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-4">{custom ? `✨ ${custom.name}` : t('ws_sub')}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-4 text-sm font-bold text-slate-700 dark:text-slate-200">
          {!custom && <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{t('ws_level')}: {level}</span>}
          {custom && (
            <button onClick={() => { setPanel('build'); setCErr(''); sfx('ui.click') }}
              className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1">
              ✏️ {t('ws_build')}
            </button>
          )}
          <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">⏱ {t('ws_time')}: {secs}</span>
          <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">❌ {t('ws_mist')}: {mistakes}</span>
          {!custom && <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">🏆 {t('games_best')}: {best}</span>}
          <button onClick={useHint} disabled={hintsLeft <= 0 || allDone} aria-label={t('ws_hint')}
            className="px-3 py-1.5 min-h-[40px] rounded-lg bg-amber-400 text-amber-950 border border-amber-500 font-bold flex items-center gap-1 disabled:opacity-40">
            💡 {t('ws_hint')} ×{hintsLeft}
          </button>
          {!custom && (
            <button onClick={() => { setPanel('build'); setCErr(''); sfx('ui.click') }}
              className="px-3 py-1.5 min-h-[40px] rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform">
              ✏️ {t('ws_build')}
            </button>
          )}
        </div>
        <div className={wrongFlash ? 'animate-pulse' : ''}>
          <div ref={boardRef} className="grid mx-auto select-none touch-none bg-white dark:bg-slate-900 rounded-2xl p-1.5 sm:p-2 shadow-lg border border-slate-200 dark:border-slate-700"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, maxWidth: 560 }}
            onPointerDown={onCellDown} onPointerMove={onCellMove} onPointerUp={finish} onPointerCancel={finish}>
            {board.grid.map((row, y) => row.map((ch, x) => {
              const f = inFound(x, y), s = inSel(x, y)
              const isHint = !!hintCell && hintCell[0] === x && hintCell[1] === y
              return (
                <div key={`${x},${y}`} data-c={`${x},${y}`}
                  className={`flex items-center justify-center aspect-square font-bold uppercase transition-colors text-base sm:text-xl ${f ? 'bg-emerald-400 dark:bg-emerald-500 text-white' : s ? 'bg-indigo-400 dark:bg-indigo-500 text-white' : 'text-slate-700 dark:text-slate-300'} ${wrongFlash && s ? 'bg-rose-400' : ''} ${isHint ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/30' : ''}`}>
                  {ch}
                </div>
              )
            }))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-4" data-testid="ws-words">
          {board.words.map(w => (
            <span key={w} className={`px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold tracking-wide ${found[w] ? 'line-through bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'}`}>{w}</span>
          ))}
        </div>
        {allDone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" data-testid="ws-done">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 text-center shadow-2xl w-full max-w-sm" data-testid="ws-done-card">
              <div className="text-6xl mb-3">🎉</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('ws_done')}</div>
              <div className="mt-2 text-slate-500 dark:text-slate-400 flex justify-center gap-4 flex-wrap">
                {custom ? <span>✨ {custom.name}</span> : <span>{t('ws_level')}: {level}</span>}
                <span>⏱ {secs}{t('ws_sec')}</span>
                <span>❌ {mistakes}</span>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button onClick={nextLevel}
                  className="flex-1 px-6 py-3 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold text-lg">
                  {t('ws_next')} →
                </button>
                {custom && (
                  <button onClick={() => { setPanel('build'); setCErr(''); }}
                    className="px-4 py-3 min-h-[56px] rounded-2xl bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-bold">
                    ✏️ {t('ws_build')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* стартовый выбор: готовые наборы или свой */}
        {entry === 'pick' && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" data-testid="ws-entry">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-4" data-testid="ws-entry-card">
              <div className="text-center">
                <div className="text-5xl mb-1">🔎</div>
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

        {/* готовые коллекции */}
        {entry === 'ready' && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto px-4 py-6" data-testid="ws-ready">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl w-full max-w-lg space-y-3" data-testid="ws-ready-card">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-lg dark:text-white">🏫 {t('gsel_ready')}</div>
                <button onClick={() => setEntry(null)} aria-label="×" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white"><X size={18} /></button>
              </div>
              <div className="grid gap-2">
                {(PRESETS[lang] || PRESETS.ru).map(pr => (
                  <button key={pr.label} onClick={() => { playSaved({ id: 'preset', name: pr.label.replace(/^\S+\s/, ''), words: pr.words, lang }); setEntry(null) }}
                    className="w-full text-left px-4 py-3 min-h-[64px] rounded-xl border dark:text-white bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <div className="font-extrabold">{pr.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{pr.words.slice(0, 4).join(' · ')}…</div>
                  </button>
                ))}
              </div>
              {sets.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-sm mb-2 dark:text-white">🗂 {t('ws_my_sets')} ({sets.length})</div>
                  <div className="space-y-1.5 max-h-40 overflow-auto">
                    {sets.map(set => (
                      <button key={set.id} onClick={() => { playSaved(set); setEntry(null) }}
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
          <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto px-4 py-6" data-testid="ws-builder">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl w-full max-w-lg space-y-3" data-testid="ws-builder-card">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-lg dark:text-white">✏️ {t('ws_build')}</div>
                <button onClick={() => setPanel(null)} aria-label="×" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white"><X size={18} /></button>
              </div>
              <input value={cName} onChange={e => setCName(e.target.value)} placeholder={t('ws_name_ph')}
                className="w-full px-4 py-2.5 min-h-[48px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white font-bold" />
              <textarea value={cWords} onChange={e => { setCWords(e.target.value); setCErr('') }} placeholder={t('ws_words_ph')}
                data-testid="ws-builder-words"
                className="w-full h-24 px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white text-sm" />
              {cErr && <div className="text-sm text-rose-600 dark:text-rose-400 font-bold">⚠️ {cErr}</div>}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-2" data-testid="ws-ai">
                <button onClick={() => { setAiOpen(v => !v); sfx('ui.click') }}
                  className="px-3 py-2 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold flex items-center gap-1.5">
                  <Sparkles size={15} /> {t('aiw_title')} {aiOpen ? '▾' : '▸'}
                </button>
                {aiOpen && (
                  <div className="flex flex-wrap items-center gap-2" data-testid="ws-ai-panel">
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
                <button onClick={playNow} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-blue-600 text-white font-bold flex items-center gap-1.5"><Play size={15} /> {t('ws_play_set')}</button>
                <button onClick={saveSet} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"><Save size={15} /> {t('ws_save_set')}</button>
                {lessonId && (
                  <button onClick={fromLesson} disabled={genBusy} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold flex items-center gap-1.5 disabled:opacity-50">
                    <Sparkles size={15} /> {t('ws_from_lesson')}
                  </button>
                )}
              </div>
              <select value={lessonId} onChange={e => setLessonId(e.target.value)} aria-label={t('sprint_pick_lesson')}
                className="w-full px-3 py-2.5 min-h-[48px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] text-sm">
                <option value="">{t('sprint_pick_lesson')}</option>
                {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              <div className="flex flex-wrap gap-1.5">
                {(PRESETS[lang] || PRESETS.ru).map((pr) => (
                  <button key={pr.label} onClick={() => { setCWords(pr.words.join(', ')); if (!cName.trim()) setCName(pr.label.replace(/^\S+\s/, '')); setCErr(''); sfx('ui.click') }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700">
                    {pr.label}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="font-bold text-sm mb-2 dark:text-white">🗂 {t('ws_my_sets')} ({sets.length})</div>
                {sets.length === 0 && <div className="text-xs text-slate-400">{t('ws_no_sets')}</div>}
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {sets.map(set => (
                    <div key={set.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                      <span className="flex-1 min-w-0 truncate font-bold text-sm dark:text-white">✨ {set.name} <span className="text-slate-400 font-normal">({set.words.length})</span></span>
                      <button onClick={() => playSaved(set)} aria-label={t('games_play')} className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-blue-600 text-white"><Play size={14} /></button>
                      <button onClick={() => shareSet(set)} aria-label={t('ws_share')} className={`p-2 min-h-[36px] min-w-[36px] rounded-lg ${shared === set.id ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}><Share2 size={14} /></button>
                      <button onClick={() => delSet(set.id)} aria-label={t('ws_del')} className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
              {shared && <div className="text-xs text-center font-bold text-emerald-600 dark:text-emerald-400">🔗 {t('ws_shared')}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
