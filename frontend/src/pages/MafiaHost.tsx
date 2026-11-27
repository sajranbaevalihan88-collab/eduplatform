import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { WS_BASE } from '../api/client'
import { toast } from '../context/UIContext'
import { sfx } from '../utils/sfx'
import LiveAvatar from '../components/LiveAvatar'
import {
  Moon, Sun, Users, Copy, Check, ExternalLink, Bot, Eye, EyeOff,
  Play, RotateCcw, MessageSquare, Vote, Trophy, ShieldAlert, Clock,
  Pause, Plus, Minus, Sparkles, ArrowLeft, X, Scale, CheckCircle2,
} from 'lucide-react'

type MafiaConfig = {
  mafia_count: number
  don_count: number
  doctor_count: number
  sheriff_count: number
  citizen_count?: number
  discuss_seconds: number
  reveal_role_on_death: boolean
}

const ROLE_BADGE: Record<string, string> = {
  mafia: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  don: 'bg-purple-500/25 text-purple-200 border-purple-400/50',
  doctor: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  sheriff: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  citizen: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
}

export default function MafiaHost() {
  // Setup
  const [title, setTitle] = useState('Школьная Мафия')
  const [cfg, setCfg] = useState<MafiaConfig>({
    mafia_count: 2,
    don_count: 0,
    doctor_count: 1,
    sheriff_count: 1,
    discuss_seconds: 90,
    reveal_role_on_death: true,
  })
  const [creating, setCreating] = useState(false)

  // Live room
  const [pin, setPin] = useState('')
  const [pinFmt, setPinFmt] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [state, setState] = useState<any>(null)
  // Режим проектора по умолчанию ВКЛ: скрывает роли и ночные ходы на экране учителя,
  // чтобы класс на доске/проекторе ничего не подсмотрел! Учитель может переключить 1 кнопкой.
  const [projectorMode, setProjectorMode] = useState(true)
  const [localDiscussRem, setLocalDiscussRem] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const prevPhaseRef = useRef<string>('')

  useEffect(() => () => {
    try { wsRef.current?.close() } catch {}
  }, [])

  // Плавный локальный тик таймера обсуждения
  useEffect(() => {
    if (!state || state.phase !== 'day_discuss') return
    setLocalDiscussRem(state.discuss_rem || 0)
  }, [state?.phase, state?.discuss_rem, state?.discuss_paused])

  useEffect(() => {
    if (!state || state.phase !== 'day_discuss' || state.discuss_paused || localDiscussRem <= 0) return
    const id = window.setInterval(() => {
      setLocalDiscussRem(s => {
        const next = Math.max(0, s - 1)
        if (next > 0 && next <= 5) sfx('lq.tick')
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [state?.phase, state?.discuss_paused, localDiscussRem > 0])

  const send = (payload: Record<string, any>) => {
    try { wsRef.current?.send(JSON.stringify(payload)) } catch {}
  }

  const createRoom = async () => {
    setCreating(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await client.post('/live-mafia/create/', {
        title: title.trim() || 'Школьная Мафия',
        ...cfg,
        origin,
      })
      const d = res.data
      setPin(d.pin)
      setPinFmt(d.pin_fmt)
      setJoinUrl(d.join_url)
      setQrUrl(d.qr_data_url || '')

      const ws = new WebSocket(`${WS_BASE}/ws/mafia/${d.pin}/`)
      wsRef.current = ws
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'host_join', secret: d.host_secret }))
      }
      ws.onmessage = (ev) => {
        let m: any = null
        try { m = JSON.parse(ev.data) } catch { return }
        if (m.type === 'state') {
          if (m.phase !== prevPhaseRef.current) {
            if (m.phase === 'role_reveal' || m.phase === 'night') sfx('ui.click')
            else if (m.phase === 'morning' || m.phase === 'day_result') sfx('lq.join')
            else if (m.phase === 'finished') sfx('lq.podium')
            prevPhaseRef.current = m.phase
          }
          setState(m)
          if (m.config) setCfg(m.config)
        } else if (m.type === 'toast') {
          toast(m.message, m.level === 'error' ? 'error' : 'info')
        } else if (m.type === 'error') {
          toast(m.message || 'Ошибка соединения', 'error')
        }
      }
      ws.onerror = () => toast('Не удалось подключиться к серверу игры', 'error')
      sfx('ui.click')
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Не удалось создать комнату Мафии', 'error')
    }
    setCreating(false)
  }

  const updateLiveConfig = (patch: Partial<MafiaConfig>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    if (state?.phase === 'lobby') {
      send({ type: 'update_config', ...next })
    }
  }

  const applyAutoBalance = (count: number) => {
    const n = Math.max(4, count)
    const mafiaTotal = n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4
    const don = n >= 7 ? 1 : 0
    const mafia = Math.max(1, mafiaTotal - don)
    const doc = n >= 5 ? 1 : 0
    const sheriff = n >= 5 ? 1 : 0
    updateLiveConfig({ mafia_count: mafia, don_count: don, doctor_count: doc, sheriff_count: sheriff })
    toast(`Автобаланс для ${n} игроков применён ✓`, 'success')
  }

  const copyLink = () => {
    const full = joinUrl.startsWith('http') ? joinUrl : `${window.location.origin}${joinUrl}`
    navigator.clipboard?.writeText(full).then(() => {
      setCopied(true)
      toast('Ссылка для входа скопирована', 'success')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const closeRoom = () => {
    send({ type: 'close_room' })
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setPin('')
    setState(null)
    prevPhaseRef.current = ''
  }

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // ==================== 1. ЭКРАН НАСТРОЙКИ КОМНАТЫ ====================
  if (!pin || !state) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 page-enter pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/games" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5">
            <ArrowLeft size={16} /> Ко всем играм
          </Link>
          <Link to="/mafia" className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Войти по PIN как игрок →
          </Link>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-3">
            <Moon size={13} /> LIVE-ИГРА ДЛЯ КЛАССА · PIN + QR
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
            🕵️ Школьная Мафия Live
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Ученики заходят со своих телефонов по PIN или QR-коду (как в Kahoot), получают секретные роли,
            делают ночные ходы и голосуют днём. Учитель полностью управляет фазами и составом ролей.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 shadow-sm">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
              Название комнаты
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Мафия — 9А класс"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Выбор количества ролей */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-sm font-bold text-slate-800 dark:text-white">Состав ролей (можно менять и в лобби)</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Остальные автоматически — 🏘️ Мирные</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'mafia_count', emoji: '🕶️', label: 'Мафия', desc: 'Ночью выбирает цель', min: 1, max: 5 },
                { key: 'don_count', emoji: '🎩', label: 'Дон мафии', desc: 'Глава мафии + ищет Шерифа', min: 0, max: 1 },
                { key: 'doctor_count', emoji: '🩺', label: 'Доктор', desc: 'Ночью спасает игрока', min: 0, max: 2 },
                { key: 'sheriff_count', emoji: '⭐', label: 'Шериф', desc: 'Ночью проверяет на мафию', min: 0, max: 2 },
              ] as const).map(item => {
                const val = cfg[item.key]
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{item.emoji}</span> {item.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateLiveConfig({ [item.key]: Math.max(item.min, val - 1) } as any)}
                        disabled={val <= item.min}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold disabled:opacity-35"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center font-mono font-extrabold text-base text-slate-900 dark:text-white">{val}</span>
                      <button
                        type="button"
                        onClick={() => updateLiveConfig({ [item.key]: Math.min(item.max, val + 1) } as any)}
                        disabled={val >= item.max}
                        className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold disabled:opacity-35"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Дополнительные настройки */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Clock size={14} /> Время обсуждения
              </span>
              <select
                value={cfg.discuss_seconds}
                onChange={e => updateLiveConfig({ discuss_seconds: Number(e.target.value) })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold dark:text-white"
              >
                <option value={60}>1 мин</option>
                <option value={90}>1.5 мин</option>
                <option value={120}>2 мин</option>
                <option value={180}>3 мин</option>
              </select>
            </div>
            <label className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Раскрывать роль выбывшего</span>
              <input
                type="checkbox"
                checked={cfg.reveal_role_on_death}
                onChange={e => updateLiveConfig({ reveal_role_on_death: e.target.checked })}
                className="w-5 h-5 accent-indigo-600 rounded"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={creating}
            onClick={createRoom}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-display font-bold text-base shadow-lg flex items-center justify-center gap-2 transition"
          >
            <Play size={18} /> {creating ? 'Создаём комнату…' : 'Создать комнату и получить PIN + QR'}
          </button>
        </div>
      </div>
    )
  }

  // ==================== 2. ЖИВАЯ КОМНАТА (ЛОББИ + ХОД ИГРЫ) ====================
  const players: any[] = state.players || []
  const alivePlayers = players.filter(p => p.alive)
  const phase: string = state.phase || 'lobby'
  const isNight = phase === 'night'
  const isFinished = phase === 'finished'
  const showSecretRoles = !projectorMode || isFinished
  const np = state.night_progress || {}
  const votes = state.votes || { counts: {}, voters: {}, voted_count: 0, alive_count: alivePlayers.length }
  const totalSpecial = (cfg.mafia_count || 0) + (cfg.don_count || 0) + (cfg.doctor_count || 0) + (cfg.sheriff_count || 0)
  const citizenCount = Math.max(0, players.length - totalSpecial)
  const mafiaTotal = (cfg.mafia_count || 0) + (cfg.don_count || 0)
  const canStart = players.length >= 4 && totalSpecial <= players.length && mafiaTotal >= 1 && mafiaTotal < (players.length - mafiaTotal)

  return (
    <div className={`min-h-[calc(100vh-80px)] rounded-3xl p-4 sm:p-6 space-y-5 transition-colors duration-500 ${
      isNight
        ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white'
        : isFinished
          ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-emerald-950 text-white'
          : 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white'
    }`}>
      {/* Верхняя строка управления */}
      <div className="flex flex-wrap items-center gap-2.5 justify-between border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-xl shrink-0">
            {isNight ? '🌙' : phase === 'morning' ? '🌅' : phase === 'day_vote' ? '🗳️' : isFinished ? '🏆' : '🕵️'}
          </span>
          <div className="min-w-0">
            <div className="font-display font-bold text-lg leading-tight truncate">{state.title}</div>
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
              <span className="font-mono font-bold text-indigo-300">PIN: {pinFmt}</span>
              <span>•</span>
              <span>{phase === 'lobby' ? 'Лобби' : `Раунд ${state.round}`}</span>
              <span>•</span>
              <span>Живы: {alivePlayers.length} / {players.length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {phase !== 'lobby' && !isFinished && (
            <button
              type="button"
              onClick={() => setProjectorMode(v => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                projectorMode
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              }`}
              title="В режиме проектора тайные роли и ночные цели скрыты от класса"
            >
              {projectorMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {projectorMode ? 'Проектор: роли скрыты' : 'Пульт: роли видны'}
            </button>
          )}
          <button
            type="button"
            onClick={() => send({ type: 'restart_game' })}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5"
            title="Вернуться в лобби с теми же игроками"
          >
            <RotateCcw size={14} /> Новая партия
          </button>
          <button
            type="button"
            onClick={closeRoom}
            className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 text-xs font-bold flex items-center gap-1.5"
          >
            <X size={14} /> Закрыть
          </button>
        </div>
      </div>

      {/* ==================== ФАЗА: ЛОББИ ==================== */}
      {phase === 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* PIN + QR карточка */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center text-center gap-4">
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              Заходите на сайте в раздел «Мафия» или по QR
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-white bg-indigo-600/30 border border-indigo-400/40 px-6 py-3 rounded-2xl">
              {pinFmt}
            </div>
            {qrUrl && (
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                <img src={qrUrl} alt="QR-код для входа в Мафию" className="w-44 h-44 block" />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Скопировано' : 'Копировать ссылку'}
              </button>
              <a
                href={`/mafia?pin=${pin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} /> Окно игрока
              </a>
            </div>
          </div>

          {/* Настройка ролей + список игроков */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold flex items-center gap-2">
                  <Sparkles size={15} className="text-amber-300" />
                  Роли на эту партию
                </div>
                <button
                  type="button"
                  onClick={() => applyAutoBalance(Math.max(4, players.length))}
                  className="px-3 py-1 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-xs font-bold text-indigo-100"
                >
                  ✨ Автобаланс ({Math.max(4, players.length)} игр.)
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { key: 'mafia_count', label: '🕶️ Мафия', min: 1, max: 5 },
                  { key: 'don_count', label: '🎩 Дон', min: 0, max: 1 },
                  { key: 'doctor_count', label: '🩺 Доктор', min: 0, max: 2 },
                  { key: 'sheriff_count', label: '⭐ Шериф', min: 0, max: 2 },
                ] as const).map(it => {
                  const val = cfg[it.key]
                  return (
                    <div key={it.key} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 flex flex-col items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200">{it.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateLiveConfig({ [it.key]: Math.max(it.min, val - 1) } as any)}
                          disabled={val <= it.min}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="font-mono font-black text-base w-5 text-center">{val}</span>
                        <button
                          type="button"
                          onClick={() => updateLiveConfig({ [it.key]: Math.min(it.max, val + 1) } as any)}
                          disabled={val >= it.max}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 pt-1">
                <span>🏘️ Мирных жителей получится: <b className="text-white">{citizenCount}</b></span>
                {!canStart && (
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <ShieldAlert size={13} />
                    {players.length < 4
                      ? `Нужно ещё ${4 - players.length} игр. (минимум 4)`
                      : totalSpecial > players.length
                        ? 'Спецролей больше, чем игроков'
                        : 'Мирных должно быть больше, чем мафии'}
                  </span>
                )}
              </div>
            </div>

            {/* Список подключившихся учеников */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm flex items-center gap-2">
                  <Users size={16} className="text-indigo-300" />
                  Игроки в комнате ({players.length})
                </div>
                <button
                  type="button"
                  onClick={() => send({ type: 'add_bots', count: 5 })}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5"
                >
                  <Bot size={14} /> + Добавить ботов (тест)
                </button>
              </div>

              {players.length === 0 ? (
                <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center text-slate-400 text-sm text-center gap-1">
                  <div>Ждём учеников…</div>
                  <div className="text-xs">Покажите QR-код или PIN <b className="text-white font-mono">{pinFmt}</b> на доске</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-950/60 border border-white/10">
                      <LiveAvatar code={p.avatar} size="sm" />
                      <span className="text-xs font-bold truncate flex-1">{p.name}{p.is_bot ? ' 🤖' : ''}</span>
                      <button
                        type="button"
                        onClick={() => send({ type: 'kick_player', player_id: p.id })}
                        className="text-slate-400 hover:text-rose-400 p-1"
                        title="Удалить игрока"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={!canStart}
                onClick={() => send({ type: 'start_game' })}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-display font-extrabold text-base shadow-lg flex items-center justify-center gap-2 transition mt-auto"
              >
                <Play size={18} /> Раздать роли и начать игру
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== АКТИВНЫЕ ФАЗЫ ИГРЫ ==================== */}
      {phase !== 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Левая колонка: Главный экран фазы + Кнопки ведущего */}
          <div className="lg:col-span-7 space-y-4">
            {/* Карточка текущей фазы */}
            <div className={`rounded-2xl p-5 sm:p-6 border shadow-xl space-y-4 ${
              isNight
                ? 'bg-indigo-950/70 border-indigo-500/35'
                : isFinished
                  ? state.winner === 'town'
                    ? 'bg-emerald-950/70 border-emerald-400/40'
                    : 'bg-rose-950/70 border-rose-400/40'
                  : 'bg-white/10 border-white/15'
            }`}>
              {phase === 'role_reveal' && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">Знакомство с ролями</div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl">🃏 Роли розданы!</h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Попросите учеников посмотреть свою секретную карточку на телефоне и закрыть её.
                    Когда класс готов — запускайте первую ночь!
                  </p>
                  <button
                    type="button"
                    onClick={() => send({ type: 'start_night' })}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Moon size={18} /> Начать Ночь 1 (Город засыпает)
                  </button>
                </>
              )}

              {phase === 'night' && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">Ночь {state.round}</div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl flex items-center gap-2.5">
                    🌙 Город засыпает…
                  </h2>
                  <p className="text-slate-300 text-sm">
                    Все смотрят в свои телефоны: Мафия выбирает цель, Доктор лечит, Шериф проверяет, а Мирные отвечают на загадку-прикрытие.
                  </p>

                  {/* Статус готовности ролей (безопасно для проектора!) */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                      np.mafia_done > 0 ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/15 text-slate-300'
                    }`}>
                      🕶️ Мафия: {np.mafia_done || 0}/{np.mafia_total || 0} {np.mafia_done > 0 && <CheckCircle2 size={13} />}
                    </span>
                    {np.don_total > 0 && (
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                        np.don_done > 0 ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/15 text-slate-300'
                      }`}>
                        🎩 Дон: {np.don_done || 0}/{np.don_total}
                      </span>
                    )}
                    {np.doctor_total > 0 && (
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                        np.doctor_done >= np.doctor_total ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/15 text-slate-300'
                      }`}>
                        🩺 Доктор: {np.doctor_done || 0}/{np.doctor_total}
                      </span>
                    )}
                    {np.sheriff_total > 0 && (
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                        np.sheriff_done >= np.sheriff_total ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/15 text-slate-300'
                      }`}>
                        ⭐ Шериф: {np.sheriff_done || 0}/{np.sheriff_total}
                      </span>
                    )}
                  </div>

                  {/* Живой лог ночных ходов — ТОЛЬКО если учитель выключил режим проектора! */}
                  {showSecretRoles && state.night_actions && (
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-400/30 space-y-1.5 text-xs">
                      <div className="font-bold text-amber-300 mb-1">👁️ Секретный пульт ведущего (видно только вам):</div>
                      {state.night_actions.mafia?.map((a: any, i: number) => (
                        <div key={`m${i}`}>🕶️ <b>{a.by}</b> целится в <b className="text-rose-300">{a.target}</b></div>
                      ))}
                      {state.night_actions.don?.map((a: any, i: number) => (
                        <div key={`d${i}`}>🎩 <b>{a.by}</b> проверил <b>{a.target}</b> → {a.is_sheriff ? '⭐ ШЕРИФ' : 'не шериф'}</div>
                      ))}
                      {state.night_actions.doctor?.map((a: any, i: number) => (
                        <div key={`doc${i}`}>🩺 <b>{a.by}</b> лечит <b className="text-emerald-300">{a.target}</b></div>
                      ))}
                      {state.night_actions.sheriff?.map((a: any, i: number) => (
                        <div key={`sh${i}`}>⭐ <b>{a.by}</b> проверил <b>{a.target}</b> → {a.is_mafia ? '🔴 МАФИЯ' : '🟢 МИРНЫЙ'}</div>
                      ))}
                      {!state.night_actions.mafia?.length && !state.night_actions.doctor?.length && !state.night_actions.sheriff?.length && (
                        <div className="text-slate-400">Ожидаем ночные выборы игроков…</div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => send({ type: 'end_night' })}
                    className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg transition ${
                      np.all_key_ready
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                    }`}
                  >
                    <Sun size={18} /> {np.all_key_ready ? 'Все походили — Объявить Утро!' : 'Завершить ночь (Утро)'}
                  </button>
                </>
              )}

              {phase === 'morning' && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Утро · Раунд {state.round}</div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl">
                    {state.last_event?.kind === 'night_saved' ? '🎉 ' : state.last_event?.kind === 'night_eliminated' ? '🕯️ ' : '☀️ '}
                    {state.last_event?.headline || 'Город просыпается!'}
                  </h2>
                  {state.last_event?.sub && <p className="text-slate-300 text-sm">{state.last_event.sub}</p>}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => send({ type: 'start_discuss' })}
                      className="px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-display font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg"
                    >
                      <MessageSquare size={17} /> Начать обсуждение ({cfg.discuss_seconds} сек)
                    </button>
                    <button
                      type="button"
                      onClick={() => send({ type: 'start_vote' })}
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-sm flex items-center gap-2"
                    >
                      <Vote size={16} /> Сразу к голосованию
                    </button>
                  </div>
                </>
              )}

              {phase === 'day_discuss' && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Дневное обсуждение · Раунд {state.round}</div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-extrabold text-2xl sm:text-3xl">💬 Кто в городе Мафия?</h2>
                      <p className="text-slate-300 text-sm mt-1">Игроки обсуждают аргументы, алиби и подозрения вслух.</p>
                    </div>
                    <div className={`px-5 py-3 rounded-2xl font-mono font-black text-3xl sm:text-4xl border ${
                      localDiscussRem <= 10 ? 'bg-rose-500/25 border-rose-400/50 text-rose-200' : 'bg-white/10 border-white/15 text-white'
                    }`}>
                      {fmtTime(localDiscussRem)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => send({ type: 'discuss_timer_ctl', action: 'pause' })}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Pause size={14} /> {state.discuss_paused ? 'Продолжить' : 'Пауза'}
                    </button>
                    <button
                      type="button"
                      onClick={() => send({ type: 'discuss_timer_ctl', action: 'add30' })}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold"
                    >
                      +30 сек
                    </button>
                    <button
                      type="button"
                      onClick={() => send({ type: 'start_vote' })}
                      className="ml-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm flex items-center gap-1.5 shadow-lg"
                    >
                      <Vote size={16} /> Открыть голосование
                    </button>
                  </div>
                </>
              )}

              {phase === 'day_vote' && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Голосование · Раунд {state.round}</span>
                    <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-full">
                      Проголосовало: {votes.voted_count} / {votes.alive_count}
                    </span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl">🗳️ Кого изгнать из города?</h2>

                  {/* Живая гистограмма голосов */}
                  <div className="space-y-2">
                    {alivePlayers.map(p => {
                      const c = votes.counts?.[p.id] || 0
                      const pct = votes.alive_count > 0 ? Math.round((c / votes.alive_count) * 100) : 0
                      return (
                        <div key={p.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10">
                          <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="flex items-center gap-2">
                              <LiveAvatar code={p.avatar} size="xs" />
                              {p.name}
                            </span>
                            <span className="font-mono text-amber-300">{c} гол.</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {(votes.counts?.skip || 0) > 0 && (
                      <div className="text-xs text-slate-300 pt-1">
                        🤝 Воздержались: <b>{votes.counts.skip}</b>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => send({ type: 'end_vote' })}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Scale size={18} /> Подвести итоги голосования
                  </button>
                </>
              )}

              {phase === 'day_result' && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Итоги дня · Раунд {state.round}</div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl">
                    ⚖️ {state.last_event?.headline}
                  </h2>
                  {state.last_event?.sub && <p className="text-slate-300 text-sm">{state.last_event.sub}</p>}
                  <button
                    type="button"
                    onClick={() => send({ type: 'start_night' })}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Moon size={18} /> Начать Ночь {state.round + 1}
                  </button>
                </>
              )}

              {isFinished && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Игра завершена</div>
                  <h2 className="font-display font-extrabold text-3xl sm:text-4xl flex items-center gap-3">
                    <Trophy className="text-amber-300 shrink-0" size={34} />
                    {state.winner === 'town' ? 'Победа Мирных жителей!' : 'Победа Мафии!'}
                  </h2>
                  <p className="text-slate-200 text-sm sm:text-base">{state.winner_reason}</p>
                  <button
                    type="button"
                    onClick={() => send({ type: 'restart_game' })}
                    className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base flex items-center gap-2 shadow-lg"
                  >
                    <RotateCcw size={18} /> Сыграть ещё раз с этим классом
                  </button>
                </>
              )}
            </div>

            {/* Хронология раундов */}
            {state.history?.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Хроника города</div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {state.history.map((h: any, idx: number) => (
                    <div key={idx} className="text-xs text-slate-200 flex items-baseline gap-2">
                      <span className="font-mono font-bold text-indigo-300 shrink-0">{h.phase}:</span>
                      <span>{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка: Горожане (живые и выбывшие) */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Users size={15} className="text-indigo-300" />
                Горожане ({alivePlayers.length} в игре)
              </h3>
              {!isFinished && (
                <span className="text-[11px] text-slate-400">
                  {projectorMode ? 'Роли скрыты' : 'Роли открыты'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[520px] overflow-y-auto pr-1">
              {players.map(p => {
                const revealThis = showSecretRoles || (!p.alive && cfg.reveal_role_on_death)
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition ${
                      p.alive
                        ? 'bg-slate-950/60 border-white/10'
                        : 'bg-slate-950/30 border-white/5 opacity-55 grayscale'
                    }`}
                  >
                    <LiveAvatar code={p.avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate ${!p.alive ? 'line-through text-slate-400' : 'text-white'}`}>
                        {p.name}{p.is_bot ? ' 🤖' : ''}
                      </div>
                      {revealThis && p.role ? (
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${ROLE_BADGE[p.role] || ROLE_BADGE.citizen}`}>
                          {p.role_emoji} {p.role_title}
                        </span>
                      ) : (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {p.alive ? '● В игре' : `Выбыл (раунд ${p.eliminated_round})`}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
