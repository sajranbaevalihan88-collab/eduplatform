import { useRef, useState, lazy, Suspense } from 'react'
import { useLang } from '../context/LangContext'
import { sfx } from '../utils/sfx'

const FarmerField3D = lazy(() => import('./FarmerField3D'))

type Crop = 'carrot' | 'pumpkin'
type Cell = Crop | null
type Pad = { fn: 'move' | 'harvest' | 'plant' | 'print'; n?: number | string; ln: number }

const W = 6, H = 5

type CH = {
  icon: string
  name: Record<string, string>
  concept: Record<string, string>
  task: Record<string, string>
  code: string
  goal: { carrots?: number; pumpkins?: number; printed?: string }
  seed: [number, number, Crop][]
}

const ROW = (): [number, number, Crop][] => Array.from({ length: W }, (_, x) => [x, 0, 'carrot' as Crop])

const CHAPTERS: CH[] = [
  {
    icon: '🌱',
    name: { ru: 'Первые шаги', en: 'First steps', kg: 'Биринчи кадамдар' },
    concept: {
      ru: 'Код выполняется строка за строкой: move() — шаг вперёд, harvest() — собрать урожай.',
      en: 'Code runs line by line: move() steps forward, harvest() collects the crop.',
      kg: 'Код сап сап менен аткарылат: move() — бир кадам, harvest() — түшүм жыйноо.',
    },
    task: { ru: 'Собери 1 морковь', en: 'Harvest 1 carrot', kg: '1 сабизди жыйна' },
    code: "move()\nmove()\nharvest()",
    goal: { carrots: 1 },
    seed: [[2, 0, 'carrot']],
  },
  {
    icon: '🔁',
    name: { ru: 'Цикл for', en: 'for loop', kg: 'for цикли' },
    concept: {
      ru: 'for i in range(n): — повторяет следующие строки n раз. Один цикл вместо пяти строк!',
      en: 'for i in range(n): repeats the next lines n times. One loop instead of five lines!',
      kg: 'for i in range(n): — кийинки саптарды n жолу кайталайт.',
    },
    task: { ru: 'Собери целый ряд — 6 морковей', en: 'Harvest the whole row — 6 carrots', kg: 'Бүт катарды жыйна — 6 сабиз' },
    code: "harvest()\nfor i in range(5):\n    move()\n    harvest()",
    goal: { carrots: 6 },
    seed: ROW(),
  },
  {
    icon: '🥬',
    name: { ru: 'Посадка', en: 'Planting', kg: 'Экспөө' },
    concept: {
      ru: "plant('carrot') сажает морковь в свою клетку. Посаженное можно сразу собрать.",
      en: "plant('carrot') seeds a carrot in the current cell.",
      kg: "plant('carrot') өз клеткага сабиз экспөт.",
    },
    task: { ru: 'Посади и собери морковь', en: 'Plant and harvest a carrot', kg: 'Эксп көр, сабизди жыйна' },
    code: "plant('carrot')\nharvest()",
    goal: { carrots: 1 },
    seed: [],
  },
  {
    icon: '🎃',
    name: { ru: 'Тыквы', en: 'Pumpkins', kg: 'Кабактар' },
    concept: {
      ru: "plant('pumpkin') — тыква вырастает медленнее, но стоит дороже. Как её собрать?",
      en: "plant('pumpkin') — a pumpkin grows slowly but is worth more.",
      kg: "plant('pumpkin') — кабак жай өсөт, бирок кымбат.",
    },
    task: { ru: 'Собери 2 тыквы', en: 'Harvest 2 pumpkins', kg: '2 кабак жыйна' },
    code: "plant('pumpkin')\nharvest()\nmove()\nplant('pumpkin')\nharvest()",
    goal: { pumpkins: 2 },
    seed: [],
  },
  {
    icon: '💧',
    name: { ru: 'print() и отчёт', en: 'print() report', kg: 'print() жана отчёт' },
    concept: {
      ru: "print('текст') выводит строку в терминал — так посредник проверяет работу фермы.",
      en: "print('text') writes a line to the terminal.",
      kg: "print('текст') терминалга сап жазат.",
    },
    task: { ru: "Напечатай отчёт «Урожай готов» и собери 1 морковь", en: "Print «Урожай готов» and harvest 1 carrot", kg: "«Урожай готов» чыгар да, 1 сабиз жыйна" },
    code: "print('Урожай готов')\nharvest()",
    goal: { printed: 'Урожай готов', carrots: 1 },
    seed: [[0, 0, 'carrot']],
  },
  {
    icon: '🍎',
    name: { ru: 'Полный день', en: 'Full day', kg: 'Толук күн' },
    concept: {
      ru: 'Соедини всё изученное: цикл идёт по полю, ты собираешь и печатаешь отчёт за день.',
      en: 'Combine everything: a loop walks the field, harvests and prints the day report.',
      kg: 'Баарын бириктир: цикл талааны аралап, түшүм жана отчёт баса бекит.',
    },
    task: { ru: 'Собери весь ряд (6 морковей) и напечатай отчёт', en: 'Harvest the row (6 carrots) and print the report', kg: 'Катарды жыйна (6 сабиз) да отчёт жаз' },
    code: "harvest()\nfor i in range(5):\n    move()\n    harvest()\nprint('День готов!')",
    goal: { carrots: 6, printed: 'День готов' },
    seed: ROW(),
  },
  {
    icon: '🏆',
    name: { ru: 'Супер-день', en: 'Super day', kg: 'Супер күн' },
    concept: {
      ru: 'Финал: собери весь ряд морковей, посади на освободившуюся клетку тыкву и сдай отчёт за день.',
      en: 'Final: harvest the whole row, plant a pumpkin on a freed cell and file the report.',
      kg: 'Финал: катарды жыйна, бош клеткага кабак экспө, отчёт бериң.',
    },
    task: { ru: 'Собери 6 морковей + 1 тыкву и напечатай отчёт', en: 'Harvest 6 carrots + 1 pumpkin and print the report', kg: '6 сабиз + 1 кабак жыйналы, отчёт жаз' },
    code: "harvest()\nfor i in range(5):\n    move()\n    harvest()\nplant('pumpkin')\nharvest()\nprint('День готов!')",
    goal: { carrots: 6, pumpkins: 1, printed: 'День готов' },
    seed: ROW(),
  },
]

type FState = {
  x: number; y: number; grid: Cell[][]; out: string[]; carrots: number; pumpkins: number; msg: string; done: boolean
}

const mkState = (seed: [number, number, Crop][]): FState => {
  const grid = Array.from({ length: H }, () => Array<Cell>(W).fill(null))
  for (const [sx, sy, c] of seed) grid[sy][sx] = c
  return {
    x: 0, y: 0, grid,
    out: [], carrots: 0, pumpkins: 0, msg: '', done: false,
  }
}

function parseCode(src: string): { ops: Pad[]; err: string | null } {
  const lines = src.split('\n')
  let i = 0
  const ops: Pad[] = []
  const cmd = (txt: string, ln: number): string | null => {
    const m = /^(move|harvest|plant|print)\s*\(\s*(.*?)\s*\)\s*$/.exec(txt)
    if (!m) return `Строка ${ln}: непонятная команда «${txt.slice(0, 40)}»`
    const fn = m[1] as Pad['fn'], arg = m[2]
    if (fn === 'move') ops.push({ fn, n: Math.min(50, Math.max(1, Math.round(Number(arg) || 1))), ln })
    else if (fn === 'harvest') ops.push({ fn, ln })
    else if (fn === 'plant') {
      if (!/carrot|pumpkin/.test(arg)) return `Строка ${ln}: plant('carrot') или plant('pumpkin')`
      ops.push({ fn, n: arg.includes('pumpkin') ? 'pumpkin' : 'carrot', ln })
    } else ops.push({ fn, n: String(arg).replace(/^['"]|['"]$/g, ''), ln })
    return null
  }
  const block = (ind: number): string | null => {
    while (i < lines.length) {
      const raw = lines[i]
      if (!raw.trim()) { i++; continue }
      const indent = raw.search(/\S/)
      if (indent < ind) return null
      const ln = i + 1
      const loopM = /^(?:for\s+\w+\s+in\s+range\((\d+)\)|repeat\((\d+)\))\s*:?\s*$/.exec(raw.trim())
      if (loopM) {
        const times = Number(loopM[1] || loopM[2] || 0)
        if (times < 1 || times > 50) return `Строка ${ln}: повтори от 1 до 50`
        i++
        const from = ops.length
        const e = block(ind + 1)
        if (e) return e
        const body = ops.splice(from)
        if (!body.length) return `Строка ${ln}: в цикле нет команд`
        if (body.length * times > 400) return 'Слишком много команд (до 400)'
        for (let r = 0; r < times; r++) for (const o of body) ops.push({ ...o })
        continue
      }
      const e = cmd(raw.trim(), ln)
      if (e) return e
      i++
    }
    return null
  }
  const err = block(0)
  if (err) return { ops: [], err }
  if (!ops.length) return { ops: [], err: 'Программа пуста' }
  return { ops, err: null }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Weather = { icon: string; name: Record<string, string>; multAll: number; multPumpkin: number }
const WEATHERS: Weather[] = [
  { icon: '☀️', name: { ru: 'Солнечно', en: 'Sunny', kg: 'Күндүү' }, multAll: 1, multPumpkin: 1 },
  { icon: '🌧️', name: { ru: 'Дождь: тыквы ×2', en: 'Rain: pumpkins ×2', kg: 'Жаан: кабак ×2' }, multAll: 1, multPumpkin: 2 },
  { icon: '🌈', name: { ru: 'Радуга: всё ×2', en: 'Rainbow: everything ×2', kg: 'Кайырма: баары ×2' }, multAll: 2, multPumpkin: 2 },
]

export default function FarmerBala() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState<'tree' | 'farm'>('tree')
  const [ch, setCh] = useState(() => Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1))
  const [stars, setStars] = useState(() => Number(localStorage.getItem('edu-farmer-best') || 0))
  const [st, setSt] = useState<FState>(() => mkState(CHAPTERS[Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)].seed))
  const [code, setCode] = useState(() => CHAPTERS[Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)].code)
  const [err, setErr] = useState<string | null>(null)
  // веселье: очки дня, серия, погода дня, всплывающий "+N", день номер
  const [pts, setPts] = useState(0)
  const [combo, setCombo] = useState({ n: 0, max: 0 })
  const [wI, setWI] = useState(() => Math.floor(Math.random() * WEATHERS.length))
  const [float, setFloat] = useState<{ txt: string; cls: string; key: number } | null>(null)
  const [dayNo, setDayNo] = useState(1)
  const [is3d, setIs3d] = useState(true)
  const [dayBest, setDayBest] = useState(() => Number(localStorage.getItem('edu-farmer-daybest-' + Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)) || 0))
  const t0Ref = useRef(0)
  const [fastBonus, setFastBonus] = useState(false)
  const stopRef = useRef(false)
  const latRef = useRef(0)
  const weather = WEATHERS[wI % WEATHERS.length]
  ;(window as any).__fb = { ch, carrots: st.carrots, pumpkins: st.pumpkins, out: st.out, done: st.done, msg: st.msg, stars, chapters: CHAPTERS.length, pts, combo: combo.max }

  const openChapter = (i: number) => {
    setCh(i); setCode(CHAPTERS[i].code); setErr(null)
    setSt(mkState(CHAPTERS[i].seed)); setTab('farm')
    setWI(Math.floor(Math.random() * WEATHERS.length))
    setPts(0); setCombo({ n: 0, max: 0 }); setFloat(null); setDayNo(d => d + 1)
    setDayBest(Number(localStorage.getItem('edu-farmer-daybest-' + i) || 0))
    setFastBonus(false)
  }

  const reset = () => { stopRef.current = true; setErr(null); setSt(mkState(CHAPTERS[ch].seed)); setPts(0); setCombo({ n: 0, max: 0 }); setFloat(null); setFastBonus(false) }

  const run = async () => {
    stopRef.current = true
    await sleep(30)
    const parsed = parseCode(code)
    if (parsed.err) { setErr(parsed.err); sfx('cm.wrong'); return }
    setErr(null)
    const s0 = mkState(CHAPTERS[ch].seed)
    setSt(s0)
    setPts(0); setCombo({ n: 0, max: 0 })
    t0Ref.current = Date.now()
    stopRef.current = false
    let s = s0
    let cpts = 0
    let ccombo = 0
    let cmax = 0
    for (const op of parsed.ops) {
      if (stopRef.current) return
      await sleep(360)
      if (stopRef.current) return
      try {
        if (op.fn === 'move') {
          const k = Number(op.n) || 1
          if (s.x + k >= W) throw new Error(`Строка ${op.ln}: фермер упёл за край фермы`)
          s = { ...s, x: s.x + k }
          latRef.current = op.ln
          sfx('ws.select', 0.35)
        } else if (op.fn === 'harvest') {
          const cell = s.grid[s.y][s.x]
          if (!cell) throw new Error(`Строка ${op.ln}: здесь нечего собирать`)
          ccombo++
          cmax = Math.max(cmax, ccombo)
          const mult = (c: number) => 1 + Math.min(2, (c - 1) * 0.25)
          const gained = Math.round((cell === 'carrot' ? 10 : 25) * weather.multAll * (cell === 'pumpkin' ? weather.multPumpkin : 1) * mult(ccombo))
          cpts += gained
          setFloat({ txt: `+${gained}`, cls: cell === 'pumpkin' ? 'text-fuchsia-300' : 'text-amber-300', key: Date.now() })
          s = {
            ...s,
            grid: s.grid.map((row, yy) => yy === s.y ? row.map((c, xx) => xx === s.x ? null : c) : row),
            carrots: cell === 'carrot' ? s.carrots + 1 : s.carrots,
            pumpkins: cell === 'pumpkin' ? s.pumpkins + 1 : s.pumpkins,
          }
          if (ccombo === 3 || ccombo === 5) sfx('fb.big')
          else sfx(cell === 'pumpkin' ? 'fb.big' : 'fb.pick')
        } else if (op.fn === 'plant') {
          if (s.grid[s.y][s.x]) throw new Error(`Строка ${op.ln}: клетка занята`)
          const c: Crop = op.n === 'pumpkin' ? 'pumpkin' : 'carrot'
          s = { ...s, grid: s.grid.map((row, yy) => yy === s.y ? row.map((cc, xx) => xx === s.x ? c : cc) : row) }
          sfx('fb.plant')
        } else {
          s = { ...s, out: [...s.out, String(op.n)] }
          sfx('fb.print')
        }
        setPts(cpts)
        setCombo(prev => {
          const n = ccombo, max = Math.max(prev.max, cmax)
          return prev.n === n && prev.max === max ? prev : { n, max }
        })
        setSt(s)
      } catch (e: any) {
        sfx('cm.wrong')
        setCombo({ n: 0, max: cmax })
        setSt({ ...s, msg: e.message })
        return
      }
    }
    const g = CHAPTERS[ch].goal
    const ok = (g.carrots === undefined || s.carrots >= g.carrots)
      && (g.pumpkins === undefined || s.pumpkins >= g.pumpkins)
      && (g.printed === undefined || s.out.some(o => o.includes(g.printed!)))
    if (ok) {
      sfx('fb.level')
      const ns = stars + 1
      setStars(ns)
      localStorage.setItem('edu-farmer-best', String(ns))
      localStorage.setItem('edu-farmer-max', String(Math.min(ch + 1, CHAPTERS.length - 1)))
      // ⚡ бонус за быстрый день + 🏆 рекорд дня
      const fast = (Date.now() - t0Ref.current) < 6000
      const bonus = fast ? 30 : 0
      if (fast) setTimeout(() => setFloat({ txt: '⚡ +30', cls: 'text-cyan-300', key: Date.now() }), 350)
      const fpts = cpts + bonus
      setPts(fpts)
      const prevBest = Number(localStorage.getItem('edu-farmer-daybest-' + ch) || 0)
      if (fpts > prevBest) {
        localStorage.setItem('edu-farmer-daybest-' + ch, String(fpts))
        setDayBest(fpts)
      }
      setFastBonus(fast)
      setSt({ ...s, done: true, msg: '' })
    } else {
      sfx('fb.print')
      setSt({ ...s, msg: '' })
    }
  }

  const unlocked = (i: number) => i === 0 || stars >= i
  const finished = (i: number) => Number(localStorage.getItem('edu-farmer-max') || 0) > i
  const starNow = Math.min(stars, CHAPTERS.length)

  const insertChip = (s: string, raw = false) => {
    sfx('fb.chip')
    try { navigator.vibrate && navigator.vibrate(10) } catch {}
    setCode(c => (raw ? c : c + (c.endsWith('\n') || c === '' ? '' : '\n')) + s)
  }

  const CHIPS: [string, string, boolean?][] = [
    ['move()', 'move()'],
    ['harvest()', 'harvest()'],
    ['🥕', "plant('carrot')"],
    ['🎃', "plant('pumpkin')"],
    ['print()', "print('...')"],
    ['for i in range(5):', 'for i in range(5):'],
    ['⎵ (отступ)', '\n    ', true],
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-emerald-900 to-emerald-950 px-2 py-4 sm:px-3 lg:px-8 sm:py-6" data-page="farmer">
      <div className="max-w-5xl mx-auto">
        <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-400">
          {t('hm_to_games')}
        </a>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-center mb-1 text-white">🧑‍🌾 {t('games_farmer')}</h1>
        <p className="text-center text-emerald-200/80 mb-3 sm:mb-4 text-sm sm:text-base">{t('fb_sub')}</p>
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          <button onClick={() => setTab('tree')} className={`px-4 py-2 rounded-xl font-bold min-h-[44px] ${tab === 'tree' ? 'bg-amber-400 text-emerald-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}>🌳 {t('fb_tree')}</button>
          <button onClick={() => setTab('farm')} className={`px-4 py-2 rounded-xl font-bold min-h-[44px] ${tab === 'farm' ? 'bg-amber-400 text-emerald-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}>🚜 {t('fb_farm')}</button>
          <span className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold min-h-[44px] flex items-center">⭐ {starNow}/{CHAPTERS.length}</span>
        </div>

        {tab === 'tree' && (
          <div className="grid gap-3 sm:grid-cols-2 max-w-3xl mx-auto" data-testid="fb-tree">
            {CHAPTERS.map((c, i) => {
              const u = unlocked(i), f = finished(i)
              return (
                <button key={i} disabled={!u} onClick={() => openChapter(i)}
                  className={`text-left rounded-2xl p-4 border transition-all ${!u ? 'bg-white/5 border-white/10 text-emerald-200/40 cursor-not-allowed' : f ? 'bg-emerald-500/20 border-emerald-400/50 text-white hover:bg-emerald-500/30' : 'bg-white/10 border-amber-300/40 text-white hover:bg-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{u ? (f ? '✅' : c.icon) : '🔒'}</span>
                    <div>
                      <div className="font-extrabold">{c.name[lang] || c.name.ru}</div>
                      <div className="text-xs opacity-70">{u ? (f ? t('fb_done') : t('fb_open')) : t('fb_locked')}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs leading-snug opacity-80">{u ? (c.concept[lang] || c.concept.ru) : '? ? ?'}</div>
                </button>
              )
            })}
          </div>
        )}

        {tab === 'farm' && (
          <div className="grid lg:grid-cols-2 gap-4" data-testid="fb-farm">
            <div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-white mb-3" data-testid="fb-task">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-2xl">{CHAPTERS[ch].icon}</span>
                  <span className="font-extrabold text-sm">{t('fb_task')}: {CHAPTERS[ch].task[lang] || CHAPTERS[ch].task.ru}</span>
                  <span className="ml-auto shrink-0 px-2 py-1 rounded-lg bg-white/10 text-xs font-bold whitespace-nowrap" data-testid="fb-weather" title={weather.name[lang] || weather.name.ru}>
                    <span className="fb-hop">{weather.icon}</span> {weather.name[lang] || weather.name.ru} · {t('fb_day')} {dayNo}
                  </span>
                </div>
                <div className="text-xs opacity-70">{CHAPTERS[ch].concept[lang] || CHAPTERS[ch].concept.ru}</div>
                <div className="mt-2 flex gap-2 text-sm font-bold" data-testid="fb-goal">
                  <span className={`px-2 py-1 rounded-lg ${CHAPTERS[ch].goal.carrots !== undefined && st.carrots >= CHAPTERS[ch].goal.carrots ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🥕 {st.carrots}{CHAPTERS[ch].goal.carrots !== undefined ? `/${CHAPTERS[ch].goal.carrots}` : ''}</span>
                  <span className={`px-2 py-1 rounded-lg ${CHAPTERS[ch].goal.pumpkins !== undefined && st.pumpkins >= CHAPTERS[ch].goal.pumpkins ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🎃 {st.pumpkins}{CHAPTERS[ch].goal.pumpkins !== undefined ? `/${CHAPTERS[ch].goal.pumpkins}` : ''}</span>
                  {CHAPTERS[ch].goal.printed !== undefined && (
                    <span className={`px-2 py-1 rounded-lg ${st.out.some(o => o.includes(CHAPTERS[ch].goal.printed!)) ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🖨 {CHAPTERS[ch].goal.printed}</span>
                  )}
                </div>
              </div>
              <div className="relative" data-testid="fb-grid">
                <div className="flex justify-end mb-1.5">
                  <button onClick={() => { setIs3d(v => !v); sfx('fb.chip') }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20"
                    data-testid="fb-3d-toggle">
                    {is3d ? `⬅ ${t('fb_2d')}` : `🧊 ${t('fb_3d')}`}
                  </button>
                </div>
                {is3d ? (
                  <Suspense fallback={<div className="rounded-2xl bg-emerald-700/60 border-4 border-emerald-600 p-2 text-white/70 text-xs" style={{ minHeight: 300 }}>🧊 …</div>}>
                    <FarmerField3D
                      st={st}
                      wx={weather.icon === '☀️' ? 'sun' : weather.icon === '🌧️' ? 'rain' : 'rainbow'}
                      stopped={st.done}
                      celebrate={st.done}
                    />
                  </Suspense>
                ) : (
                  <div className="relative rounded-2xl bg-emerald-700/60 border-4 border-emerald-600 p-2 shadow-inner">
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${W},minmax(0,1fr))` }}>
                      {Array.from({ length: H }).flatMap((_, y) =>
                        Array.from({ length: W }).map((_, x) => {
                          const cell = st.grid[y][x]
                          const me = st.x === x && st.y === y
                          return (
                            <div key={`${x}-${y}`} data-cell={`${x},${y}`}
                              className={`relative aspect-square rounded-lg flex items-center justify-center text-2xl md:text-3xl ${me ? 'bg-amber-300/30 ring-2 ring-amber-300' : 'bg-emerald-600/40'}`}>
                              {me ? <span className="fb-hop" data-testid="fb-me">🧑‍🌾</span> : ''}
                              {cell && <span className="absolute bottom-0 right-0 text-xl">{cell === 'carrot' ? '🥕' : '🎃'}</span>}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
                {float && (
                  <div key={float.key} className={`fb-float pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 text-2xl font-extrabold drop-shadow-lg ${float.cls}`} data-testid="fb-float">{float.txt}</div>
                )}
                {combo.n >= 3 && !st.done && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-fuchsia-600/80 text-white text-xs font-extrabold shadow" data-testid="fb-combo">🔥 {t('fb_combo')} ×{combo.n}</div>
                )}
              </div>
              <pre className="mt-3 rounded-xl bg-black/40 text-emerald-200 text-sm p-3 min-h-[92px] whitespace-pre-wrap" data-testid="fb-out">{st.out.length ? st.out.join('\n') : '> _'}</pre>
            </div>
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                <span className="font-mono">Python 🐍</span>
                <span className="flex gap-1 font-mono">
                  <span className="px-2 py-0.5 rounded bg-white/10">move()</span>
                  <span className="px-2 py-0.5 rounded bg-white/10">harvest()</span>
                  <span className="px-2 py-0.5 rounded bg-white/10">plant('carrot')</span>
                  <span className="px-2 py-0.5 rounded bg-white/10">print()</span>
                </span>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
                className="flex-1 min-h-[190px] w-full rounded-xl bg-[#0b1220] text-emerald-100 font-mono text-base sm:text-sm p-3 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/60" data-testid="fb-code" />
              {err && <div className="mt-2 text-rose-300 text-sm font-semibold" data-testid="fb-err">{err}</div>}
              {st.msg && <div className="mt-2 text-amber-300 text-sm font-semibold" data-testid="fb-msg">⚠ {st.msg}</div>}
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" data-testid="fb-chips" role="group" aria-label={t('fb_chips')}>
                {CHIPS.map(([label, ins, raw], i) => (
                  <button key={i} onClick={() => insertChip(ins, !!raw)} title={ins}
                    className="px-2.5 py-2 min-h-[44px] rounded-xl bg-white/10 text-emerald-100 font-mono text-xs border border-white/10 active:scale-95 shrink-0">
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={run} className="flex-1 py-3 rounded-xl font-extrabold bg-amber-400 text-emerald-950 hover:bg-amber-300 min-h-[44px]" data-testid="fb-run">▶ {t('fb_run')}</button>
                <button onClick={reset} className="px-4 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 min-h-[44px]">{t('fb_reset')}</button>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:gap-3 text-sm text-white/80" data-testid="fb-res">
                <span>🥕 {st.carrots}</span><span>🎃 {st.pumpkins}</span>
                <span className="ml-auto font-extrabold text-amber-300" data-testid="fb-pts">🏅 {pts}</span>
                {combo.max >= 3 && <span className="font-bold text-fuchsia-300">🔥 {t('fb_sery')}: {combo.max}</span>}
                {dayBest > 0 && <span className="font-bold text-emerald-300" data-testid="fb-best" title={t('fb_best_hint')}>🏆 {dayBest}</span>}
              </div>
            </div>
          </div>
        )}

        {st.done && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" data-testid="fb-done">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 text-center shadow-2xl max-w-sm w-full">
              <div className="text-5xl sm:text-6xl mb-3 fb-hop">⭐</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{t('fb_done2')}</div>
              <div className="mt-2 text-slate-500 dark:text-slate-400">+1 ⭐ · {t('fb_total')}: {stars}</div>
              <div className="mt-2 flex justify-center gap-2 flex-wrap text-sm font-bold" data-testid="fb-final">
                <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700">🏅 {pts}</span>
                {fastBonus && <span className="px-2 py-1 rounded-lg bg-cyan-100 text-cyan-700" data-testid="fb-fast">⚡ {t('fb_fast')}</span>}
                {combo.max >= 3 && <span className="px-2 py-1 rounded-lg bg-fuchsia-100 text-fuchsia-700">🔥 ×{combo.max}</span>}
                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">{weather.icon} {weather.name[lang] || weather.name.ru}</span>
              </div>
              <button onClick={() => { setSt(s => ({ ...s, done: false })); setTab('tree') }} className="mt-4 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold min-h-[44px] w-full sm:w-auto">🌳 {t('fb_tonext')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
