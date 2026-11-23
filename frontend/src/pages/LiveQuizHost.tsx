import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client, { WS_BASE } from '../api/client'
import { READY_TOPICS } from '../data/readyTopics'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { sfx, startBgMusic, stopBgMusic } from '../utils/sfx'
import LiveAvatar from '../components/LiveAvatar'
import {
  Zap, Users, Play, Trophy, Mountain, Shield, Copy, Check, ExternalLink,
  Bot, ArrowRight, RotateCcw, Flame, AlertTriangle, Sparkles, Plus, Trash2,
  Edit3, Save, Wand2, FileText, Volume2, VolumeX, CheckCircle2, Coins
} from 'lucide-react'

type QuizMode = 'gold' | 'classic' | 'race' | 'boss'

export type CustomQ = {
  text: string
  explanation?: string
  options: { text: string; is_correct: boolean }[]
}

export type CustomKahootPack = {
  id: string
  title: string
  createdAt: string
  questions: CustomQ[]
}

const CUSTOM_PACKS_KEY = 'edu-custom-kahoots-v1'

function loadCustomPacks(): CustomKahootPack[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PACKS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function saveCustomPacks(list: CustomKahootPack[]) {
  try { localStorage.setItem(CUSTOM_PACKS_KEY, JSON.stringify(list)) } catch {}
}

const OPT_STYLES = [
  { bg: 'bg-rose-600', border: 'border-rose-400', light: 'bg-rose-500/20 border-rose-400', shape: '▲', label: 'Красный' },
  { bg: 'bg-blue-600', border: 'border-blue-400', light: 'bg-blue-500/20 border-blue-400', shape: '◆', label: 'Синий' },
  { bg: 'bg-amber-500', border: 'border-amber-300', light: 'bg-amber-500/20 border-amber-400', shape: '●', label: 'Жёлтый' },
  { bg: 'bg-emerald-600', border: 'border-emerald-400', light: 'bg-emerald-500/20 border-emerald-400', shape: '■', label: 'Зелёный' },
]

const ERUDITION_PACK = {
  id: 'erudition',
  title: 'Эрудиция и Кыргызстан',
  icon: '🏔️',
  desc: '6 ярких вопросов: география КР, наука, логика и технологии.',
  questions: [
    {
      text: 'Какая самая высокая вершина Кыргызстана?',
      options: [
        { text: 'Пик Победы (Жеңиш)', is_correct: true },
        { text: 'Пик Ленина', is_correct: false },
        { text: 'Хан-Тенгри', is_correct: false },
        { text: 'Ала-Арча', is_correct: false },
      ],
    },
    {
      text: 'Чему равно 15% от 200?',
      options: [
        { text: '25', is_correct: false },
        { text: '30', is_correct: true },
        { text: '35', is_correct: false },
        { text: '20', is_correct: false },
      ],
    },
    {
      text: 'Какая планета Солнечной системы самая большая?',
      options: [
        { text: 'Сатурн', is_correct: false },
        { text: 'Марс', is_correct: false },
        { text: 'Юпитер', is_correct: true },
        { text: 'Нептун', is_correct: false },
      ],
    },
    {
      text: 'Что выведет Python: print(len("Бишкек"))?',
      options: [
        { text: '5', is_correct: false },
        { text: '6', is_correct: true },
        { text: '7', is_correct: false },
        { text: 'Ошибку', is_correct: false },
      ],
    },
    {
      text: 'Какое озеро в Кыргызстане входит в число крупнейших высокогорных озёр мира?',
      options: [
        { text: 'Сон-Куль', is_correct: false },
        { text: 'Сары-Челек', is_correct: false },
        { text: 'Иссык-Куль', is_correct: true },
        { text: 'Чатыр-Куль', is_correct: false },
      ],
    },
    {
      text: 'Продолжи логическую цепочку: 2, 6, 12, 20, 30, ...?',
      options: [
        { text: '40', is_correct: false },
        { text: '42', is_correct: true },
        { text: '38', is_correct: false },
        { text: '44', is_correct: false },
      ],
    },
  ],
}

const BUILTIN_PACKS = [ERUDITION_PACK, ...READY_TOPICS]

const emptyQuestion = (): CustomQ => ({
  text: '',
  explanation: '',
  options: [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
})

export default function LiveQuizHost() {
  const { t } = useLang()
  const [params] = useSearchParams()
  const preTestId = params.get('test') || ''

  // Setup state
  const [phase, setPhase] = useState<'setup' | 'lobby' | 'question' | 'reveal' | 'podium'>('setup')
  const [sourceKind, setSourceKind] = useState<'builtin' | 'custom' | 'builder' | 'db'>(preTestId ? 'db' : 'builtin')
  const [builtinId, setBuiltinId] = useState('erudition')
  const [dbTests, setDbTests] = useState<any[]>([])
  const [selTestId, setSelTestId] = useState(preTestId)
  const [mode, setMode] = useState<QuizMode>('gold')
  const [tpq, setTpq] = useState(20)
  const [doubleLast, setDoubleLast] = useState(true)
  const [creating, setCreating] = useState(false)
  const [musicOn, setMusicOn] = useState(false)

  // Конструктор собственной игры преподавателя
  const [customPacks, setCustomPacks] = useState<CustomKahootPack[]>(() => loadCustomPacks())
  const [selCustomId, setSelCustomId] = useState<string>(() => loadCustomPacks()[0]?.id || '')
  const [editPackId, setEditPackId] = useState<string | null>(null)
  const [bTitle, setBTitle] = useState('Моя викторина для класса')
  const [bQs, setBQs] = useState<CustomQ[]>([
    {
      text: 'Столица Кыргызской Республики?',
      explanation: 'Бишкек — столица и крупнейший город Кыргызстана.',
      options: [
        { text: 'Бишкек', is_correct: true },
        { text: 'Ош', is_correct: false },
        { text: 'Каракол', is_correct: false },
        { text: 'Нарын', is_correct: false },
      ],
    },
  ])
  const [bCurIdx, setBCurIdx] = useState(0)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [alsoSaveToDb, setAlsoSaveToDb] = useState(true)

  // Live room state
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [curQ, setCurQ] = useState<any>(null)
  const [remSec, setRemSec] = useState(0)
  const [answeredCnt, setAnsweredCnt] = useState({ answered: 0, total: 0 })
  const [revealData, setRevealData] = useState<any>(null)
  const [podiumData, setPodiumData] = useState<any>(null)
  const [boss, setBoss] = useState<any>({ name: 'Дракон Пробелов', hp: 1000, max_hp: 1000, shield: 100 })
  const [copied, setCopied] = useState(false)
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; name: string; avatar: string; left: number }>>([])
  const [goldEvents, setGoldEvents] = useState<Array<{ id: number; text: string; emoji: string; tone?: string; player_name: string; player_avatar: string }>>([])
  const [liveLeaderboard, setLiveLeaderboard] = useState<any[]>([])
  const [introBanner, setIntroBanner] = useState<null | { num: number; total: number; isDouble: boolean }>(null)
  const [podiumStep, setPodiumStep] = useState(3)

  const wsRef = useRef<WebSocket | null>(null)
  const reactionIdRef = useRef(0)
  const goldEventIdRef = useRef(0)

  const loadDbTests = () => {
    client.get('/tests/?page_size=50').then(r => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      setDbTests(list)
      if (!selTestId && list.length) setSelTestId(String(list[0].id))
    }).catch(() => {})
  }

  useEffect(() => {
    loadDbTests()
    return () => {
      stopBgMusic()
      try { wsRef.current?.close() } catch {}
    }
  }, [])

  // Метроном последних 5 секунд + фоновая музыка
  useEffect(() => {
    if (phase !== 'question' || remSec <= 0) return
    const id = window.setInterval(() => {
      setRemSec(s => {
        const next = Math.max(0, s - 1)
        if (next > 0 && next <= 5) sfx('lq.tick')
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, remSec > 0])

  const toggleMusic = () => {
    if (musicOn) {
      stopBgMusic()
      setMusicOn(false)
    } else {
      startBgMusic(phase === 'question' ? 'battle' : 'lobby')
      setMusicOn(true)
    }
  }

  const sendWs = (obj: any) => {
    try { wsRef.current?.send(JSON.stringify(obj)) } catch {}
  }

  // ── Операции Конструктора Кахут ──
  const curBuilderQ = bQs[bCurIdx] || bQs[0] || emptyQuestion()

  const updateCurQ = (patch: Partial<CustomQ>) => {
    setBQs(prev => prev.map((q, i) => (i === bCurIdx ? { ...q, ...patch } : q)))
  }

  const updateCurOpt = (oIdx: number, patch: Partial<{ text: string; is_correct: boolean }>) => {
    setBQs(prev =>
      prev.map((q, i) =>
        i === bCurIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) }
          : q
      )
    )
  }

  const setQuestionAsTrueFalse = () => {
    sfx('ui.click')
    updateCurQ({
      options: [
        { text: 'Правда (Верно)', is_correct: true },
        { text: 'Ложь (Неверно)', is_correct: false },
      ],
    })
  }

  const setQuestionAs4Options = () => {
    sfx('ui.click')
    if (curBuilderQ.options.length >= 4) return
    const padded = [...curBuilderQ.options]
    while (padded.length < 4) padded.push({ text: '', is_correct: false })
    updateCurQ({ options: padded })
  }

  const addBuilderQ = () => {
    sfx('ui.click')
    setBQs(prev => {
      const next = [...prev, emptyQuestion()]
      setBCurIdx(next.length - 1)
      return next
    })
  }

  const duplicateBuilderQ = () => {
    sfx('ui.click')
    const clone: CustomQ = JSON.parse(JSON.stringify(curBuilderQ))
    setBQs(prev => {
      const next = [...prev.slice(0, bCurIdx + 1), clone, ...prev.slice(bCurIdx + 1)]
      setBCurIdx(bCurIdx + 1)
      return next
    })
  }

  const removeBuilderQ = (idx: number) => {
    if (bQs.length <= 1) { toast('В игре должен быть хотя бы 1 вопрос', 'error'); return }
    sfx('ui.click')
    setBQs(prev => {
      const next = prev.filter((_, i) => i !== idx)
      setBCurIdx(Math.max(0, Math.min(bCurIdx, next.length - 1)))
      return next
    })
  }

  const importBulkQuestions = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast('Вставь строки с вопросами', 'error'); return }
    const parsed: CustomQ[] = []
    for (const ln of lines) {
      const parts = ln.split('|').map(s => s.trim()).filter(Boolean)
      if (parts.length >= 3) {
        const qText = parts[0]
        const opts = parts.slice(1, 5).map((txt, idx) => ({ text: txt, is_correct: idx === 0 }))
        parsed.push({ text: qText, options: opts, explanation: '' })
      }
    }
    if (!parsed.length) {
      toast('Формат строки: Вопрос? | Правильный ответ | Неверный 1 | Неверный 2', 'error')
      return
    }
    setBQs(prev => {
      const cleaned = prev.filter(q => q.text.trim())
      const next = [...cleaned, ...parsed]
      setBCurIdx(next.length - 1)
      return next
    })
    setBulkText('')
    setBulkOpen(false)
    sfx('ui.success')
    toast(`Добавлено вопросов: +${parsed.length}`, 'success')
  }

  const parsePromptCount = (promptStr: string, fallback: number): number => {
    const s = promptStr.toLowerCase()
    const m = s.match(/\b(\d{1,2})\s*(?:вопрос\S*|вопр\.?|суроо\S*|question\S*|задани\S*|шт\.?|штук\S*)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 40) return n
    }
    const cleaned = s.replace(/\b\d{1,2}\s*[-–]?\s*(?:класс\S*|кл\.?|grade\S*)/gi, '').replace(/python\s*3/gi, '')
    const nums = (cleaned.match(/\b(\d{1,2})\b/g) || []).map(Number).filter(n => n >= 1 && n <= 40)
    if (nums.length > 0) return nums[nums.length - 1]
    return Math.max(1, Math.min(40, fallback || 10))
  }

  const onAiTopicChange = (val: string) => {
    setAiTopic(val)
    const detected = parsePromptCount(val, -1)
    if (detected >= 1 && detected <= 40 && /\d/.test(val)) {
      setAiCount(detected)
    }
  }

  const generateWithAI = async () => {
    if (!aiTopic.trim()) { toast('Введи тему или запрос (например: «сделай мне вопросы по пайтону 14 вопросов»)', 'error'); return }
    const targetCount = parsePromptCount(aiTopic, aiCount)
    setAiCount(targetCount)
    setAiBusy(true)
    try {
      const r = await client.post('/tests/generate/', {
        count: targetCount,
        prompt: aiTopic.trim(),
        text: '',
      })
      const genQs: CustomQ[] = (r.data?.questions || []).map((q: any) => ({
        text: q.text || '',
        explanation: q.explanation || '',
        options: (q.options || []).slice(0, 4).map((o: any) => ({ text: o.text || '', is_correct: !!o.is_correct })),
      })).filter((q: CustomQ) => q.text && q.options.length >= 2)
      if (!genQs.length) throw new Error('empty')
      setBQs(prev => {
        // Если в конструкторе был только 1 стартовый демо-вопрос — заменяем его, чтобы получилось РОВНО targetCount вопросов!
        const isOnlyDefault =
          prev.length === 1 &&
          (!prev[0].text.trim() || prev[0].text.trim() === 'Столица Кыргызской Республики?')
        const cleaned = isOnlyDefault ? [] : prev.filter(q => q.text.trim())
        const next = [...cleaned, ...genQs]
        setBCurIdx(0)
        return next
      })
      const cleanName = aiTopic.trim()
        .replace(/\b(?:сделай|создай|составь|сгенерируй|мне|нам|вопросы|вопросов|по|теме|на|тему)\b/gi, ' ')
        .replace(/\b\d{1,2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!bTitle.trim() || bTitle === 'Моя викторина для класса') {
        setBTitle(`Квиз: ${cleanName || aiTopic.trim()}`)
      }
      setAiTopic('')
      sfx('ui.success')
      toast(`✨ Сгенерировано ровно ${genQs.length} вопр.! Проверь и запускай игру.`, 'success')
    } catch {
      toast('Не удалось сгенерировать вопросы автоматически — добавь вручную или списком', 'error')
    }
    setAiBusy(false)
  }

  const validateAndSaveBuilder = async (): Promise<CustomKahootPack | null> => {
    const title = bTitle.trim()
    if (!title) { toast('Введи название своей игры', 'error'); return null }
    const validQs: CustomQ[] = []
    for (let i = 0; i < bQs.length; i++) {
      const q = bQs[i]
      const qt = q.text.trim()
      const filledOpts = q.options.map(o => ({ text: o.text.trim(), is_correct: o.is_correct })).filter(o => o.text)
      if (!qt || filledOpts.length < 2) {
        setBCurIdx(i)
        toast(`Вопрос №${i + 1}: заполни текст вопроса и минимум 2 варианта ответа`, 'error')
        return null
      }
      if (!filledOpts.some(o => o.is_correct)) filledOpts[0].is_correct = true
      validQs.push({ text: qt, explanation: (q.explanation || '').trim(), options: filledOpts })
    }

    const pack: CustomKahootPack = {
      id: editPackId || ('kh_' + Date.now()),
      title,
      createdAt: new Date().toLocaleDateString(),
      questions: validQs,
    }
    const nextList = [pack, ...customPacks.filter(p => p.id !== pack.id)]
    setCustomPacks(nextList)
    saveCustomPacks(nextList)
    setSelCustomId(pack.id)
    setEditPackId(pack.id)

    if (alsoSaveToDb) {
      try {
        await client.post('/tests/', {
          title,
          description: 'Создано в конструкторе Билим-Квиз Live (Kahoot)',
          pass_score: 60,
          time_limit: 0,
          time_per_question: tpq,
          is_public: true,
          questions: validQs.map((q, idx) => ({
            text: q.text,
            type: 'single',
            points: 1,
            order: idx,
            explanation: q.explanation || '',
            options: q.options.map((o, j) => ({ text: o.text, is_correct: o.is_correct, order: j })),
          })),
        })
        loadDbTests()
      } catch {
        // Локально игра уже сохранена — не блокируем запуск
      }
    }

    sfx('ui.success')
    toast(`Игра «${title}» (${validQs.length} вопр.) сохранена!`, 'success')
    return pack
  }

  const editSavedPack = (pk: CustomKahootPack) => {
    setEditPackId(pk.id)
    setBTitle(pk.title)
    setBQs(JSON.parse(JSON.stringify(pk.questions)))
    setBCurIdx(0)
    setSourceKind('builder')
    sfx('ui.click')
  }

  const deleteSavedPack = (id: string) => {
    const next = customPacks.filter(p => p.id !== id)
    setCustomPacks(next)
    saveCustomPacks(next)
    if (selCustomId === id) setSelCustomId(next[0]?.id || '')
    toast('Игра удалена', 'success')
  }

  const createRoom = async (overridePack?: CustomKahootPack) => {
    let packToLaunch = overridePack || null
    if (!packToLaunch && sourceKind === 'builder') {
      packToLaunch = await validateAndSaveBuilder()
      if (!packToLaunch) return
    }

    setCreating(true)
    try {
      const payload: any = {
        mode,
        time_per_question: tpq,
        double_last: doubleLast,
        origin: window.location.origin,
      }
      if (packToLaunch) {
        payload.title = packToLaunch.title
        payload.questions = packToLaunch.questions
      } else if (sourceKind === 'custom') {
        const found = customPacks.find(p => p.id === selCustomId) || customPacks[0]
        if (!found) { toast('Сначала создай свою игру во вкладке «Создать свой Кахут»', 'error'); setCreating(false); return }
        payload.title = found.title
        payload.questions = found.questions
      } else if (sourceKind === 'db' && selTestId) {
        payload.test_id = Number(selTestId)
      } else {
        const pack = BUILTIN_PACKS.find(p => p.id === builtinId) || BUILTIN_PACKS[0]
        payload.title = pack.title
        payload.questions = pack.questions
      }
      const r = await client.post('/live-quiz/create/', payload)
      setRoomInfo(r.data)

      const token = localStorage.getItem('access') || localStorage.getItem('token') || ''
      const ws = new WebSocket(`${WS_BASE}/ws/quiz/${r.data.pin}/?token=${encodeURIComponent(token)}`)
      wsRef.current = ws
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'host_join', secret: r.data.host_secret }))
      }
      ws.onmessage = (ev) => {
        let m: any = null
        try { m = JSON.parse(ev.data) } catch { return }
        if (m.type === 'host_ready') {
          setPlayers(m.players || [])
          if (m.boss) setBoss(m.boss)
          setPhase('lobby')
          sfx('ui.win')
        } else if (m.type === 'players_update') {
          setPlayers(m.players || [])
          sfx('lq.join')
        } else if (m.type === 'reaction') {
          const rid = ++reactionIdRef.current
          const left = 10 + Math.floor(Math.random() * 75)
          setReactions(prev => [...prev.slice(-18), { id: rid, emoji: m.emoji || '🔥', name: m.name || '', avatar: m.avatar || '', left }])
          sfx('ui.click', 0.3)
          window.setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== rid))
          }, 3100)
        } else if (m.type === 'gold_event') {
          const gid = ++goldEventIdRef.current
          setGoldEvents(prev => [
            {
              id: gid,
              text: m.text || '',
              emoji: m.emoji || '🪙',
              tone: m.tone || 'good',
              player_name: m.player_name || '',
              player_avatar: m.player_avatar || '',
            },
            ...prev.slice(0, 5),
          ])
          if (Array.isArray(m.leaderboard)) {
            setLiveLeaderboard(m.leaderboard)
            setRevealData((prev: any) => (prev ? { ...prev, leaderboard: m.leaderboard } : prev))
          }
          if (m.tone === 'steal' || m.tone === 'swap' || m.tone === 'legend') sfx('ui.notify', 0.6)
        } else if (m.type === 'question') {
          setCurQ(m)
          setRemSec(m.time_limit || tpq)
          setAnsweredCnt({ answered: 0, total: m.total_players || 0 })
          setRevealData(null)
          setGoldEvents([])
          if (m.boss) setBoss(m.boss)
          setIntroBanner({ num: (m.q_index ?? 0) + 1, total: m.total || 1, isDouble: !!m.is_double })
          window.setTimeout(() => setIntroBanner(null), 1150)
          setPhase('question')
          sfx('ws.go')
        } else if (m.type === 'answer_count') {
          setAnsweredCnt({ answered: m.answered || 0, total: m.total_players || 0 })
          sfx('ui.click', 0.5)
        } else if (m.type === 'reveal') {
          setIntroBanner(null)
          setRevealData(m)
          if (Array.isArray(m.leaderboard)) setLiveLeaderboard(m.leaderboard)
          if (m.boss) setBoss(m.boss)
          setPhase('reveal')
          sfx('lq.reveal')
        } else if (m.type === 'podium') {
          stopBgMusic()
          setMusicOn(false)
          setIntroBanner(null)
          setPodiumData(m)
          if (m.boss) setBoss(m.boss)
          setPodiumStep(0)
          setPhase('podium')
          sfx('lq.podium')
          window.setTimeout(() => setPodiumStep(1), 250)
          window.setTimeout(() => setPodiumStep(2), 950)
          window.setTimeout(() => { setPodiumStep(3); sfx('ui.win') }, 1750)
        } else if (m.type === 'error') {
          toast(m.message || 'Ошибка комнаты', 'error')
        }
      }
      ws.onerror = () => toast('Не удалось подключиться к WebSocket Live-квиза', 'error')
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Ошибка создания Live-комнаты', 'error')
    }
    setCreating(false)
  }

  const copyPin = () => {
    if (!roomInfo?.pin) return
    navigator.clipboard?.writeText(roomInfo.pin)
    setCopied(true)
    sfx('ui.notify')
    toast(`PIN ${roomInfo.pin_fmt} скопирован!`, 'success')
    setTimeout(() => setCopied(false), 1500)
  }

  const resetToSetup = () => {
    stopBgMusic()
    setMusicOn(false)
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setRoomInfo(null); setPlayers([]); setCurQ(null); setRevealData(null); setPodiumData(null); setGoldEvents([]); setLiveLeaderboard([])
    setPhase('setup')
  }

  const bossPct = boss?.max_hp ? Math.max(0, Math.round((boss.hp / boss.max_hp) * 100)) : 100
  const maxRaceScore = Math.max(1000, (roomInfo?.questions_count || 5) * 1000)
  const qTimePct = curQ?.time_limit ? Math.max(0, Math.min(100, (remSec / curQ.time_limit) * 100)) : 100

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-indigo-950 via-violet-950 to-slate-950 px-3 py-5 sm:px-6 text-white overflow-hidden" data-testid="live-host-page">
      <style>{`
        @keyframes lqFloatUp {
          0% { transform: translateY(20px) scale(0.7); opacity: 0; }
          15% { opacity: 1; transform: translateY(-20px) scale(1.08); }
          85% { opacity: 1; }
          100% { transform: translateY(-420px) scale(0.95); opacity: 0; }
        }
        @keyframes lqPopIn {
          0% { transform: scale(0.65) translateY(18px); opacity: 0; }
          70% { transform: scale(1.06) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .lq-float-reaction { animation: lqFloatUp 3s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .lq-pop-in { animation: lqPopIn 0.48s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      {/* Живые всплывающие реакции учеников на проекторе */}
      {reactions.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 top-20 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
          {reactions.map(r => (
            <div
              key={r.id}
              className="lq-float-reaction absolute bottom-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 border border-white/20 shadow-2xl backdrop-blur-md"
              style={{ left: `${r.left}%` }}
            >
              <LiveAvatar code={r.avatar} size="xs" />
              <span className="text-xs font-extrabold text-indigo-100 max-w-[90px] truncate">{r.name}</span>
              <span className="text-2xl leading-none">{r.emoji}</span>
            </div>
          ))}
        </div>
      )}

      {/* Краткая заставка нового вопроса в стиле шоу Kahoot */}
      {introBanner && phase === 'question' && (
        <div
          onClick={() => setIntroBanner(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/85 backdrop-blur-md cursor-pointer"
        >
          <div className="lq-pop-in text-center space-y-3 px-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-amber-300 font-black text-sm uppercase tracking-widest">
              {introBanner.isDouble ? '⚡ ФИНАЛЬНЫЙ РАУНД · ×2 ОЧКОВ!' : '🎯 ПРИГОТОВЬТЕСЬ!'}
            </div>
            <div className="text-5xl sm:text-7xl font-display font-black drop-shadow-2xl">
              ВОПРОС {introBanner.num} <span className="text-indigo-300 text-3xl sm:text-5xl">/ {introBanner.total}</span>
            </div>
            <div className="text-sm text-indigo-200 font-semibold">Смотрите на экран и нажимайте ответ на телефоне!</div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-5 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/games" className="text-sm font-bold text-indigo-300 hover:text-white">{t('hm_to_games')}</Link>
          <div className="flex items-center gap-2">
            {phase !== 'setup' && (
              <button type="button" onClick={toggleMusic}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                  musicOn ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}>
                {musicOn ? <Volume2 size={14} /> : <VolumeX size={14} />} {musicOn ? 'Музыка ВКЛ' : '🎵 Музыка лобби'}
              </button>
            )}
            <Link to="/live" className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5">
              📱 Экран ученика (PIN) <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* ═══════════════ 1. НАСТРОЙКА И КОНСТРУКТОР КАХУТ ═══════════════ */}
        {phase === 'setup' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-xs font-extrabold">
                <Sparkles size={13} /> СОЗДАВАЙ СВОИ ИГРЫ И ЗАПУСКАЙ НА ВЕСЬ КЛАСС · АНАЛОГ BLOOKET И KAHOOT
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-black">⚡ {t('games_livequiz')}</h1>
              <p className="text-sm text-indigo-200/80">Преподаватель может сам собрать свою игру в конструкторе, сгенерировать с ИИ или выбрать готовый тест!</p>
            </div>

            <div className="bg-slate-900/85 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
              {/* 1. Выбор режима отображения на проекторе */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">1. Режим шоу на проекторе</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {([
                    ['gold', '💰 Золотая лихорадка', 'В стиле Blooket: за верный ответ открой 1 из 3 сундуков (×2, Кража 25%, Обмен!)', Coins],
                    ['classic', '🏆 Классика Kahoot', 'Гистограмма, лидерборд Топ-5 и пьедестал 1–2–3', Trophy],
                    ['race', '🏔️ Гонка на Ала-Тоо', 'Блуки класса мчатся к вершине Пика Победы!', Mountain],
                    ['boss', '🏰 Босс-рейд', 'Весь класс объединяется против Дракона Пробелов!', Shield],
                  ] as [QuizMode, string, string, any][]).map(([k, title, sub]) => (
                    <button key={k} type="button" onClick={() => { setMode(k); sfx('ui.click') }}
                      data-testid={`lq-mode-${k}`}
                      className={`p-3.5 rounded-2xl border-2 text-left transition relative ${
                        mode === k ? 'bg-indigo-600 border-amber-400 shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}>
                      {k === 'gold' && (
                        <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                          Хит Blooket
                        </span>
                      )}
                      <div className="font-extrabold text-sm">{title}</div>
                      <div className="text-xs text-white/75 mt-0.5">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Выбор или создание своей игры */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">2. Выбери или создай свою игру</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setSourceKind('builder'); sfx('ui.click') }}
                    data-testid="lq-tab-builder"
                    className={`px-4 py-2.5 rounded-xl text-xs font-black border flex items-center gap-1.5 transition ${
                      sourceKind === 'builder' ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-300 shadow-lg' : 'bg-amber-500/15 text-amber-200 border-amber-400/30 hover:bg-amber-500/25'
                    }`}>
                    <Plus size={15} /> 🛠️ Создать свой Кахут (Конструктор)
                  </button>
                  {customPacks.length > 0 && (
                    <button type="button" onClick={() => { setSourceKind('custom'); sfx('ui.click') }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${sourceKind === 'custom' ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      ⭐ Мои игры ({customPacks.length})
                    </button>
                  )}
                  <button type="button" onClick={() => { setSourceKind('builtin'); sfx('ui.click') }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${sourceKind === 'builtin' ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    ✨ Готовые наборы ({BUILTIN_PACKS.length})
                  </button>
                  <button type="button" onClick={() => { setSourceKind('db'); sfx('ui.click') }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${sourceKind === 'db' ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    📚 Тесты из базы ({dbTests.length})
                  </button>
                </div>

                {/* ── ВКЛАДКА A: КОНСТРУКТОР СВОЕЙ ИГРЫ КАХУТ ── */}
                {sourceKind === 'builder' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border-2 border-amber-400/40 space-y-4" data-testid="lq-custom-builder">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label className="text-[11px] font-bold text-amber-300 uppercase">Название игры:</label>
                        <input
                          value={bTitle}
                          onChange={e => setBTitle(e.target.value)}
                          placeholder="Напр.: Финальная битва 8А по физике"
                          data-testid="lq-builder-title"
                          className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 focus:border-amber-400 outline-none font-extrabold text-base text-white"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 self-end">
                        <button type="button" onClick={() => setBulkOpen(v => !v)}
                          className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5">
                          <FileText size={14} /> 📋 Вставить списком
                        </button>
                      </div>
                    </div>

                    {/* Генерация с ИИ за 1 клик (понимает «сделай мне вопросы по пайтону 14 вопросов») */}
                    <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-400/30 items-center">
                      <Wand2 size={16} className="text-amber-300 shrink-0 ml-1" />
                      <input
                        value={aiTopic}
                        onChange={e => onAiTopicChange(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                        placeholder="Напиши запрос, напр.: «сделай мне вопросы по пайтону 14 вопросов»…"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs text-white outline-none"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-indigo-200 font-bold">
                        Вопросов:
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={aiCount}
                          onChange={e => setAiCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 5)))}
                          className="w-14 px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-xs text-center font-mono font-bold text-amber-300"
                        />
                      </label>
                      <button type="button" onClick={generateWithAI} disabled={aiBusy}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold disabled:opacity-50">
                        {aiBusy ? 'Генерируем…' : `✨ Сгенерировать (${aiCount} вопр.)`}
                      </button>
                    </div>

                    {/* Быстрая вставка списком */}
                    {bulkOpen && (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-white/15 space-y-2">
                        <div className="text-xs text-indigo-200">
                          Вставь вопросы (каждый с новой строки: <code className="font-mono text-amber-300">Вопрос? | Правильный ответ | Неверный 1 | Неверный 2 | Неверный 3</code>):
                        </div>
                        <textarea
                          value={bulkText}
                          onChange={e => setBulkText(e.target.value)}
                          rows={4}
                          placeholder={"Формула воды? | H2O | CO2 | NaCl | O2\nСтолица Кыргызстана? | Бишкек | Ош | Алматы | Ташкент\nЗемля круглая? | Правда | Ложь"}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-mono text-white"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={importBulkQuestions} className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black">
                            ➕ Добавить в игру
                          </button>
                          <button type="button" onClick={() => setBulkOpen(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Лента слайдов-вопросов (1, 2, 3... +) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {bQs.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setBCurIdx(idx); sfx('ui.click') }}
                          className={`px-3 py-2 rounded-xl text-xs font-black shrink-0 border flex items-center gap-1.5 transition ${
                            bCurIdx === idx ? 'bg-amber-400 text-slate-950 border-amber-300 shadow' : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <span>#{idx + 1}</span>
                          <span className="max-w-[90px] truncate font-medium opacity-80">{q.text || 'Новый'}</span>
                        </button>
                      ))}
                      <button type="button" onClick={addBuilderQ} data-testid="lq-add-q-btn"
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold shrink-0 flex items-center gap-1">
                        <Plus size={14} /> Добавить вопрос
                      </button>
                    </div>

                    {/* Редактор текущего вопроса */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-amber-300">ВОПРОС №{bCurIdx + 1} из {bQs.length}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={setQuestionAs4Options}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${curBuilderQ.options.length > 2 ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10'}`}>
                            4 варианта
                          </button>
                          <button type="button" onClick={setQuestionAsTrueFalse}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${curBuilderQ.options.length === 2 ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10'}`}>
                            Правда / Ложь
                          </button>
                          <button type="button" onClick={duplicateBuilderQ} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold" title="Дублировать вопрос">
                            Копия
                          </button>
                          <button type="button" onClick={() => removeBuilderQ(bCurIdx)} className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300" title="Удалить вопрос">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <input
                        value={curBuilderQ.text}
                        onChange={e => updateCurQ({ text: e.target.value })}
                        placeholder="Введи текст вопроса (например: Чему равен корень из 144?)…"
                        data-testid="lq-q-text"
                        className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 font-extrabold text-base outline-none"
                      />

                      {/* 4 цветные плитки ответов Kahoot */}
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {curBuilderQ.options.map((o, oIdx) => {
                          const st = OPT_STYLES[oIdx % 4]
                          return (
                            <div key={oIdx} className={`${st.bg} rounded-2xl p-3 flex items-center gap-2.5 shadow-md border-2 ${o.is_correct ? 'border-white ring-2 ring-amber-300' : 'border-transparent opacity-90'}`}>
                              <span className="w-8 h-8 rounded-lg bg-black/25 flex items-center justify-center font-black text-lg shrink-0">{st.shape}</span>
                              <input
                                value={o.text}
                                onChange={e => updateCurOpt(oIdx, { text: e.target.value })}
                                placeholder={`Вариант ${oIdx + 1}${oIdx < 2 ? ' (обязательно)' : ' (необязательно)'}`}
                                data-testid={`lq-opt-input-${oIdx}`}
                                className="flex-1 min-w-0 bg-black/20 focus:bg-black/35 text-white placeholder-white/60 px-3 py-2 rounded-xl text-sm font-bold outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => { sfx('ui.click'); updateCurOpt(oIdx, { is_correct: !o.is_correct }) }}
                                data-testid={`lq-opt-correct-${oIdx}`}
                                title={o.is_correct ? 'Правильный ответ' : 'Отметить как правильный'}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition shrink-0 ${
                                  o.is_correct ? 'bg-white text-emerald-700 shadow' : 'bg-black/25 text-white/50 hover:text-white'
                                }`}
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      <input
                        value={curBuilderQ.explanation || ''}
                        onChange={e => updateCurQ({ explanation: e.target.value })}
                        placeholder="💡 Пояснение после ответа (необязательно — покажется классу на проекторе)"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-indigo-100 outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="flex items-center gap-2 text-xs text-indigo-200 cursor-pointer">
                        <input type="checkbox" checked={alsoSaveToDb} onChange={e => setAlsoSaveToDb(e.target.checked)} className="w-4 h-4 accent-emerald-400" />
                        Также сохранить в общую базу «Тесты» школы
                      </label>
                      <button type="button" onClick={() => validateAndSaveBuilder()}
                        data-testid="lq-save-pack-btn"
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5">
                        <Save size={14} /> Сохранить в «Мои игры»
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ВКЛАДКА B: МОИ СОЗДАННЫЕ ИГРЫ ── */}
                {sourceKind === 'custom' && (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {customPacks.map(pk => (
                      <div key={pk.id} onClick={() => setSelCustomId(pk.id)}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-start justify-between gap-2 ${
                          selCustomId === pk.id ? 'bg-emerald-500/20 border-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm truncate">⭐ {pk.title}</div>
                          <div className="text-xs text-white/70 mt-0.5">{pk.questions.length} вопросов · {pk.createdAt}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => editSavedPack(pk)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs" title="Редактировать">
                            <Edit3 size={13} />
                          </button>
                          <button type="button" onClick={() => deleteSavedPack(pk.id)} className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs" title="Удалить">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── ВКЛАДКА C: ГОТОВЫЕ НАБОРЫ ── */}
                {sourceKind === 'builtin' && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {BUILTIN_PACKS.map(pk => (
                      <button key={pk.id} type="button" onClick={() => setBuiltinId(pk.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          builtinId === pk.id ? 'bg-emerald-500/20 border-emerald-400' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}>
                        <div className="font-bold text-sm">{pk.icon} {pk.title} <span className="text-xs opacity-70">({pk.questions.length} вопр.)</span></div>
                        <div className="text-xs text-white/70 mt-0.5">{pk.desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── ВКЛАДКА D: ТЕСТЫ ИЗ БАЗЫ ── */}
                {sourceKind === 'db' && (
                  dbTests.length > 0 ? (
                    <select value={selTestId} onChange={e => setSelTestId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/15 text-white text-sm font-semibold">
                      {dbTests.map((ts: any) => (
                        <option key={ts.id} value={ts.id}>{ts.title} ({ts.questions_count ?? ts.questions?.length ?? '?'} вопр.)</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-xl bg-white/5 text-xs text-slate-300">
                      Пока нет созданных тестов в базе — нажми «🛠️ Создать свой Кахут» выше!
                    </div>
                  )
                )}
              </div>

              {/* Таймер и ×2 */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-indigo-200 font-bold">⏱ На вопрос:</span>
                  {[10, 15, 20, 30].map(sec => (
                    <button key={sec} type="button" onClick={() => setTpq(sec)}
                      className={`px-3 py-1.5 rounded-lg font-bold border ${tpq === sec ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10'}`}>
                      {sec}с
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-100 cursor-pointer ml-auto">
                  <input type="checkbox" checked={doubleLast} onChange={e => setDoubleLast(e.target.checked)} className="w-4 h-4 accent-amber-400" />
                  ⚡ Финальный вопрос ×2 очков
                </label>
              </div>

              <button
                type="button"
                onClick={() => createRoom()}
                disabled={creating}
                data-testid="lq-create-btn"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 hover:brightness-110 text-slate-950 font-black text-xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap size={22} className="fill-slate-950" />
                {creating
                  ? 'Создаём комнату…'
                  : sourceKind === 'builder'
                  ? `СОХРАНИТЬ «${bTitle.slice(0, 24)}» И ЗАПУСТИТЬ LIVE (PIN)`
                  : 'СОЗДАТЬ LIVE-КОМНАТУ И ПОЛУЧИТЬ PIN'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════ 2. ЛОББИ С PIN И QR-КОДОМ ═══════════════ */}
        {phase === 'lobby' && roomInfo && (
          <div className="space-y-5" data-testid="lq-lobby">
            <div className="grid md:grid-cols-3 gap-4 items-center bg-slate-900/90 border-2 border-indigo-400/40 rounded-3xl p-5 sm:p-6 shadow-2xl">
              <div className="md:col-span-2 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {roomInfo.title} · {roomInfo.questions_count} вопросов · {mode === 'gold' ? '💰 Золотая лихорадка (Blooket)' : mode === 'classic' ? '🏆 Классика' : mode === 'race' ? '🏔️ Гонка на Ала-Тоо' : '🏰 Босс-рейд'}
                </div>
                <div className="text-sm text-indigo-200">
                  Ученики открывают на телефоне <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">{window.location.origin}/live</span> и вводят PIN:
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-4xl sm:text-6xl font-mono font-black tracking-[0.14em] text-amber-300 bg-black/40 px-5 py-3 rounded-2xl border border-amber-400/40 select-all" data-testid="lq-pin">
                    {roomInfo.pin_fmt}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={copyPin} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5">
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Копировать PIN
                    </button>
                    <a href={`/live?pin=${roomInfo.pin}`} target="_blank" rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold flex items-center gap-1.5">
                      📱 Открыть как ученик <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {(roomInfo.qr_data_url || roomInfo.join_url) && (
                <div className="flex flex-col items-center gap-1.5 bg-white p-3 rounded-2xl w-fit mx-auto shadow-xl">
                  <img
                    src={roomInfo.qr_data_url || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomInfo.join_url)}`}
                    alt="QR входа в Live-квиз"
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain"
                  />
                  <span className="text-[11px] font-bold text-slate-700">Сканируй камерой телефона</span>
                </div>
              )}
            </div>

            <div className="bg-slate-900/75 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-extrabold text-lg flex items-center gap-2">
                  <Users size={20} className="text-amber-400" /> Игроки в лобби: <span className="text-amber-300" data-testid="lq-players-cnt">{players.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => sendWs({ type: 'add_bots', count: 3 })} data-testid="lq-add-bots"
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5">
                    <Bot size={15} /> + Добавить 3 демо-бота (для теста)
                  </button>
                  <button type="button" onClick={() => sendWs({ type: 'start_question' })} disabled={players.length === 0} data-testid="lq-start-btn"
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-base flex items-center gap-2 shadow-lg">
                    <Play size={18} className="fill-slate-950" /> СТАРТ ИГРЫ!
                  </button>
                </div>
              </div>

              {players.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {players.map((p: any) => (
                    <div key={p.id} className="lq-pop-in group pl-2 pr-3.5 py-2 rounded-2xl bg-indigo-600/35 hover:bg-indigo-600/50 border border-indigo-400/40 font-bold text-sm flex items-center gap-2.5 shadow-lg transition">
                      <LiveAvatar code={p.avatar} size="md" />
                      <div className="min-w-0">
                        <div className="font-extrabold leading-tight truncate max-w-[130px]">{p.name}</div>
                        {p.is_bot ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-indigo-200 mt-0.5">БОТ</span>
                        ) : (
                          <span className="text-[10px] text-emerald-300 font-semibold">Готов ✓</span>
                        )}
                      </div>
                      <button type="button" onClick={() => sendWs({ type: 'kick', player_id: p.id })}
                        title="Удалить игрока из комнаты"
                        className="opacity-50 group-hover:opacity-100 text-xs text-rose-300 hover:text-rose-200 ml-1 px-1">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-indigo-200/70 text-sm space-y-1.5">
                  <div>Ждём подключения учеников… Сканируйте QR-код, введите PIN на <code className="font-mono">/live</code> или нажмите «+ Добавить 3 демо-бота»!</div>
                  <div className="text-xs text-amber-300/85">✨ Ученики выбирают одного из 18 милых Блуков в стиле Blooket и кидают реакции 🔥👏🚀 на экран!</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ 3. АКТИВНЫЙ ВОПРОС (ПРОЕКТОР) ═══════════════ */}
        {phase === 'question' && curQ && (
          <div className="space-y-4" data-testid="lq-question">
            <div className="bg-slate-900/85 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-indigo-600 font-black text-sm">Вопрос {curQ.q_index + 1} / {curQ.total}</span>
                  {curQ.is_double && <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs animate-pulse">⚡ ×2 ОЧКОВ!</span>}
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-indigo-200 font-semibold">
                    Бустеры учеников: ✂️ 50/50 · 🔥 ×2 · 🛡️ Щит
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 font-bold text-sm">
                    Ответили: <b className="text-amber-300">{answeredCnt.answered}</b> / {answeredCnt.total}
                  </span>
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-2xl border-2 transition ${
                    remSec <= 5 ? 'bg-rose-600 border-rose-300 animate-pulse scale-105' : 'bg-indigo-600 border-indigo-300'
                  }`}>
                    {remSec}
                  </span>
                  <button type="button" onClick={() => sendWs({ type: 'reveal' })}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold">
                    Показать ответ →
                  </button>
                </div>
              </div>
              {/* Плавная шкала таймера */}
              <div className="h-2 bg-slate-950 w-full">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    remSec <= 5 ? 'bg-gradient-to-r from-rose-500 to-amber-400' : 'bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400'
                  }`}
                  style={{ width: `${qTimePct}%` }}
                />
              </div>
            </div>

            {mode === 'boss' && (
              <div className="bg-rose-950/70 border border-rose-400/40 rounded-2xl p-3.5 flex flex-wrap items-center gap-4">
                <div className="text-4xl">🐉</div>
                <div className="flex-1 min-w-48 space-y-1">
                  <div className="flex justify-between text-xs font-extrabold">
                    <span className="text-rose-200">{boss.name}</span>
                    <span className="text-amber-300">{boss.hp} / {boss.max_hp} HP</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-black/50 overflow-hidden border border-rose-400/30">
                    <div className="h-full bg-gradient-to-r from-rose-600 to-amber-500 transition-all duration-500" style={{ width: `${bossPct}%` }} />
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/40 text-xs font-bold text-sky-200">
                  🛡️ Щит класса: {boss.shield}%
                </div>
              </div>
            )}

            {mode === 'gold' && (goldEvents.length > 0 || liveLeaderboard.length > 0) && (
              <div className="bg-amber-950/55 border border-amber-400/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3" data-testid="lq-gold-ticker">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-black shrink-0">💰 СУНДУКИ LIVE</span>
                  {goldEvents[0] ? (
                    <div className="flex items-center gap-2 min-w-0 lq-pop-in" key={goldEvents[0].id}>
                      <LiveAvatar code={goldEvents[0].player_avatar} size="xs" />
                      <span className="text-sm font-extrabold text-amber-100 truncate">{goldEvents[0].text}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-200/80">Кто первым откроет сундук с сокровищами? 🧰</span>
                  )}
                </div>
                {liveLeaderboard.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {liveLeaderboard.slice(0, 3).map((lp: any) => (
                      <span key={lp.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/35 border border-white/10 text-xs font-extrabold">
                        <span className="text-amber-300">#{lp.rank}</span>
                        <span className="max-w-[70px] truncate">{lp.name}</span>
                        <span className="font-mono text-amber-300">{lp.score}🪙</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 text-center shadow-2xl">
              <div className="text-2xl sm:text-4xl font-display font-black leading-snug">{curQ.text}</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {(curQ.options || []).map((o: any, idx: number) => {
                const st = OPT_STYLES[idx % 4]
                return (
                  <div key={idx} className={`${st.bg} rounded-2xl p-5 flex items-center gap-4 shadow-xl min-h-[84px]`}>
                    <span className="w-11 h-11 rounded-xl bg-black/25 flex items-center justify-center text-2xl font-black shrink-0">{st.shape}</span>
                    <span className="font-extrabold text-lg sm:text-xl leading-tight">{o.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════════ 4. РАЗБОР ВОПРОСА + ЛИДЕРБОРД / ГОНКА / БОСС ═══════════════ */}
        {phase === 'reveal' && revealData && curQ && (
          <div className="space-y-4" data-testid="lq-reveal">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-indigo-300 font-bold">Вопрос {revealData.q_index + 1} / {revealData.total} · Точность класса: <b className="text-emerald-300">{revealData.accuracy_pct}%</b></div>
                <h2 className="text-xl sm:text-2xl font-black mt-0.5">{curQ.text}</h2>
              </div>
              <button type="button" onClick={() => sendWs({ type: revealData.is_last ? 'finish' : 'start_question' })}
                data-testid="lq-next-btn"
                className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base flex items-center gap-2 shadow-xl">
                {revealData.is_last ? '🏆 К пьедесталу!' : 'Следующий вопрос'} <ArrowRight size={18} />
              </button>
            </div>

            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                {(curQ.options || []).map((o: any, idx: number) => {
                  const st = OPT_STYLES[idx % 4]
                  const cnt = revealData.counts?.[idx] || 0
                  const maxC = Math.max(1, ...(revealData.counts || [1]))
                  const hPct = Math.max(14, Math.round((cnt / maxC) * 100))
                  const isRight = (revealData.correct || []).includes(idx)
                  return (
                    <div key={idx} className={`rounded-2xl p-3 border-2 transition ${isRight ? 'border-emerald-400 bg-emerald-500/15 shadow-lg' : 'border-white/10 bg-white/5 opacity-65'}`}>
                      <div className="h-24 flex items-end justify-center mb-2">
                        <div className={`w-14 rounded-t-xl ${st.bg} flex items-start justify-center pt-1.5 font-black text-lg transition-all duration-500`} style={{ height: `${hPct}%` }}>
                          {cnt}
                        </div>
                      </div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>{st.shape}</span>
                        <span className="truncate flex-1">{o.text}</span>
                        {isRight && <span className="text-emerald-300 text-base">✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {revealData.explanation && (
                <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xs text-indigo-100">
                  💡 <b>Пояснение:</b> {revealData.explanation}
                </div>
              )}
            </div>

            {mode === 'race' && (
              <div className="bg-gradient-to-r from-sky-950/90 to-indigo-950/90 border border-sky-400/30 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <span>🏔️ Гонка к Пику Победы (Ала-Тоо)</span>
                  <span className="text-amber-300">🏁 Финиш</span>
                </div>
                <div className="space-y-3">
                  {(revealData.leaderboard || []).slice(0, 8).map((p: any) => {
                    const pos = Math.min(94, Math.max(5, Math.round((p.score / maxRaceScore) * 94)))
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="text-amber-300 font-black">#{p.rank}</span>
                            <span>{p.name}</span>
                            {p.streak >= 2 && <span className="text-amber-300">🔥×{p.streak}</span>}
                            {p.last_points > 0 && <span className="text-emerald-300">+{p.last_points}</span>}
                          </span>
                          <span className="text-amber-300 font-mono">{p.score} м</span>
                        </div>
                        <div className="relative h-10 rounded-full bg-slate-900/85 border border-white/10 overflow-visible px-1 flex items-center">
                          <div className="h-6 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-400 transition-all duration-700" style={{ width: `${pos}%` }} />
                          <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 z-10" style={{ left: `calc(${pos}% - 18px)` }}>
                            <LiveAvatar code={p.avatar} size="sm" streak={p.streak} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {mode === 'boss' && (
              <div className="bg-rose-950/80 border-2 border-rose-400/40 rounded-3xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-lg">🐉 {boss.name}: {boss.hp} / {boss.max_hp} HP</div>
                  <div className="flex gap-2 text-xs font-extrabold">
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/25 border border-emerald-400 text-emerald-200">
                      ⚔️ Удар класса: −{revealData.boss?.damage || 0} HP
                    </span>
                    {(revealData.boss?.boss_attack || 0) > 0 && (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-500/30 border border-rose-400 text-rose-200">
                        🔥 Контратака Босса: −{revealData.boss.boss_attack}% щита
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-5 rounded-full bg-black/50 overflow-hidden border border-rose-400/30">
                  <div className="h-full bg-gradient-to-r from-rose-600 to-amber-500 transition-all duration-700" style={{ width: `${bossPct}%` }} />
                </div>
              </div>
            )}

            {mode === 'gold' && goldEvents.length > 0 && (
              <div className="bg-gradient-to-r from-amber-950/75 via-slate-900/85 to-amber-950/75 border border-amber-400/40 rounded-3xl p-4 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Coins size={14} /> События сундуков в этом раунде
                </div>
                <div className="flex flex-wrap gap-2">
                  {goldEvents.slice(0, 4).map(ev => (
                    <div key={ev.id} className="lq-pop-in flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/35 border border-amber-300/25 text-xs font-bold text-amber-100">
                      <LiveAvatar code={ev.player_avatar} size="xs" />
                      <span>{ev.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode !== 'race' && (
              <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-2">
                <div className="font-extrabold text-sm text-amber-300 mb-2">
                  {mode === 'gold' ? '💰 Лидеры по золоту прямо сейчас' : '🏆 Топ игроков прямо сейчас'}
                </div>
                {(revealData.leaderboard || []).slice(0, 6).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                    <span className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                      p.rank === 1 ? 'bg-amber-400 text-slate-950 shadow' : p.rank === 2 ? 'bg-slate-300 text-slate-900' : p.rank === 3 ? 'bg-orange-400 text-slate-950' : 'bg-white/10'
                    }`}>{p.rank}</span>
                    <LiveAvatar code={p.avatar} size="sm" streak={p.streak} />
                    <span className="font-bold flex-1 truncate">{p.name}</span>
                    {p.streak >= 2 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold flex items-center gap-0.5"><Flame size={11} /> ×{p.streak}</span>}
                    {p.last_points !== 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                        p.last_points > 0 ? 'text-emerald-400 bg-emerald-500/15' : 'text-rose-300 bg-rose-500/15'
                      }`}>
                        {p.last_points > 0 ? `+${p.last_points}` : p.last_points}{mode === 'gold' ? ' 🪙' : ''}
                      </span>
                    )}
                    <span className="font-mono font-black text-lg text-amber-300 min-w-[82px] text-right">
                      {p.score}{mode === 'gold' ? ' 🪙' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ 5. ФИНАЛЬНЫЙ ПЬЕДЕСТАЛ + АНАЛИТИКА УЧИТЕЛЯ ═══════════════ */}
        {phase === 'podium' && podiumData && (
          <div className="space-y-6 relative" data-testid="lq-podium">
            {/* Конфетти-салют при открытии 1 места */}
            {podiumStep >= 3 && (
              <div className="pointer-events-none fixed inset-0 overflow-hidden z-30" aria-hidden="true">
                {Array.from({ length: 48 }, (_, i) => {
                  const colors = ['#facc15', '#fb7185', '#38bdf8', '#34d399', '#a78bfa', '#fb923c']
                  return (
                    <span
                      key={i}
                      className="confetti-piece"
                      style={{
                        left: `${(i * 89) % 100}%`,
                        width: 7 + (i % 6),
                        height: i % 3 === 0 ? 7 + (i % 6) : 5,
                        background: colors[i % colors.length],
                        borderRadius: i % 3 === 0 ? '50%' : '2px',
                        animationDelay: `${((i * 23) % 18) / 10}s`,
                        animationDuration: `${2.4 + ((i * 41) % 18) / 10}s`,
                      }}
                    />
                  )
                })}
              </div>
            )}

            <div className="text-center space-y-2">
              <div className="text-5xl fb-hop">{mode === 'boss' ? (podiumData.boss?.defeated ? '🎉🐉💥' : '🛡️🐉') : '🏆'}</div>
              <h2 className="text-3xl sm:text-4xl font-display font-black">
                {mode === 'boss'
                  ? (podiumData.boss?.defeated ? 'КЛАСС ПОБЕДИЛ БОССА!' : 'Бой окончен — класс выстоял!')
                  : `Итоги: ${podiumData.title}`}
              </h2>
            </div>

            {(podiumData.leaderboard || []).length > 0 && (
              <div className="grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto pt-6">
                {[1, 0, 2].map(idx => {
                  const p = podiumData.leaderboard[idx]
                  if (!p) return <div key={idx} />
                  // Поочерёдное открытие: 3 место (step >= 1) → 2 место (step >= 2) → 1 место (step >= 3)
                  const requiredStep = idx === 2 ? 1 : idx === 1 ? 2 : 3
                  const visible = podiumStep >= requiredStep
                  const hCls =
                    idx === 0
                      ? 'h-44 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-slate-950 ring-2 ring-amber-200'
                      : idx === 1
                        ? 'h-32 bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950'
                        : 'h-24 bg-gradient-to-b from-orange-400 to-orange-600 text-slate-950'
                  return (
                    <div
                      key={p.id}
                      className={`text-center space-y-2 transition-all duration-700 ${
                        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {idx === 0 && <span className="text-3xl animate-bounce">👑</span>}
                        <LiveAvatar code={p.avatar} size={idx === 0 ? 'xl' : 'lg'} streak={p.streak} />
                      </div>
                      <div className="font-extrabold text-sm sm:text-base truncate px-1">{p.name}</div>
                      <div className={`rounded-t-2xl p-3 flex flex-col items-center justify-center shadow-2xl ${hCls}`}>
                        <div className="text-2xl sm:text-3xl font-black">#{idx + 1}</div>
                        <div className="font-mono font-extrabold text-sm">{p.score}{mode === 'gold' ? ' 🪙' : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {(podiumData.mvps || []).length > 0 && (
              <div className="grid sm:grid-cols-3 gap-3">
                {podiumData.mvps.map((m: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/10 border border-white/15 text-center flex flex-col items-center gap-1.5">
                    <div className="text-xs font-extrabold text-amber-300">{m.badge}</div>
                    <LiveAvatar code={m.avatar} size="md" />
                    <div className="font-extrabold text-base">{m.name}</div>
                    <div className="text-xs text-indigo-200">{m.val}</div>
                  </div>
                ))}
              </div>
            )}

            {(podiumData.weak_questions || []).length > 0 && (
              <div className="bg-slate-900/80 border border-amber-400/30 rounded-3xl p-5 space-y-2.5">
                <div className="font-extrabold text-sm text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={16} /> Аналитика для учителя: на каких вопросах класс чаще ошибался
                </div>
                {podiumData.weak_questions.map((wq: any) => (
                  <div key={wq.q_index} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 text-sm">
                    <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                      wq.accuracy_pct < 50 ? 'bg-rose-500/30 text-rose-200' : wq.accuracy_pct < 80 ? 'bg-amber-500/30 text-amber-200' : 'bg-emerald-500/30 text-emerald-200'
                    }`}>{wq.accuracy_pct}%</span>
                    <span className="flex-1 truncate">№{wq.q_index}. {wq.text}</span>
                    <span className="text-xs text-slate-400">{wq.correct_count}/{wq.answered} верно</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button type="button" onClick={resetToSetup} className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black flex items-center gap-2">
                <RotateCcw size={18} /> Новая Live-игра
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
