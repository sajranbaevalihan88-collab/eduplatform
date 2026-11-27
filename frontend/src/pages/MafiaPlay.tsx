import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client, { WS_BASE } from '../api/client'
import { toast } from '../context/UIContext'
import { sfx } from '../utils/sfx'
import LiveAvatar, { AVATAR_CHARS, buildAvatarCode } from '../components/LiveAvatar'
import {
  Moon, Eye, EyeOff, Shuffle, Loader2, CheckCircle2, Trophy,
  Vote, Search, HeartPulse, Crosshair, ArrowLeft, Clock, Users,
} from 'lucide-react'

const ROLE_CARD_STYLE: Record<string, string> = {
  mafia: 'from-rose-950 via-red-900 to-slate-950 border-rose-500/50',
  don: 'from-purple-950 via-rose-950 to-slate-950 border-purple-400/60',
  doctor: 'from-emerald-950 via-teal-900 to-slate-950 border-emerald-400/50',
  sheriff: 'from-amber-950 via-yellow-900 to-slate-950 border-amber-400/50',
  citizen: 'from-slate-900 via-indigo-950 to-slate-950 border-sky-400/40',
}

export default function MafiaPlay() {
  const [params] = useSearchParams()
  const [pin, setPin] = useState(() => (params.get('pin') || '').replace(/\D/g, '').slice(0, 6))
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null')
      return u?.first_name || u?.username || ''
    } catch { return '' }
  })
  const [charId, setCharId] = useState<string>(AVATAR_CHARS[0].id)
  const avatarCode = buildAvatarCode(charId)

  const [joining, setJoining] = useState(false)
  const [state, setState] = useState<any>(null)
  const [roleVisible, setRoleVisible] = useState(false)
  const [riddlePicked, setRiddlePicked] = useState<number | null>(null)
  const [localDiscussRem, setLocalDiscussRem] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const prevPhaseRef = useRef<string>('')

  useEffect(() => () => {
    try { wsRef.current?.close() } catch {}
  }, [])

  // Если ученик случайно обновил страницу во время партии — авто-переподключение по сохранённому токену
  useEffect(() => {
    const cleanPin = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6)
    if (cleanPin.length !== 6) return
    try {
      const savedToken = sessionStorage.getItem(`mafia-token-${cleanPin}`)
      if (savedToken) {
        connectWs(cleanPin, { token: savedToken })
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!state || state.phase !== 'day_discuss') return
    setLocalDiscussRem(state.discuss_rem || 0)
  }, [state?.phase, state?.discuss_rem, state?.discuss_paused])

  useEffect(() => {
    if (!state || state.phase !== 'day_discuss' || state.discuss_paused || localDiscussRem <= 0) return
    const id = window.setInterval(() => setLocalDiscussRem(s => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [state?.phase, state?.discuss_paused, localDiscussRem > 0])

  const connectWs = (cleanPin: string, joinPayload: Record<string, any>) => {
    try { wsRef.current?.close() } catch {}
    const ws = new WebSocket(`${WS_BASE}/ws/mafia/${cleanPin}/`)
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'player_join', ...joinPayload }))
    }
    ws.onmessage = (ev) => {
      let m: any = null
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'state') {
        setJoining(false)
        if (m.me?.token) {
          try { sessionStorage.setItem(`mafia-token-${cleanPin}`, m.me.token) } catch {}
        }
        if (m.phase !== prevPhaseRef.current) {
          if (m.phase === 'role_reveal') { setRoleVisible(false); sfx('lq.join') }
          else if (m.phase === 'night') { setRiddlePicked(null); sfx('ui.click') }
          else if (m.phase === 'finished') sfx('lq.podium')
          prevPhaseRef.current = m.phase
        }
        setState(m)
      } else if (m.type === 'toast') {
        toast(m.message, m.level === 'error' ? 'error' : 'info')
      } else if (m.type === 'room_closed') {
        toast(m.message || 'Ведущий завершил игру', 'info')
        setState(null)
      } else if (m.type === 'error') {
        setJoining(false)
        toast(m.message || 'Ошибка входа', 'error')
      }
    }
    ws.onerror = () => {
      setJoining(false)
      toast('Не удалось подключиться к комнате', 'error')
    }
  }

  const joinRoom = async () => {
    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 6) { toast('Введи 6 цифр PIN-кода с экрана учителя', 'error'); return }
    if (!name.trim()) { toast('Введи своё имя', 'error'); return }
    setJoining(true)
    try {
      await client.get(`/live-mafia/check/${cleanPin}/`)
    } catch {
      toast('Комната с таким PIN не найдена', 'error')
      setJoining(false)
      return
    }
    connectWs(cleanPin, { name: name.trim(), avatar: avatarCode })
  }

  const send = (payload: Record<string, any>) => {
    try { wsRef.current?.send(JSON.stringify(payload)) } catch {}
  }

  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  // ==================== 1. ЭКРАН ВХОДА ПО PIN ====================
  if (!state) {
    return (
      <div className="max-w-md mx-auto py-4 sm:py-8 px-2 space-y-5 page-enter">
        <Link to="/games" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft size={16} /> Ко всем играм
        </Link>

        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 border border-indigo-500/30 shadow-2xl space-y-5">
          <div className="text-center space-y-1">
            <div className="text-4xl">🕵️</div>
            <h1 className="font-display font-extrabold text-2xl">Школьная Мафия</h1>
            <p className="text-xs text-slate-300">Введи PIN-код с доски учителя, чтобы получить секретную роль</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-indigo-200 mb-1">PIN-код комнаты (6 цифр)</label>
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                className="w-full text-center font-mono font-black text-2xl tracking-[0.25em] py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-200 mb-1">Твоё имя</label>
              <input
                value={name}
                onChange={e => setName(e.target.value.slice(0, 22))}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                placeholder="Например: Айбек"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold placeholder:text-white/35 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Выбор аватара */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LiveAvatar code={avatarCode} size="md" />
                <div>
                  <div className="text-xs font-bold text-white">Твой персонаж</div>
                  <div className="text-[11px] text-slate-400">Будет виден всем игрокам</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCharId(AVATAR_CHARS[Math.floor(Math.random() * AVATAR_CHARS.length)].id)
                  sfx('ui.click')
                }}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <Shuffle size={14} className="shrink-0" /> Другой
              </button>
            </div>

            <button
              type="button"
              disabled={joining}
              onClick={joinRoom}
              className="w-full py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-display font-extrabold text-base shadow-lg flex items-center justify-center gap-2 transition"
            >
              {joining ? <Loader2 size={18} className="animate-spin" /> : <Moon size={18} />}
              {joining ? 'Подключаемся…' : 'Войти в город'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== 2. ВНУТРИ ИГРЫ ====================
  const me = state.me || {}
  const players: any[] = state.players || []
  const alivePlayers = players.filter(p => p.alive)
  const phase: string = state.phase || 'lobby'
  const isMafia = me.role === 'mafia' || me.role === 'don'
  const isDon = me.role === 'don'
  const isDoctor = me.role === 'doctor'
  const isSheriff = me.role === 'sheriff'
  const isCitizen = me.role === 'citizen'

  return (
    <div className="max-w-lg mx-auto py-3 px-2 pb-20 space-y-4 page-enter">
      {/* Шапка игрока */}
      <div className="rounded-2xl bg-slate-900 text-white border border-white/10 p-3.5 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <LiveAvatar code={me.avatar || avatarCode} size="sm" />
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{me.name}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>PIN {state.pin}</span>
              <span>•</span>
              <span className={me.alive ? 'text-emerald-400' : 'text-rose-400'}>
                {phase === 'lobby' ? 'В лобби' : me.alive ? '● В игре' : '👻 Выбыл'}
              </span>
            </div>
          </div>
        </div>

        {/* Секретная кнопка «Подсмотреть роль» — доступна в любой фазе после раздачи */}
        {phase !== 'lobby' && (
          <button
            type="button"
            onClick={() => { setRoleVisible(v => !v); sfx('ui.click') }}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            {roleVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            {roleVisible ? 'Скрыть роль' : 'Моя роль'}
          </button>
        )}
      </div>

      {/* Секретная карточка роли (скрывается от соседей по парте) */}
      {phase !== 'lobby' && (roleVisible || phase === 'role_reveal') && (
        <div className={`rounded-3xl p-5 text-white border shadow-2xl bg-gradient-to-br space-y-3 ${
          roleVisible ? (ROLE_CARD_STYLE[me.role] || ROLE_CARD_STYLE.citizen) : 'from-slate-900 to-slate-950 border-white/15'
        }`}>
          {!roleVisible ? (
            <button
              type="button"
              onClick={() => { setRoleVisible(true); sfx('fb.pick') }}
              className="w-full py-8 flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="text-4xl">🃏</div>
              <div className="font-display font-extrabold text-lg">Нажми, чтобы открыть свою роль</div>
              <div className="text-xs text-slate-400">Убедись, что соседи не смотрят в твой экран</div>
            </button>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest opacity-75">
                    {me.team === 'mafia' ? 'Команда Мафии' : 'Команда Мирных'}
                  </div>
                  <h2 className="font-display font-extrabold text-2xl mt-0.5 flex items-center gap-2">
                    <span>{me.role_emoji}</span> {me.role_title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleVisible(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/45 text-xs font-bold"
                >
                  Спрятать
                </button>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">{me.role_desc}</p>
              {isMafia && me.teammates?.length > 0 && (
                <div className="p-3 rounded-xl bg-black/30 border border-rose-400/30 text-xs space-y-1">
                  <div className="font-bold text-rose-200">Твои союзники по мафии:</div>
                  {me.teammates.map((tm: any) => (
                    <div key={tm.id} className="flex items-center justify-between">
                      <span>🕶️ <b>{tm.name}</b> ({tm.role_title})</span>
                      <span className={tm.alive ? 'text-emerald-300' : 'text-slate-400'}>{tm.alive ? 'жив' : 'выбыл'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================== ЛОББИ ==================== */}
      {phase === 'lobby' && (
        <div className="rounded-3xl bg-slate-900 text-white border border-white/10 p-5 text-center space-y-4">
          <div className="text-4xl">🏙️</div>
          <div>
            <h2 className="font-display font-extrabold text-xl">{state.title}</h2>
            <p className="text-xs text-slate-300 mt-1">Ты в игре! Ждём, пока учитель раздаст роли всем участникам…</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {players.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-xs font-semibold">
                <LiveAvatar code={p.avatar} size="xs" /> {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ==================== ВЫБЫВШИЙ НАБЛЮДАТЕЛЬ ==================== */}
      {phase !== 'lobby' && phase !== 'finished' && !me.alive && (
        <div className="rounded-2xl bg-slate-900/90 text-slate-200 border border-white/10 p-5 text-center space-y-2">
          <div className="text-3xl">👻</div>
          <div className="font-bold text-base">Ты выбыл из города</div>
          <p className="text-xs text-slate-400">
            Соблюдай тишину и не подсказывай живым игрокам — наблюдай, кто победит!
          </p>
        </div>
      )}

      {/* ==================== НОЧЬ (АКТИВНЫЕ ЖИВЫЕ ИГРОКИ) ==================== */}
      {phase === 'night' && me.alive && (
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white border border-indigo-500/35 p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">🌙 Ночь {state.round}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10">{me.role_emoji} {me.role_title}</span>
          </div>

          {/* МАФИЯ И ДОН: выбор цели */}
          {isMafia && (
            <div className="space-y-3">
              <div className="font-bold text-base flex items-center gap-2 text-rose-200">
                <Crosshair size={18} /> Выбери цель на эту ночь:
              </div>
              {me.mafia_picks?.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs space-y-0.5">
                  {me.mafia_picks.map((pk: any, i: number) => (
                    <div key={i}>🕶️ <b>{pk.by}</b> выбрал(а): <b className="text-rose-200">{pk.target_name}</b></div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {alivePlayers.map(p => {
                  const picked = me.my_night_target === p.id
                  const isMate = me.teammates?.some((t: any) => t.id === p.id) || p.id === me.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { send({ type: 'night_action', kind: 'mafia_kill', target_id: p.id }); sfx('ui.click') }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-left transition ${
                        picked
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                          : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold text-sm">
                        <LiveAvatar code={p.avatar} size="sm" />
                        {p.name} {isMate ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/30">свой</span> : null}
                      </span>
                      {picked && <CheckCircle2 size={18} />}
                    </button>
                  )
                })}
              </div>

              {/* ДОП. ДЕЙСТВИЕ ДОНА: найти Шерифа */}
              {isDon && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="font-bold text-sm text-purple-200 flex items-center gap-1.5">
                    🎩 Проверка Дона (найти Шерифа):
                  </div>
                  {me.my_don_checked ? (
                    <div className="text-xs text-emerald-300 font-semibold">✓ Проверка в эту ночь выполнена (смотри журнал ниже).</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {alivePlayers.filter(p => p.id !== me.id).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { send({ type: 'night_action', kind: 'don_check', target_id: p.id }); sfx('fb.pick') }}
                          className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-xs font-bold"
                        >
                          Проверить {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {me.don_log?.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-black/30 border border-purple-400/30 text-xs space-y-1">
                      <div className="font-bold text-purple-200">Журнал Дона:</div>
                      {me.don_log.map((l: any, idx: number) => (
                        <div key={idx}>Ночь {l.round}: <b>{l.target_name}</b> — {l.is_sheriff ? '⭐ ЭТО ШЕРИФ!' : 'не шериф'}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ДОКТОР: лечение */}
          {isDoctor && (
            <div className="space-y-3">
              <div className="font-bold text-base flex items-center gap-2 text-emerald-200">
                <HeartPulse size={18} /> Кого защитить этой ночью?
              </div>
              <div className="grid grid-cols-1 gap-2">
                {alivePlayers.map(p => {
                  const picked = me.my_night_target === p.id
                  const blocked = me.last_healed_id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={blocked}
                      onClick={() => { send({ type: 'night_action', kind: 'doctor_heal', target_id: p.id }); sfx('ui.click') }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-left transition ${
                        blocked
                          ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                          : picked
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                            : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold text-sm">
                        <LiveAvatar code={p.avatar} size="sm" />
                        {p.name}{p.id === me.id ? ' (я)' : ''}
                      </span>
                      {blocked ? <span className="text-[10px]">Лечил в прошлую ночь</span> : picked ? <CheckCircle2 size={18} /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ШЕРИФ: проверка игрока */}
          {isSheriff && (
            <div className="space-y-3">
              <div className="font-bold text-base flex items-center gap-2 text-amber-200">
                <Search size={18} /> Кого проверить на причастность к Мафии?
              </div>
              {me.my_night_target ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-sm font-bold text-amber-100">
                  ✓ Проверка выполнена! Результат записан в твой блокнот ниже.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {alivePlayers.filter(p => p.id !== me.id).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { send({ type: 'night_action', kind: 'sheriff_check', target_id: p.id }); sfx('fb.pick') }}
                      className="p-3 rounded-xl border bg-white/5 hover:bg-amber-500/20 border-white/15 hover:border-amber-400/50 flex items-center justify-between gap-2 text-left transition"
                    >
                      <span className="flex items-center gap-2.5 font-bold text-sm">
                        <LiveAvatar code={p.avatar} size="sm" />
                        {p.name}
                      </span>
                      <span className="text-xs font-bold text-amber-300">Проверить →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* МИРНЫЙ ЖИТЕЛЬ: загадка-прикрытие (чтобы ночью нажимали на экраны все) */}
          {isCitizen && (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                Город спит. Нажми любой вариант на загадке-прикрытии, чтобы никто не понял, у кого активная роль ночью:
              </div>
              {me.riddle && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                  <div className="font-bold text-sm text-indigo-100">{me.riddle.q}</div>
                  <div className="grid grid-cols-1 gap-2">
                    {me.riddle.opts.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRiddlePicked(idx)
                          send({ type: 'night_action', kind: 'decoy' })
                          sfx('ui.click')
                        }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                          riddlePicked === idx
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {(me.riddle.done || riddlePicked !== null) && (
                    <div className="text-xs text-emerald-300 font-semibold">✓ Отлично! Ждём наступления утра…</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Записная книжка Шерифа (видна Шерифу в любую фазу, чтобы не забыть проверки) */}
      {isSheriff && me.sheriff_log?.length > 0 && phase !== 'lobby' && (
        <div className="rounded-2xl bg-amber-950/80 text-amber-50 border border-amber-400/40 p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-300">📓 Блокнот Шерифа (только твой экран)</div>
          <div className="space-y-1.5">
            {me.sheriff_log.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-black/25 px-3 py-2 rounded-xl">
                <span>Ночь {item.round}: <b>{item.target_name}</b></span>
                <span className={`font-extrabold px-2 py-0.5 rounded-md ${item.is_mafia ? 'bg-rose-500/30 text-rose-200' : 'bg-emerald-500/30 text-emerald-200'}`}>
                  {item.is_mafia ? '🔴 МАФИЯ' : '🟢 МИРНЫЙ'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== УТРО / ОБСУЖДЕНИЕ / ИТОГ ДНЯ ==================== */}
      {(phase === 'morning' || phase === 'day_discuss' || phase === 'day_result') && (
        <div className="rounded-3xl bg-slate-900 text-white border border-white/10 p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
              {phase === 'morning' ? `☀️ Утро · Раунд ${state.round}` : phase === 'day_discuss' ? `💬 Обсуждение · Раунд ${state.round}` : `⚖️ Итоги дня · Раунд ${state.round}`}
            </span>
            {phase === 'day_discuss' && (
              <span className="font-mono font-extrabold text-sm bg-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Clock size={13} /> {fmtTime(localDiscussRem)}
              </span>
            )}
          </div>
          {state.last_event?.headline && (
            <div className="font-display font-bold text-lg">{state.last_event.headline}</div>
          )}
          {state.last_event?.sub && (
            <div className="text-xs text-slate-300">{state.last_event.sub}</div>
          )}
          <div className="pt-2 border-t border-white/10">
            <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Users size={13} /> Живые игроки ({alivePlayers.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {alivePlayers.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-xs font-semibold">
                  <LiveAvatar code={p.avatar} size="xs" /> {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ДНЕВНОЕ ГОЛОСОВАНИЕ ==================== */}
      {phase === 'day_vote' && me.alive && (
        <div className="rounded-3xl bg-slate-900 text-white border border-amber-400/40 p-5 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="font-display font-extrabold text-lg flex items-center gap-2 text-amber-300">
              <Vote size={19} /> Голосование дня
            </span>
            <span className="text-xs font-mono text-slate-300">
              {state.votes?.voted_count || 0}/{state.votes?.alive_count || alivePlayers.length}
            </span>
          </div>
          <p className="text-xs text-slate-300">Выбери игрока, которого считаешь Мафией (можно изменить голос до закрытия):</p>
          <div className="grid grid-cols-1 gap-2">
            {alivePlayers.filter(p => p.id !== me.id).map(p => {
              const voted = me.my_vote === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { send({ type: 'day_vote', target_id: p.id }); sfx('ui.click') }}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-left transition ${
                    voted
                      ? 'bg-amber-400 border-amber-300 text-slate-950 font-extrabold shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border-white/15 text-white font-bold'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <LiveAvatar code={p.avatar} size="sm" />
                    {p.name}
                  </span>
                  {voted && <CheckCircle2 size={18} />}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => { send({ type: 'day_vote', target_id: 'skip' }); sfx('ui.click') }}
              className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                me.my_vote === 'skip'
                  ? 'bg-slate-200 text-slate-950 border-white'
                  : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-300'
              }`}
            >
              🤝 Воздержаться (никого не изгонять)
            </button>
          </div>
        </div>
      )}

      {/* ==================== ФИНАЛ ==================== */}
      {phase === 'finished' && (
        <div className={`rounded-3xl p-5 text-white border shadow-2xl space-y-4 ${
          state.winner === 'town'
            ? 'bg-gradient-to-br from-emerald-950 to-slate-950 border-emerald-400/50'
            : 'bg-gradient-to-br from-rose-950 to-slate-950 border-rose-400/50'
        }`}>
          <div className="text-center space-y-1">
            <Trophy className="mx-auto text-amber-300" size={38} />
            <h2 className="font-display font-extrabold text-2xl">
              {state.winner === 'town' ? 'Победа Мирных жителей!' : 'Победа Мафии!'}
            </h2>
            <p className="text-xs text-slate-200">{state.winner_reason}</p>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="text-xs font-bold text-slate-300 mb-1">Все роли этой партии:</div>
            {players.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-black/25 px-3 py-2 rounded-xl">
                <span className="flex items-center gap-2 font-bold">
                  <LiveAvatar code={p.avatar} size="xs" />
                  {p.name}
                </span>
                <span className="font-bold">{p.role_emoji} {p.role_title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
