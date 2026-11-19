import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { WORD_PACKS, wordsFromText } from '../utils/words'
import { sfx } from '../utils/sfx'
import { AI_FEATURES, isTeacherAIAllowed } from '../utils/features'
import { Sparkles, X, Trash2, Share2, Save, Play, RotateCcw, Trophy, Lightbulb, Flame, Eye } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type Phase = 'idle' | 'play' | 'over'
type Diff = 'easy' | 'hard'
type VisualScene = 'gallows' | 'balloon'
type HmSet = { id: string; name: string; words: string[]; lang: string; clues?: Record<string, string> }

const LIVES = 6
const SETS_KEY = 'edu-hm-sets'

const hum = (ms: number | number[]) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} }

// Тематические категории с учебными определениями-подсказками
const CATEGORY_BANKS: Record<string, { label: string; icon: string; lang: string; items: { w: string; clue: string }[] }> = {
  all: { label: 'Все слова', icon: '🎲', lang: 'auto', items: [] },
  python: {
    label: 'Python и IT', icon: '🐍', lang: 'ru',
    items: [
      { w: 'функция', clue: 'Именованный блок кода в Python, который создаётся ключевым словом def' },
      { w: 'переменная', clue: 'Именованная область памяти для хранения значения в программе' },
      { w: 'алгоритм', clue: 'Точная последовательность шагов для решения задачи' },
      { w: 'словарь', clue: 'Структура данных dict в Python, хранящая пары «ключ: значение»' },
      { w: 'кортеж', clue: 'Неизменяемая последовательность элементов tuple в Python' },
      { w: 'список', clue: 'Изменяемая коллекция элементов [1, 2, 3] в Python' },
      { w: 'индекс', clue: 'Порядковый номер элемента в списке или строке (начинается с 0)' },
      { w: 'строка', clue: 'Текстовый тип данных str в программировании' },
      { w: 'цикл', clue: 'Конструкция for или while для многократного повторения кода' },
      { w: 'модуль', clue: 'Файл или библиотека, подключаемая через import' },
      { w: 'отладка', clue: 'Процесс поиска и исправления ошибок (багов) в коде' },
      { w: 'массив', clue: 'Упорядоченный набор элементов одного типа в памяти' },
      { w: 'сервер', clue: 'Компьютер или программа, обрабатывающая запросы клиентов по сети' },
      { w: 'пиксель', clue: 'Наименьшая цветная точка цифрового изображения на экране' },
    ],
  },
  kyrgyzstan: {
    label: 'Кыргызстан', icon: '🏔️', lang: 'ru',
    items: [
      { w: 'бишкек', clue: 'Столица и крупнейший город Кыргызской Республики' },
      { w: 'манас', clue: 'Великий кыргызский народный эпос, включённый в список ЮНЕСКО' },
      { w: 'иссыккуль', clue: 'Горное незамерзающее озеро — «Жемчужина Кыргызстана»' },
      { w: 'комуз', clue: 'Национальный трёхструнный щипковый музыкальный инструмент' },
      { w: 'тюндюк', clue: 'Круглое навершие юрты, изображённое в центре флага КР' },
      { w: 'калпак', clue: 'Традиционный кыргызский белый войлочный головной убор' },
      { w: 'бурана', clue: 'Древняя историческая башня XI века в Чуйской долине' },
      { w: 'алатоо', clue: 'Величественные снежные горы Кыргызстана и главная площадь столицы' },
      { w: 'шырдак', clue: 'Традиционный кыргызский войлочный ковёр с узорами оймо' },
      { w: 'каракол', clue: 'Живописный город на востоке Иссык-Кульской области' },
      { w: 'джайлоо', clue: 'Высокогорное летнее пастбище в горах Тянь-Шаня' },
      { w: 'боорсок', clue: 'Традиционное кыргызское угощение из жареного теста' },
    ],
  },
  science: {
    label: 'Наука и Космос', icon: '🧬', lang: 'ru',
    items: [
      { w: 'молекула', clue: 'Наименьшая частица вещества, сохраняющая его химические свойства' },
      { w: 'электрон', clue: 'Отрицательно заряженная элементарная частица в атоме' },
      { w: 'галактика', clue: 'Гигантская звёздная система, например наш Млечный Путь' },
      { w: 'фотосинтез', clue: 'Образование органических веществ в зелёных листьях на свету' },
      { w: 'кислород', clue: 'Химический элемент O₂, необходимый для дыхания' },
      { w: 'гравитация', clue: 'Сила всемирного тяготения между всеми телами во Вселенной' },
      { w: 'хромосома', clue: 'Структура в ядре клетки, хранящая наследственную информацию ДНК' },
      { w: 'энергия', clue: 'Физическая величина, показывающая способность тела совершать работу' },
      { w: 'меркурий', clue: 'Самая близкая к Солнцу планета Солнечной системы' },
      { w: 'магнит', clue: 'Тело, обладающее собственным магнитным полем и полюсами N и S' },
    ],
  },
  math: {
    label: 'Математика', icon: '📐', lang: 'ru',
    items: [
      { w: 'уравнение', clue: 'Математическое равенство с одной или несколькими неизвестными (например, 2x + 4 = 10)' },
      { w: 'гипотенуза', clue: 'Самая длинная сторона прямоугольного треугольника напротив прямого угла' },
      { w: 'периметр', clue: 'Сумма длин всех сторон геометрической фигуры' },
      { w: 'теорема', clue: 'Математическое утверждение, истинность которого доказывается' },
      { w: 'процент', clue: 'Одна сотая доля числа, обозначаемая знаком %' },
      { w: 'диаметр', clue: 'Хорда окружности, проходящая точно через её центр (2 радиуса)' },
      { w: 'квадрат', clue: 'Прямоугольник, у которого все 4 стороны равны' },
      { w: 'делитель', clue: 'Число, на которое данное число делится без остатка' },
    ],
  },
  english: {
    label: 'English Words', icon: '🇬🇧', lang: 'en',
    items: [
      { w: 'knowledge', clue: 'Information, understanding and skills that you gain through education' },
      { w: 'mountain', clue: 'A very high natural elevation of the earth surface (like Ala-Too)' },
      { w: 'computer', clue: 'An electronic machine that processes data and runs programs' },
      { w: 'science', clue: 'The study of nature, physics, chemistry and biology' },
      { w: 'library', clue: 'A building or room containing collections of books for reading' },
      { w: 'victory', clue: 'Success in a game, competition, or struggle' },
      { w: 'language', clue: 'A system of communication used by people (English, Kyrgyz, Russian)' },
      { w: 'teacher', clue: 'A person who helps students acquire knowledge at school' },
    ],
  },
  kyrgyz_lang: {
    label: 'Кыргыз тили', icon: '🇰🇬', lang: 'kg',
    items: [
      { w: 'мектеп', clue: 'Балдар билим алган окуу жайы (Школа)' },
      { w: 'мугалим', clue: 'Окуучуларга билим жана тарбия берген инсан (Учитель)' },
      { w: 'китеп', clue: 'Билим булагы болгон басма чыгарма (Книга)' },
      { w: 'билим', clue: 'Окуу жана тажрыйба аркылуу алынган илим-көндүм (Знание)' },
      { w: 'комузчу', clue: 'Кыргыздын үч кылдуу комузунда кол ойноткон өнөрпоз' },
      { w: 'достук', clue: 'Адамдар ортосундагы ынтымак жана өз ара ишеним (Дружба)' },
      { w: 'эмгек', clue: 'Адамдын акыл жана күч жумшап жасаган пайдалуу иши (Труд)' },
      { w: 'жайлоо', clue: 'Тоо койнундагы жайкы салкын жайыт' },
    ],
  },
}

const CLUE_LOOKUP: Record<string, string> = {}
Object.values(CATEGORY_BANKS).forEach(cat => {
  cat.items.forEach(it => { CLUE_LOOKUP[it.w.toLowerCase()] = it.clue })
})

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
  if (/[үөң]/.test(join)) return 'kg'
  return 'ru'
}

function presetBank(lang: string): { label: string; words: string[] }[] {
  const l = lang === 'kg' ? 'kg' : lang === 'en' ? 'en' : 'ru'
  const ok = ['ru', 'kg'].includes(l) ? /^[а-яёүөң]+$/ : /^[a-z]+$/
  const raw = [...new Set((WORD_PACKS[l] || WORD_PACKS.ru).words.map(w => w.toLowerCase()))].filter(w => ok.test(w) && w.length >= 3 && w.length <= 10)
  const out: { label: string; words: string[] }[] = [
    { label: '🐍 Python и IT', words: CATEGORY_BANKS.python.items.map(i => i.w) },
    { label: '🏔️ Кыргызстан', words: CATEGORY_BANKS.kyrgyzstan.items.map(i => i.w) },
    { label: '🧬 Наука и Космос', words: CATEGORY_BANKS.science.items.map(i => i.w) },
  ]
  const chunks = [raw.slice(0, 8), raw.slice(8, 16)]
  chunks.forEach((c, i) => { if (c.length >= 4) out.push({ label: `📖 #${i + 1}`, words: c }) })
  return out
}

function pickBank(lang: string, diff: Diff, categoryKey: string = 'all'): string[] {
  if (categoryKey !== 'all' && CATEGORY_BANKS[categoryKey]?.items.length) {
    return CATEGORY_BANKS[categoryKey].items.map(x => x.w.toLowerCase())
  }
  const key = lang === 'kg' ? 'kg' : lang === 'en' ? 'en' : 'ru'
  const raw = (WORD_PACKS[key] || WORD_PACKS.ru).words
  const ok = ['ru', 'kg'].includes(key) ? /^[а-яёүөң]+$/ : /^[a-z]+$/
  const lo = diff === 'easy' ? 4 : 6
  const hi = diff === 'easy' ? 5 : 8
  return [...new Set(raw.map(w => w.toLowerCase()))].filter(w => w.length >= lo && w.length <= hi && ok.test(w))
}

function alphabetOf(bank: string[]): string[] {
  const set = new Set(bank.join('').split(''))
  // Добавляем стандартные буквы языка, чтобы клавиатура была полной и удобной
  const sample = bank.join('')
  if (/[a-z]/.test(sample)) {
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c => set.add(c))
  } else {
    'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.split('').forEach(c => set.add(c))
    if (/[үөң]/.test(sample)) {
      'өүң'.split('').forEach(c => set.add(c))
    }
  }
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
  const [category, setCategory] = useState<string>('all')
  const [visualScene, setVisualScene] = useState<VisualScene>('gallows')
  const [word, setWord] = useState('')
  const [guessed, setGuessed] = useState<string[]>([])
  const [solved, setSolved] = useState(0)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [showClue, setShowClue] = useState(true)
  const [best, setBest] = useState<string | null>(null)
  const [bestDiff, setBestDiff] = useState<string | null>(null)
  const [hintsLeft, setHintsLeft] = useState(2)
  const [flash, setFlash] = useState('')
  const [custom, setCustom] = useState<HmSet | null>(null)
  const [panel, setPanel] = useState<null | 'build'>(null)
  const [entry, setEntry] = useState<null | 'pick' | 'ready'>(null)

  // Автоподбор слов в билдере
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
  const bankRef = useRef(pickBank(lang, 'easy', 'all'))
  const seqRef = useRef<string[]>([])
  const seqIdx = useRef(0)

  useEffect(() => {
    try { setBest(localStorage.getItem('edu-hangman-best')) } catch {}
    try { setBestDiff(localStorage.getItem(`edu-hangman-best-${diff}`)) } catch {}
  }, [diff])

  useEffect(() => { (window as any).__hm = { word, guessed, solved, phase, diff, hints: hintsLeft, set: custom?.name || null } })

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
    setStreak(0)
    setScore(0)
    nextWord()
    setPhase('play')
    sfx('hm.go')
  }

  const exitCustom = () => {
    setCustom(null)
    setPhase('idle')
    sfx('ui.click')
  }

  useEffect(() => {
    client.get('/lessons/?owner=me').then(r => {
      const d = Array.isArray(r.data) ? r.data : r.data.results || []
      setLessons(d.slice(0, 40).map((x: any) => ({ id: x.id, title: x.title })))
    }).catch(() => {})
  }, [])

  const parseSetInput = (): { words: string[] } | { words: null; err: string } => {
    const words = [...new Set(cWords.split(/[\s,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean))]
    if (words.length < 3) return { words: null, err: t('ws_err_few') }
    if (words.length > 20) return { words: null, err: '≤ 20' }
    for (const w of words) {
      if (w.length < 3 || w.length > 14) return { words: null, err: `“${w}” — 3–14` }
      const hasCyr = /[а-яүөңё]/.test(w)
      const hasLat = /[a-z]/.test(w)
      if (hasCyr === hasLat) return { words: null, err: `“${w}” — ${t('ws_err_mixed')}` }
    }
    const anyCyr = words.some(w => /[а-яүөңё]/.test(w))
    const anyLat = words.some(w => /[a-z]/.test(w))
    if (anyCyr && anyLat) return { words: null, err: t('ws_err_mixed') }
    return { words }
  }

  const parsePromptWordCount = (s: string, fallback: number): number => {
    const m = s.toLowerCase().match(/\b(\d{1,2})\s*(?:слов\S*|сөз\S*|word\S*|вопрос\S*|шт\.?|штук\S*)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 3 && n <= 20) return n
    }
    const nums = (s.match(/\b(\d{1,2})\b/g) || []).map(Number).filter(n => n >= 3 && n <= 20)
    if (nums.length > 0) return nums[nums.length - 1]
    return Math.max(3, Math.min(20, fallback || 10))
  }

  const onAiPromptChange = (val: string) => {
    setAiPrompt(val)
    if (/\d/.test(val)) {
      setAiCount(parsePromptWordCount(val, aiCount))
    }
  }

  const genWordsAI = async () => {
    if (aiBusy) return
    if (aiPrompt.trim().length < 2) { setCErr(t('aiw_need_topic') || 'Напиши тему'); return }
    const targetCount = parsePromptWordCount(aiPrompt, aiCount)
    setAiCount(targetCount)
    setAiBusy(true); setCErr('')
    try {
      const r = await client.post('/ai/words/', { prompt: aiPrompt.trim(), count: targetCount })
      const words: string[] = (r.data.words || []).map(String)
      if (!words.length) throw new Error('empty')
      setCWords(words.join(', '))
      if (!cName.trim()) setCName(aiPrompt.trim().slice(0, 30))
      setAiSrc(typeof r.data.source === 'string' ? r.data.source : null)
      sfx('fb.pick')
    } catch (e: any) {
      setCErr(e?.response?.data?.error || t('aiw_fail') || 'Не получилось — напиши слова сам')
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
        .filter(w => /^[а-яүөңёa-z]{3,12}$/.test(w)))].slice(0, 12)
      if (words.length < 3) { setCErr(t('ws_err_few')); return }
      setCWords(words.join(', '))
      if (!cName.trim()) setCName(`${t('hm_from_lesson')}: ${String(r.data.title || '').slice(0, 20)}`)
      sfx('hm.hint')
    } catch { setCErr('⚠️') } finally { setGenBusy(false) }
  }

  const startGame = (overrideCat?: string) => {
    const catKey = overrideCat ?? category
    setSolved(0)
    setStreak(0)
    setScore(0)
    if (!custom) bankRef.current = pickBank(lang, diff, catKey)
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
  const wrong = alphabet.filter(al => guessed.includes(al) && !word.includes(al)).length
  const alive = wrong < LIVES

  useEffect(() => {
    if (phase !== 'play' || !word || guessed.length === 0) return
    if (isWin) {
      sfx('hm.win')
      hum(15)
      setFlash(t('hm_solved'))
      const ns = solved + 1
      const nStreak = streak + 1
      const gained = 100 + (LIVES - wrong) * 20 + Math.min(nStreak, 5) * 25
      setSolved(ns)
      setStreak(nStreak)
      setScore(s => s + gained)
      saveBest(ns)
      say(`${t('hm_solved')} ${word}`)
      const x = setTimeout(() => { nextWord() }, 1150)
      return () => clearTimeout(x)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWin])

  useEffect(() => {
    if (phase !== 'play' || alive || !word) return
    sfx('hm.lose')
    hum(60)
    setStreak(0)
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

  const d = drawFor(wrong)
  const wordClue = CLUE_LOOKUP[word.toLowerCase()] || (custom ? `Слово из набора «${custom.name}» (${word.length} букв)` : `Слово из ${word.length} букв`)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          {t('hm_to_games')}
        </a>
        {/* Переключатель 2D-сцены: Классическая Виселица или Воздушные шары */}
        <div className="inline-flex rounded-xl border dark:border-slate-700 overflow-hidden text-xs font-bold">
          <button
            type="button"
            onClick={() => setVisualScene('gallows')}
            className={`px-3 py-1.5 ${visualScene === 'gallows' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-slate-300'}`}
          >
            🎯 Классика 2D
          </button>
          <button
            type="button"
            onClick={() => setVisualScene('balloon')}
            className={`px-3 py-1.5 border-l dark:border-slate-700 ${visualScene === 'balloon' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-slate-300'}`}
          >
            🎈 Воздушный шар 2D
          </button>
        </div>
      </div>

      <h1 className="font-display font-bold text-2xl sm:text-3xl dark:text-white flex items-center gap-2">
        <span>{t('hm_title')} 🎯</span>
        {custom && <span className="text-sm px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">✨ {custom.name}</span>}
      </h1>

      {/* Тематические категории для быстрого выбора */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_BANKS).map(([key, cat]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setCustom(null)
              setCategory(key)
              if (phase === 'play') {
                bankRef.current = pickBank(lang, diff, key)
                seqRef.current = []
                seqIdx.current = 0
                nextWord()
              }
              sfx('ui.click')
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              !custom && category === key
                ? 'bg-amber-400 border-amber-500 text-slate-950 shadow'
                : 'bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {phase === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400">{t('hm_desc')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDiff('easy')} aria-pressed={diff === 'easy'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${diff === 'easy' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              {t('hm_diff_e')} (4–5)
            </button>
            <button onClick={() => setDiff('hard')} aria-pressed={diff === 'hard'}
              className={`px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold border ${diff === 'hard' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
              {t('hm_diff_h')} (6–8)
            </button>
            <button onClick={() => { setPanel('build'); setCErr(''); sfx('ui.click') }}
              data-testid="hm-build"
              className="px-4 py-3 min-h-[52px] rounded-xl text-sm font-bold bg-indigo-600 text-white hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-1.5">
              ✏️ {t('hm_build')}
            </button>
          </div>
          <div className="bg-indigo-50 dark:bg-blue-900/20 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-4 space-y-1.5 text-sm dark:text-slate-200">
            <div>• {t('hm_rule1')}</div>
            <div>• {t('hm_rule2')}</div>
            <div>• 💡 У каждого тематического слова есть учебная подсказка-определение!</div>
          </div>
          <button onClick={() => startGame()} className="w-full px-6 py-4 min-h-[56px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-lg">
            🎯 {t('hm_start')}
          </button>
          {(bestDiff || best) && <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Trophy size={15} /> {t('hm_best')}: {bestDiff || best} {t('hm_solved_n')}</div>}
        </>
      )}

      {phase !== 'idle' && (
        <>
          {/* Статус-бар игры */}
          <div className="flex flex-wrap gap-2.5 items-center font-bold dark:text-white bg-white dark:bg-slate-900 p-3 rounded-2xl border dark:border-slate-700 shadow-sm">
            {custom && (
              <button onClick={exitCustom} data-testid="hm-set-badge"
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center gap-1">
                ✨ {custom.name} <X size={13} />
              </button>
            )}
            <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm">
              ✓ {t('hm_solved_n')}: {solved}
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-mono">
              ⭐ {score} очк.
            </span>
            {streak >= 2 && (
              <span className="px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs flex items-center gap-1">
                <Flame size={14} /> ×{streak}
              </span>
            )}
            <span className={`px-3 py-1 rounded-xl text-sm ${wrong >= 4 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 animate-pulse' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {'❤️'.repeat(Math.max(0, LIVES - wrong))}{'🖤'.repeat(Math.min(LIVES, wrong))} ({LIVES - wrong})
            </span>

            {phase === 'play' && (
              <button onClick={useHint} disabled={hintsLeft <= 0}
                className="px-3 py-1.5 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-500 text-xs sm:text-sm font-bold flex items-center gap-1 disabled:opacity-40">
                <Lightbulb size={15} /> Открыть букву ×{hintsLeft}
              </button>
            )}
            <button onClick={() => startGame()} className="ml-auto px-3 py-1.5 min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-xs sm:text-sm inline-flex items-center gap-1">
              <RotateCcw size={15} /> {t('hm_again')}
            </button>
          </div>

          {flash && <div className="rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 animate-bounce">{flash}</div>}

          {/* Главная игровая карточка: 2D-иллюстрация + подсказка + буквы слова */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-700 p-4 sm:p-6 shadow-md flex flex-col sm:flex-row items-center gap-5">
            {/* 2D Сцена */}
            <div className="w-44 h-48 shrink-0 rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-100 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/60 border dark:border-slate-700 p-2 flex items-center justify-center relative overflow-hidden">
              {visualScene === 'gallows' ? (
                <svg viewBox="0 0 160 175" className="w-full h-full" aria-hidden="true">
                  {/* Солнце и горы на фоне */}
                  <circle cx="132" cy="28" r="14" fill="#fde047" opacity="0.8" />
                  <polygon points="0,155 45,95 95,155" fill="#94a3b8" opacity="0.35" />
                  <polygon points="65,155 115,85 160,155" fill="#64748b" opacity="0.35" />
                  <rect x="0" y="150" width="160" height="25" fill="#22c55e" opacity="0.45" />
                  {/* Деревянная стойка */}
                  <line x1="16" y1="152" x2="110" y2="152" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
                  <line x1="36" y1="152" x2="36" y2="16" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
                  <line x1="36" y1="16" x2="104" y2="16" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
                  <line x1="36" y1="38" x2="58" y2="16" stroke="#92400e" strokeWidth="4.5" strokeLinecap="round" />
                  {/* Верёвка */}
                  <line x1="104" y1="16" x2="104" y2="38" stroke="#d97706" strokeWidth="3.5" />

                  {/* Персонаж в Ак-Калпаке */}
                  {d.head && (
                    <g>
                      <circle cx="104" cy="54" r="14" fill="#fed7aa" stroke="#ea580c" strokeWidth="2.5" />
                      {/* Калпак */}
                      <polygon points="91,44 117,44 111,27 97,27" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
                      <line x1="90" y1="44" x2="118" y2="44" stroke="#1e293b" strokeWidth="2.5" />
                      {/* Выражение лица */}
                      {wrong >= 6 ? (
                        <g stroke="#dc2626" strokeWidth="2">
                          <line x1="97" y1="50" x2="101" y2="54" /><line x1="101" y1="50" x2="97" y2="54" />
                          <line x1="107" y1="50" x2="111" y2="54" /><line x1="111" y1="50" x2="107" y2="54" />
                          <path d="M99 61 Q104 57 109 61" fill="none" />
                        </g>
                      ) : (
                        <g fill="#0f172a">
                          <circle cx="99" cy="52" r="1.8" />
                          <circle cx="109" cy="52" r="1.8" />
                          <path d={wrong >= 4 ? 'M99 60 Q104 57 109 60' : 'M99 59 Q104 63 109 59'} stroke="#0f172a" strokeWidth="1.8" fill="none" />
                        </g>
                      )}
                    </g>
                  )}
                  {d.body && (
                    <rect x="95" y="68" width="18" height="36" rx="6" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="2" />
                  )}
                  {d.armL && <line x1="95" y1="74" x2="77" y2="94" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />}
                  {d.armR && <line x1="113" y1="74" x2="131" y2="94" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />}
                  {d.legL && <line x1="99" y1="104" x2="85" y2="132" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />}
                  {d.legR && <line x1="109" y1="104" x2="123" y2="132" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />}
                </svg>
              ) : (
                /* 2D Сцена: Воздушный шар над Иссык-Кулем (6 шаров = 6 жизней) */
                <svg viewBox="0 0 160 175" className="w-full h-full" aria-hidden="true">
                  <rect x="0" y="145" width="160" height="30" fill="#0284c7" opacity="0.55" />
                  <path d="M0 152 Q40 146 80 152 T160 152" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.7" />
                  <g transform={`translate(0, ${wrong * 11})`} style={{ transition: 'transform 400ms ease-out' }}>
                    {[
                      { cx: 52, cy: 36, color: '#ef4444' },
                      { cx: 70, cy: 26, color: '#f59e0b' },
                      { cx: 90, cy: 26, color: '#10b981' },
                      { cx: 108, cy: 36, color: '#3b82f6' },
                      { cx: 64, cy: 46, color: '#8b5cf6' },
                      { cx: 96, cy: 46, color: '#ec4899' },
                    ].map((b, idx) => {
                      const aliveBalloon = idx < (LIVES - wrong)
                      return aliveBalloon ? (
                        <g key={idx}>
                          <line x1={b.cx} y1={b.cy + 14} x2="80" y2="86" stroke="#64748b" strokeWidth="1.5" />
                          <ellipse cx={b.cx} cy={b.cy} rx="13" ry="16" fill={b.color} />
                          <circle cx={b.cx - 4} cy={b.cy - 5} r="3" fill="#ffffff" opacity="0.45" />
                        </g>
                      ) : null
                    })}
                    {/* Корзина с путешественником */}
                    <rect x="64" y="86" width="32" height="24" rx="5" fill="#b45309" stroke="#78350f" strokeWidth="2" />
                    <circle cx="80" cy="77" r="8" fill="#fed7aa" stroke="#78350f" strokeWidth="1.5" />
                  </g>
                </svg>
              )}
            </div>

            {/* Правая часть: Подсказка-определение + Табло букв слова */}
            <div className="flex-1 min-w-0 w-full space-y-4">
              <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex items-start justify-between gap-2">
                <div className="text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                  <span className="font-extrabold text-amber-700 dark:text-amber-400 block mb-0.5">💡 Подсказка-определение:</span>
                  {showClue ? wordClue : <span className="italic opacity-70">Подсказка скрыта (нажми глаз, чтобы показать)</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowClue(v => !v)}
                  className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 text-amber-700 dark:text-amber-300 shrink-0"
                  title="Показать/скрыть определение"
                >
                  <Eye size={15} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center sm:justify-start" aria-label={t('hm_word_aria')}>
                {word.split('').map((ch, i) => (
                  <span
                    key={i}
                    className={`w-9 h-12 sm:w-11 sm:h-14 rounded-xl border-2 flex items-center justify-center font-display font-black text-xl sm:text-2xl uppercase transition-all ${
                      guessed.includes(ch)
                        ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/40 text-emerald-900 dark:text-white scale-105 shadow-sm'
                        : phase === 'over'
                          ? 'bg-rose-50 border-rose-400 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 border-b-4 dark:text-white'
                    }`}
                  >
                    {guessed.includes(ch) ? ch : phase === 'over' ? ch : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Экранная клавиатура */}
          {phase === 'play' && (
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 bg-white dark:bg-slate-900 p-4 rounded-3xl border dark:border-slate-700 shadow-sm" role="group" aria-label={t('hm_alpha_aria')}>
              {alphabet.map(al => {
                const used = guessed.includes(al)
                const good = used && word.includes(al)
                return (
                  <button
                    key={al}
                    onClick={() => guess(al)}
                    disabled={used}
                    className={`w-10 h-11 sm:w-12 sm:h-12 rounded-xl font-display font-bold text-lg uppercase border-2 transition-all ${
                      good
                        ? 'bg-emerald-500 border-emerald-600 text-white scale-95 shadow-inner'
                        : used
                          ? 'bg-rose-100 border-rose-200 text-rose-400 dark:bg-rose-950/40 dark:border-rose-900 opacity-60'
                          : 'bg-slate-50 border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 active:scale-95 dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {al}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {phase === 'over' && (
        <div className="text-center bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-3xl p-6 shadow-lg space-y-2">
          <div className="text-5xl">🎯</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('hm_lost')}</div>
          <div className="text-sm text-slate-500">Загаданное слово:</div>
          <div className="font-display font-black text-2xl text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{word}</div>
          <div className="text-xs text-slate-500 max-w-md mx-auto">{wordClue}</div>
          <div className="text-slate-600 dark:text-slate-300 font-bold pt-1">
            {t('hm_solved_n')}: {solved} · Очки: {score}{best ? ` • ${t('hm_best')}: ${best}` : ''}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button onClick={() => startGame()} className="px-6 py-3 min-h-[52px] rounded-xl bg-indigo-600 text-white font-bold inline-flex items-center justify-center gap-2"><RotateCcw size={17} /> {t('hm_again')}</button>
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
                  <div className="text-xs text-slate-500 dark:text-slate-400">{pr.words.slice(0, 5).join(' · ')}…</div>
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
                      <span className="p-1.5 rounded-lg bg-indigo-600 text-white"><Play size={12} /></span>
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
            {AI_FEATURES && isTeacherAIAllowed() && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-2" data-testid="hm-ai">
                <button onClick={() => { setAiOpen(v => !v); sfx('ui.click') }}
                  className="px-3 py-2 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                  <Sparkles size={15} /> {t('aiw_title')} {aiOpen ? '▾' : '▸'}
                </button>
                {aiOpen && (
                  <div className="flex flex-wrap items-center gap-2" data-testid="hm-ai-panel">
                    <input value={aiPrompt} onChange={e => onAiPromptChange(e.target.value)} placeholder="Напр.: «сделай по пайтону 14 слов»"
                      className="flex-1 min-w-[180px] px-3 py-2.5 min-h-[48px] rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-sm" />
                    <input type="number" min={3} max={20} value={aiCount} onChange={e => setAiCount(Math.max(3, Math.min(20, parseInt(e.target.value) || 10)))}
                      aria-label={t('aiw_count')} className="w-16 px-2 py-2.5 min-h-[48px] rounded-xl border bg-white dark:bg-slate-700 dark:text-white text-sm text-center font-bold" />
                    <button onClick={genWordsAI} disabled={aiBusy}
                      className="px-4 py-2.5 min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                      {aiBusy ? '⏳' : t('aiw_gen')}
                    </button>
                    {aiSrc && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 w-full">{t('aiw_src')}</span>}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={playNow} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-1.5"><Play size={15} /> {t('hm_play_set')}</button>
              <button onClick={saveSet} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"><Save size={15} /> {t('hm_save_set')}</button>
              {lessonId && (
                <button onClick={fromLesson} disabled={genBusy} className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50">
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
                    <button onClick={() => { setPanel(null); playCustom(set) }} aria-label={t('games_play')} className="p-2 min-h-[36px] min-w-[36px] rounded-lg bg-indigo-600 text-white"><Play size={14} /></button>
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
