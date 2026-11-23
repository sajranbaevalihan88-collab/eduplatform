import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client, { WS_BASE } from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { sfx } from '../utils/sfx'
import LiveAvatar, { AVATAR_CHARS, RARITY_META, buildAvatarCode } from '../components/LiveAvatar'
import { Zap, CheckCircle2, XCircle, Trophy, Flame, Loader2, Shuffle, Shield, Scissors, Sparkles, Coins, Gift } from 'lucide-react'

const BTN_STYLES = [
  { bg: 'bg-rose-600 hover:bg-rose-500 border-rose-400/50', shape: '▲' },
  { bg: 'bg-blue-600 hover:bg-blue-500 border-blue-400/50', shape: '◆' },
  { bg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/60', shape: '●' },
  { bg: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50', shape: '■' },
]

const REACTIONS = ['🔥', '👏', '😂', '🚀', '❤️', '⚡']

export default function LiveQuizPlay() {
  const { t } = useLang()
  const [params] = useSearchParams()
  const [pin, setPin] = useState(() => (params.get('pin') || '').replace(/\D/g, '').slice(0, 6))
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null')
      return u?.first_name || u?.username || ''
    } catch { return '' }
  })

  // Выбор персонажа в стиле Blooket («Блуки» с уровнями редкости)
  const [charId, setCharId] = useState<string>(AVATAR_CHARS[0].id)
  const avatarCode = buildAvatarCode(charId)
  const selectedBlook = AVATAR_CHARS.find(c => c.id === charId) || AVATAR_CHARS[0]
  const rarityInfo = RARITY_META[selectedBlook.rarity]

  const [joining, setJoining] = useState(false)
  const [phase, setPhase] = useState<'join' | 'lobby' | 'question' | 'chest' | 'answered' | 'reveal' | 'podium'>('join')
  const [roomMeta, setRoomMeta] = useState<any>(null)
  const [curQ, setCurQ] = useState<any>(null)
  const [remSec, setRemSec] = useState(0)
  const [pickedOpt, setPickedOpt] = useState<number | null>(null)
  const [myRes, setMyRes] = useState<any>(null)
  const [myScore, setMyScore] = useState(0)
  const [podium, setPodium] = useState<any>(null)
  const [myId, setMyId] = useState('')

  // Blooket Gold Quest — 3 сундука за правильный ответ
  const [chestSending, setChestSending] = useState(false)
  const [chestResult, setChestResult] = useState<null | {
    choice: number
    chests: Array<{ kind: string; label: string; emoji: string; tone?: string }>
    picked: { kind: string; label: string; emoji: string; tone?: string }
    delta: number
    total_score: number
    event_text: string
  }>(null)

  // Бустеры (50/50, ×2 Очки, Щит серии)
  const [powerups, setPowerups] = useState<{ '5050': boolean; double: boolean; shield: boolean }>({ '5050': true, double: true, shield: true })
  const [hiddenOpts, setHiddenOpts] = useState<number[]>([])
  const [activeDouble, setActiveDouble] = useState(false)
  const [activeShield, setActiveShield] = useState(false)
  const [reactCooldown, setReactCooldown] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const chestResultRef = useRef(chestResult)
  chestResultRef.current = chestResult
  const pendingRevealRef = useRef<any>(null)
  const chestTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    try { wsRef.current?.close() } catch {}
    if (chestTimerRef.current) window.clearTimeout(chestTimerRef.current)
  }, [])

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

  const randomizeAvatar = () => {
    setCharId(AVATAR_CHARS[Math.floor(Math.random() * AVATAR_CHARS.length)].id)
    sfx('ui.click')
  }

  const sendReaction = (emoji: string) => {
    if (reactCooldown) return
    try { wsRef.current?.send(JSON.stringify({ type: 'reaction', emoji })) } catch {}
    sfx('ui.click')
    setReactCooldown(true)
    setTimeout(() => setReactCooldown(false), 650)
  }

  const triggerPowerup = (kind: '5050' | 'double' | 'shield') => {
    if (phase !== 'question' || pickedOpt !== null || !powerups[kind]) return
    try { wsRef.current?.send(JSON.stringify({ type: 'use_powerup', kind })) } catch {}
    sfx('fb.pick')
  }

  const openGoldChest = (idx: number) => {
    if (chestSending || chestResult) return
    setChestSending(true)
    sfx('fb.pick')
    try { wsRef.current?.send(JSON.stringify({ type: 'open_chest', choice: idx })) } catch {}
  }

  const applyPendingReveal = () => {
    if (chestTimerRef.current) {
      window.clearTimeout(chestTimerRef.current)
      chestTimerRef.current = null
    }
    const rev = pendingRevealRef.current
    if (!rev) return
    pendingRevealRef.current = null
    setMyRes(rev)
    setPhase('reveal')
  }

  const joinRoom = async () => {
    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 6) { toast('Введи 6 цифр PIN-кода с экрана учителя', 'error'); return }
    if (!name.trim()) { toast('Введи своё имя', 'error'); return }
    setJoining(true)
    try {
      await client.get(`/live-quiz/check/${cleanPin}/`)
    } catch {
      toast('Комната с таким PIN не найдена', 'error')
      setJoining(false)
      return
    }

    const ws = new WebSocket(`${WS_BASE}/ws/quiz/${cleanPin}/`)
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'player_join', name: name.trim(), avatar: avatarCode }))
    }
    ws.onmessage = (ev) => {
      let m: any = null
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'joined') {
        setJoining(false)
        setMyId(m.player_id || '')
        setMyScore(0)
        setRoomMeta(m)
        if (m.powerups) setPowerups(m.powerups)
        setPhase('lobby')
        sfx('lq.join')
      } else if (m.type === 'question') {
        if (chestTimerRef.current) { window.clearTimeout(chestTimerRef.current); chestTimerRef.current = null }
        pendingRevealRef.current = null
        setCurQ(m)
        setRemSec(m.time_limit || 20)
        setPickedOpt(null)
        setMyRes(null)
        setChestResult(null)
        setChestSending(false)
        setHiddenOpts([])
        setActiveDouble(false)
        setActiveShield(false)
        setPhase('question')
        sfx('fb.plant')
      } else if (m.type === 'powerup_ok') {
        if (m.powerups) setPowerups(m.powerups)
        if (m.kind === '5050' && Array.isArray(m.hide)) {
          setHiddenOpts(m.hide)
          toast('✂️ 50/50: два неверных варианта убраны!', 'success')
        } else if (m.kind === 'double') {
          setActiveDouble(true)
          toast('🔥 Ставка ×2 активирована на этот вопрос!', 'success')
        } else if (m.kind === 'shield') {
          setActiveShield(true)
          toast('🛡️ Щит серии активирован!', 'success')
        }
      } else if (m.type === 'answer_ack') {
        if (typeof m.total_score === 'number') setMyScore(m.total_score)
        if (m.chest_ready) {
          setChestResult(null)
          setChestSending(false)
          setPhase('chest')
          sfx('ui.success')
        } else if (phaseRef.current === 'question') {
          setPhase('answered')
          sfx('fb.chip')
        }
      } else if (m.type === 'chest_result') {
        setChestSending(false)
        setChestResult(m)
        if (typeof m.total_score === 'number') setMyScore(m.total_score)
        const tone = m.picked?.tone
        if (tone === 'bad') sfx('cm.wrong')
        else if (tone === 'legend' || tone === 'epic' || tone === 'steal' || tone === 'swap') sfx('ui.win')
        else sfx('lq.reveal')
        // Если сервер уже прислал reveal пока игрок выбирал сундук — даём 2.4 сек полюбоваться и показываем итоги
        if (pendingRevealRef.current) {
          pendingRevealRef.current = {
            ...pendingRevealRef.current,
            total_score: m.total_score,
            chest_text: m.event_text,
          }
          chestTimerRef.current = window.setTimeout(() => applyPendingReveal(), 2400)
        }
      } else if (m.type === 'reveal') {
        const builtRes = {
          ...(m.me || { correct: false, points_gained: 0, total_score: 0, rank: 1, streak: 0, rank_delta: 0 }),
          explanation: m.explanation || '',
        }
        if (typeof builtRes.total_score === 'number') setMyScore(builtRes.total_score)
        if (m.me?.powerups) setPowerups(m.me.powerups)
        // Если игрок прямо сейчас ещё не открыл сундук — не прерываем экран сундуков!
        if (phaseRef.current === 'chest' && !chestResultRef.current && m.me?.pending_chest) {
          pendingRevealRef.current = builtRes
          return
        }
        setMyRes(builtRes)
        setPhase('reveal')
        sfx(m.me?.correct ? 'lq.reveal' : 'cm.wrong')
      } else if (m.type === 'podium') {
        if (chestTimerRef.current) { window.clearTimeout(chestTimerRef.current); chestTimerRef.current = null }
        pendingRevealRef.current = null
        setPodium(m)
        setPhase('podium')
        sfx('lq.podium')
      } else if (m.type === 'error') {
        setJoining(false)
        toast(m.message || 'Ошибка подключения', 'error')
      }
    }
    ws.onerror = () => { setJoining(false); toast('Не удалось подключиться к комнате', 'error') }
  }

  const sendAnswer = (optIdx: number) => {
    if (pickedOpt !== null || hiddenOpts.includes(optIdx)) return
    setPickedOpt(optIdx)
    try { wsRef.current?.send(JSON.stringify({ type: 'answer', option: optIdx })) } catch {}
  }

  const isGoldMode = roomMeta?.mode === 'gold'
  const myFinalRow = (podium?.leaderboard || []).find((r: any) => r.id === myId)

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-indigo-950 via-violet-950 to-slate-950 px-3 py-5 text-white flex flex-col items-center justify-center" data-testid="live-play-page">
      <div className="w-full max-w-md space-y-4">
        {/* 1. ВХОД ПО PIN + КОЛЛЕКЦИЯ БЛУКОВ (в стиле Blooket) */}
        {phase === 'join' && (
          <div className="bg-slate-900/90 border border-white/15 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1.5">
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="relative p-3 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 shadow-inner">
                  <LiveAvatar code={avatarCode} size="xl" className="fb-hop" />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="font-display font-black text-base text-white">{selectedBlook.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${rarityInfo.pill}`}>
                    {selectedBlook.rarity === 'legendary' ? '✨ ' : ''}{rarityInfo.label}
                  </span>
                </div>
              </div>
              <h1 className="text-2xl font-display font-black pt-0.5">{t('games_livequiz')}</h1>
              <p className="text-xs text-indigo-200">Выбери своего Блука, введи PIN-код с доски учителя и вступай в игру!</p>
            </div>

            <div className="space-y-3">
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="PIN-код (6 цифр)"
                data-testid="lqp-pin"
                className="w-full text-center text-3xl font-mono font-black tracking-[0.2em] py-3 rounded-2xl bg-slate-950 border-2 border-indigo-400/50 focus:border-amber-400 outline-none text-amber-300"
              />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                maxLength={24}
                placeholder="Твоё имя"
                data-testid="lqp-name"
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/15 focus:border-indigo-400 outline-none text-base font-bold text-center"
              />

              {/* Чистая витрина Блуков (Blooket style — единый стиль без шапок поверх рамки) */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
                  <span>✨ Выбери Блука ({AVATAR_CHARS.length}):</span>
                  <button
                    type="button"
                    onClick={randomizeAvatar}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <Shuffle size={12} /> Случайный
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {AVATAR_CHARS.map(ch => {
                    const sel = charId === ch.id
                    const rMeta = RARITY_META[ch.rarity]
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => { setCharId(ch.id); sfx('ui.click') }}
                        title={`${ch.name} (${rMeta.label})`}
                        className={`relative p-1.5 rounded-2xl flex flex-col items-center gap-0.5 transition ${
                          sel
                            ? 'ring-2 ring-amber-400 scale-105 bg-amber-400/15 shadow-lg z-10'
                            : 'bg-white/5 hover:bg-white/15 hover:scale-105'
                        }`}
                      >
                        <span
                          className="absolute top-1 right-1 w-2 h-2 rounded-full"
                          style={{ background: rMeta.color }}
                        />
                        <LiveAvatar code={buildAvatarCode(ch.id)} size="sm" />
                        <span className="text-[9px] font-bold text-indigo-100/90 truncate max-w-full leading-tight">
                          {ch.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={joinRoom}
                disabled={joining}
                data-testid="lqp-join-btn"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-black text-lg shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {joining ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} className="fill-slate-950" />} ВОЙТИ В ИГРУ
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between text-xs text-indigo-300">
              <Link to="/games" className="hover:text-white">← К играм</Link>
              <Link to="/live/host" className="hover:text-amber-300 font-bold">Я учитель (создать PIN) →</Link>
            </div>
          </div>
        )}

        {/* 2. ОЖИДАНИЕ В ЛОББИ + ЖИВЫЕ РЕАКЦИИ НА ПРОЕКТОР */}
        {phase === 'lobby' && (
          <div className="bg-slate-900/90 border border-indigo-400/40 rounded-3xl p-7 text-center space-y-4 shadow-2xl" data-testid="lqp-lobby">
            <div className="flex justify-center">
              <LiveAvatar code={avatarCode} size="xl" className="fb-hop" />
            </div>
            <div className="text-2xl font-black">{name}</div>
            <div className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-sm">
              ✓ Ты в игре! {roomMeta?.title}
            </div>
            {isGoldMode && (
              <div className="px-3.5 py-2 rounded-2xl bg-amber-400/15 border border-amber-300/40 text-amber-200 text-xs font-bold">
                💰 Режим «Золотая лихорадка»: за верный ответ открывай 1 из 3 сундуков с золотом, ×2 или кражей!
              </div>
            )}
            <p className="text-sm text-indigo-200 animate-pulse">Смотри на экран проектора — учитель скоро нажмёт «Старт» 👀</p>

            {/* Живые реакции летят прямо на экран учителя */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="text-xs text-indigo-300 font-bold">Отправь реакцию на большой экран:</div>
              <div className="flex justify-center gap-2">
                {REACTIONS.map(em => (
                  <button
                    key={em}
                    type="button"
                    disabled={reactCooldown}
                    onClick={() => sendReaction(em)}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/25 active:scale-90 text-xl flex items-center justify-center transition disabled:opacity-50"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. ВОПРОС — БУСТЕРЫ + 4 ЦВЕТНЫЕ КНОПКИ */}
        {phase === 'question' && curQ && (
          <div className="space-y-3.5" data-testid="lqp-question">
            <div className="flex items-center justify-between text-sm font-bold gap-2">
              <span className="px-3 py-1 rounded-xl bg-white/10">Вопрос {curQ.q_index + 1}/{curQ.total}</span>
              {isGoldMode && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300 text-xs font-black flex items-center gap-1">
                  <Coins size={13} /> {myScore} 🪙
                </span>
              )}
              {curQ.is_double && <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">⚡ ФИНАЛ ×2</span>}
              <span className={`px-3 py-1 rounded-xl font-mono font-black ${remSec <= 5 ? 'bg-rose-600 animate-pulse' : 'bg-indigo-600'}`}>⏱ {remSec}с</span>
            </div>

            {/* Панель тактических бустеров (50/50, ×2, Щит) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!powerups['5050'] || (curQ.options || []).length < 4}
                onClick={() => triggerPowerup('5050')}
                data-testid="lqp-pu-5050"
                className="py-2 px-2 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-200 text-xs font-extrabold flex items-center justify-center gap-1 hover:bg-sky-500/35 disabled:opacity-35 transition"
              >
                <Scissors size={13} /> 50 / 50
              </button>
              <button
                type="button"
                disabled={!powerups.double}
                onClick={() => triggerPowerup('double')}
                data-testid="lqp-pu-double"
                className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition disabled:opacity-35 ${
                  activeDouble ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg' : 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/35'
                }`}
              >
                <Sparkles size={13} /> {activeDouble ? '×2 АКТИВНО!' : isGoldMode ? '×2 Старт' : '×2 Очки'}
              </button>
              <button
                type="button"
                disabled={!powerups.shield}
                onClick={() => triggerPowerup('shield')}
                data-testid="lqp-pu-shield"
                className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition disabled:opacity-35 ${
                  activeShield ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-lg' : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/35'
                }`}
              >
                <Shield size={13} /> {activeShield ? 'ЩИТ ВКЛ!' : 'Щит серии'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white text-slate-900 font-extrabold text-center text-base sm:text-lg shadow-xl">
              {curQ.text}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(curQ.options || []).map((o: any, idx: number) => {
                const st = BTN_STYLES[idx % 4]
                const hidden = hiddenOpts.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={hidden}
                    onClick={() => sendAnswer(idx)}
                    data-testid={`lqp-opt-${idx}`}
                    className={`${st.bg} border-2 min-h-[76px] px-5 py-4 rounded-2xl font-extrabold text-lg flex items-center gap-4 text-left shadow-xl active:scale-95 transition ${
                      hidden ? 'opacity-15 line-through scale-95 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-2xl shrink-0">{st.shape}</span>
                    <span className="leading-tight">{o.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 3.5. BLOOKET GOLD QUEST — ВЫБОР 1 ИЗ 3 СУНДУКОВ! */}
        {phase === 'chest' && (
          <div className="bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-2xl" data-testid="lqp-chest">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs font-black">
                <CheckCircle2 size={14} /> ВЕРНЫЙ ОТВЕТ!
              </div>
              <h2 className="text-2xl font-display font-black text-amber-300">
                {chestResult ? 'Сундук открыт!' : '🎁 Выбери 1 из 3 сундуков!'}
              </h2>
              <p className="text-xs text-amber-100/80">
                {chestResult
                  ? chestResult.event_text
                  : 'Внутри может быть +500 🪙, ×2 Золота, Кража 25% или Обмен с лидером!'}
              </p>
            </div>

            {!chestResult ? (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {[0, 1, 2].map(idx => (
                  <button
                    key={idx}
                    type="button"
                    disabled={chestSending}
                    onClick={() => openGoldChest(idx)}
                    data-testid={`lqp-chest-${idx}`}
                    className="group relative py-5 px-2 rounded-2xl bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 border-2 border-amber-300 shadow-xl hover:scale-105 active:scale-95 transition flex flex-col items-center gap-2 disabled:opacity-60"
                  >
                    <span className="text-4xl drop-shadow group-hover:scale-110 transition-transform">🧰</span>
                    <span className="text-[11px] font-black text-amber-50 bg-black/30 px-2 py-0.5 rounded-full">
                      Сундук {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {chestResult.chests.map((c, idx) => {
                    const isPicked = idx === chestResult.choice
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition ${
                          isPicked
                            ? 'bg-amber-400/25 border-amber-300 scale-105 shadow-xl ring-2 ring-amber-300/60'
                            : 'bg-white/5 border-white/10 opacity-50 scale-95'
                        }`}
                      >
                        <span className="text-3xl leading-none">{c.emoji}</span>
                        <span className={`text-[11px] font-black leading-tight ${isPicked ? 'text-amber-200' : 'text-slate-300'}`}>
                          {c.label}
                        </span>
                        {isPicked && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-300 text-slate-950">
                            Твой!
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/40 border border-amber-400/40 font-mono font-black text-lg text-amber-300">
                  <Coins size={18} /> Баланс: {chestResult.total_score} 🪙
                </div>

                {pendingRevealRef.current ? (
                  <button
                    type="button"
                    onClick={applyPendingReveal}
                    className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
                  >
                    К результатам раунда →
                  </button>
                ) : (
                  <p className="text-xs text-indigo-200 animate-pulse">Ждём окончания раунда на проекторе…</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. ОТВЕТ ОТПРАВЛЕН */}
        {phase === 'answered' && (
          <div className="bg-slate-900/90 border border-white/15 rounded-3xl p-8 text-center space-y-3 shadow-2xl">
            <Loader2 size={44} className="animate-spin text-amber-400 mx-auto" />
            <div className="text-xl font-black">Ответ принят!</div>
            {activeDouble && <div className="text-xs font-bold text-amber-300">🔥 Ставка ×2 активна — держим кулачки!</div>}
            <p className="text-sm text-indigo-200">Ждём остальных игроков и проверяем результат…</p>
          </div>
        )}

        {/* 5. РЕЗУЛЬТАТ ВОПРОСА */}
        {phase === 'reveal' && myRes && (
          <div className={`rounded-3xl p-6 text-center space-y-3.5 shadow-2xl border-2 ${
            myRes.correct ? 'bg-emerald-600/90 border-emerald-300' : 'bg-rose-600/90 border-rose-300'
          }`} data-testid="lqp-reveal">
            {myRes.correct
              ? <CheckCircle2 size={54} className="mx-auto text-white" />
              : <XCircle size={54} className="mx-auto text-white" />}
            <div className="text-3xl font-black">{myRes.correct ? 'ВЕРНО!' : 'НЕВЕРНО'}</div>
            {myRes.points_gained !== 0 && (
              <div className="inline-block px-4 py-1.5 rounded-2xl bg-black/25 font-mono font-black text-2xl text-amber-300">
                {myRes.points_gained > 0 ? `+${myRes.points_gained}` : myRes.points_gained} {isGoldMode ? '🪙' : ''}
              </div>
            )}
            {myRes.chest_text && (
              <div className="px-3 py-1.5 rounded-xl bg-black/25 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5">
                <Gift size={14} /> {myRes.chest_text}
              </div>
            )}
            {myRes.shield_saved && (
              <div className="px-3 py-1 rounded-xl bg-black/25 text-emerald-200 font-bold text-xs">
                🛡️ Щит спас твою огненную серию!
              </div>
            )}
            {myRes.streak >= 2 && (
              <div className="flex items-center justify-center gap-1 text-amber-200 font-bold text-sm">
                <Flame size={16} /> Огненная серия ×{myRes.streak}!
              </div>
            )}
            {myRes.rank_delta > 0 && (
              <div className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs inline-block">
                🚀 Поднялся на +{myRes.rank_delta} {myRes.rank_delta === 1 ? 'место' : 'места'}!
              </div>
            )}
            {myRes.explanation && (
              <div className="p-2.5 rounded-xl bg-black/20 text-xs text-white/90 text-left">
                💡 {myRes.explanation}
              </div>
            )}
            <div className="pt-2 border-t border-white/25 text-sm font-bold">
              Твоё место: <b>#{myRes.rank}</b> · Всего: <b>{myRes.total_score}</b> {isGoldMode ? '🪙 золота' : 'очков'}
            </div>

            <div className="flex justify-center gap-1.5 pt-1">
              {REACTIONS.map(em => (
                <button
                  key={em}
                  type="button"
                  disabled={reactCooldown}
                  onClick={() => sendReaction(em)}
                  className="w-9 h-9 rounded-xl bg-black/20 hover:bg-black/35 text-base flex items-center justify-center"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. ФИНАЛ */}
        {phase === 'podium' && (
          <div className="bg-slate-900/90 border-2 border-amber-400/50 rounded-3xl p-7 text-center space-y-4 shadow-2xl" data-testid="lqp-podium">
            <Trophy size={54} className="mx-auto text-amber-400 fb-hop" />
            <h2 className="text-2xl font-black">Игра завершена!</h2>
            {myFinalRow && (
              <div className="p-4 rounded-2xl bg-white/10 space-y-2 flex flex-col items-center">
                <LiveAvatar code={myFinalRow.avatar} size="lg" streak={myFinalRow.max_streak} />
                <div className="font-extrabold text-lg">Твоё место: #{myFinalRow.rank}</div>
                <div className="font-mono font-black text-2xl text-amber-300">
                  {myFinalRow.score} {isGoldMode ? '🪙 золота' : 'очков'}
                </div>
                <div className="text-xs text-indigo-200">Верных ответов: {myFinalRow.correct}</div>
              </div>
            )}
            <button type="button" onClick={() => { try { wsRef.current?.close() } catch {}; setPhase('join'); setPin('') }}
              className="w-full py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-black">
              Войти в новую игру
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
