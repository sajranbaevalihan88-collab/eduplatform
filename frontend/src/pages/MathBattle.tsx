import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Swords, Bot, Users, Trophy, Flame, RotateCcw, Play, Zap, Heart,
  Settings2, Plus, Trash2, Edit3, Save, FileText, Volume2, VolumeX, Sliders
} from 'lucide-react'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { sfx, startBgMusic, stopBgMusic } from '../utils/sfx'

type PlayMode = 'pvp' | 'bot' | 'solo'
type QFormat = 'tf' | 'choice'
type GradeTier = '1-2' | '3-4' | '5-6' | '7-9' | '10-12' | 'custom_gen' | 'custom_pack'
type BotLevel = 'easy' | 'medium' | 'hard'
type OpKind = 'add' | 'sub' | 'mul' | 'div' | 'pow' | 'eq'

export type CustomMathItem = {
  lhs: string       // "7 × 8" или "2x + 5 = 17 ⇒ x"
  ans: string       // "56" или "6"
  wrongs?: string[] // необязательные ложные варианты
}

export type CustomMathPack = {
  id: string
  title: string
  items: CustomMathItem[]
  createdAt: string
}

const MB_PACKS_KEY = 'edu-mathbattle-packs-v1'

function loadMathPacks(): CustomMathPack[] {
  try {
    const raw = localStorage.getItem(MB_PACKS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function saveMathPacks(list: CustomMathPack[]) {
  try { localStorage.setItem(MB_PACKS_KEY, JSON.stringify(list)) } catch {}
}

type MathQuestion = {
  expr: string        // Для TF: "18 + 27 = 45", для choice: "18 + 27 = ?"
  isTrue: boolean     // только для TF
  correctVal: string  // правильный ответ
  options?: string[]  // 4 варианта для choice
}

const MASCOTS = ['🦅', '🐺', '🐆', '🐴', '🦁', '🦊', '🐉', '🤖']

const GRADE_TIERS: { id: GradeTier; label: Record<string, string>; desc: Record<string, string> }[] = [
  { id: '1-2', label: { ru: '1–2 класс', en: 'Grades 1–2', kg: '1–2-класс' }, desc: { ru: 'Сложение и вычитание до 100', en: 'Add & subtract up to 100', kg: '100гө чейин кошуу, кемитүү' } },
  { id: '3-4', label: { ru: '3–4 класс', en: 'Grades 3–4', kg: '3–4-класс' }, desc: { ru: 'Умножение, деление, скобки', en: 'Multiply, divide, order', kg: 'Көбөйтүү, бөлүү, кашаа' } },
  { id: '5-6', label: { ru: '5–6 класс', en: 'Grades 5–6', kg: '5–6-класс' }, desc: { ru: 'Отрицательные, проценты, дроби', en: 'Negatives, percents, fractions', kg: 'Терс сандар, пайыздар' } },
  { id: '7-9', label: { ru: '7–9 класс', en: 'Grades 7–9', kg: '7–9-класс' }, desc: { ru: 'Степени, корни, уравнения', en: 'Powers, roots, equations', kg: 'Даражалар, тамыр, теңдеме' } },
  { id: '10-12', label: { ru: '10–12 класс', en: 'Grades 10–12', kg: '10–12-класс' }, desc: { ru: 'Логарифмы, тригонометрия, модули', en: 'Logs, trig, advanced math', kg: 'Логарифм, тригонометрия' } },
]

const BOT_CFG: Record<BotLevel, { label: Record<string, string>; minMs: number; maxMs: number; acc: number }> = {
  easy: { label: { ru: '🌱 Новичок', en: '🌱 Rookie', kg: '🌱 Жаңы баштаган' }, minMs: 2600, maxMs: 4200, acc: 0.78 },
  medium: { label: { ru: '🎓 Отличник', en: '🎓 Honor', kg: '🎓 Мыкты' }, minMs: 1700, maxMs: 2900, acc: 0.88 },
  hard: { label: { ru: '🧠 Профессор', en: '🧠 Professor', kg: '🧠 Профессор' }, minMs: 1100, maxMs: 2000, acc: 0.94 },
}

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (Math.max(a, b) - a + 1))

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeFakeNumber(ans: number): number {
  const deltas = Math.abs(ans) >= 20 ? [-10, -3, -2, -1, 1, 2, 3, 10] : [-4, -3, -2, -1, 1, 2, 3, 4]
  const pick = deltas[ri(0, deltas.length - 1)]
  const candidate = ans + pick
  return candidate === ans ? ans + 1 : candidate
}

function makeFakeValue(ansStr: string, customWrongs?: string[]): string {
  if (customWrongs && customWrongs.length > 0) {
    return customWrongs[ri(0, customWrongs.length - 1)]
  }
  const num = Number(ansStr.replace(',', '.'))
  if (!Number.isNaN(num)) {
    return String(makeFakeNumber(num))
  }
  return ansStr + '1'
}

type GenOpts = {
  ops: OpKind[]
  minN: number
  maxN: number
  customItems?: CustomMathItem[]
}

function finalizeQuestion(lhs: string, ansStr: string, format: QFormat, customWrong?: string[] | null): MathQuestion {
  const num = Number(ansStr.replace(',', '.'))
  const isNumeric = !Number.isNaN(num)

  if (format === 'tf') {
    const isTrue = Math.random() > 0.48
    let shown = ansStr
    if (!isTrue) {
      shown = makeFakeValue(ansStr, customWrong || undefined)
    }
    return { expr: `${lhs} = ${shown}`, isTrue, correctVal: ansStr }
  }

  const set = new Set<string>([ansStr])
  if (customWrong && customWrong.length) {
    for (const w of customWrong) if (w) set.add(w)
  }
  let guard = 0
  while (set.size < 4 && guard < 40) {
    if (isNumeric) set.add(String(makeFakeNumber(num)))
    else set.add(`${ansStr} (${set.size})`)
    guard++
  }
  return { expr: `${lhs} = ?`, isTrue: true, correctVal: ansStr, options: shuffle(Array.from(set)).slice(0, 4) }
}

function genQuestion(tier: GradeTier, format: QFormat, genOpts?: GenOpts): MathQuestion {
  // 1. Пользовательский набор примеров учителя
  if (tier === 'custom_pack' && genOpts?.customItems && genOpts.customItems.length > 0) {
    const it = genOpts.customItems[ri(0, genOpts.customItems.length - 1)]
    return finalizeQuestion(it.lhs, it.ans, format, it.wrongs)
  }

  // 2. Тонкий конструктор формул учителя
  if (tier === 'custom_gen' && genOpts) {
    const ops: OpKind[] = genOpts.ops.length ? genOpts.ops : ['add', 'sub', 'mul']
    const op = ops[ri(0, ops.length - 1)]
    const lo = Math.max(1, Math.min(genOpts.minN, genOpts.maxN))
    const hi = Math.max(lo + 1, Math.max(genOpts.minN, genOpts.maxN))
    if (op === 'add') {
      const a = ri(lo, hi), b = ri(lo, hi)
      return finalizeQuestion(`${a} + ${b}`, String(a + b), format)
    }
    if (op === 'sub') {
      const a = ri(lo, hi), b = ri(lo, hi)
      const big = Math.max(a, b), sm = Math.min(a, b)
      return finalizeQuestion(`${big} − ${sm}`, String(big - sm), format)
    }
    if (op === 'mul') {
      const a = ri(lo, Math.min(hi, 30)), b = ri(2, Math.min(hi, 20))
      return finalizeQuestion(`${a} × ${b}`, String(a * b), format)
    }
    if (op === 'div') {
      const b = ri(Math.max(2, lo), Math.min(hi, 20)), q = ri(2, 15)
      return finalizeQuestion(`${b * q} ÷ ${b}`, String(q), format)
    }
    if (op === 'pow') {
      const n = ri(2, Math.min(20, hi))
      return Math.random() > 0.5
        ? finalizeQuestion(`${n}²`, String(n * n), format)
        : finalizeQuestion(`√${n * n}`, String(n), format)
    }
    // уравнение
    const a = ri(2, 9), x = ri(lo, Math.min(hi, 25)), b = ri(1, 20)
    return finalizeQuestion(`${a}x + ${b} = ${a * x + b}  ⇒  x`, String(x), format)
  }

  let lhs = ''
  let ansNum = 0
  let ansStr = ''
  let customWrong: string[] | null = null

  if (tier === '1-2') {
    const op = Math.random() > 0.45 ? '+' : '-'
    if (op === '+') {
      const a = ri(3, 45), b = ri(2, 40)
      lhs = `${a} + ${b}`; ansNum = a + b
    } else {
      const a = ri(12, 70), b = ri(2, a - 1)
      lhs = `${a} − ${b}`; ansNum = a - b
    }
    ansStr = String(ansNum)
  } else if (tier === '3-4') {
    const kind = ri(0, 2)
    if (kind === 0) {
      const a = ri(3, 12), b = ri(3, 12)
      lhs = `${a} × ${b}`; ansNum = a * b
    } else if (kind === 1) {
      const b = ri(2, 11), q = ri(3, 12)
      lhs = `${b * q} ÷ ${b}`; ansNum = q
    } else {
      const a = ri(2, 9), b = ri(2, 8), c = ri(3, 18)
      lhs = `${a} × ${b} + ${c}`; ansNum = a * b + c
    }
    ansStr = String(ansNum)
  } else if (tier === '5-6') {
    const kind = ri(0, 2)
    if (kind === 0) {
      const a = ri(-25, 15), b = ri(-20, 25)
      lhs = b >= 0 ? `${a} + ${b}` : `${a} − ${Math.abs(b)}`
      ansNum = a + b
    } else if (kind === 1) {
      const pcts = [10, 20, 25, 50]
      const p = pcts[ri(0, pcts.length - 1)]
      const base = ri(2, 16) * (p === 25 ? 4 : 10)
      lhs = `${p}% от ${base}`; ansNum = (base * p) / 100
    } else {
      const b = ri(2, 9), c = ri(2, 6), k = ri(2, 10) * c
      lhs = `(${k} + ${b * c}) ÷ ${c}`; ansNum = k / c + b
    }
    ansStr = String(ansNum)
  } else if (tier === '7-9') {
    const kind = ri(0, 2)
    if (kind === 0) {
      const n = ri(4, 15)
      if (Math.random() > 0.5) { lhs = `√${n * n}`; ansNum = n }
      else { lhs = `${n}²`; ansNum = n * n }
    } else if (kind === 1) {
      const a = ri(2, 7), x = ri(2, 11), b = ri(1, 15)
      lhs = `${a}x + ${b} = ${a * x + b}  ⇒  x`
      ansNum = x
    } else {
      const base = ri(2, 5), exp = base === 2 ? ri(3, 7) : ri(2, 4)
      lhs = `${base}^${exp}`; ansNum = Math.pow(base, exp)
    }
    ansStr = String(ansNum)
  } else {
    const kind = ri(0, 3)
    if (kind === 0) {
      const b = ri(2, 4), k = b === 2 ? ri(2, 6) : ri(2, 4)
      lhs = `log_${b}(${Math.pow(b, k)})`; ansNum = k; ansStr = String(k)
    } else if (kind === 1) {
      const trig: [string, string, string[]][] = [
        ['sin 30°', '0.5', ['1', '0', '√3/2']],
        ['cos 60°', '0.5', ['0', '1', '√2/2']],
        ['sin 90°', '1', ['0', '0.5', '-1']],
        ['cos 0°', '1', ['0', '-1', '0.5']],
        ['tg 45°', '1', ['0', '√3', '0.5']],
        ['cos 180°', '-1', ['1', '0', '0.5']],
        ['sin 0°', '0', ['1', '-1', '0.5']],
      ]
      const pick = trig[ri(0, trig.length - 1)]
      lhs = pick[0]; ansStr = pick[1]; customWrong = pick[2]
    } else if (kind === 2) {
      const a = ri(2, 9), b = ri(-15, -3)
      lhs = `|${b}| × ${a}`; ansNum = Math.abs(b) * a; ansStr = String(ansNum)
    } else {
      const a = ri(2, 6), n = ri(2, 5)
      lhs = `(${a}x^${n})' при x=1`; ansNum = a * n; ansStr = String(ansNum)
    }
  }

  return finalizeQuestion(lhs, ansStr, format, customWrong)
}

type Fighter = {
  name: string
  mascot: string
  hearts: number
  time: number
  combo: number
  maxCombo: number
  correct: number
  wrong: number
  q: MathQuestion
  flash: null | 'hit' | 'crit' | 'miss' | 'damaged'
  floatTxt: { txt: string; cls: string; key: number } | null
}

export default function MathBattle() {
  const { t, lang } = useLang()
  const [phase, setPhase] = useState<'setup' | 'battle' | 'ko'>('setup')
  const [mode, setMode] = useState<PlayMode>('bot')
  const [tier, setTier] = useState<GradeTier>('3-4')
  const [format, setFormat] = useState<QFormat>('tf')
  const [botLvl, setBotLvl] = useState<BotLevel>('medium')
  const [p1Name, setP1Name] = useState('Команда 1')
  const [p2Name, setP2Name] = useState('Команда 2')
  const [p1Mascot, setP1Mascot] = useState('🦅')
  const [p2Mascot, setP2Mascot] = useState('🐺')
  const [soloBest, setSoloBest] = useState(() => Number(localStorage.getItem('edu-mathbattle-best') || 0))
  const [winner, setWinner] = useState<1 | 2 | 0>(0)
  const [boltDir, setBoltDir] = useState<null | { dir: '1to2' | '2to1'; crit: boolean; key: number }>(null)
  const [musicOn, setMusicOn] = useState(false)

  // Настраиваемые правила боя (жизни, таймер, урон)
  const [startHearts, setStartHearts] = useState(3)
  const [startSec, setStartSec] = useState(12)
  const [dmgMult, setDmgMult] = useState<1 | 1.5>(1)

  // Конструктор учителя: 1) Свой генератор операций/чисел, 2) Свои наборы примеров
  const [customOps, setCustomOps] = useState<OpKind[]>(['mul', 'add'])
  const [minN, setMinN] = useState(2)
  const [maxN, setMaxN] = useState(12)

  const [packs, setPacks] = useState<CustomMathPack[]>(() => loadMathPacks())
  const [selPackId, setSelPackId] = useState<string>(() => loadMathPacks()[0]?.id || '')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editPackId, setEditPackId] = useState<string | null>(null)
  const [packTitle, setPackTitle] = useState('Мой набор для Математического боя')
  const [packItems, setPackItems] = useState<CustomMathItem[]>([
    { lhs: '7 × 8', ans: '56', wrongs: ['54', '58', '64'] },
    { lhs: '15 × 6', ans: '90', wrongs: ['80', '85', '95'] },
    { lhs: '3x + 4 = 19 ⇒ x', ans: '5', wrongs: ['4', '6', '7'] },
  ])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const maxTime = Math.max(14, Math.round(startSec * 1.5))

  const curGenOpts = (): GenOpts => {
    const found = packs.find(p => p.id === selPackId) || packs[0]
    return {
      ops: customOps,
      minN,
      maxN,
      customItems: found?.items || packItems,
    }
  }

  const [f1, setF1] = useState<Fighter>(() => ({
    name: 'Команда 1', mascot: '🦅', hearts: 3, time: 12, combo: 0, maxCombo: 0, correct: 0, wrong: 0,
    q: genQuestion('3-4', 'tf'), flash: null, floatTxt: null,
  }))
  const [f2, setF2] = useState<Fighter>(() => ({
    name: 'ИИ-Бот', mascot: '🐺', hearts: 3, time: 12, combo: 0, maxCombo: 0, correct: 0, wrong: 0,
    q: genQuestion('3-4', 'tf'), flash: null, floatTxt: null,
  }))

  const f1Ref = useRef(f1); f1Ref.current = f1
  const f2Ref = useRef(f2); f2Ref.current = f2
  const phaseRef = useRef(phase); phaseRef.current = phase

  useEffect(() => () => stopBgMusic(), [])

  const toggleMusic = () => {
    if (musicOn) {
      stopBgMusic()
      setMusicOn(false)
    } else {
      startBgMusic('battle')
      setMusicOn(true)
    }
  }

  // ── Конструктор наборов примеров учителя ──
  const toggleOp = (op: OpKind) => {
    sfx('ui.click')
    setCustomOps(prev => prev.includes(op) ? (prev.length > 1 ? prev.filter(x => x !== op) : prev) : [...prev, op])
  }

  const addPackRow = () => {
    sfx('ui.click')
    setPackItems(prev => [...prev, { lhs: '', ans: '', wrongs: [] }])
  }

  const updatePackRow = (idx: number, patch: Partial<CustomMathItem>) => {
    setPackItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const removePackRow = (idx: number) => {
    if (packItems.length <= 1) { toast('Нужен хотя бы 1 пример в наборе', 'error'); return }
    sfx('ui.click')
    setPackItems(prev => prev.filter((_, i) => i !== idx))
  }

  const importBulkMath = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast('Вставь строки с примерами', 'error'); return }
    const parsed: CustomMathItem[] = []
    for (const ln of lines) {
      if (ln.includes('|')) {
        const parts = ln.split('|').map(s => s.trim()).filter(Boolean)
        if (parts.length >= 2) {
          const wrongs = parts[2] ? parts[2].split(',').map(x => x.trim()).filter(Boolean) : []
          parsed.push({ lhs: parts[0], ans: parts[1], wrongs })
        }
      } else if (ln.includes('=')) {
        const idx = ln.lastIndexOf('=')
        const lhs = ln.slice(0, idx).trim()
        const ans = ln.slice(idx + 1).trim()
        if (lhs && ans) parsed.push({ lhs, ans, wrongs: [] })
      }
    }
    if (!parsed.length) {
      toast('Формат строки: 7 × 8 = 56   или   3x + 2 = 14 | 4 | 3, 5, 6', 'error')
      return
    }
    setPackItems(prev => [...prev.filter(x => x.lhs.trim() && x.ans.trim()), ...parsed])
    setBulkText('')
    setBulkOpen(false)
    sfx('ui.success')
    toast(`Добавлено примеров: +${parsed.length}`, 'success')
  }

  const saveCustomPack = (): CustomMathPack | null => {
    const title = packTitle.trim()
    if (!title) { toast('Введи название набора', 'error'); return null }
    const valid = packItems
      .map(it => ({ lhs: it.lhs.trim(), ans: it.ans.trim(), wrongs: (it.wrongs || []).filter(Boolean) }))
      .filter(it => it.lhs && it.ans)
    if (!valid.length) { toast('Заполни хотя бы 1 пример и ответ', 'error'); return null }

    const pk: CustomMathPack = {
      id: editPackId || ('mb_' + Date.now()),
      title,
      items: valid,
      createdAt: new Date().toLocaleDateString(),
    }
    const next = [pk, ...packs.filter(p => p.id !== pk.id)]
    setPacks(next)
    saveMathPacks(next)
    setSelPackId(pk.id)
    setEditPackId(pk.id)
    setTier('custom_pack')
    setBuilderOpen(false)
    sfx('ui.success')
    toast(`Набор «${title}» (${valid.length} прим.) сохранён и выбран для боя!`, 'success')
    return pk
  }

  const editSavedMathPack = (pk: CustomMathPack) => {
    setEditPackId(pk.id)
    setPackTitle(pk.title)
    setPackItems(JSON.parse(JSON.stringify(pk.items)))
    setBuilderOpen(true)
    setTier('custom_pack')
    sfx('ui.click')
  }

  const deleteSavedMathPack = (id: string) => {
    const next = packs.filter(p => p.id !== id)
    setPacks(next)
    saveMathPacks(next)
    if (selPackId === id) setSelPackId(next[0]?.id || '')
    toast('Набор удалён', 'success')
  }

  const startBattle = () => {
    let activeTier = tier
    let activeOpts = curGenOpts()
    if (builderOpen) {
      const saved = saveCustomPack()
      if (!saved) return
      activeTier = 'custom_pack'
      activeOpts = { ...activeOpts, customItems: saved.items }
    }
    sfx('ui.win')
    setWinner(0)
    setBoltDir(null)
    const rightName = mode === 'bot' ? (BOT_CFG[botLvl].label[lang] || BOT_CFG[botLvl].label.ru) : (p2Name.trim() || 'Команда 2')
    setF1({
      name: p1Name.trim() || 'Игрок 1', mascot: p1Mascot, hearts: startHearts, time: startSec,
      combo: 0, maxCombo: 0, correct: 0, wrong: 0,
      q: genQuestion(activeTier, format, activeOpts), flash: null, floatTxt: null,
    })
    setF2({
      name: rightName, mascot: mode === 'bot' ? '🤖' : p2Mascot, hearts: startHearts, time: startSec,
      combo: 0, maxCombo: 0, correct: 0, wrong: 0,
      q: genQuestion(activeTier, format, activeOpts), flash: null, floatTxt: null,
    })
    setPhase('battle')
  }

  const finishBattle = (winSide: 1 | 2) => {
    if (phaseRef.current !== 'battle') return
    phaseRef.current = 'ko'
    stopBgMusic()
    setMusicOn(false)
    setWinner(winSide)
    setPhase('ko')
    sfx('mb.ko')
    if (mode === 'solo') {
      const sc = f1Ref.current.correct
      if (sc > soloBest) {
        setSoloBest(sc)
        localStorage.setItem('edu-mathbattle-best', String(sc))
      }
    }
  }

  useEffect(() => {
    if (phase !== 'battle') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (phaseRef.current !== 'battle') return

      const speedMul = mode === 'solo' ? 1 + Math.min(1.8, f1Ref.current.correct * 0.045) : 1

      setF1(prev => {
        const nt = prev.time - dt * speedMul
        if (nt <= 0) {
          const nh = prev.hearts - 1
          sfx('ui.error')
          if (nh <= 0) {
            setTimeout(() => finishBattle(2), 10)
            return { ...prev, hearts: 0, time: 0, combo: 0, flash: 'damaged', floatTxt: { txt: '💔 K.O.!', cls: 'text-rose-400', key: Date.now() } }
          }
          return { ...prev, hearts: nh, time: startSec, combo: 0, flash: 'damaged', floatTxt: { txt: '💔 −1 жизнь', cls: 'text-rose-400', key: Date.now() } }
        }
        return { ...prev, time: nt }
      })

      if (mode !== 'solo') {
        setF2(prev => {
          const nt = prev.time - dt
          if (nt <= 0) {
            const nh = prev.hearts - 1
            sfx('mb.strike')
            if (nh <= 0) {
              setTimeout(() => finishBattle(1), 10)
              return { ...prev, hearts: 0, time: 0, combo: 0, flash: 'damaged', floatTxt: { txt: '💔 K.O.!', cls: 'text-rose-400', key: Date.now() } }
            }
            return { ...prev, hearts: nh, time: startSec, combo: 0, flash: 'damaged', floatTxt: { txt: '💔 −1 жизнь', cls: 'text-rose-400', key: Date.now() } }
          }
          return { ...prev, time: nt }
        })
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, mode, startSec])

  const answer = (side: 1 | 2, ok: boolean) => {
    if (phaseRef.current !== 'battle') return
    const nextQ = genQuestion(tier, format, curGenOpts())
    const nowKey = Date.now() + Math.random()
    const hitDmg = 2.5 * dmgMult
    const critDmg = 4.2 * dmgMult
    const hitHeal = 1.6
    const missPen = 2.8 * dmgMult

    const applyAttacker = (prev: Fighter): Fighter => {
      if (ok) {
        const nc = prev.combo + 1
        const crit = nc >= 3
        sfx(crit ? 'mb.crit' : 'mb.strike')
        return {
          ...prev,
          combo: nc,
          maxCombo: Math.max(prev.maxCombo, nc),
          correct: prev.correct + 1,
          time: Math.min(maxTime, prev.time + (crit ? hitHeal * 1.35 : hitHeal)),
          q: nextQ,
          flash: crit ? 'crit' : 'hit',
          floatTxt: { txt: crit ? `⚡ КРИТ ×${nc}!` : `+${hitHeal.toFixed(1)}с ⚔️`, cls: crit ? 'text-amber-300' : 'text-emerald-300', key: nowKey },
        }
      } else {
        sfx('ui.error')
        const nt = Math.max(0.15, prev.time - missPen)
        return {
          ...prev,
          combo: 0,
          wrong: prev.wrong + 1,
          time: nt,
          q: nextQ,
          flash: 'miss',
          floatTxt: { txt: `✕ −${missPen.toFixed(1)}с`, cls: 'text-rose-400', key: nowKey },
        }
      }
    }

    const applyDefender = (prev: Fighter, isCrit: boolean): Fighter => {
      const dmg = isCrit ? critDmg : hitDmg
      const nt = Math.max(0.05, prev.time - dmg)
      return {
        ...prev,
        time: nt,
        flash: 'damaged',
        floatTxt: { txt: `💥 −${dmg.toFixed(1)}с`, cls: 'text-orange-400', key: nowKey + 1 },
      }
    }

    if (side === 1) {
      const isCrit = ok && f1Ref.current.combo + 1 >= 3
      setF1(applyAttacker)
      if (ok && mode !== 'solo') {
        setF2(prev => applyDefender(prev, isCrit))
        setBoltDir({ dir: '1to2', crit: isCrit, key: nowKey })
      }
    } else {
      const isCrit = ok && f2Ref.current.combo + 1 >= 3
      setF2(applyAttacker)
      if (ok) {
        setF1(prev => applyDefender(prev, isCrit))
        setBoltDir({ dir: '2to1', crit: isCrit, key: nowKey })
      }
    }
  }

  useEffect(() => {
    if (phase !== 'battle' || mode !== 'bot') return
    let timer = 0
    const cfg = BOT_CFG[botLvl]
    const schedule = () => {
      const delay = ri(cfg.minMs, cfg.maxMs)
      timer = window.setTimeout(() => {
        if (phaseRef.current !== 'battle') return
        const ok = Math.random() < cfg.acc
        answer(2, ok)
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [phase, mode, botLvl, tier, format])

  useEffect(() => {
    if (phase !== 'battle') return
    const onKey = (e: KeyboardEvent) => {
      if (format === 'tf') {
        const k = e.key.toLowerCase()
        if (k === 'a' || k === 'ф') answer(1, f1Ref.current.q.isTrue === true)
        else if (k === 'd' || k === 'в') answer(1, f1Ref.current.q.isTrue === false)
        else if (mode === 'pvp' && e.key === 'ArrowLeft') { e.preventDefault(); answer(2, f2Ref.current.q.isTrue === true) }
        else if (mode === 'pvp' && e.key === 'ArrowRight') { e.preventDefault(); answer(2, f2Ref.current.q.isTrue === false) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, format, mode, tier])

  useEffect(() => {
    if (!f1.flash) return
    const tmr = setTimeout(() => setF1(p => ({ ...p, flash: null })), 260)
    return () => clearTimeout(tmr)
  }, [f1.flash])
  useEffect(() => {
    if (!f2.flash) return
    const tmr = setTimeout(() => setF2(p => ({ ...p, flash: null })), 260)
    return () => clearTimeout(tmr)
  }, [f2.flash])

  const renderFighterCard = (f: Fighter, side: 1 | 2, interactive: boolean) => {
    const pct = Math.max(0, Math.min(100, (f.time / maxTime) * 100))
    const barColor = pct > 55 ? 'from-emerald-400 to-teal-400' : pct > 28 ? 'from-amber-400 to-orange-400' : 'from-rose-500 to-red-600'
    const ringCls =
      f.flash === 'crit' ? 'ring-4 ring-amber-400 scale-[1.01]' :
      f.flash === 'hit' ? 'ring-4 ring-emerald-400' :
      f.flash === 'miss' || f.flash === 'damaged' ? 'ring-4 ring-rose-500 translate-x-1' : ''
    const accent = side === 1 ? 'from-indigo-600 to-sky-600' : 'from-rose-600 to-orange-500'

    return (
      <div
        data-testid={`mb-fighter-${side}`}
        className={`relative rounded-3xl bg-slate-900/90 border-2 border-white/10 p-4 sm:p-5 flex flex-col gap-3 shadow-2xl transition-all duration-150 ${ringCls}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-3xl shadow-lg shrink-0`}>
              {f.mascot}
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-white text-base sm:text-lg truncate">{f.name}</div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>✓ {f.correct}</span>
                {f.combo >= 2 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold flex items-center gap-0.5 animate-pulse">
                    <Flame size={11} /> ×{f.combo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1" aria-label={`Жизни: ${f.hearts}`}>
            {Array.from({ length: startHearts }, (_, i) => (
              <Heart
                key={i}
                size={22}
                className={`transition-all duration-300 ${i < f.hearts ? 'fill-rose-500 text-rose-400 scale-100 drop-shadow' : 'text-slate-700 scale-75'}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono font-bold text-slate-300">
            <span>⏱ Энергия времени</span>
            <span className={pct < 28 ? 'text-rose-400 animate-pulse' : 'text-white'}>{f.time.toFixed(1)} с</span>
          </div>
          <div className="h-4 rounded-full bg-slate-800 overflow-hidden border border-white/10 p-0.5">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-75`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="relative my-1 rounded-2xl bg-slate-950/90 border border-white/10 py-6 sm:py-8 px-3 text-center min-h-[120px] flex items-center justify-center">
          <div className="text-2xl sm:text-4xl font-mono font-black text-white tracking-wide break-words" data-testid={`mb-expr-${side}`}>
            {f.q.expr}
          </div>
          {f.floatTxt && (
            <div key={f.floatTxt.key} className={`fb-float pointer-events-none absolute top-2 right-3 text-lg sm:text-xl font-black drop-shadow-lg ${f.floatTxt.cls}`}>
              {f.floatTxt.txt}
            </div>
          )}
        </div>

        {interactive ? (
          format === 'tf' ? (
            <div className="grid grid-cols-2 gap-3 mt-auto">
              <button
                type="button"
                onClick={() => answer(side, f.q.isTrue === true)}
                data-testid={`mb-true-${side}`}
                className="py-4 sm:py-5 min-h-[64px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-lg sm:text-xl shadow-lg shadow-emerald-900/40 transition flex flex-col items-center justify-center"
              >
                <span>✓ ВЕРНО</span>
                {mode === 'pvp' && <span className="text-[11px] font-mono opacity-75">{side === 1 ? 'клавиша A' : 'стрелка ←'}</span>}
              </button>
              <button
                type="button"
                onClick={() => answer(side, f.q.isTrue === false)}
                data-testid={`mb-false-${side}`}
                className="py-4 sm:py-5 min-h-[64px] rounded-2xl bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-black text-lg sm:text-xl shadow-lg shadow-rose-900/40 transition flex flex-col items-center justify-center"
              >
                <span>✕ НЕВЕРНО</span>
                {mode === 'pvp' && <span className="text-[11px] font-mono opacity-75">{side === 1 ? 'клавиша D' : 'стрелка →'}</span>}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 mt-auto">
              {(f.q.options || []).map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => answer(side, opt === f.q.correctVal)}
                  className="py-4 min-h-[56px] rounded-2xl bg-white/10 hover:bg-indigo-500 active:scale-95 text-white font-mono font-extrabold text-xl border border-white/15 transition"
                >
                  {opt}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-auto py-4 rounded-2xl bg-white/5 border border-white/10 text-center text-sm font-bold text-slate-300 flex items-center justify-center gap-2">
            <Bot size={18} className="text-amber-400 animate-bounce" /> Бот просчитывает удар…
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 px-3 py-5 sm:px-6 text-white" data-testid="math-battle-page">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/games" className="text-sm font-bold text-indigo-300 hover:text-white">
            {t('hm_to_games')}
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMusic}
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${
                musicOn ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
              }`}>
              {musicOn ? <Volume2 size={13} /> : <VolumeX size={13} />} {musicOn ? 'Музыка ВКЛ' : '🎵 Ритм боя'}
            </button>
            {soloBest > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold flex items-center gap-1">
                <Trophy size={13} /> Рекорд соло: {soloBest}
              </span>
            )}
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight flex items-center justify-center gap-2.5">
            <Swords className="text-amber-400" size={32} /> {t('games_mathbattle')}
          </h1>
          <p className="text-sm sm:text-base text-indigo-200/80 max-w-2xl mx-auto">
            Верный ответ наносит удар и отнимает время соперника · Преподаватель может сам создать свои примеры и правила боя!
          </p>
        </div>

        {/* ═══════════════ ЭКРАН НАСТРОЙКИ И КОНСТРУКТОР БОЯ ═══════════════ */}
        {phase === 'setup' && (
          <div className="bg-slate-900/85 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl max-w-4xl mx-auto">
            {/* 1. Выбор режима */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Settings2 size={14} /> 1. Режим боя
              </div>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {([
                  ['bot', '🤖 Против ИИ-бота', 'Проверь скорость реакции против бота', Bot],
                  ['pvp', '👥 2 игрока / Команды', 'Дуэль на одном экране или проекторе', Users],
                  ['solo', '🏆 Соло на рекорд', 'Ускоряющийся таймер и таблица рекордов', Trophy],
                ] as [PlayMode, string, string, any][]).map(([k, title, sub]) => (
                  <button key={k} type="button" onClick={() => { setMode(k); sfx('ui.click') }}
                    data-testid={`mb-mode-${k}`}
                    className={`p-3.5 rounded-2xl border-2 text-left transition ${
                      mode === k ? 'bg-indigo-600 border-amber-400 shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}>
                    <div className="font-extrabold text-sm">{title}</div>
                    <div className="text-xs text-white/70 mt-0.5">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Уровень по классам ИЛИ Своя игра преподавателя */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">2. Примеры по классам (1–12) или Своя игра учителя</div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => { setTier('custom_gen'); setBuilderOpen(false); sfx('ui.click') }}
                    data-testid="mb-tab-custom-gen"
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1 ${
                      tier === 'custom_gen' && !builderOpen ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30 hover:bg-indigo-500/30'
                    }`}>
                    <Sliders size={13} /> ⚙️ Настроить генератор
                  </button>
                  <button type="button" onClick={() => { setBuilderOpen(v => !v); setTier('custom_pack'); sfx('ui.click') }}
                    data-testid="mb-tab-custom-builder"
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1 ${
                      builderOpen ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-300 shadow' : 'bg-amber-500/15 text-amber-200 border-amber-400/30 hover:bg-amber-500/25'
                    }`}>
                    <Plus size={14} /> 🛠️ Свои примеры (Конструктор учителя)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {GRADE_TIERS.map(g => (
                  <button key={g.id} type="button" onClick={() => { setTier(g.id); setBuilderOpen(false); sfx('ui.click') }}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      tier === g.id && !builderOpen ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold' : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}>
                    <div className="font-extrabold text-xs">{g.label[lang] || g.label.ru}</div>
                    <div className={`text-[10px] mt-0.5 leading-tight ${tier === g.id && !builderOpen ? 'text-slate-800' : 'text-slate-400'}`}>{g.desc[lang] || g.desc.ru}</div>
                  </button>
                ))}
              </div>

              {/* Сохранённые наборы учителя */}
              {packs.length > 0 && !builderOpen && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-amber-300">⭐ Мои сохранённые наборы для боя:</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {packs.map(pk => (
                      <div key={pk.id} onClick={() => { setSelPackId(pk.id); setTier('custom_pack'); sfx('ui.click') }}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-2 transition ${
                          tier === 'custom_pack' && selPackId === pk.id ? 'bg-emerald-500/25 border-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs truncate">⭐ {pk.title}</div>
                          <div className="text-[10px] text-white/70">{pk.items.length} прим. · {pk.createdAt}</div>
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => editSavedMathPack(pk)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20" title="Редактировать">
                            <Edit3 size={12} />
                          </button>
                          <button type="button" onClick={() => deleteSavedMathPack(pk.id)} className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300" title="Удалить">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* РЕЖИМ А: ТОНКИЙ ГЕНЕРАТОР ФОРМУЛ УЧИТЕЛЯ */}
              {tier === 'custom_gen' && !builderOpen && (
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-400/40 space-y-3" data-testid="mb-custom-gen-panel">
                  <div className="text-xs font-extrabold text-amber-300">⚙️ Настрой свой генератор примеров для урока:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ['add', '➕ Сложение'],
                      ['sub', '➖ Вычитание'],
                      ['mul', '✖️ Умножение'],
                      ['div', '➗ Деление'],
                      ['pow', 'x² Степени и корни'],
                      ['eq', '📐 Уравнения с X'],
                    ] as [OpKind, string][]).map(([op, lbl]) => (
                      <button key={op} type="button" onClick={() => toggleOp(op)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                          customOps.includes(op) ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/5 text-slate-400 border-white/10'
                        }`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <span className="text-indigo-200">Числа от:</span>
                      <input type="number" min={1} max={500} value={minN} onChange={e => setMinN(Number(e.target.value) || 1)}
                        className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-center font-bold" />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-indigo-200">до:</span>
                      <input type="number" min={2} max={1000} value={maxN} onChange={e => setMaxN(Number(e.target.value) || 10)}
                        className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-center font-bold" />
                    </label>
                    <span className="text-[11px] text-slate-400">Игра сама будет генерировать бесконечные примеры по твоим правилам!</span>
                  </div>
                </div>
              )}

              {/* РЕЖИМ Б: КОНСТРУКТОР СВОИХ ПРИМЕРОВ УЧИТЕЛЯ */}
              {builderOpen && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border-2 border-amber-400/40 space-y-3.5" data-testid="mb-custom-builder">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-[220px]">
                      <label className="text-[11px] font-bold text-amber-300 uppercase">Название твоего набора для боя:</label>
                      <input
                        value={packTitle}
                        onChange={e => setPackTitle(e.target.value)}
                        placeholder="Напр.: Таблица умножения 3А или Уравнения 8Б"
                        data-testid="mb-pack-title"
                        className="w-full mt-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 font-extrabold text-sm text-white outline-none focus:border-amber-400"
                      />
                    </div>
                    <button type="button" onClick={() => setBulkOpen(v => !v)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 self-end">
                      <FileText size={14} /> 📋 Вставить списком
                    </button>
                  </div>

                  {bulkOpen && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/15 space-y-2">
                      <div className="text-xs text-indigo-200">
                        Вставь свои примеры построчно (<code className="font-mono text-amber-300">7 × 8 = 56</code> или <code className="font-mono text-amber-300">2x + 5 = 17 | 6 | 4, 5, 7</code>):
                      </div>
                      <textarea
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        rows={4}
                        placeholder={"7 × 8 = 56\n9 × 6 = 54\n12 × 12 = 144\n2x + 4 = 14 | 5 | 4, 6, 8"}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-mono text-white"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={importBulkMath} className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black">
                          ➕ Добавить примеры
                        </button>
                        <button type="button" onClick={() => setBulkOpen(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {packItems.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900/80 p-2 rounded-xl border border-white/10">
                        <span className="col-span-1 text-center text-xs font-bold text-slate-400">#{idx + 1}</span>
                        <input
                          value={it.lhs}
                          onChange={e => updatePackRow(idx, { lhs: e.target.value })}
                          placeholder="Пример (напр. 8 × 7)"
                          data-testid={`mb-item-lhs-${idx}`}
                          className="col-span-5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs font-mono font-bold text-white"
                        />
                        <input
                          value={it.ans}
                          onChange={e => updatePackRow(idx, { ans: e.target.value })}
                          placeholder="Ответ (56)"
                          data-testid={`mb-item-ans-${idx}`}
                          className="col-span-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-400/40 text-xs font-mono font-bold text-emerald-300 text-center"
                        />
                        <input
                          value={(it.wrongs || []).join(', ')}
                          onChange={e => updatePackRow(idx, { wrongs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="Ловушки: 54, 58 (или авто)"
                          className="col-span-3 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-[11px] font-mono text-slate-300"
                        />
                        <button type="button" onClick={() => removePackRow(idx)} className="col-span-1 flex justify-center text-rose-400 hover:text-rose-300">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button type="button" onClick={addPackRow} className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1">
                      <Plus size={14} /> Добавить пример
                    </button>
                    <button type="button" onClick={() => saveCustomPack()} data-testid="mb-save-pack-btn"
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5">
                      <Save size={14} /> Сохранить набор
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Формат ответа + Правила боя + Сила бота / Команды */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">3. Формат вопросов и правила боя</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setFormat('tf'); sfx('ui.click') }}
                    className={`p-2.5 rounded-xl border text-xs font-bold ${format === 'tf' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10'}`}>
                    ✓ / ✕ Верно или Неверно
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">Классический Math Battle</div>
                  </button>
                  <button type="button" onClick={() => { setFormat('choice'); sfx('ui.click') }}
                    className={`p-2.5 rounded-xl border text-xs font-bold ${format === 'choice' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10'}`}>
                    🔢 4 варианта ответа
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">Выбери точный ответ</div>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-indigo-200 font-semibold">❤️ Жизни:</span>
                  {[1, 3, 5].map(h => (
                    <button key={h} type="button" onClick={() => setStartHearts(h)}
                      className={`px-2.5 py-1 rounded-lg font-bold border ${startHearts === h ? 'bg-rose-500 border-rose-300' : 'bg-white/5 border-white/10'}`}>
                      {h}
                    </button>
                  ))}
                  <span className="text-indigo-200 font-semibold ml-2">⏱ Таймер:</span>
                  {[10, 12, 18].map(s => (
                    <button key={s} type="button" onClick={() => setStartSec(s)}
                      className={`px-2.5 py-1 rounded-lg font-bold border ${startSec === s ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10'}`}>
                      {s}с
                    </button>
                  ))}
                  <button type="button" onClick={() => setDmgMult(d => d === 1 ? 1.5 : 1)}
                    className={`px-2.5 py-1 rounded-lg font-bold border ml-auto ${dmgMult === 1.5 ? 'bg-orange-500 border-orange-300' : 'bg-white/5 border-white/10'}`}>
                    ⚡ Урон ×{dmgMult}
                  </button>
                </div>
              </div>

              {mode === 'bot' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">4. Сила ИИ-бота</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['easy', 'medium', 'hard'] as BotLevel[]).map(lv => (
                      <button key={lv} type="button" onClick={() => { setBotLvl(lv); sfx('ui.click') }}
                        className={`p-2.5 rounded-xl border text-xs font-bold ${botLvl === lv ? 'bg-rose-500 text-white border-rose-400' : 'bg-white/5 border-white/10'}`}>
                        {BOT_CFG[lv].label[lang] || BOT_CFG[lv].label.ru}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'pvp' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">4. Бойцы / Команды</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setP1Mascot(MASCOTS[(MASCOTS.indexOf(p1Mascot) + 1) % MASCOTS.length])} className="px-2.5 rounded-xl bg-white/10 text-xl">{p1Mascot}</button>
                      <input value={p1Name} onChange={e => setP1Name(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white" />
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setP2Mascot(MASCOTS[(MASCOTS.indexOf(p2Mascot) + 1) % MASCOTS.length])} className="px-2.5 rounded-xl bg-white/10 text-xl">{p2Mascot}</button>
                      <input value={p2Name} onChange={e => setP2Name(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={startBattle}
              data-testid="mb-start"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 hover:brightness-110 text-slate-950 font-black text-xl shadow-xl flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <Play size={22} className="fill-slate-950" />
              {builderOpen ? `СОХРАНИТЬ «${packTitle.slice(0, 22)}» И НАЧАТЬ БОЙ!` : 'НАЧАТЬ БОЙ!'}
            </button>
          </div>
        )}

        {/* ═══════════════ АРЕНА БОЯ ═══════════════ */}
        {phase === 'battle' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Zap size={14} />
                {tier === 'custom_pack'
                  ? `⭐ ${(packs.find(p => p.id === selPackId) || packs[0])?.title || packTitle}`
                  : tier === 'custom_gen'
                  ? `⚙️ Свой генератор (${minN}..${maxN})`
                  : GRADE_TIERS.find(g => g.id === tier)?.label.ru}
                {' · '}
                {format === 'tf' ? 'Верно / Неверно' : '4 ответа'}
              </span>
              {boltDir && (
                <span key={boltDir.key} className="font-black text-amber-300 animate-pulse">
                  {boltDir.dir === '1to2' ? (boltDir.crit ? '⚡⚡ КРИТ-УДАР ➔' : '⚔️ УДАР ➔') : (boltDir.crit ? '⬅ ⚡⚡ КРИТ-УДАР' : '⬅ ⚔️ УДАР')}
                </span>
              )}
              <button type="button" onClick={() => { stopBgMusic(); setMusicOn(false); setPhase('setup') }} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-bold">
                ✕ Выйти
              </button>
            </div>

            <div className={mode === 'solo' ? 'max-w-lg mx-auto' : 'grid md:grid-cols-2 gap-4 items-stretch'}>
              {renderFighterCard(f1, 1, true)}
              {mode !== 'solo' && renderFighterCard(f2, 2, mode === 'pvp')}
            </div>
          </div>
        )}

        {/* ═══════════════ ЭКРАН K.O. / ПОБЕДЫ ═══════════════ */}
        {phase === 'ko' && (
          <div className="bg-slate-900/90 border-2 border-amber-400/50 rounded-3xl p-6 sm:p-8 text-center max-w-xl mx-auto space-y-5 shadow-2xl" data-testid="mb-ko">
            <div className="text-6xl fb-hop">{mode === 'solo' ? '🏆' : winner === 1 ? f1.mascot : f2.mascot}</div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-amber-400">💥 K.O. · НОКАУТ!</div>
              <h2 className="text-3xl font-black mt-1">
                {mode === 'solo'
                  ? `Результат: ${f1.correct} верных!`
                  : `Победа: ${winner === 1 ? f1.name : f2.name}!`}
              </h2>
            </div>

            <div className={`grid ${mode === 'solo' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-left`}>
              {([f1, ...(mode === 'solo' ? [] : [f2])] as Fighter[]).map((f, i) => {
                const total = f.correct + f.wrong
                const acc = total ? Math.round((f.correct / total) * 100) : 0
                return (
                  <div key={i} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-xs">
                    <div className="font-extrabold text-sm flex items-center gap-1.5">{f.mascot} {f.name}</div>
                    <div className="text-emerald-300">Верно: <b>{f.correct}</b> · Ошибок: <b className="text-rose-300">{f.wrong}</b></div>
                    <div className="text-indigo-200">Точность: <b>{acc}%</b> · Макс. комбо: <b>🔥 ×{f.maxCombo}</b></div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button type="button" onClick={startBattle} className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black flex items-center gap-2">
                <RotateCcw size={18} /> Реванш!
              </button>
              <button type="button" onClick={() => setPhase('setup')} className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold">
                Настройки и конструктор боя
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
